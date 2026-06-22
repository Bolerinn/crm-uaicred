// ============================================================
// tabelas.js — CRM Tables, Rendering, Dashboard & Metrics
// Extracted from index.html
// ============================================================

// ---------- Dependencies (globals set in index.html) ----------
// Requires: clientes[], clientesLixeira[], STATUS_OPTS, PRODUTO_OPTS
// Requires: filtroStatus, filtroProduto, filtroResultadoAnalises, filtroBancoAnalises
// Requires: filtroStatusAndamento, filtroProdutoAndamento, filtroBancoAndamento
// Requires: filtroProdutoEmitidos, filtroBancoEmitidos, filtroEmitidos
// Requires: mesSelecionado, tabAtivo, mesAtual, anoAtual
// Requires: isMaster(), getStatusOpts(), getStatusLabel(), sbAdmin, sb
// Requires: atualizarCampo(), carregarLixeira(), excluirCliente()
// Requires: converterCliente(), mostrarToast(), onBancoChange()
// Requires: validarIndicacaoInput(), capitalizarCliente(), editarCampo()
// Requires: editarCampoInput(), mascaraCPF(), mascaraData(), apenasNumeros()
// Requires: SUPABASE_URL, SERVICE_ROLE_KEY

// ==================================================================
// RESULTADO HELPERS (used by table renders)
// ==================================================================

function getResultadoBadge(valor) {
  if (!valor) return '<span class=\"text-xs text-gray-400\">—</span>';
  const style = RESULTADO_COLORS[valor] || '';
  return `<span class=\"text-xs font-semibold\" style=\"${style}\">${RESULTADO_LABELS[valor] || valor}</span>`;
}

function getBancosMarcados(c) {
  const bancos = [];
  if (c.banco_caixa) bancos.push('caixa');
  if (c.banco_bradesco) bancos.push('bradesco');
  if (c.banco_itau) bancos.push('itau');
  if (c.banco_santander) bancos.push('santander');
  if (c.banco_inter) bancos.push('inter');
  return bancos;
}

function getResultadoPerBancoHtml(c) {
  const bancos = getBancosMarcados(c);
  if (bancos.length === 0) return '<span class=\"text-xs text-gray-400\">—</span>';
  const labels = {caixa:'Caixa',bradesco:'Bradesco',itau:'Itaú',santander:'Santander',inter:'Inter'};
  return bancos.map(b => {
    const campo = 'resultado_' + b;
    const valor = c[campo] || '';
    return `<div class=\"flex items-center gap-1 mb-1 cursor-pointer select-none\" onclick=\"ciclarResultadoBanco(${c.id},'${b}')\" title=\"Clique para alternar\">
      <span class=\"text-xs font-medium\" style=\"min-width:70px;\">${labels[b]}:</span>
      ${getResultadoBadge(valor)}
    </div>`;
  }).join('');
}

function getResultadoHtml(c) {
  const bancos = getBancosMarcados(c);
  if (bancos.length === 0) return '<span class=\"text-xs text-gray-500\">—</span>';
  const labels = {caixa:'Caixa',bradesco:'Bradesco',itau:'Itaú',santander:'Santander',inter:'Inter'};
  return bancos.map(b => {
    const valor = (c['resultado_' + b] || '').replace(/\"/g,'&quot;');
    return `<div class=\"flex items-center gap-1 mb-1\"><span class=\"text-xs font-medium\" style=\"min-width:70px;\">${labels[b]}:</span><input value=\"${valor}\" onblur=\"atualizarCampo(${c.id},'resultado_${b}',this.value)\" placeholder=\"—\" class=\"text-xs bg-transparent border border-gray-600 rounded px-1 py-0.5\" style=\"color:inherit;width:100px;\"></div>`;
  }).join('');
}

function atualizarResultadoRow(id) {
  const td = document.getElementById('resultado-' + id);
  if (!td) return;
  const c = clientes.find(c => c.id === id);
  if (!c) return;
  td.innerHTML = getResultadoPerBancoHtml(c);
}

// ==================================================================
// FILTERING
// ==================================================================
function getFiltrados(sourceClientes, tab) {
  const src = sourceClientes || clientes;
  const t = tab || tabAtivo;
  const fs = t === 'andamento' ? filtroStatusAndamento : filtroStatus;
  const fp = t === 'andamento' ? filtroProdutoAndamento : filtroProduto;
  const fb = t === 'andamento' ? filtroBancoAndamento : 'todos';
  return src.filter(c => {
    let passaStatus;
    if (t === 'andamento') {
      passaStatus = c.status !== 'emitido' && c.convertido === true && (c.mes_referencia || '') === mesSelecionado;
      if (fs !== 'todos') passaStatus = passaStatus && c.status === fs;
    } else if (t === 'emitidos') {
      passaStatus = c.status === 'emitido';
      if (c.mes_referencia && c.mes_referencia !== mesSelecionado) passaStatus = false;
      if (filtroProdutoEmitidos !== 'todos') passaStatus = passaStatus && c.produto === filtroProdutoEmitidos;
      if (filtroBancoEmitidos !== 'todos') passaStatus = passaStatus && c.banco === filtroBancoEmitidos;
      else if (filtroEmitidos !== 'todos') passaStatus = passaStatus && (c.produto === filtroEmitidos || c.indicacao === filtroEmitidos);
    } else {
      // Aba Análises: excluir convertidos e clientes com mês de competência
      passaStatus = c.convertido !== true && (c.mes_referencia || '') === (String(anoAtual)+'-'+String(mesAtual+1).padStart(2,'0'));
      if (filtroProduto !== 'todos') passaStatus = passaStatus && c.produto === filtroProduto;
      if (filtroResultadoAnalises !== 'todos') passaStatus = passaStatus && c.resultado === filtroResultadoAnalises;
      if (filtroBancoAnalises !== 'todos') passaStatus = passaStatus && c['resultado_' + filtroBancoAnalises.toLowerCase()] === 'aprovado';
      if (fs !== 'todos') passaStatus = passaStatus && c.status === fs;
    }
    const passaProduto = (t === 'andamento') ? (fp === 'todos' || c.produto === fp) : true;
    const passaBanco = (t === 'andamento' && fb !== 'todos') ? (c.banco || '') === fb : true;
    return passaStatus && passaProduto && passaBanco;
  });
}

// ==================================================================
// DASHBOARD HELPERS
// ==================================================================
function parseDataBR(str) {
  if (!str || str === '—') return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, a = parseInt(parts[2]);
  if (isNaN(d) || isNaN(m) || isNaN(a)) return null;
  return new Date(a, m, d);
}

function diasDesde(data) {
  if (!data) return Infinity;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const diff = hoje - data;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function diasAte(data) {
  if (!data) return Infinity;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const diff = data - hoje;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getAlertasPrazoExcedido() {
  return clientes.filter(c => {
    if (c.status === 'emitido') return false;
    if (c.convertido !== true) return false;
    if (!c.data_vistoria || c.data_vistoria === '—') return false;
    const inicio = parseDataBR(c.data_vistoria);
    if (!inicio) return false;
    return diasDesde(inicio) > 30;
  });
}

function getAlertasUrgentes() {
  return clientes.filter(c => {
    if (c.status === 'emitido') return false;
    if (c.convertido !== true) return false;
    return c.urgente === true;
  });
}

function getAlertasMatricula() {
  return clientes.filter(c => {
    if (c.status === 'emitido') return false;
    if (c.convertido !== true) return false;
    const dataMat = parseDataBR(c.data_matricula);
    if (!dataMat) return false;
    const dias = diasDesde(dataMat);
    const banco = (c.banco || '').toLowerCase();
    if (banco === 'itau' || banco === 'itaú') return dias > 13;
    return dias > 23;
  });
}

function getAlertasIQ() {
  return clientes.filter(c => {
    if (c.status === 'emitido') return false;
    if (c.convertido !== true) return false;
    if (!c.iq) return false;
    const dataIQ = parseDataBR(c.data_iq);
    if (!dataIQ) return false;
    return diasAte(dataIQ) <= 3;
  });
}

function cardAlerta(titulo, cor, icone, items, renderItem) {
  if (items.length === 0) {
    return `<div class=\"p-5 rounded-2xl border shadow-sm\" style=\"background:var(--bg-card);border-color:var(--border);\">
      <div class=\"flex items-center gap-2 mb-3\">
        <span class=\"text-lg\">${icone}</span>
        <h3 class=\"font-semibold text-sm\" style=\"color:${cor};\">${titulo}</h3>
        <span class=\"ml-auto text-xs px-2 py-0.5 rounded-full font-medium\" style=\"background:${cor}18;color:${cor};\">0</span>
      </div>
      <p class=\"text-xs\" style=\"color:var(--text-muted);\">Nenhum alerta no momento ✅</p>
    </div>`;
  }
  return `<div class=\"p-5 rounded-2xl border shadow-sm\" style=\"background:var(--bg-card);border-color:${cor}40;\">
    <div class=\"flex items-center gap-2 mb-3\">
      <span class=\"text-lg\">${icone}</span>
      <h3 class=\"font-semibold text-sm\" style=\"color:${cor};\">${titulo}</h3>
      <span class=\"ml-auto text-xs px-2 py-0.5 rounded-full font-bold\" style=\"background:${cor};color:#fff;\">${items.length}</span>
    </div>
    <div class=\"space-y-2\">
      ${items.map(c => renderItem(c, cor)).join('')}
    </div>
  </div>`;
}

function renderizarDashboard() {
  const container = document.getElementById('dashboardContent');
  if (!container) return;

  const prazoExcedido = getAlertasPrazoExcedido();
  const urgentes = getAlertasUrgentes();
  const matriculas = getAlertasMatricula();
  const iqs = getAlertasIQ();

  const total = prazoExcedido.length + urgentes.length + matriculas.length + iqs.length;

  const renderCliente = (c, cor) => {
    const banco = c.banco || '—';
    const status = (STATUS_OPTS.find(s => s.id === c.status) || {}).label || c.status || '—';
    const diasInicio = c.data_vistoria ? diasDesde(parseDataBR(c.data_vistoria)) : '?';
    return `<div class=\"flex items-center justify-between p-2 rounded-lg text-xs\" style=\"background:var(--bg-body);\">
      <div>
        <span class=\"font-medium\" style=\"color:var(--text);\">${c.cliente || 'Sem nome'}</span>
        <span class=\"ml-2\" style=\"color:var(--text-muted);\">${banco}</span>
        <span class=\"ml-2 px-1.5 py-0.5 rounded text-xs font-medium\" style=\"background:${cor}18;color:${cor};\">${status}</span>
      </div>
    </div>`;
  };

  const renderUrgente = (c, cor) => {
    const banco = c.banco || '—';
    const status = (STATUS_OPTS.find(s => s.id === c.status) || {}).label || c.status || '—';
    return `<div class=\"flex items-center justify-between p-2 rounded-lg text-xs\" style=\"background:var(--bg-body);border-left:3px solid ${cor};\">
      <div>
        <span class=\"font-medium\" style=\"color:var(--text);\">${c.cliente || 'Sem nome'}</span>
        <span class=\"ml-2\" style=\"color:var(--text-muted);\">${banco}</span>
        <span class=\"ml-2 px-1.5 py-0.5 rounded text-xs font-medium\" style=\"background:${cor}18;color:${cor};\">${status}</span>
      </div>
      <span style=\"color:${cor};font-weight:600;\">🔴 URGENTE</span>
    </div>`;
  };

  const renderMatricula = (c, cor) => {
    const banco = c.banco || '—';
    const dias = diasDesde(parseDataBR(c.data_matricula));
    const limite = (banco || '').toLowerCase() === 'itau' || (banco || '').toLowerCase() === 'itaú' ? 13 : 23;
    return `<div class=\"flex items-center justify-between p-2 rounded-lg text-xs\" style=\"background:var(--bg-body);border-left:3px solid ${cor};\">
      <div>
        <span class=\"font-medium\" style=\"color:var(--text);\">${c.cliente || 'Sem nome'}</span>
        <span class=\"ml-2\" style=\"color:var(--text-muted);\">${banco}</span>
        <span class=\"ml-2\" style=\"color:var(--text-muted);\">Matrícula: ${c.data_matricula || '—'}</span>
      </div>
      <span style=\"color:${cor};font-weight:600;\">${dias}d</span>
    </div>`;
  };

  const renderIQ = (c, cor) => {
    const banco = c.banco || '—';
    const dias = diasAte(parseDataBR(c.data_iq));
    const diasAbs = Math.abs(dias);
    const label = dias <= 0 ? `${diasAbs}d de atraso` : dias === 1 ? '1d restante' : `${dias}d restantes`;
    return `<div class=\"flex items-center justify-between p-2 rounded-lg text-xs\" style=\"background:var(--bg-body);border-left:3px solid ${cor};\">
      <div>
        <span class=\"font-medium\" style=\"color:var(--text);\">${c.cliente || 'Sem nome'}</span>
        <span class=\"ml-2\" style=\"color:var(--text-muted);\">${banco}</span>
        <span class=\"ml-2\" style=\"color:var(--text-muted);\">IQ: ${c.data_iq || '—'}</span>
      </div>
      <span style=\"color:${cor};font-weight:600;\">${label}</span>
    </div>`;
  };

  container.innerHTML = `
    <div class=\"mb-4 flex items-center gap-3\">
      <div class=\"text-sm font-semibold\" style=\"color:var(--text);\">Total de alertas: <span style=\"color:${total > 0 ? '#dc2626' : '#059669'};\">${total}</span></div>
      <button onclick=\"renderizarDashboard()\" class=\"text-xs px-3 py-1 rounded-lg border transition\" style=\"border-color:var(--border);color:var(--text-secondary);background:var(--bg-card);\"><svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"23 4 23 10 17 10\"/><polyline points=\"1 20 1 14 7 14\"/><path d=\"M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15\"/></svg> Atualizar</button>
    </div>
    <div class=\"grid gap-4\" style=\"grid-template-columns:repeat(auto-fit,minmax(380px,1fr));\">
      ${cardAlerta('Prazo Excedido (+30d)', '#f97316', '<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><polyline points=\"12 6 12 12 16 14\"/></svg>', prazoExcedido, renderCliente)}
      ${cardAlerta('Urgência', '#dc2626', '<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"12\"/><line x1=\"12\" y1=\"16\" x2=\"12.01\" y2=\"16\"/></svg>', urgentes, renderUrgente)}
      ${cardAlerta('Matrícula Vencendo', '#d97706', '<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/><rect x=\"8\" y=\"2\" width=\"8\" height=\"4\" rx=\"1\" ry=\"1\"/></svg>', matriculas, renderMatricula)}
      ${cardAlerta('Vencimento IQ', '#7c3aed', '<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 2a7 7 0 0 0-7 7c0 2.38 2 3.5 2 5.5s-1 4-1 4h12s-1-2-1-4 2-3.12 2-5.5a7 7 0 0 0-7-7z\"/><path d=\"M9 20h6\"/><path d=\"M12 17v3\"/></svg>', iqs, renderIQ)}
    </div>
  `;
}

// ==================================================================
// EXPAND / TOGGLE
// ==================================================================
function toggleExpand(id) {
  const expandedRow = document.querySelector(`tr.expanded-row[data-parent="${id}"]`);
  const mainRow = document.querySelector(`tr.main-row[data-id="${id}"]`);
  if (!expandedRow) return;
  const isHidden = expandedRow.classList.contains('hidden');
  if (isHidden) {
    expandedRow.classList.remove('hidden');
    if (mainRow) mainRow.classList.add('expanded');
  } else {
    expandedRow.classList.add('hidden');
    if (mainRow) mainRow.classList.remove('expanded');
  }
}

// ==================================================================
// TAB SWITCHING
// ==================================================================
function mudarTab(tab) {
  tabAtivo = tab;

  // Update nav active states
  document.querySelectorAll('#sidebar nav a').forEach(a => a.classList.remove('active'));
  const navLink = document.querySelector(`#sidebar nav a[data-tab="${tab}"]`);
  if (navLink) navLink.classList.add('active');

  // Show/hide tab panels
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`tab-${tab}`);
  if (panel) panel.classList.add('active');

  // Pre-filter for specific tabs
  if (tab === 'andamento') {
    filtroStatus = 'em-andamento';
  } else if (tab === 'emitidos') {
    filtroStatus = 'emitido';
  } else if (tab === 'lixeira') {
    carregarLixeira();
    return;
  } else if (tab === 'dashboard') {
    renderizarDashboard();
    return;
  } else {
    filtroStatus = 'todos';
  }

  renderizarTudo();
}

// ==================================================================
// STATS
// ==================================================================
function atualizarStats() {
  const container = document.getElementById('statsBar');
  if (!container) return;
  const filtrados = getFiltrados(null, 'analises');
  const count = filtrados.length;
  const master = isMaster();
  
  let html = `<div class=\"stat-card\"><div class=\"stat-label\">Processos</div><div class=\"stat-value\" style=\"color:var(--accent);\">${count}</div></div>`;
  
  if (master) {
    // Contagem por banco
    const bancos = ['Caixa','Bradesco','Itaú','Santander','Inter'];
    const bancosCols = ['banco_caixa','banco_bradesco','banco_itau','banco_santander','banco_inter'];
    bancos.forEach((nome, i) => {
      const n = filtrados.filter(c => c[bancosCols[i]]).length;
      html += `<div class=\"stat-card\"><div class=\"stat-label\">${nome}</div><div class=\"stat-value\" style=\"color:var(--accent);\">${n}</div></div>`;
    });
    
    // Total financiamento
    const totalFinanc = filtrados.reduce((s, c) => s + (parseInt((c.valor_financiado || '').replace(/\\D/g, '')) || 0), 0);
    html += `<div class=\"stat-card\"><div class=\"stat-label\">Total Financ.</div><div class=\"stat-value\" style=\"color:#059669;\">R$ ${totalFinanc.toLocaleString('pt-BR')}</div></div>`;
    
    // Aprovações (pelo menos um banco aprovado)
    const resultadoCols = ['resultado_caixa','resultado_bradesco','resultado_itau','resultado_santander','resultado_inter'];
    const aprovados = filtrados.filter(c => resultadoCols.some(col => c[col] === 'aprovado')).length;
    html += `<div class=\"stat-card\"><div class=\"stat-label\">Aprovações</div><div class=\"stat-value\" style=\"color:#059669;\">${aprovados}</div></div>`;
  }
  
  container.innerHTML = html;
}

function atualizarStatsAndamento() {
  const container = document.getElementById('statsBarAndamento');
  if (!container) return;
  const filtrados = getFiltrados(null, 'andamento');
  const count = filtrados.length;
  const master = isMaster();
  
  let html = `<div class=\"stat-card\"><div class=\"stat-label\">Processos</div><div class=\"stat-value\" style=\"color:var(--accent);\">${count}</div></div>`;
  
  if (master) {
    // Por banco (usa campo 'banco' único)
    const bancos = ['Caixa','Bradesco','Itaú','Santander','Inter'];
    bancos.forEach(nome => {
      const n = filtrados.filter(c => c.banco === nome).length;
      html += `<div class=\"stat-card\"><div class=\"stat-label\">${nome}</div><div class=\"stat-value\" style=\"color:var(--accent);\">${n}</div></div>`;
    });
    // Total financiamento
    const totalFinanc = filtrados.reduce((s, c) => s + (parseInt((c.valor_financiado || '').replace(/\\D/g, '')) || 0), 0);
    html += `<div class=\"stat-card\"><div class=\"stat-label\">Total Financ.</div><div class=\"stat-value\" style=\"color:#059669;\">R$ ${totalFinanc.toLocaleString('pt-BR')}</div></div>`;
    // Por produto
    PRODUTO_OPTS.forEach(p => {
      const n = filtrados.filter(c => c.produto === p).length;
      if (n > 0) html += `<div class=\"stat-card\"><div class=\"stat-label\">${p}</div><div class=\"stat-value\" style=\"color:var(--accent);\">${n}</div></div>`;
    });
  }
  
  container.innerHTML = html;
}

function atualizarStatsEmitidos() {
  const container = document.getElementById('statsBarEmitidos');
  if (!container) return;
  const filtrados = getFiltrados(null, 'emitidos');
  const count = filtrados.length;
  const master = isMaster();
  
  let html = `<div class=\"stat-card\"><div class=\"stat-label\">Emitidos</div><div class=\"stat-value\" style=\"color:var(--accent);\">${count}</div></div>`;
  
  if (master) {
    // Por banco
    const bancos = ['Caixa','Bradesco','Itaú','Santander','Inter'];
    bancos.forEach(nome => {
      const n = filtrados.filter(c => c.banco === nome).length;
      html += `<div class=\"stat-card\"><div class=\"stat-label\">${nome}</div><div class=\"stat-value\" style=\"color:var(--accent);\">${n}</div></div>`;
    });
    // Total financiamento
    const totalFinanc = filtrados.reduce((s, c) => s + (parseInt((c.valor_financiado || '').replace(/\\D/g, '')) || 0), 0);
    html += `<div class=\"stat-card\"><div class=\"stat-label\">Total Financ.</div><div class=\"stat-value\" style=\"color:#059669;\">R$ ${totalFinanc.toLocaleString('pt-BR')}</div></div>`;
    // Por produto
    PRODUTO_OPTS.forEach(p => {
      const n = filtrados.filter(c => c.produto === p).length;
      if (n > 0) html += `<div class=\"stat-card\"><div class=\"stat-label\">${p}</div><div class=\"stat-value\" style=\"color:var(--accent);\">${n}</div></div>`;
    });
  }
  
  container.innerHTML = html;
}

// ==================================================================
// MES SELECTORS
// ==================================================================
function renderizarMesSelectorAnalises() {
  const container = document.getElementById('mesSelectorAnalises');
  if (!container) return;
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const nomeMes = meses[mesAtual];
  const hojeMes = new Date().getMonth();
  const hojeAno = new Date().getFullYear();
  const ehHoje = mesAtual === hojeMes && anoAtual === hojeAno;
  container.innerHTML = `
    <button onclick=\"mudarMesAnalises(-1)\" class=\"text-sm px-2 py-1 rounded-lg transition\" style=\"color:var(--text-muted);border:1px solid var(--border);background:var(--bg-card);\" title=\"Mês anterior\">◀</button>
    <span class=\"text-sm font-semibold px-2\" style=\"color:var(--text);min-width:100px;text-align:center;\">${nomeMes} ${anoAtual}</span>
    <button onclick=\"mudarMesAnalises(1)\" class=\"text-sm px-2 py-1 rounded-lg transition\" style=\"color:var(--text-muted);border:1px solid var(--border);background:var(--bg-card);\" title=\"Próximo mês\">▶</button>
    <button onclick=\"iniciarNovaCompetenciaAnalises()\" class=\"text-xs px-3 py-1.5 rounded-lg font-medium transition\" style=\"background:var(--accent);color:#fff;border:none;\" title=\"Avançar follow-ups para o próximo mês\">📋 ${ehHoje ? '✓ Mês Atual' : 'Ir para ' + nomeMes}</button>
  `;
}

function renderizarMesSelector() {
  const container = document.getElementById('mesSelector');
  if (!container) return;
  const [ano, mes] = mesSelecionado.split('-');
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const nomeMes = meses[parseInt(mes)-1];
  const hoje = new Date().toISOString().slice(0,7);
  container.innerHTML = `
    <button onclick=\"mudarMes(-1)\" class=\"text-sm px-2 py-1 rounded-lg transition\" style=\"color:var(--text-muted);border:1px solid var(--border);background:var(--bg-card);\" title=\"Mês anterior\">◀</button>
    <span class=\"text-sm font-semibold px-2\" style=\"color:var(--text);min-width:100px;text-align:center;\">${nomeMes} ${ano}</span>
    <button onclick=\"mudarMes(1)\" class=\"text-sm px-2 py-1 rounded-lg transition\" style=\"color:var(--text-muted);border:1px solid var(--border);background:var(--bg-card);\" title=\"Próximo mês\">▶</button>
    <button onclick=\"iniciarNovaCompetencia()\" class=\"text-xs px-3 py-1.5 rounded-lg font-medium transition\" style=\"background:var(--accent);color:#fff;border:none;\" title=\"Iniciar competência do mês corrente duplicando processos não emitidos\">📋 ${mesSelecionado === hoje ? '✓ Mês Atual' : 'Iniciar ' + nomeMes}</button>
  `;
}

function renderizarMesSelectorEmitidos() {
  const container = document.getElementById('mesSelectorEmitidos');
  if (!container) return;
  const [ano, mes] = mesSelecionado.split('-');
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const nomeMes = meses[parseInt(mes)-1];
  container.innerHTML = `
    <button onclick=\"mudarMes(-1)\" class=\"text-sm px-2 py-1 rounded-lg transition\" style=\"color:var(--text-muted);border:1px solid var(--border);background:var(--bg-card);\" title=\"Mês anterior\">◀</button>
    <span class=\"text-sm font-semibold px-2\" style=\"color:var(--text);min-width:100px;text-align:center;\">${nomeMes} ${ano}</span>
    <button onclick=\"mudarMes(1)\" class=\"text-sm px-2 py-1 rounded-lg transition\" style=\"color:var(--text-muted);border:1px solid var(--border);background:var(--bg-card);\" title=\"Próximo mês\">▶</button>
  `;
}

// ==================================================================
// FILTERS RENDER
// ==================================================================
function renderizarFiltros() {
  // Status filters (only if the container exists)
  const statusContainer = document.getElementById('filtrosStatus');
  if (statusContainer) {
    const statuses = [
      { id: 'todos', label: 'Todos' },
      ...STATUS_OPTS.filter(s => s.id !== 'emitido')
    ];
    statusContainer.innerHTML = `
      <span class=\"text-xs font-semibold uppercase tracking-wider text-gray-500\">Status:</span>
      ${statuses.map(s => `
        <button class=\"filter-btn filter-btn-status ${filtroStatus===s.id?'active':''}\" onclick=\"filtrarStatus('${s.id}', this)\">${s.label}</button>
      `).join('')}
    `;
  }

  // Product filters
  const prodContainer = document.getElementById('filtrosProduto');
  if (prodContainer) {
    prodContainer.innerHTML = `
    <span class=\"text-xs font-semibold uppercase tracking-wider text-gray-500\">Produto:</span>
    <button class=\"filter-btn filter-btn-produto ${filtroProduto==='todos'?'active':''}\" onclick=\"filtrarProduto('todos', this)\">Todos</button>
    <button class=\"filter-btn filter-btn-produto ${filtroProduto==='SBPE'?'active':''}\" onclick=\"filtrarProduto('SBPE', this)\">SBPE</button>
    <button class=\"filter-btn filter-btn-produto ${filtroProduto==='FGTS'?'active':''}\" onclick=\"filtrarProduto('FGTS', this)\">FGTS</button>
    <button class=\"filter-btn filter-btn-produto ${filtroProduto==='FGTS a vista'?'active':''}\" onclick=\"filtrarProduto('FGTS a vista', this)\">FGTS a vista</button>
    <button class=\"filter-btn filter-btn-produto ${filtroProduto==='HomeEquity'?'active':''}\" onclick=\"filtrarProduto('HomeEquity', this)\">HomeEquity</button>
    <button class=\"filter-btn filter-btn-produto ${filtroProduto==='Terreno'?'active':''}\" onclick=\"filtrarProduto('Terreno', this)\">Terreno</button>
    <button class=\"filter-btn filter-btn-produto ${filtroProduto==='Comercial'?'active':''}\" onclick=\"filtrarProduto('Comercial', this)\">Comercial</button>
    <button class=\"filter-btn filter-btn-produto ${filtroProduto==='Construção'?'active':''}\" onclick=\"filtrarProduto('Construção', this)\">Construção</button>
  `;
  }

  // Aba 1: Produto
  const prA = document.getElementById('filtrosProdutoAnalises');
  if (prA) {
    prA.innerHTML = `<span class=\"text-xs font-semibold uppercase tracking-wider text-gray-500\">Produto:</span> <button class=\"filter-btn filter-btn-produto ${filtroProduto==='todos'?'active':''}\" onclick=\"filtrarProduto('todos', this)\">Todos</button> ${PRODUTO_OPTS.map(p => `<button class=\"filter-btn filter-btn-produto ${filtroProduto===p?'active':''}\" onclick=\"filtrarProduto('${p}', this)\">${p}</button>`).join('')}`;
  }
  // Aba 1: Resultado
  const resA = document.getElementById('filtrosResultadoAnalises');
  if (resA) {
    const resultados = ['aprovado','condicionado','reprovado'];
    resA.innerHTML = `<span class=\"text-xs font-semibold uppercase tracking-wider text-gray-500\">Resultado:</span> <button class=\"filter-btn ${filtroResultadoAnalises==='todos'?'active':''}\" onclick=\"filtrarResultadoAnalises('todos', this)\">Todos</button> ${resultados.map(r => `<button class=\"filter-btn ${filtroResultadoAnalises===r?'active':''}\" onclick=\"filtrarResultadoAnalises('${r}', this)\">${r.charAt(0).toUpperCase()+r.slice(1)}</button>`).join('')}`;
  }
  // Aba 1: Banco
  const bcA = document.getElementById('filtrosBancoAnalises');
  if (bcA) {
    const bancos = ['caixa','bradesco','itau','santander','inter'];
    const nomes = ['Caixa','Bradesco','Itaú','Santander','Inter'];
    bcA.innerHTML = `<span class=\"text-xs font-semibold uppercase tracking-wider text-gray-500\">Banco:</span> <button class=\"filter-btn ${filtroBancoAnalises==='todos'?'active':''}\" onclick=\"filtrarBancoAnalises('todos', this)\">Todos</button> ${bancos.map((b,i) => `<button class=\"filter-btn ${filtroBancoAnalises===b?'active':''}\" onclick=\"filtrarBancoAnalises('${b}', this)\">${nomes[i]}</button>`).join('')}`;
  }
}

function renderizarFiltrosAndamento() {
  // Status
  const stContainer = document.getElementById('filtrosStatusAndamento');
  if (stContainer) {
    const statuses = [{ id: 'todos', label: 'Todos' }, ...STATUS_OPTS.filter(s => s.id !== 'emitido')];
    stContainer.innerHTML = `
      <span class=\"text-xs font-semibold uppercase tracking-wider text-gray-500\">Status:</span>
      ${statuses.map(s => `<button class=\"filter-btn filter-btn-status ${filtroStatusAndamento===s.id?'active':''}\" onclick=\"filtrarStatus('${s.id}', this)\">${s.label}</button>`).join('')}
    `;
  }
  // Produto
  const prContainer = document.getElementById('filtrosProdutoAndamento');
  if (prContainer) {
    prContainer.innerHTML = `
      <span class=\"text-xs font-semibold uppercase tracking-wider text-gray-500\">Produto:</span>
      <button class=\"filter-btn filter-btn-produto ${filtroProdutoAndamento==='todos'?'active':''}\" onclick=\"filtrarProduto('todos', this)\">Todos</button>
      ${PRODUTO_OPTS.map(p => `<button class=\"filter-btn filter-btn-produto ${filtroProdutoAndamento===p?'active':''}\" onclick=\"filtrarProduto('${p}', this)\">${p}</button>`).join('')}
    `;
  }
  // Banco
  const bcContainer = document.getElementById('filtrosBancoAndamento');
  if (bcContainer) {
    const bancos = ['Caixa','Bradesco','Itaú','Santander','Inter'];
    bcContainer.innerHTML = `
      <span class=\"text-xs font-semibold uppercase tracking-wider text-gray-500\">Banco:</span>
      <button class=\"filter-btn ${filtroBancoAndamento==='todos'?'active':''}\" onclick=\"filtrarBancoAndamento('todos', this)\">Todos</button>
      ${bancos.map(b => `<button class=\"filter-btn ${filtroBancoAndamento===b?'active':''}\" onclick=\"filtrarBancoAndamento('${b}', this)\">${b}</button>`).join('')}
    `;
  }
}

function renderizarFiltrosEmitidos() {
  const prContainer = document.getElementById('filtrosProdutoEmitidos');
  if (prContainer) {
    prContainer.innerHTML = `<span class=\"text-xs font-semibold uppercase tracking-wider text-gray-500\">Produto:</span> <button class=\"filter-btn filter-btn-produto ${filtroProdutoEmitidos==='todos'?'active':''}\" onclick=\"filtrarProdutoEmitidos('todos', this)\">Todos</button> ${PRODUTO_OPTS.map(p => `<button class=\"filter-btn filter-btn-produto ${filtroProdutoEmitidos===p?'active':''}\" onclick=\"filtrarProdutoEmitidos('${p}', this)\">${p}</button>`).join('')}`;
  }
  const bcContainer = document.getElementById('filtrosBancoEmitidos');
  if (bcContainer) {
    const bancos = ['Caixa','Bradesco','Itaú','Santander','Inter'];
    bcContainer.innerHTML = `<span class=\"text-xs font-semibold uppercase tracking-wider text-gray-500\">Banco:</span> <button class=\"filter-btn ${filtroBancoEmitidos==='todos'?'active':''}\" onclick=\"filtrarBancoEmitidos('todos', this)\">Todos</button> ${bancos.map(b => `<button class=\"filter-btn ${filtroBancoEmitidos===b?'active':''}\" onclick=\"filtrarBancoEmitidos('${b}', this)\">${b}</button>`).join('')}`;
  }
}

// ==================================================================
// LIXEIRA TABLE
// ==================================================================
function renderizarTabelaLixeira() {
  const tbody = document.getElementById('tableBodyLixeira');
  const vazia = document.getElementById('lixeiraVazia');
  if (!clientesLixeira.length) {
    tbody.innerHTML = '';
    vazia.classList.remove('hidden');
    return;
  }
  vazia.classList.add('hidden');
  tbody.innerHTML = clientesLixeira.map((c, i) => {
    const data = c.deleted_at ? new Date(c.deleted_at).toLocaleDateString('pt-BR') : '—';
    const etapa = c.status === 'emitido' ? 'EMITIDO' : c.mes_referencia ? 'EM ANDAMENTO' : 'ANÁLISE';
    const etapaCor = etapa === 'EMITIDO' ? '#b8860b' : etapa === 'EM ANDAMENTO' ? '#f97316' : '#6b7280';
    return '<tr>' +
      '<td class=\"px-3 py-2\" style=\"color:var(--text-muted);\">' + (i+1) + '</td>' +
      '<td class=\"px-3 py-2 font-medium\" style=\"color:var(--text);\">' + (c.cliente || '—') + '</td>' +
      '<td class=\"px-3 py-2\">' + (c.banco || '—') + '</td>' +
      '<td class=\"px-3 py-2\">' + (c.produto || '—') + '</td>' +
      '<td class=\"px-3 py-2\"><span style=\"color:' + etapaCor + ';font-weight:600;font-size:0.7rem;\">' + etapa + '</span></td>' +
      '<td class=\"px-3 py-2\">' + (c.deleted_by || '—') + '</td>' +
      '<td class=\"px-3 py-2\" style=\"color:var(--text-muted);\">' + data + '</td>' +
      '<td class=\"px-3 py-2\">' +
        '<button onclick=\"restaurarDaLixeira(' + c.id + ')\" style=\"background:#10b981;color:#fff;border:none;padding:3px 10px;border-radius:6px;cursor:pointer;font-size:0.7rem;\">↩ Restaurar</button> ' +
        '<button onclick=\"excluirPermanentemente(' + c.id + ')\" style=\"background:#ef4444;color:#fff;border:none;padding:3px 10px;border-radius:6px;cursor:pointer;font-size:0.7rem;\">✕ Excluir</button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

// ==================================================================
// METRICS
// ==================================================================

function metricaFiltrarPorPeriodo(lista) {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth(); // 0-based

  if (metricaPeriodo === 'este-mes') {
    const ref = `${ano}-${String(mes+1).padStart(2,'0')}`;
    return lista.filter(c => c.mes_referencia === ref);
  }
  if (metricaPeriodo === 'mes-passado') {
    const mAnt = mes === 0 ? 12 : mes;
    const aAnt = mes === 0 ? ano-1 : ano;
    const ref = `${aAnt}-${String(mAnt).padStart(2,'0')}`;
    return lista.filter(c => c.mes_referencia === ref);
  }
  if (metricaPeriodo === '12-meses') {
    const limite = `${ano-1}-${String(mes+1).padStart(2,'0')}`;
    return lista.filter(c => (c.mes_referencia || '') >= limite);
  }
  if (metricaPeriodo === 'personalizado' && metricaDataInicio && metricaDataFim) {
    const ini = parseDataBR(metricaDataInicio);
    const fim = parseDataBR(metricaDataFim);
    if (!ini || !fim) return lista;
    return lista.filter(c => {
      const d = parseDataBR(c.data_vistoria) || (c.created_at ? new Date(c.created_at) : null);
      return d && d >= ini && d <= fim;
    });
  }
  return lista;
}

function metricaFiltrarPorEmpresa(lista) {
  if (metricaEmpresa === 'caixa') {
    return lista.filter(c => (c.banco || '').toLowerCase() === 'caixa');
  }
  if (metricaEmpresa === 'privados') {
    const privados = ['bradesco', 'itaú', 'itau', 'santander', 'inter'];
    return lista.filter(c => privados.includes((c.banco || '').toLowerCase()));
  }
  return lista;
}

function formatarMoeda(v) {
  if (v >= 1e6) return 'R$ ' + (v/1e6).toFixed(1).replace('.', ',') + 'M';
  if (v >= 1e3) return 'R$ ' + (v/1e3).toFixed(0).replace('.', ',') + 'k';
  return 'R$ ' + v.toFixed(0);
}

function renderizarMetricas() {
  const container = document.getElementById('metricasContent');
  if (!container) return;

  // Aplicar filtros
  const filtrados = metricaFiltrarPorEmpresa(metricaFiltrarPorPeriodo(clientes));
  const todos = metricaFiltrarPorPeriodo(clientes); // sem filtro de empresa (pra comparação)

  const doMes = clientes.filter(c => c.mes_referencia === mesSelecionado);
  const total = doMes.filter(c => c.convertido !== true).length;
  const emAndamento = doMes.filter(c => c.convertido === true && c.status !== 'emitido').length;
  const emitidos = doMes.filter(c => c.status === 'emitido').length;

  // ---- Dados baseados nos filtros ----
  const analises = filtrados.filter(c => c.convertido !== true).length;
  const andamento = filtrados.filter(c => c.convertido === true && c.status !== 'emitido').length;
  const emit = filtrados.filter(c => c.status === 'emitido').length;
  const totalFinanciado = filtrados
    .filter(c => c.status === 'emitido')
    .reduce((sum, c) => {
      const v = parseFloat(String(c.valor_financiado||'').replace(/[^\\d,.-]/g, '').replace(',','.')) || 0;
      return sum + v;
    }, 0);
  const conversao = analises + andamento + emit > 0 ? (emit / (analises + andamento + emit) * 100) : 0;

  // CAIXA vs Privados
  const caixa = filtrados.filter(c => (c.banco||'').toLowerCase() === 'caixa');
  const privados = filtrados.filter(c => {
    const b = (c.banco||'').toLowerCase();
    return ['bradesco','itaú','itau','santander','inter'].includes(b);
  });
  const caixaAnalises = caixa.filter(c => c.convertido !== true).length;
  const caixaAndamento = caixa.filter(c => c.convertido === true && c.status !== 'emitido').length;
  const caixaEmitidos = caixa.filter(c => c.status === 'emitido').length;
  const caixaFin = caixa.filter(c => c.status === 'emitido')
    .reduce((s,c) => s + (parseFloat(String(c.valor_financiado||'').replace(/[^\\d,.-]/g,'').replace(',','.'))||0), 0);
  const privAnalises = privados.filter(c => c.convertido !== true).length;
  const privAndamento = privados.filter(c => c.convertido === true && c.status !== 'emitido').length;
  const privEmitidos = privados.filter(c => c.status === 'emitido').length;
  const privFin = privados.filter(c => c.status === 'emitido')
    .reduce((s,c) => s + (parseFloat(String(c.valor_financiado||'').replace(/[^\\d,.-]/g,'').replace(',','.'))||0), 0);

  // Produtos
  const produtos = {};
  ['SBPE','FGTS','Carta de Crédito'].forEach(p => {
    produtos[p] = filtrados.filter(c => c.produto === p).length;
  });
  produtos['Outros'] = filtrados.filter(c => !['SBPE','FGTS','Carta de Crédito'].includes(c.produto||'')).length;
  const totalProd = Object.values(produtos).reduce((a,b)=>a+b,0) || 1;
  const coresProduto = { 'SBPE':'#f97316', 'FGTS':'#1e40af', 'Carta de Crédito':'#7c3aed', 'Outros':'#059669' };
  let pieGrad = '';
  let acum = 0;
  Object.entries(produtos).forEach(([nome, qtd]) => {
    const pct = (qtd / totalProd * 100);
    if (pct > 0) {
      pieGrad += `${coresProduto[nome]} ${acum}% ${acum+pct}%, `;
      acum += pct;
    }
  });
  pieGrad = pieGrad.replace(/, $/, '');

  // Status distribution + bottleneck (tempo)
  const statusCounts = {};
  const statusDias = {};
  const andamentoProcs = filtrados.filter(c => c.convertido === true && c.status !== 'emitido');
  STATUS_OPTS.forEach(s => {
    const procs = andamentoProcs.filter(c => c.status === s.id);
    statusCounts[s.id] = procs.length;
    if (procs.length > 0) {
      const diasTotal = procs.reduce((sum, c) => {
        const d = parseDataBR(c.data_vistoria);
        return sum + (d ? diasDesde(d) : 0);
      }, 0);
      statusDias[s.id] = Math.round(diasTotal / procs.length);
    } else {
      statusDias[s.id] = 0;
    }
  });
  const maxCount = Math.max(1, ...Object.values(statusCounts));
  // Gargalo = status com mais dias médios (e pelo menos 1 processo)
  let gargaloStatus = null;
  let gargaloDias = 0;
  Object.entries(statusDias).forEach(([sid, dias]) => {
    if (statusCounts[sid] > 0 && dias > gargaloDias) {
      gargaloDias = dias;
      gargaloStatus = sid;
    }
  });

  // Top indicações
  const indicadores = {};
  filtrados.forEach(c => {
    const ind = (c.indicacao || 'Sem indicação').trim();
    if (ind) indicadores[ind] = (indicadores[ind] || 0) + 1;
  });
  const topInd = Object.entries(indicadores).sort((a,b) => b[1]-a[1]).slice(0,5);
  const maxInd = topInd.length > 0 ? topInd[0][1] : 1;

  // Emitidos em diferentes períodos
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();
  const refAtual = `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}`;
  const mAnt = mesAtual === 0 ? 12 : mesAtual;
  const aAnt = mesAtual === 0 ? anoAtual-1 : anoAtual;
  const refAnterior = `${aAnt}-${String(mAnt).padStart(2,'0')}`;
  const emitidosMes = filtrados.filter(c => c.status === 'emitido' && c.mes_referencia === refAtual).length;
  const finMes = filtrados.filter(c => c.status === 'emitido' && c.mes_referencia === refAtual)
    .reduce((s,c) => s + (parseFloat(String(c.valor_financiado||'').replace(/[^\\d,.-]/g,'').replace(',','.'))||0), 0);
  const emitidosMesAnt = filtrados.filter(c => c.status === 'emitido' && c.mes_referencia === refAnterior).length;
  const finMesAnt = filtrados.filter(c => c.status === 'emitido' && c.mes_referencia === refAnterior)
    .reduce((s,c) => s + (parseFloat(String(c.valor_financiado||'').replace(/[^\\d,.-]/g,'').replace(',','.'))||0), 0);
  const emitidos12m = filtrados.filter(c => c.status === 'emitido').length;
  const fin12m = filtrados.filter(c => c.status === 'emitido')
    .reduce((s,c) => s + (parseFloat(String(c.valor_financiado||'').replace(/[^\\d,.-]/g,'').replace(',','.'))||0), 0);

  // Helpers para badge de periodo
  const periodoLabel = metricaPeriodo === 'este-mes' ? 'Este mês' :
    metricaPeriodo === 'mes-passado' ? 'Mês passado' :
    metricaPeriodo === '12-meses' ? 'Últimos 12 meses' : 'Personalizado';

  // ===== HTML =====
  let html = '';

  // -- Filters bar --
  html += `<div class=\"flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl\" style=\"background:var(--bg-card);border:1px solid var(--border);\">
    <span class=\"text-xs font-semibold uppercase tracking-wider\" style=\"color:var(--text-muted);\">Período:</span>
    ${['este-mes','mes-passado','12-meses','personalizado'].map(p => {
      const labels = { 'este-mes':'Este mês', 'mes-passado':'Mês passado', '12-meses':'12 meses', 'personalizado':'Período' };
      const ativo = metricaPeriodo === p;
      return `<button onclick=\"metricaSetPeriodo('${p}')\" class=\"px-3 py-1.5 rounded-lg text-xs font-medium transition\"
        style=\"${ativo ? 'background:var(--accent);color:#fff;border:1px solid var(--accent);' : 'background:var(--bg-body);color:var(--text-secondary);border:1px solid var(--border);'}\">${labels[p]}</button>`;
    }).join('')}
    ${metricaPeriodo === 'personalizado' ? `
      <input type=\"text\" id=\"metricaDataInicio\" placeholder=\"dd/mm/aaaa\" value=\"${metricaDataInicio}\" onchange=\"metricaDataInicio=this.value;renderizarMetricas()\" class=\"px-2 py-1 rounded text-xs border\" style=\"width:100px;border-color:var(--border);background:var(--bg-input);color:var(--text);\">
      <span class=\"text-xs\" style=\"color:var(--text-muted);\">até</span>
      <input type=\"text\" id=\"metricaDataFim\" placeholder=\"dd/mm/aaaa\" value=\"${metricaDataFim}\" onchange=\"metricaDataFim=this.value;renderizarMetricas()\" class=\"px-2 py-1 rounded text-xs border\" style=\"width:100px;border-color:var(--border);background:var(--bg-input);color:var(--text);\">
    ` : ''}
    <span class=\"mx-2\" style=\"color:var(--border);\">|</span>
    <span class=\"text-xs font-semibold uppercase tracking-wider\" style=\"color:var(--text-muted);\">Empresa:</span>
    ${['todas','caixa','privados'].map(e => {
      const labels = { 'todas':'Todas', 'caixa':'<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"2\" width=\"16\" height=\"20\" rx=\"2\" ry=\"2\"/><path d=\"M9 18h6v4H9z\"/></svg> Caixa', 'privados':'<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"7\" width=\"20\" height=\"14\" rx=\"2\" ry=\"2\"/><path d=\"M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16\"/></svg> Privados' };
      const ativo = metricaEmpresa === e;
      return `<button onclick=\"metricaSetEmpresa('${e}')\" class=\"px-3 py-1.5 rounded-lg text-xs font-medium transition\"
        style=\"${ativo ? 'background:var(--accent);color:#fff;border:1px solid var(--accent);' : 'background:var(--bg-body);color:var(--text-secondary);border:1px solid var(--border);'}\">${labels[e]}</button>`;
    }).join('')}
  </div>`;

  // -- KPI row --
  html += `<div class=\"grid grid-cols-5 gap-3 mb-4\">
    <div class=\"metrica-card text-center\">
      <div class=\"text-xs uppercase tracking-wider mb-1\" style=\"color:var(--text-muted);\">Análises</div>
      <div class=\"metrica-number\">${analises}</div>
      <div class=\"text-xs mt-1\" style=\"color:var(--text-muted);\">${periodoLabel.toLowerCase()}</div>
    </div>
    <div class=\"metrica-card text-center\">
      <div class=\"text-xs uppercase tracking-wider mb-1\" style=\"color:var(--text-muted);\">Em Andamento</div>
      <div class=\"metrica-number\" style=\"color:#f97316;\">${andamento}</div>
      <div class=\"text-xs mt-1\" style=\"color:var(--text-muted);\">${STATUS_OPTS.filter(s => statusCounts[s.id] > 0).length} status</div>
    </div>
    <div class=\"metrica-card text-center\">
      <div class=\"text-xs uppercase tracking-wider mb-1\" style=\"color:var(--text-muted);\">Emitidos</div>
      <div class=\"metrica-number\" style=\"color:#059669;\">${emit}</div>
      <div class=\"text-xs mt-1\" style=\"color:var(--text-muted);\">${formatarMoeda(totalFinanciado)}</div>
    </div>
    <div class=\"metrica-card text-center\">
      <div class=\"text-xs uppercase tracking-wider mb-1\" style=\"color:var(--text-muted);\">Total Financiado</div>
      <div class=\"metrica-number\" style=\"font-size:1.3rem;color:#1e40af;\">${formatarMoeda(totalFinanciado)}</div>
    </div>
    <div class=\"metrica-card text-center\">
      <div class=\"text-xs uppercase tracking-wider mb-1\" style=\"color:var(--text-muted);\">Conversão</div>
      <div class=\"metrica-number\" style=\"color:#7c3aed;\">${conversao.toFixed(1)}%</div>
      <div class=\"text-xs mt-1\" style=\"color:var(--text-muted);\">análise → emitido</div>
    </div>
  </div>`;

  // -- CAIXA vs Privados --
  html += `<div class=\"grid grid-cols-2 gap-4 mb-4\">
    <div class=\"metrica-card\" style=\"border-left:4px solid #1e40af;\">
      <div class=\"text-xs uppercase tracking-wider mb-3\" style=\"color:#1e40af;font-weight:700;\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#1e40af\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"2\" width=\"16\" height=\"20\" rx=\"2\" ry=\"2\"/><path d=\"M9 18h6v4H9z\"/></svg> Caixa</div>
      <div class=\"grid grid-cols-4 gap-2 text-center\">
        <div><div class=\"text-lg font-bold\">${caixaAnalises}</div><div class=\"text-xs\" style=\"color:var(--text-muted);\">análises</div></div>
        <div><div class=\"text-lg font-bold\">${caixaAndamento}</div><div class=\"text-xs\" style=\"color:var(--text-muted);\">andamento</div></div>
        <div><div class=\"text-lg font-bold\">${caixaEmitidos}</div><div class=\"text-xs\" style=\"color:var(--text-muted);\">emitidos</div></div>
        <div><div class=\"text-lg font-bold\">${formatarMoeda(caixaFin)}</div><div class=\"text-xs\" style=\"color:var(--text-muted);\">financiado</div></div>
      </div>
    </div>
    <div class=\"metrica-card\" style=\"border-left:4px solid #7c3aed;\">
      <div class=\"text-xs uppercase tracking-wider mb-3\" style=\"color:#7c3aed;font-weight:700;\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7c3aed\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"7\" width=\"20\" height=\"14\" rx=\"2\" ry=\"2\"/><path d=\"M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16\"/></svg> Privados</div>
      <div class=\"grid grid-cols-4 gap-2 text-center\">
        <div><div class=\"text-lg font-bold\">${privAnalises}</div><div class=\"text-xs\" style=\"color:var(--text-muted);\">análises</div></div>
        <div><div class=\"text-lg font-bold\">${privAndamento}</div><div class=\"text-xs\" style=\"color:var(--text-muted);\">andamento</div></div>
        <div><div class=\"text-lg font-bold\">${privEmitidos}</div><div class=\"text-xs\" style=\"color:var(--text-muted);\">emitidos</div></div>
        <div><div class=\"text-lg font-bold\">${formatarMoeda(privFin)}</div><div class=\"text-xs\" style=\"color:var(--text-muted);\">financiado</div></div>
      </div>
    </div>
  </div>`;

  // -- Charts row --
  html += `<div class=\"grid gap-4 mb-4\" style=\"grid-template-columns:1fr 1fr 1fr;\">
    <!-- Produto Pie -->
    <div class=\"metrica-card\">
      <div class=\"text-xs uppercase tracking-wider mb-3\" style=\"color:var(--text-muted);\">Análises por Produto</div>
      <div class=\"flex items-center gap-4\">
        <div style=\"width:100px;height:100px;border-radius:50%;background:conic-gradient(${pieGrad || '#eee 0% 100%'});flex-shrink:0;\"></div>
        <div class=\"text-xs space-y-1\">
          ${Object.entries(produtos).map(([n,q]) => `<div>• ${n}: <b>${q}</b></div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Status + Gargalo -->
    <div class=\"metrica-card\">
      <div class=\"text-xs uppercase tracking-wider mb-3\" style=\"color:var(--text-muted);\">Andamento por Status</div>
      ${STATUS_OPTS.filter(s => statusCounts[s.id] > 0).map(s => {
        const pct = maxCount > 0 ? (statusCounts[s.id]/maxCount*100) : 0;
        return `<div class=\"flex items-center gap-2 mb-2\">
          <span class=\"text-xs truncate\" style=\"width:90px;color:var(--text-secondary);\">${s.label}</span>
          <div class=\"flex-1\" style=\"height:6px;border-radius:3px;background:var(--metrica-bar-bg);\">
            <div style=\"width:${pct}%;height:100%;border-radius:3px;background:var(--accent);\"></div>
          </div>
          <span class=\"text-xs font-mono\" style=\"color:var(--text-muted);\">${statusCounts[s.id]}</span>
        </div>`;
      }).join('')}
      ${andamento === 0 ? '<div class=\"text-xs\" style=\"color:var(--text-muted);\">Sem processos em andamento</div>' : ''}
      ${gargaloStatus ? `
        <div class=\"mt-3 pt-2 border-t text-xs\" style=\"border-color:var(--border);\">
          ⚠️ Gargalo: <b style=\"color:#dc2626;\">${(STATUS_OPTS.find(s=>s.id===gargaloStatus)||{}).label||gargaloStatus}</b> — média de <b style=\"color:#dc2626;\">${gargaloDias}d</b>
        </div>
      ` : ''}
    </div>

    <!-- Top Indicações -->
    <div class=\"metrica-card\">
      <div class=\"text-xs uppercase tracking-wider mb-3\" style=\"color:var(--text-muted);\">Top Indicações</div>
      ${topInd.length === 0 ? '<div class=\"text-xs\" style=\"color:var(--text-muted);\">Sem dados</div>' :
        topInd.map(([nome, qtd], i) => `
        <div class=\"flex items-center justify-between py-1\" style=\"border-bottom:1px solid var(--border-light);\">
          <span class=\"text-xs\" style=\"color:var(--text-secondary);\">${i+1}. ${nome}</span>
          <span class=\"text-xs font-bold\" style=\"color:var(--accent);\">${qtd}</span>
        </div>
      `).join('')}
    </div>
  </div>`;

  // -- Emitidos & Financiamento --
  html += `<div class=\"metrica-card mb-4\">
    <div class=\"text-xs uppercase tracking-wider mb-3\" style=\"color:var(--text-muted);\">✅ Emitidos & Financiamento</div>
    <div class=\"grid grid-cols-4 gap-3\">
      <div class=\"text-center p-3 rounded-xl\" style=\"background:#f0fdf4;\">
        <div class=\"text-xs\" style=\"color:var(--text-muted);\">Este mês</div>
        <div class=\"text-xl font-bold\" style=\"color:#059669;\">${emitidosMes}</div>
        <div class=\"text-xs\" style=\"color:var(--text-muted);\">${formatarMoeda(finMes)}</div>
      </div>
      <div class=\"text-center p-3 rounded-xl\" style=\"background:#fefce8;\">
        <div class=\"text-xs\" style=\"color:var(--text-muted);\">Mês passado</div>
        <div class=\"text-xl font-bold\" style=\"color:#d97706;\">${emitidosMesAnt}</div>
        <div class=\"text-xs\" style=\"color:var(--text-muted);\">${formatarMoeda(finMesAnt)}</div>
      </div>
      <div class=\"text-center p-3 rounded-xl\" style=\"background:#eff6ff;\">
        <div class=\"text-xs\" style=\"color:var(--text-muted);\">12 meses</div>
        <div class=\"text-xl font-bold\" style=\"color:#1e40af;\">${emitidos12m}</div>
        <div class=\"text-xs\" style=\"color:var(--text-muted);\">${formatarMoeda(fin12m)}</div>
      </div>
      <div class=\"text-center p-3 rounded-xl\" style=\"background:#faf5ff;\">
        <div class=\"text-xs\" style=\"color:var(--text-muted);\">Personalizado</div>
        <div class=\"text-xl font-bold\" style=\"color:#7c3aed;\">${emit}</div>
        <div class=\"text-xs\" style=\"color:var(--text-muted);\">${formatarMoeda(totalFinanciado)}</div>
      </div>
    </div>
  </div>`;



  container.innerHTML = html;
}

function metricaSetPeriodo(p) {
  metricaPeriodo = p;
  renderizarMetricas();
}
function metricaSetEmpresa(e) {
  metricaEmpresa = e;
  renderizarMetricas();
}

// ==================================================================
// RENDER ORCHESTRATORS
// ==================================================================
function renderizarTudo() {
  if (tabAtivo === 'lixeira') {
    carregarLixeira();
    return;
  }
  if (tabAtivo === 'dashboard') {
    renderizarDashboard();
    return;
  }
  if (tabAtivo === 'andamento') {
    renderizarMesSelector();
    renderizarFiltrosAndamento();
    renderizarTabelaAndamento();
    atualizarStatsAndamento();
  } else if (tabAtivo === 'emitidos') {
    renderizarMesSelectorEmitidos();
    renderizarFiltrosEmitidos();
    renderizarTabelaEmitidos();
    atualizarStatsEmitidos();
  } else if (tabAtivo === 'metricas') {
    renderizarMetricas();
  } else {
    renderizarMesSelectorAnalises();
    renderizarTabelaAnalises();
    renderizarFiltros();
    atualizarStats();
  }
  atualizarSugestoesIndicacao();
}

function renderizarTabelas() {
  if (tabAtivo === 'lixeira') {
    renderizarTabelaLixeira();
    return;
  }
  if (tabAtivo === 'dashboard') {
    renderizarDashboard();
    return;
  }
  if (tabAtivo === 'andamento') {
    renderizarTabelaAndamento();
    atualizarStatsAndamento();
  } else if (tabAtivo === 'emitidos') {
    renderizarTabelaEmitidos();
  } else {
    renderizarTabelaAnalises();
  }
}

// ==================================================================
// TABLE RENDERS
// ==================================================================
function renderizarTabelaAnalises() {
  const tbody = document.getElementById('tableBody');
  const filtrados = getFiltrados(null, 'analises');

  if (filtrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan=\"14\" class=\"text-center py-16 text-gray-600\">Nenhum processo encontrado.</td></tr>';
    atualizarStats();
    return;
  }

  tbody.innerHTML = filtrados.map((c, i) => {
    return `
    <tr class=\"border-b border-[#1f1f1f] hover:bg-orange-900/5 transition\" data-id=\"${c.id}\">
      <td class=\"px-2 py-2.5 text-gray-600 text-xs text-center\">${i + 1}</td>
      <td class=\"px-3 py-2.5\"><input list=\"indicacaoSuggestions\" data-id=\"${c.id}\" data-campo=\"indicacao\" class=\"editavel px-1 rounded bg-transparent border-0\" onblur=\"validarIndicacaoInput(this)\" onfocus=\"this.dataset.oldValue=this.value\" value=\"${c.indicacao||''}\" style=\"color:inherit;width:120px;\" autocomplete=\"off\"></td>
      <td class=\"px-3 py-2.5\"><span contenteditable=\"true\" tabindex=\"0\" data-id=\"${c.id}\" data-campo=\"cliente\" class=\"editavel px-1 -mx-1 rounded\" onblur=\"capitalizarCliente(this);editarCampo(this)\" onkeydown=\"if(event.key==='Enter'){event.preventDefault();this.blur();}\">${c.cliente||''}</span></td>
      <td class=\"px-3 py-2.5\"><input tabindex=\"0\" data-id=\"${c.id}\" data-campo=\"cpf\" class=\"editavel px-1 rounded font-mono text-xs bg-transparent border-0\" oninput=\"mascaraCPF(this)\" onblur=\"editarCampoInput(this)\" value=\"${c.cpf||''}\" maxlength=\"14\" style=\"color:inherit;width:110px;\"></td>
      <td class=\"px-3 py-2.5\"><input tabindex=\"0\" data-id=\"${c.id}\" data-campo=\"data\" onfocus=\"if(!this.value)this.value=new Date().toLocaleDateString('pt-BR').slice(0,5)\" class=\"editavel px-1 rounded bg-transparent border-0 text-xs\" oninput=\"mascaraData(this)\" onblur=\"editarCampoInput(this)\" value=\"${c.data||''}\" placeholder=\"dd/mm\" maxlength=\"5\" style=\"color:inherit;width:70px;\"></td>
      <td class=\"px-3 py-2.5\" style=\"white-space:nowrap;\">
        <label class=\"inline-flex items-center gap-0.5 mr-2 text-xs cursor-pointer font-semibold\" style=\"color:#0061A8;\"><input type=\"checkbox\" ${c.banco_caixa?'checked':''} onchange=\"toggleBanco(${c.id},'caixa',this.checked)\" class=\"w-3 h-3 accent-blue-600\"> Caixa</label>
        <label class=\"inline-flex items-center gap-0.5 mr-2 text-xs cursor-pointer font-semibold\" style=\"color:#CC092F;\"><input type=\"checkbox\" ${c.banco_bradesco?'checked':''} onchange=\"toggleBanco(${c.id},'bradesco',this.checked)\" class=\"w-3 h-3 accent-red-600\"> Bradesco</label>
        <label class=\"inline-flex items-center gap-0.5 mr-2 text-xs cursor-pointer font-semibold\" style=\"color:#F97316;\"><input type=\"checkbox\" ${c.banco_itau?'checked':''} onchange=\"toggleBanco(${c.id},'itau',this.checked)\" class=\"w-3 h-3 accent-orange-500\"> Itaú</label>
        <label class=\"inline-flex items-center gap-0.5 mr-2 text-xs cursor-pointer font-semibold\" style=\"color:#EC0000;\"><input type=\"checkbox\" ${c.banco_santander?'checked':''} onchange=\"toggleBanco(${c.id},'santander',this.checked)\" class=\"w-3 h-3 accent-red-600\"> Santander</label>
        <label class=\"inline-flex items-center gap-0.5 text-xs cursor-pointer font-semibold\" style=\"color:#FF7A00;\"><input type=\"checkbox\" ${c.banco_inter?'checked':''} onchange=\"toggleBanco(${c.id},'inter',this.checked)\" class=\"w-3 h-3 accent-orange-500\"> Inter</label>
      </td>
      <td class=\"px-3 py-2.5\"><input tabindex=\"0\" data-id=\"${c.id}\" data-campo=\"agencia\" class=\"editavel px-1 rounded bg-transparent border-0\" oninput=\"apenasNumeros(this)\" onblur=\"editarCampoInput(this)\" value=\"${c.agencia||''}\" style=\"color:inherit;width:70px;\"></td>
      <td class=\"px-3 py-2.5\"><input tabindex=\"0\" data-id=\"${c.id}\" data-campo=\"valor_imovel\" class=\"editavel px-1 rounded bg-transparent border-0\" oninput=\"this.value=this.value.replace(/[^\\d]/g,'')\" onblur=\"formatarMoeda(this);editarCampoInput(this)\" value=\"${c.valor_imovel||''}\" style=\"color:inherit;width:110px;\"></td>
      <td class=\"px-3 py-2.5\"><input tabindex=\"0\" data-id=\"${c.id}\" data-campo=\"valor_financiado\" class=\"editavel px-1 rounded bg-transparent border-0\" oninput=\"this.value=this.value.replace(/[^\\d]/g,'')\" onblur=\"formatarMoeda(this);editarCampoInput(this)\" value=\"${c.valor_financiado||''}\" style=\"color:inherit;width:110px;\"></td>
      <td class=\"px-3 py-2.5\">
        <select onchange=\"atualizarCampo(${c.id},'produto',this.value)\" class=\"text-xs font-semibold bg-transparent cursor-pointer rounded-lg p-1 border-0 focus:ring-2 focus:ring-orange-500\" style=\"color:var(--text);\">
          ${PRODUTO_OPTS.map(p => `<option value=\"${p}\" ${p===c.produto?'selected':''}>${p}</option>`).join('')}
        </select>
      </td>
      <td class=\"px-3 py-2.5\" id=\"resultado-${c.id}\">${getResultadoPerBancoHtml(c)}</td>
      <td class=\"px-3 py-2.5\"><span contenteditable=\"true\" tabindex=\"0\" data-id=\"${c.id}\" data-campo=\"obs\" class=\"editavel px-1 -mx-1 rounded\" onblur=\"editarCampo(this)\" onkeydown=\"if(event.key==='Enter'){event.preventDefault();this.blur();}\">${c.obs||''}</span></td>
      <td class=\"px-2 py-2.5 text-center\">
        <input type=\"checkbox\" ${c.follow_up?'checked':''} onchange=\"atualizarCampo(${c.id},'follow_up',this.checked)\" class=\"w-3.5 h-3.5 accent-blue-500 cursor-pointer\" title=\"F-U\">
      </td>
      <td class=\"px-2 py-2.5 text-center\">
        <input type=\"checkbox\" ${c.convertido?'checked':''} onchange=\"converterCliente(${c.id},this.checked)\" class=\"w-3.5 h-3.5 accent-green-600 cursor-pointer\" title=\"Conv.\">
      </td>
      <td class=\"px-3 py-2.5 criado-por-col\">${c.criado_por || '—'}</td>
      <td class=\"px-2 py-2.5 text-center\">
        <button onclick=\"excluirCliente(${c.id})\" class=\"text-gray-500 hover:text-red-500 transition\" title=\"Excluir\">🗑️</button>
      </td>
    </tr>`;
  }).join('');
  atualizarStats();
}

function renderizarTabelaAndamento() {
  const tbody = document.getElementById('tableBodyAndamento');

  // Preservar quais linhas estão expandidas
  const expandedIds = [];
  document.querySelectorAll('#tableBodyAndamento tr.expanded-row:not(.hidden)').forEach(r => {
    const pid = parseInt(r.dataset.parent);
    if (pid) expandedIds.push(pid);
  });

  const filtrados = getFiltrados(null, 'andamento');

  if (filtrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan=\"14\" class=\"text-center py-16\" style=\"color:var(--text-muted);\">Nenhum processo em andamento.</td></tr>';
    atualizarStatsAndamento();
    return;
  }

  tbody.innerHTML = filtrados.map((c, i) => {
    const idx = clientes.indexOf(c);
    const banco = c.banco || '';
    const { opts: statusOpts, validStatus } = getStatusOpts(banco, c.status || '');
    const fgts = c.fgts || false;
    const iq = c.iq || false;
    return `
    <tr style=\"border-bottom:1px solid var(--border-light);\" data-id=\"${c.id}\" class=\"main-row\">
      <td class=\"px-2 py-2.5 text-xs text-center\" style=\"color:var(--text-muted);\">${i + 1}</td>
      <td class=\"px-3 py-2.5\"><input list=\"indicacaoSuggestions\" data-id=\"${c.id}\" data-campo=\"indicacao\" class=\"editavel px-1 rounded bg-transparent border-0\" onblur=\"validarIndicacaoInput(this)\" onfocus=\"this.dataset.oldValue=this.value\" value=\"${c.indicacao||''}\" style=\"color:inherit;width:120px;\" autocomplete=\"off\"></td>
      <td class=\"px-3 py-2.5\"><span contenteditable=\"true\" tabindex=\"0\" data-id=\"${c.id}\" data-campo=\"cliente\" class=\"editavel px-1 -mx-1 rounded\" onblur=\"capitalizarCliente(this);editarCampo(this)\" onkeydown=\"if(event.key==='Enter'){event.preventDefault();this.blur();}\">${c.cliente||''}</span></td>
      <td class=\"px-1 py-2.5 text-center\">
        <span class=\"expand-btn\" onclick=\"toggleExpand(${c.id})\" title=\"Expandir\">▼</span>
      </td>
      <td class=\"px-3 py-2.5\"><input tabindex=\"0\" data-id=\"${c.id}\" data-campo=\"cpf\" class=\"editavel px-1 rounded font-mono text-xs bg-transparent border-0\" oninput=\"mascaraCPF(this)\" onblur=\"editarCampoInput(this)\" value=\"${c.cpf||''}\" maxlength=\"14\" style=\"color:inherit;width:110px;\"></td>
      <td class=\"px-3 py-2.5\">
        <select onchange=\"onBancoChange(${c.id},this.value)\" class=\"text-xs bg-transparent cursor-pointer rounded-lg p-1 border-0 focus:ring-2 focus:ring-orange-500\" style=\"color:inherit;\">
          <option value=\"\" ${!c.banco?'selected':''}>—</option>
          ${['Bradesco','Caixa','Itaú','Santander','Inter'].map(b => `<option value=\"${b}\" ${c.banco===b?'selected':''}>${b}</option>`).join('')}
        </select>
      </td>
      <td class=\"px-3 py-2.5\"><input tabindex=\"0\" data-id=\"${c.id}\" data-campo=\"agencia\" class=\"editavel px-1 rounded bg-transparent border-0\" oninput=\"apenasNumeros(this)\" onblur=\"editarCampoInput(this)\" value=\"${c.agencia||''}\" style=\"color:inherit;width:70px;\"></td>
      <td class=\"px-3 py-2.5\"><input tabindex=\"0\" data-id=\"${c.id}\" data-campo=\"valor_imovel\" class=\"editavel px-1 rounded bg-transparent border-0\" oninput=\"this.value=this.value.replace(/[^\\d]/g,'')\" onblur=\"formatarMoeda(this);editarCampoInput(this)\" value=\"${c.valor_imovel||''}\" style=\"color:inherit;width:110px;\"></td>
      <td class=\"px-3 py-2.5\"><input tabindex=\"0\" data-id=\"${c.id}\" data-campo=\"valor_financiado\" class=\"editavel px-1 rounded bg-transparent border-0\" oninput=\"this.value=this.value.replace(/[^\\d]/g,'')\" onblur=\"formatarMoeda(this);editarCampoInput(this)\" value=\"${c.valor_financiado||''}\" style=\"color:inherit;width:110px;\"></td>
      <td class=\"px-3 py-2.5\">
        <select onchange=\"atualizarCampo(${c.id},'produto',this.value)\" class=\"text-xs font-semibold bg-transparent cursor-pointer rounded-lg p-1 border-0 focus:ring-2 focus:ring-orange-500\" style=\"color:var(--text-secondary);\">
          ${PRODUTO_OPTS.map(p => `<option value=\"${p}\" ${p===c.produto?'selected':''}>${p}</option>`).join('')}
        </select>
      </td>
      <td class=\"px-3 py-2.5\"><input data-id=\"${c.id}\" data-campo=\"data_vistoria\" class=\"editavel px-1 rounded bg-transparent border-0 text-xs\" oninput=\"mascaraData(this)\" onblur=\"editarCampoInput(this)\" value=\"${c.data_vistoria||''}\" maxlength=\"10\" style=\"color:inherit;width:90px;\"></td>
      <td class=\"px-3 py-2.5\"><input data-id=\"${c.id}\" data-campo=\"data_emissao\" class=\"editavel px-1 rounded bg-transparent border-0 text-xs\" oninput=\"mascaraData(this)\" onblur=\"editarCampoInput(this)\" value=\"${c.data_emissao||''}\" placeholder=\"dd/mm/aaaa\" maxlength=\"10\" style=\"color:inherit;width:100px;\"></td>
      <td class=\"px-3 py-2.5\">
        <select onchange=\"atualizarCampo(${c.id},'status',this.value)\" data-id=\"${c.id}\" class=\"status-select text-xs bg-transparent cursor-pointer rounded-lg p-1 border-0 focus:ring-2 focus:ring-orange-500\" style=\"color:var(--text-secondary);\">
          ${statusOpts.map(s => getStatusLabel(s)).map((label,i) => `<option value=\"${statusOpts[i]}\" ${statusOpts[i]===c.status?'selected':''}>${label}</option>`).join('')}
        </select>
      </td>
      <td class=\"px-3 py-2.5\"><span contenteditable=\"true\" tabindex=\"0\" data-id=\"${c.id}\" data-campo=\"obs\" class=\"editavel px-1 -mx-1 rounded\" onblur=\"editarCampo(this)\" onkeydown=\"if(event.key==='Enter'){event.preventDefault();this.blur();}\">${c.obs||''}</span></td>
      <td class=\"px-3 py-2.5 criado-por-col\">${c.criado_por || '—'}</td>
      <td class=\"px-2 py-2.5 text-center\">
        <button onclick=\"excluirCliente(${c.id})\" class=\"text-gray-500 hover:text-red-500 transition\" title=\"Excluir\">🗑️</button>
      </td>
    </tr>
    <tr class=\"expanded-row hidden\" data-parent=\"${c.id}\">
      <td colspan=\"14\">
        <div class=\"expanded-grid\">
          <div class=\"expanded-item\">
            <label style=\"cursor:pointer;\" onclick=\"toggleFGTS(${c.id})\">
              <input type=\"checkbox\" ${fgts?'checked':''} onchange=\"toggleFGTS(${c.id})\" style=\"accent-color:#f97316;\"> FGTS
            </label>
            <input type=\"text\" data-id=\"${c.id}\" data-campo=\"valor_fgts\" class=\"valor-fgts-field ${fgts?'':'hidden'}\" oninput=\"this.value=this.value.replace(/[^\\d]/g,'')\" onblur=\"formatarMoeda(this);editarCampoInput(this)\" value=\"${c.valor_fgts||''}\" placeholder=\"R$ 0,00\" style=\"color:inherit;width:130px;${fgts?'':'display:none;'}\">
          </div>
          <div class=\"expanded-item\">
            <label style=\"cursor:pointer;\" onclick=\"toggleIQ(${c.id})\">
              <input type=\"checkbox\" ${iq?'checked':''} onchange=\"toggleIQ(${c.id})\" style=\"accent-color:#f97316;\"> IQ
            </label>
            <input type=\"text\" data-id=\"${c.id}\" data-campo=\"data_iq\" class=\"data-iq-field ${iq?'':'hidden'}\" oninput=\"mascaraData(this)\" onblur=\"editarCampoInput(this)\" value=\"${c.data_iq||''}\" placeholder=\"dd/mm/aaaa\" maxlength=\"10\" style=\"color:inherit;width:110px;${iq?'':'display:none;'}\">
          </div>
          <div class=\"expanded-item\">
            <label>Data Matrícula</label>
            <input type=\"text\" data-id=\"${c.id}\" data-campo=\"data_matricula\" class=\"editavel px-1 rounded bg-transparent border-0\" oninput=\"mascaraData(this)\" onblur=\"editarCampoInput(this)\" value=\"${c.data_matricula||''}\" placeholder=\"dd/mm/aaaa\" maxlength=\"10\" style=\"color:inherit;width:110px;\">
          </div>
          <div class=\"expanded-item\" id=\"urgente-item-${c.id}\" style=\"${isMaster()?'':'display:none;'}\">
            <label style=\"cursor:pointer;\">
              <input type=\"checkbox\" ${c.urgente?'checked':''} onchange=\"toggleUrgente(${c.id})\" style=\"accent-color:#dc2626;\"> 🔴 Urgente
            </label>
          </div>
          <div class=\"expanded-item\" style=\"justify-content:flex-end;\">
            <button class=\"btn-briefing\" onclick=\"gerarBriefing(${c.id})\" title=\"Gerar Briefing (em breve)\">
              <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z\"></path><polyline points=\"14 2 14 8 20 8\"></polyline><line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"></line><line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"></line></svg>
              Briefing
            </button>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');
  atualizarStatsAndamento();

  // Re-expandir linhas que estavam abertas
  expandedIds.forEach(id => {
    const row = document.querySelector(`#tableBodyAndamento tr.expanded-row[data-parent="${id}"]`);
    const main = document.querySelector(`#tableBodyAndamento tr.main-row[data-id="${id}"]`);
    if (row) row.classList.remove('hidden');
    if (main) main.classList.add('expanded');
  });
}

function renderizarTabelaEmitidos() {
  const tbody = document.getElementById('tableBodyEmitidos');
  const filtrados = getFiltrados(null, 'emitidos');

  if (filtrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan=\"11\" class=\"text-center py-16 text-gray-600\">Nenhum contrato emitido ainda.</td></tr>';
    atualizarStatsEmitidos();
    return;
  }

  const master = isMaster();

  tbody.innerHTML = filtrados.map((c, i) => {
    const idx = clientes.indexOf(c);
    return `
    <tr class=\"border-b border-[#1f1f1f] hover:bg-orange-900/5 transition\" data-id=\"${c.id}\">
      <td class=\"px-2 py-2.5 text-gray-600 text-xs text-center\">${i + 1}</td>
      <td class=\"px-3 py-2.5 text-gray-300\">${c.indicacao||'—'}</td>
      <td class=\"px-3 py-2.5 text-gray-200 font-medium\">${c.cliente||'—'}</td>
      <td class=\"px-3 py-2.5 text-gray-400 font-mono text-xs\">${c.cpf||'—'}</td>
      <td class=\"px-3 py-2.5 text-gray-300\">${c.banco||'—'}</td>
      <td class=\"px-3 py-2.5 text-gray-300\">${c.agencia||'—'}</td>
      <td class=\"px-3 py-2.5 text-gray-300\">${c.valor_imovel||'—'}</td>
      <td class=\"px-3 py-2.5 text-gray-300\">${c.valor_financiado||'—'}</td>
      <td class=\"px-3 py-2.5\"><span class=\"text-xs font-semibold ${c.produto==='FGTS'?'text-orange-400':'text-gray-300'}\">${c.produto||'—'}</span></td>
      <td class=\"px-3 py-2.5 text-gray-400 text-xs\">${c.emitido_por||c.criado_por||'—'}</td>
      <td class=\"px-2 py-2.5 text-center\">
        ${master ? `<button onclick=\"reverterEmitido(${c.id})\" class=\"text-xs px-2 py-1 rounded-lg border transition\" style=\"color:var(--accent);border-color:var(--accent);background:transparent;\" title=\"Reverter para Análises\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"/><polyline points=\"16 17 21 12 16 7\"/><line x1=\"21\" y1=\"12\" x2=\"9\" y2=\"12\"/></svg></button>` : ''}
        ${master ? `<button onclick=\"excluirCliente(${c.id})\" class=\"ml-1 text-gray-500 hover:text-red-500 transition\" title=\"Excluir\">🗑️</button>` : ''}
      </td>
    </tr>`;
  }).join('');
  atualizarStatsEmitidos();
}
