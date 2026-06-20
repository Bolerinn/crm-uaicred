// ========== CRUD ==========

async function carregarDados() {
  // Tenta RPC primeiro (mais seguro), fallback para REST com service_role
  try {
    const { data, error } = await sb.rpc('get_clientes');
    if (error) throw error;
    clientes = data || [];
    clientes = [...new Map(clientes.map(c => [c.id, c])).values()]; // dedup
  } catch(e) {
    // Fallback: REST com service_role (ou RLS)
    try {
      const resp = await fetch(SUPABASE_URL + '/rest/v1/clientes?select=*&deleted_at=is.null&order=id', {
        headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + SERVICE_ROLE_KEY }
      });
      if (resp.ok) {
        clientes = await resp.json();
        clientes = [...new Map(clientes.map(c => [c.id, c])).values()];
      } else {
        // Fallback via RLS
        const { data: d2, error: e2 } = await sb.from('clientes').select('*').is('deleted_at', null).order('id');
        if (e2) throw e2;
        clientes = d2 || [];
      }
    } catch(e2) {
      mostrarToast('Erro ao carregar dados');
      return;
    }
  }

// Save old value on focus for indicação validation
document.addEventListener('focusin', function(e) {
  if (e.target.dataset && e.target.dataset.campo === 'indicacao') {
    e.target.dataset.oldValue = e.target.value;
  }
});

  popularDatalistIndicacoes();
  renderizarTudo();
}

async function adicionarCliente() {
  if (adicionando) return;
  adicionando = true;
  try {
    const { data: user } = await sb.auth.getUser();
    const insertData = {
      cliente: 'Novo Cliente',
      data: new Date().toLocaleDateString('pt-BR').slice(0,5),
      produto: 'SBPE',
      status: 'aguardando-doc',
      data_vistoria: '—',
      banco_caixa: false,
      banco_bradesco: false,
      banco_itau: false,
      banco_santander: false,
      banco_inter: false,
      created_by: user.user?.id,
      criado_por: usuarioNome || user.user?.email?.split('@')[0] || '—'
    };
    if (tabAtivo === 'analises') {
      insertData.mes_referencia = mesSelecionado;
    } else if (tabAtivo === 'andamento') {
      insertData.mes_referencia = mesSelecionado;
      insertData.convertido = true;
    }
    const { data, error } = await sb
      .from('clientes')
      .insert(insertData)
      .select()
      .single();

    if (error) { mostrarToast('Erro ao adicionar'); return; }
    mostrarToast('Processo adicionado ✏️');
    setTimeout(() => {
      const tbodyId = tabAtivo === 'andamento' ? 'tableBodyAndamento' : tabAtivo === 'emitidos' ? 'tableBodyEmitidos' : 'tableBody';
      const row = document.querySelector(`#${tbodyId} tr[data-id="${data.id}"]`);
      if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }, 300);
  } finally {
    setTimeout(() => { adicionando = false; }, 2000);
  }
}

async function excluirCliente(id) {
  if (!confirm('Excluir este cliente?')) return;
  const c = clientes.find(c => c.id === id);
  if (!c) return;
  // Emitidos: só master pode excluir
  if (c.status === 'emitido' && !isMaster()) {
    mostrarToast('Apenas o master pode excluir processos emitidos');
    return;
  }
  // Soft-delete: marca deleted_at (nunca remove do banco)
  const analista = usuarioNome || (await sb.auth.getUser()).data?.user?.email?.split('@')[0] || '—';
  try {
    const { error } = await sb.rpc('soft_delete_cliente', { p_id: id, p_analista: analista });
    if (error) throw error;
  } catch(e) {
    // Fallback
    const { error } = await sbAdmin.from('clientes').update({ deleted_at: new Date().toISOString(), deleted_by: analista }).eq('id', id);
    if (error) { mostrarToast('Erro ao excluir: ' + error.message); return; }
  }
  ultimoExcluido = { id, cliente: c.cliente, timer: setTimeout(() => { ultimoExcluido = null; }, 8000) };
  clientes = clientes.filter(c => c.id !== id);
  renderizarTabelas();
  mostrarToastDesfazer(c.cliente, id);
}

async function restaurarCliente(id) {
  if (ultimoExcluido && ultimoExcluido.timer) clearTimeout(ultimoExcluido.timer);
  try {
    const { error } = await sb.rpc('restore_cliente', { p_id: id });
    if (error) throw error;
  } catch(e) {
    const { error } = await sbAdmin.from('clientes').update({ deleted_at: null }).eq('id', id);
    if (error) { mostrarToast('Erro ao restaurar'); return; }
  }
  await carregarDados();
  mostrarToast('Processo restaurado ↩️');
}

async function atualizarCampo(id, campo, valor) {
  ultimaEdicao = { id, campo, ts: Date.now() };
  const { error } = await sb
    .from('clientes')
    .update({ [campo]: valor, ...(campo === 'status' && valor === 'emitido' ? { emitido_por: usuarioNome || '' } : {}) })
    .eq('id', id);

  if (error) { mostrarToast('Erro ao salvar: ' + error.message); return; }

  const c = clientes.find(c => c.id === id);
  if (c) { c[campo] = valor; }
  atualizarStats();

  // Status change → force re-render all tabs (cross-tab migration)
  if (campo === 'status') {
    renderizarTabelaAnalises();
    renderizarTabelaAndamento();
    renderizarTabelaEmitidos();
  }
}

async function converterCliente(id, checked) {
  // Atualiza localmente primeiro para garantir render imediato
  const c = clientes.find(c => c.id === id);
  if (c) {
    c.convertido = checked;
    if (checked) {
      c.mes_referencia = new Date().toISOString().slice(0,7);
    }
  }
  // Depois persiste no banco
  await atualizarCampo(id, 'convertido', checked);
  if (checked) {
    await atualizarCampo(id, 'mes_referencia', c.mes_referencia);
  }
  renderizarTabelaAnalises();
  renderizarTabelaAndamento();
  atualizarStats();
  if (checked) mostrarToast('Cliente convertido em processo ✅');
}

function onBancoChange(id, novoBanco) {
  const c = clientes.find(c => c.id === id);
  if (!c) return;
  atualizarCampo(id, 'banco', novoBanco);
  const { opts, validStatus } = getStatusOpts(novoBanco, c.status || '');
  if (validStatus !== (c.status || '')) {
    atualizarCampo(id, 'status', validStatus);
  }
  const statusSelect = document.querySelector(`select.status-select[data-id="${id}"]`);
  if (statusSelect) {
    statusSelect.innerHTML = opts.map(s => `<option value="${s}" ${s===validStatus?'selected':''}>${getStatusLabel(s)}</option>`).join('');
  }
}

async function toggleBanco(id, banco, checked) {
  // Atualiza local e DOM imediatamente (antes do DB)
  const c = clientes.find(c => c.id === id);
  if (c) {
    c['banco_' + banco] = checked;
  }
  atualizarResultadoRow(id);
  // Depois persiste no banco
  await atualizarCampo(id, 'banco_' + banco, checked);
}

async function toggleUrgente(id) {
  if (!isMaster()) return;
  const c = clientes.find(c => c.id === id);
  if (!c) return;
  const novo = !c.urgente;
  c.urgente = novo;
  await atualizarCampo(id, 'urgente', novo);
  mostrarToast(novo ? '🔴 Marcado como urgente' : '⚪ Urgência removida');
  if (tabAtivo === 'dashboard') renderizarDashboard();
}

function toggleFGTS(id) {
  const c = clientes.find(c => c.id === id);
  if (!c) return;
  const novo = !c.fgts;
  atualizarCampo(id, 'fgts', novo);
  const valorField = document.querySelector(`.valor-fgts-field[data-id="${id}"]`);
  if (valorField) {
    if (novo) { valorField.classList.remove('hidden'); valorField.style.display = ''; }
    else { valorField.classList.add('hidden'); valorField.style.display = 'none'; valorField.value = ''; }
  }
  if (!novo) atualizarCampo(id, 'valor_fgts', '');
}

function toggleIQ(id) {
  const c = clientes.find(c => c.id === id);
  if (!c) return;
  const novo = !c.iq;
  atualizarCampo(id, 'iq', novo);
  const dataField = document.querySelector(`.data-iq-field[data-id="${id}"]`);
  if (dataField) {
    if (novo) { dataField.classList.remove('hidden'); dataField.style.display = ''; }
    else { dataField.classList.add('hidden'); dataField.style.display = 'none'; dataField.value = ''; }
  }
  if (!novo) atualizarCampo(id, 'data_iq', '');
}

function gerarBriefing(id) {
  mostrarToast('📄 Briefing em desenvolvimento — em breve disponível');
}

async function reverterEmitido(id) {
  if (!isMaster()) { mostrarToast('Apenas Master pode reverter'); return; }
  await atualizarCampo(id, 'status', 'aguardando-doc');
  mostrarToast('↩ Processo revertido para Análises');
}

// ========== RESULTADO CYCLE (per bank) ==========

function getResultadoBadge(valor) {
  if (!valor) return '<span class="text-xs text-gray-400">—</span>';
  const style = RESULTADO_COLORS[valor] || '';
  return `<span class="text-xs font-semibold" style="${style}">${RESULTADO_LABELS[valor] || valor}</span>`;
}

function getResultadoPerBancoHtml(c) {
  const bancos = getBancosMarcados(c);
  if (bancos.length === 0) return '<span class="text-xs text-gray-400">—</span>';
  const labels = {caixa:'Caixa',bradesco:'Bradesco',itau:'Itaú',santander:'Santander',inter:'Inter'};
  return bancos.map(b => {
    const campo = 'resultado_' + b;
    const valor = c[campo] || '';
    return `<div class="flex items-center gap-1 mb-1 cursor-pointer select-none" onclick="ciclarResultadoBanco(${c.id},'${b}')" title="Clique para alternar">
      <span class="text-xs font-medium" style="min-width:70px;">${labels[b]}:</span>
      ${getResultadoBadge(valor)}
    </div>`;
  }).join('');
}

async function ciclarResultadoBanco(id, banco) {
  const c = clientes.find(c => c.id === id);
  if (!c) return;
  const campo = 'resultado_' + banco;
  const atual = c[campo] || '';
  const idx = RESULTADO_CYCLE.indexOf(atual);
  const proximo = RESULTADO_CYCLE[(idx + 1) % RESULTADO_CYCLE.length];
  c[campo] = proximo;
  // Update DOM immediately
  const td = document.getElementById('resultado-' + id);
  if (td) td.innerHTML = getResultadoPerBancoHtml(c);
  // Persist
  await atualizarCampo(id, campo, proximo);
  atualizarStats();
}

async function duplicarClientes(lista, novoMes) {
  let count = 0;
  const { data: { user } } = await sb.auth.getUser();
  const userId = user?.id;
  for (const c of lista) {
    const { id, created_at, updated_at, ...dados } = c;
    dados.created_by = userId; // garante permissão de delete
    dados.mes_referencia = novoMes;
    dados.status = dados.status || 'aguardando-doc';
    console.log('duplicando: '+c.cliente+' -> '+novoMes); const { error } = await sb.from('clientes').insert(dados);
    if (error) { mostrarToast('Erro ao duplicar: ' + error.message); return; }
    count++;
  }
  mostrarToast(`📋 ${count} processos duplicados para ${novoMes}`);
  await carregarDados();
}

async function iniciarNovaCompetenciaAnalises() {
  if (_dupLock) return;
  _dupLock = true;
  const [ano, mes] = (String(anoAtual)+'-'+String(mesAtual+1).padStart(2,'0')).split('-').map(Number);
  const dataSeguinte = new Date(ano, mes, 1);
  const mesAlvo = dataSeguinte.toISOString().slice(0,7);
  const followUps = clientes.filter(c => c.follow_up === true && c.mes_referencia === (String(anoAtual)+'-'+String(mesAtual+1).padStart(2,'0')) && c.convertido !== true && c.status !== 'emitido');
  const existentesNoAlvo = clientes.filter(c => c.mes_referencia === mesAlvo).map(c => c.cliente);
  const todos = followUps.filter(c => !existentesNoAlvo.includes(c.cliente));
  if (todos.length === 0) { mostrarToast('Nenhum follow-up para duplicar.'); _dupLock = false; return; }
  await duplicarClientes(todos, mesAlvo);
  await carregarDados();
  _dupLock = false;
}

async function iniciarNovaCompetencia() {
  if (_dupLock) return;
  _dupLock = true;
  const [ano, mes] = mesSelecionado.split('-').map(Number);
  const dataSeguinte = new Date(ano, mes, 1);
  const mesAlvo = dataSeguinte.toISOString().slice(0,7);

  const origem = clientes.filter(c => c.mes_referencia === mesSelecionado && c.status !== 'emitido' && c.convertido === true);
  const existentesNoAlvo = clientes.filter(c => c.mes_referencia === mesAlvo).map(c => c.cliente);
  const todos = origem.filter(c => !existentesNoAlvo.includes(c.cliente));
  if (todos.length === 0) {
    mostrarToast('Nenhum processo pendente para duplicar.');
    return;
  }
  await duplicarClientes(todos, mesAlvo);
  await carregarDados();
  _dupLock = false;
}

// ========== LIXEIRA ==========

async function carregarLixeira() {
  const trintaDiasAtras = new Date(Date.now() - 30*24*60*60*1000).toISOString();
  try {
    const { data, error } = await sb.rpc('get_lixeira');
    if (error) throw error;
    clientesLixeira = data || [];
  } catch(e) {
    const { data, error } = await sbAdmin
      .from('clientes')
      .select('*')
      .not('deleted_at', 'is', null)
      .gte('deleted_at', trintaDiasAtras)
      .order('deleted_at', { ascending: false });
    if (error) { mostrarToast('Erro ao carregar lixeira'); return; }
    clientesLixeira = data || [];
  }
  renderizarTabelaLixeira();
}

async function restaurarDaLixeira(id) {
  try {
    const { error } = await sb.rpc('restore_cliente', { p_id: id });
    if (error) throw error;
  } catch(e) {
    const { error } = await sbAdmin.from('clientes').update({ deleted_at: null }).eq('id', id);
    if (error) { mostrarToast('Erro ao restaurar'); return; }
  }
  clientesLixeira = clientesLixeira.filter(c => c.id !== id);
  renderizarTabelaLixeira();
  mostrarToast('Processo restaurado ↩️');
}

async function excluirPermanentemente(id) {
  if (!confirm('ATENÇÃO: Este processo será EXCLUÍDO PERMANENTEMENTE e não poderá ser recuperado. Continuar?')) return;
  try {
    const { error } = await sb.rpc('excluir_permanentemente_cliente', { p_id: id });
    if (error) throw error;
  } catch(e) {
    const resp = await fetch(SUPABASE_URL + '/rest/v1/clientes?id=eq.' + id, {
      method: 'DELETE',
      headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + SERVICE_ROLE_KEY }
    });
    if (!resp.ok) { mostrarToast('Erro ao excluir permanentemente'); return; }
  }
  clientesLixeira = clientesLixeira.filter(c => c.id !== id);
  renderizarTabelaLixeira();
  mostrarToast('Processo excluído permanentemente '+String.fromCharCode(10060));
}

// ========== REALTIME ==========

function ouvirTempoReal() {
  if (_rtChannel) return;
  _rtChannel = sb
    .channel('clientes-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, payload => {
      if (payload.eventType === 'INSERT') {
        if (deletedIds.has(payload.new.id)) return;
        clientes = [...new Map([...clientes, payload.new].map(c => [c.id, c])).values()];
        renderizarTudo();
      } else if (payload.eventType === 'UPDATE') {
        if (deletedIds.has(payload.new.id)) return;
        const local = ultimaEdicao;
        if (local && local.id === payload.new.id && (Date.now() - local.ts) < 800) {
          // Edição local — atualiza cache sem re-renderizar (preserva foco)
          const idx = clientes.findIndex(c => c.id === payload.new.id);
          if (idx >= 0) clientes[idx] = payload.new;
          return;
        }
        const idx = clientes.findIndex(c => c.id === payload.new.id);
        if (idx >= 0) clientes[idx] = payload.new;
        renderizarTudo();
      } else if (payload.eventType === 'DELETE') {
        clientes = clientes.filter(c => c.id !== payload.old.id);
        renderizarTudo();
      }
    })
    .subscribe();
}
