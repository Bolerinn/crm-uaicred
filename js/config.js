// ========== SUPABASE CONFIG ==========
const SUPABASE_URL = 'https://dztiktcvueorlafiocdf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jsQh5PSYqwvGcJeS2CRWRw_jhhO59PK';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Admin client (fallback — será removido quando RPC functions estiverem no ar)
const SERVICE_ROLE_KEY = 'eyJhbG...YRpU';
const sbAdmin = supabase.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// === profiles-init ===
// (initProfile, isMaster, getProfile definidos inline no HTML — não duplicar aqui)

// ========== STATE ==========
const STATUS_OPTS = [
  { id: 'aguardando-doc',  label: 'Aguardando Documentação' },
  { id: 'aguardando-vis',  label: 'Aguardando Vistoria' },
  { id: 'aguardando-laudo',label: 'Aguardando Laudo' },
  { id: 'conformidade',    label: 'Conformidade' },
  { id: 'em-registro',     label: 'Em Registro' },
  { id: 'checklist-i',     label: 'Checklist I' },
  { id: 'checklist-ii',    label: 'Checklist II' },
  { id: 'analise-juridica',label: 'Análise Jurídica' },
  { id: 'emitido',         label: 'Contrato Emitido' },
];
const PRODUTO_OPTS = ['SBPE', 'FGTS', 'FGTS a vista', 'HomeEquity', 'Terreno', 'Comercial', 'Construção'];
const BANCO_OPTS = ['','Caixa','Bradesco','Itaú','Santander','Inter'];
const STATUS_POR_BANCO = {
  '':           ['aguardando-doc','aguardando-vis','emitido'],
  'Caixa':      ['aguardando-doc','aguardando-vis','aguardando-laudo','conformidade','emitido'],
  'Bradesco':   ['aguardando-doc','checklist-i','aguardando-vis','checklist-ii','emitido'],
  'Itaú':       ['aguardando-doc','aguardando-vis','analise-juridica','emitido'],
  'Santander':  ['aguardando-doc','aguardando-vis','analise-juridica','emitido'],
  'Inter':      ['aguardando-doc','aguardando-vis','analise-juridica','emitido'],
};
function getStatusOpts(banco, currentStatus) {
  const opts = STATUS_POR_BANCO[banco] || STATUS_POR_BANCO[''];
  const validStatus = opts.includes(currentStatus) ? currentStatus : opts[0];
  return { opts, validStatus };
}
function getStatusLabel(statusId) {
  return (STATUS_OPTS.find(s => s.id === statusId) || {}).label || statusId || '—';
}

let clientes = [];
let usuarioEmail = '';
let filtroStatus = 'todos';
let filtroProduto = 'todos';
let filtroResultadoAnalises = 'todos';
let filtroBancoAnalises = 'todos';
let filtroStatusAndamento = 'todos';
let filtroProdutoAndamento = 'todos';
let filtroBancoAndamento = 'todos';
let filtroProdutoEmitidos = 'todos';
let filtroBancoEmitidos = 'todos';
let filtroEmitidos = 'todos';
let mesSelecionado = new Date().toISOString().slice(0,7); // YYYY-MM
let tabAtivo = 'dashboard';
let mesAtual = new Date().getMonth(); // 0-11
let anoAtual = new Date().getFullYear();
let adicionando = false;
let ultimaEdicao = null;
const deletedIds = new Set(); // mantido para compatibilidade com realtime

// ========== AUTH ==========
const NOME_PARA_EMAIL = {
  'douglas': 'contatoadouglas@gmail.com',
  'luana': 'salvador+luana@primeassessoria.net',
  'fernanda': 'salvador+fernanda@primeassessoria.net',
  'marjore': 'salvador+marjore@primeassessoria.net',
  'teste': 'salvador+teste@primeassessoria.net',
};

let ultimoExcluido = null; // para desfazer

// ========== REALTIME ==========
let _rtChannel = null;

// ========== INDICAÇÕES (autocomplete) ==========
const INDICACOES_KEY = 'crm_indicacoes';

// ========== RESULTADO CYCLE (per bank) ==========
const RESULTADO_CYCLE = ['', 'aprovado', 'condicionado', 'reprovado'];
const RESULTADO_LABELS = { 'aprovado': '✅ APROVADO', 'condicionado': '⚠️ CONDICIONADO', 'reprovado': '❌ REPROVADO' };
const RESULTADO_COLORS = { 'aprovado': 'color:#059669;', 'condicionado': 'color:#d97706;', 'reprovado': 'color:#dc2626;' };

let _dupLock = false;

// ========== LIXEIRA ==========
let clientesLixeira = [];

let metricaPeriodo = 'este-mes'; // este-mes | mes-passado | 12-meses | personalizado
let metricaEmpresa = 'todas';    // todas | caixa | privados
let metricaDataInicio = '';
let metricaDataFim = '';
