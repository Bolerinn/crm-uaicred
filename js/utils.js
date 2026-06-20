// ========== TOAST ==========
function mostrarToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2500);
}

function mostrarToastDesfazer(nome, id) {
  const t = document.getElementById('toast');
  t.innerHTML = '🗑️ "' + nome + '" movido para lixeira &nbsp;<button onclick="restaurarCliente(' + id + ')" style="background:#f97316;color:#fff;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-weight:600;">DESFAZER</button>';
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.classList.remove('show'); t.innerHTML = ''; }, 8000);
}

// ========== FILTERS ==========
function filtrarStatus(status, btn) {
  if (tabAtivo === 'andamento') {
    filtroStatusAndamento = status;
    document.querySelectorAll('#filtrosStatusAndamento .filter-btn-status').forEach(b => b.classList.remove('active'));
  } else {
    filtroStatus = status;
    document.querySelectorAll('#filtrosStatus .filter-btn-status').forEach(b => b.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');
  renderizarTabelas();
}

function filtrarProduto(produto, btn) {
  if (tabAtivo === 'andamento') {
    filtroProdutoAndamento = produto;
    document.querySelectorAll('#filtrosProdutoAndamento .filter-btn-produto').forEach(b => b.classList.remove('active'));
  } else {
    filtroProduto = produto;
    document.querySelectorAll('#filtrosProdutoAnalises .filter-btn-produto').forEach(b => b.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');
  renderizarTabelas();
}

function filtrarResultadoAnalises(resultado, btn) {
  filtroResultadoAnalises = resultado;
  document.querySelectorAll('#filtrosResultadoAnalises .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add("active");
  renderizarTabelaAnalises();
  atualizarStats();
}

function filtrarBancoAnalises(banco, btn) {
  filtroBancoAnalises = banco;
  document.querySelectorAll('#filtrosBancoAnalises .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add("active");
  renderizarTabelaAnalises();
  atualizarStats();
}

function irParaMesAtualAnalises() {
  mesAtual = new Date().getMonth();
  anoAtual = new Date().getFullYear();
  renderizarMesSelectorAnalises();
  renderizarTabelaAnalises();
  mesSelecionado = String(anoAtual)+'-'+String(mesAtual+1).padStart(2,'0');
  atualizarStats();
}

function mudarMesAnalises(delta) {
  mesAtual += delta;
  if (mesAtual < 0) { mesAtual = 11; anoAtual--; }
  if (mesAtual > 11) { mesAtual = 0; anoAtual++; }
  renderizarMesSelectorAnalises();
  renderizarTabelaAnalises();
  atualizarStats();
}

// ========== MÁSCARAS & FORMATAÇÕES ==========
function mascaraCPF(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 11);
  v = v.replace(/^(\d{3})(\d)/, '$1.$2');
  v = v.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
  v = v.replace(/\.(\d{3})(\d)/, '.$1-$2');
  input.value = v;
}
function apenasNumeros(input) {
  input.value = input.value.replace(/\D/g, '');
}
function capitalizarCliente(el) {
  const txt = el.textContent.trim();
  if (!txt) return;
  el.textContent = txt.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
}
function formatarMoeda(input) {
  let v = input.value.replace(/\D/g, '');
  if (!v) { input.value = ''; return; }
  const num = parseInt(v, 10);
  input.value = 'R$ ' + num.toLocaleString('pt-BR');
}
function mascaraData(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 8);
  v = v.replace(/^(\d{2})(\d)/, '$1/$2');
  v = v.replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
  input.value = v;
}
function editarCampo(el) {
  const id = parseInt(el.dataset.id);
  const campo = el.dataset.campo;
  atualizarCampo(id, campo, el.textContent.trim());
}

function editarCampoInput(el) {
  const id = parseInt(el.dataset.id);
  const campo = el.dataset.campo;
  atualizarCampo(id, campo, el.value.trim());
}

function mudarMes(delta) {
  const [ano, mes] = mesSelecionado.split('-').map(Number);
  const d = new Date(ano, mes - 1 + delta, 1);
  mesSelecionado = d.toISOString().slice(0,7);
  renderizarTudo();
}

function filtrarBancoEmitidos(banco, btn) {
  filtroBancoEmitidos = banco;
  document.querySelectorAll('#filtrosBancoEmitidos .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderizarTabelaEmitidos();
  atualizarStatsEmitidos();
}

function filtrarProdutoEmitidos(produto, btn) {
  filtroProdutoEmitidos = produto;
  document.querySelectorAll('#filtrosProdutoEmitidos .filter-btn-produto').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderizarTabelaEmitidos();
  atualizarStatsEmitidos();
}

function filtrarEmitidos(filtro, btn) {
  filtroEmitidos = filtro;
  document.querySelectorAll('#filtrosEmitidos .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderizarTabelaEmitidos();
  atualizarStatsEmitidos();
}

function exportarCSV() {
  const headers = ['Indicação','Cliente','CPF','Agência','Valor Imóvel','Valor Financiado','Produto','Banco','Início','Status','Obs'];
  const rows = clientes.map(c => [
    c.indicacao, c.cliente, c.cpf, c.agencia, c.valor_imovel, c.valor_financiado, c.produto, c.banco, c.data_vistoria,
    STATUS_OPTS.find(s => s.id === c.status)?.label || c.status, c.obs
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.map(v => '"'+(v||'')+'"').join(','))].join("\n");
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'rede-prime-clientes.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  mostrarToast('CSV exportado 📥');
}

function exportarExcel() {
  const headers = ['Indicação','Cliente','CPF','Agência','Valor Imóvel','Valor Financiado','Produto','Banco','Início','Status','Obs'];
  const rows = clientes.map(c => [
    c.indicacao, c.cliente, c.cpf, c.agencia, c.valor_imovel, c.valor_financiado, c.produto, c.banco, c.data_vistoria,
    STATUS_OPTS.find(s => s.id === c.status)?.label || c.status, c.obs
  ]);
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch:22 },{ wch:26 },{ wch:16 },{ wch:22 },{ wch:16 },{ wch:16 },{ wch:10 },{ wch:12 },{ wch:16 },{ wch:22 },{ wch:30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Processos');
  XLSX.writeFile(wb, 'rede-prime-processos.xlsx');
  mostrarToast('Planilha exportada 📊');
}

function filtrarBancoAndamento(banco, btn) {
  filtroBancoAndamento = banco;
  document.querySelectorAll('#filtrosBancoAndamento .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderizarTabelaAndamento();
  atualizarStatsAndamento();
}
