// ========== INDICAÇÕES (autocomplete) ==========

function carregarIndicacoes() {
  try {
    const saved = localStorage.getItem(INDICACOES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch(e) { return []; }
}

function salvarIndicacoes(lista) {
  localStorage.setItem(INDICACOES_KEY, JSON.stringify(lista));
}

function extrairIndicacoesDoBanco() {
  const nomes = new Set();
  clientes.forEach(c => {
    const ind = (c.indicacao || '').trim();
    if (ind && ind !== 'Sem indicação') nomes.add(ind);
  });
  return Array.from(nomes);
}

function sincronizarIndicacoes() {
  const salvas = carregarIndicacoes();
  const doBanco = extrairIndicacoesDoBanco();
  const nomesSalvos = new Set(salvas.map(i => i.nome));
  let changed = false;
  doBanco.forEach(nome => {
    if (!nomesSalvos.has(nome)) {
      salvas.push({ nome, tipo: 'Outro', adicionado_em: new Date().toISOString(), _legado: true });
      changed = true;
    }
  });
  if (changed) salvarIndicacoes(salvas);
  return salvas;
}

function popularDatalistIndicacoes() {
  const lista = sincronizarIndicacoes();
  const dl = document.getElementById('indicacaoSuggestions');
  if (!dl) return;
  dl.innerHTML = lista.map(i => `<option value="${i.nome.replace(/"/g,'&quot;')}">${i.tipo || ''}</option>`).join('');

}

function atualizarSugestoesIndicacao() {
  const datalist = document.getElementById('indicacaoSuggestions');
  if (!datalist) return;
  const sugestoes = [...new Set(clientes.map(c => c.indicacao).filter(Boolean))].sort();
  datalist.innerHTML = sugestoes.map(s => `<option value="${s.replace(/"/g,'&quot;')}">`).join('');
}

// ========== PARCEIROS ==========

function abrirModalParceiros() {
  const modal = document.getElementById('modalParceiros');
  const container = document.getElementById('modalParceirosLista');
  if (!modal || !container) return;
  const lista = carregarIndicacoes();
  if (lista.length === 0) {
    container.innerHTML = '<div class="text-xs text-center py-8" style="color:var(--text-muted);">Nenhum parceiro cadastrado</div>';
  } else {
    container.innerHTML = lista.map(i => {
      const tipoIcon = i.tipo === 'Corretor' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' : i.tipo === 'Gerente' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>' : i.tipo === 'Imobiliária' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><path d="M9 18h6v4H9z"/></svg>' : i.tipo === 'Correspondente' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      return `<div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background:var(--bg-body);">
        <div class="flex items-center gap-2">
          <span style="display:inline-flex;align-items:center;">${tipoIcon}</span>
          <span class="text-sm font-medium">${i.nome}${i.tipo === 'Corretor' && i.imobiliaria ? `<span class="text-xs ml-2" style="color:var(--text-muted);">→ ${i.imobiliaria}</span>` : ''}</span>
          <span class="text-xs" style="color:var(--text-muted);">${i.tipo}</span>
        </div>
        ${isMaster() ? `<div class="flex items-center gap-1">
          <button onclick="editarParceiro('${i.nome.replace(/'/g,"\\'")}', '${i.tipo}')" class="text-xs px-2 py-1 rounded transition" style="background:transparent;color:var(--text-muted);border:none;cursor:pointer;" title="Editar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
          <button onclick="removerParceiro('${i.nome.replace(/'/g,"\\'")}')" class="text-xs px-2 py-1 rounded transition" style="background:transparent;color:var(--text-muted);border:none;cursor:pointer;" title="Remover"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>` : ''}
      </div>`;
    }).join('');
  }
  modal.classList.remove('hidden');
}

function fecharModalParceiros() {
  document.getElementById('modalParceiros').classList.add('hidden');
}

function editarParceiro(nome, tipo) {
  document.getElementById('editParceiroNomeOriginal').value = nome;
  document.getElementById('editParceiroNome').value = nome;
  document.getElementById('editParceiroTipo').value = tipo || 'Outro';
  const lista = carregarIndicacoes();
  const parceiro = lista.find(i => i.nome === nome);
  const imobiliaria = parceiro?.imobiliaria || '';
  document.getElementById('editImobiliaria').value = imobiliaria;
  document.getElementById('editParceiroTipo').dispatchEvent(new Event('change'));
  document.getElementById('modalEditarParceiro').classList.remove('hidden');
}

function fecharModalEditarParceiro() {
  document.getElementById('modalEditarParceiro').classList.add('hidden');
  const imo = document.getElementById('editImobiliaria');
  if (imo) imo.value = '';
  const grp = document.getElementById('editImobiliariaGroup');
  if (grp) grp.classList.add('hidden');
}

function salvarEdicaoParceiro() {
  const nomeOriginal = document.getElementById('editParceiroNomeOriginal').value;
  const novoNome = document.getElementById('editParceiroNome').value.trim();
  const novoTipo = document.getElementById('editParceiroTipo').value;
  if (!novoNome) { mostrarToast('Preencha o nome'); return; }
  
  const lista = carregarIndicacoes();
  const idx = lista.findIndex(i => i.nome === nomeOriginal);
  if (idx < 0) { mostrarToast('Parceiro não encontrado'); return; }
  
  // Check duplicate only if name actually changed
  if (novoNome.toLowerCase() !== nomeOriginal.toLowerCase() &&
      lista.some(i => i.nome.toLowerCase() === novoNome.toLowerCase())) {
    mostrarToast('⚠️ Já existe um parceiro com esse nome');
    return;
  }
  
  // Count how many processes use this partner
  const emUso = clientes.filter(c => (c.indicacao || '').trim() === nomeOriginal).length;
  
  const novaImobiliaria = (document.getElementById('editImobiliaria')?.value || '').trim();

  if (novoNome !== nomeOriginal) {
    // Name changed: update partner entry, old processes keep original name
    lista[idx].nome = novoNome;
    lista[idx].tipo = novoTipo;
    lista[idx].imobiliaria = novaImobiliaria;
    // Keep old name available by adding an alias if processes reference it
    if (emUso > 0 && !lista.some(i => i.nome === nomeOriginal)) {
      lista.push({ nome: nomeOriginal, tipo: novoTipo, imobiliaria: novaImobiliaria, adicionado_em: new Date().toISOString(), _legado: true });
    }
  } else {
    lista[idx].tipo = novoTipo;
    lista[idx].imobiliaria = novaImobiliaria;
  }
  
  salvarIndicacoes(lista);
  popularDatalistIndicacoes();
  fecharModalEditarParceiro();
  abrirModalParceiros(); // refresh
  mostrarToast('✅ Parceiro atualizado' + (emUso > 0 ? ` (${emUso} processos mantêm o nome original)` : ''));
}

function removerParceiro(nome) {
  // Check if in use
  const emUso = clientes.filter(c => (c.indicacao || '').trim() === nome).length;
  const msg = emUso > 0
    ? `"${nome}" está vinculado a ${emUso} processo(s). Remover da lista de parceiros? (os processos manterão o nome)`
    : `Remover "${nome}" da lista de parceiros?`;
  
  if (!confirm(msg)) return;
  const lista = carregarIndicacoes();
  const novaLista = lista.filter(i => i.nome !== nome);
  salvarIndicacoes(novaLista);
  popularDatalistIndicacoes();
  abrirModalParceiros();
  mostrarToast('🗑️ Parceiro removido da lista' + (emUso > 0 ? ` (${emUso} processos mantêm o nome)` : ''));
}

// ========== INDICAÇÃO (modal de adição) ==========

function abrirModalIndicacao() {
  document.getElementById('modalIndicacao').classList.remove('hidden');
  document.getElementById('indNome').focus();
  document.getElementById('indTipo').dispatchEvent(new Event('change'));
}

function fecharModalIndicacao() {
  document.getElementById('modalIndicacao').classList.add('hidden');
  document.getElementById('indNome').value = '';
  const imo = document.getElementById('indImobiliaria');
  if (imo) { imo.value = ''; }
  const imoGrp = document.getElementById('indImobiliariaGroup');
  if (imoGrp) { imoGrp.classList.add('hidden'); }
}

function validarIndicacaoInput(el) {
  const valor = el.value.trim();
  if (!valor) { editarCampoInput(el); return; }
  const lista = carregarIndicacoes();
  const nomes = lista.map(i => i.nome.toLowerCase());
  if (!nomes.includes(valor.toLowerCase())) {
    // Check if it exists in the DB with different case
    const match = lista.find(i => i.nome.toLowerCase() === valor.toLowerCase());
    if (match) {
      el.value = match.nome; // Use correct case
      editarCampoInput(el);
    } else {
      mostrarToast('⚠️ Indicação não cadastrada. Use o botão + para adicionar.');
      el.value = el.dataset.oldValue || '';
      el.focus();
    }
  } else {
    editarCampoInput(el);
  }
}

function adicionarIndicacao() {
  const tipo = document.getElementById('indTipo').value;
  const nome = document.getElementById('indNome').value.trim();
  if (!nome) { mostrarToast('Preencha o nome'); return; }
  const nomeCompleto = nome;
  
  const lista = carregarIndicacoes();
  // Evitar duplicata
  if (lista.some(i => i.nome.toLowerCase() === nomeCompleto.toLowerCase())) {
    const existente = lista.find(i => i.nome.toLowerCase() === nomeCompleto.toLowerCase());
    mostrarToast('⚠️ Parceiro já cadastrado: ' + existente.nome + ' (' + (existente.tipo || 'Outro') + ')');
    return;
  }
  const imobiliaria = (document.getElementById('indImobiliaria')?.value || '').trim();
  lista.push({ nome: nomeCompleto, tipo, imobiliaria, adicionado_em: new Date().toISOString() });
  salvarIndicacoes(lista);
  popularDatalistIndicacoes();
  fecharModalIndicacao();
  mostrarToast('✅ Indicação adicionada: ' + nomeCompleto);
}
