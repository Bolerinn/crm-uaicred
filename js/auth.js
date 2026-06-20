// ========== AUTH ==========
const NOME_PARA_EMAIL = {
  'douglas': 'contatoadouglas@gmail.com',
  'luana': 'salvador+luana@primeassessoria.net',
  'fernanda': 'salvador+fernanda@primeassessoria.net',
  'marjore': 'salvador+marjore@primeassessoria.net',
  'teste': 'salvador+teste@primeassessoria.net',
};

async function entrar() {
  try {
  const nomeDigitado = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');

  if (!nomeDigitado || !password) {
    errorEl.textContent = 'Preencha nome e senha.';
    errorEl.classList.remove('hidden');
    return;
  }

  const email = NOME_PARA_EMAIL[nomeDigitado.toLowerCase()];
  if (!email) {
    errorEl.textContent = 'Nome não encontrado.';
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.textContent = 'Entrando...';
  errorEl.classList.remove('hidden');

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
    return;
  }

  usuarioEmail = data.user.email;

  const precisaTrocar = await initProfile();

  document.getElementById('sidebarUser').textContent = usuarioNome || data.user.email.split('@')[0];
  document.getElementById('sidebarAvatar').textContent = (usuarioNome || 'U')[0].toUpperCase();
  document.getElementById('sidebarRole').textContent = usuarioTipo === 'master' ? 'Master' : 'Usuário';

  if (usuarioTipo === 'master') {
      document.body.classList.add('master');
    document.querySelectorAll('.nav-master').forEach(el => el.classList.add('visible'));
  }

  if (precisaTrocar) {
    document.getElementById('pwChangeScreen').classList.remove('hidden');
    return;
  }

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  await carregarDados();
  ouvirTempoReal();
  } catch(e) {
    document.getElementById('loginError').textContent = 'Erro: ' + e.message;
    document.getElementById('loginError').classList.remove('hidden');
  }
}

async function sair() {
  await sb.auth.signOut();
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('pwChangeScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

// ========== PASSWORD CHANGE ==========
function validarPw() {
  const nova = document.getElementById('pwNew').value;
  const conf = document.getElementById('pwConfirm').value;
  const newMsg = document.getElementById('pwNewMsg');
  const confMsg = document.getElementById('pwConfirmMsg');
  const btn = document.getElementById('pwSaveBtn');

  let ok = true;

  if (nova.length < 8) {
    newMsg.innerHTML = '<span class="invalido">✗ Mínimo 8 caracteres</span>';
    ok = false;
  } else {
    newMsg.innerHTML = '<span class="valido">✓ Ok</span>';
  }

  if (!conf) {
    confMsg.innerHTML = '';
    ok = false;
  } else if (conf !== nova) {
    confMsg.innerHTML = '<span class="invalido">✗ Senhas não conferem</span>';
    ok = false;
  } else {
    confMsg.innerHTML = '<span class="valido">✓ Ok</span>';
  }

  btn.disabled = !ok;
}

async function salvarNovaSenha() {
  const nova = document.getElementById('pwNew').value;
  const conf = document.getElementById('pwConfirm').value;
  const errEl = document.getElementById('pwError');
  const btn = document.getElementById('pwSaveBtn');

  if (nova.length < 8 || nova !== conf) return;
  btn.disabled = true;
  btn.textContent = 'Salvando...';
  errEl.classList.add('hidden');

  const { error } = await sb.auth.updateUser({ password: nova });
  if (error) {
    errEl.textContent = error.message;
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Salvar e Entrar';
    return;
  }

  await sb.auth.updateUser({ data: { force_password_change: false } });
  mostrarToast('Senha alterada com sucesso 🔒');

  document.getElementById('pwChangeScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');

  // Show master nav if applicable
  if (usuarioTipo === 'master') {
      document.body.classList.add('master');
    document.querySelectorAll('.nav-master').forEach(el => el.classList.add('visible'));
  }

  await carregarDados();
  ouvirTempoReal();
}

async function sairForcarSenha() {
  await sb.auth.signOut();
  document.getElementById('pwChangeScreen').classList.add('hidden');
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginScreen').classList.remove('hidden');
}

// ========== THEME ==========
function toggleSenha(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  btn.innerHTML = isPassword ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="m14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  btn.title = isPassword ? 'Ocultar senha' : 'Mostrar senha';
}

function toggleTema() {
  const isDark = document.documentElement.hasAttribute('data-theme');
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('tema', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('tema', 'dark');
  }
  mostrarToast(isDark ? 'Modo claro ☀️' : 'Modo noturno 🌙');
}

// ========== SETTINGS ==========
async function abrirConfiguracoes() {
  const modal = document.getElementById('settingsModal');
  const content = document.getElementById('settingsContent');
  modal.classList.remove('hidden');

  const { data: { user } } = await sb.auth.getUser();
  const meta = user?.user_metadata || {};
  const tipo = usuarioTipo || meta.tipo || 'user';
  const nome = usuarioNome || meta.nome || user?.email?.split('@')[0] || '';

  let html = '';

  html += `
    <div class="theme-toggle" onclick="toggleTema()">
      <span class="theme-toggle-label">🌙 Modo Noturno</span>
      <div class="toggle-switch"></div>
    </div>
    <div class="rounded-xl p-4 mb-4 border" style="background:var(--bg-card);border-color:var(--border);">
      <div class="flex items-center justify-between mb-2">
        <span class="font-semibold" style="color:var(--text);">Meu Perfil</span>
        <span class="text-xs px-2 py-0.5 rounded-full ${tipo === 'master' ? 'bg-amber-900/30 text-amber-400' : 'bg-gray-800 text-gray-400'}">${tipo === 'master' ? '👑 Master' : '👤 Usuário'}</span>
      </div>
      <div class="space-y-2">
        <div>
          <label class="text-xs text-gray-500">Nome</label>
          <input id="settingsNome" class="input-fw text-sm" value="${nome.replace(/"/g,'&quot;')}">
        </div>
        <div>
          <label class="text-xs text-gray-500">E-mail</label>
          <p class="text-sm py-2" style="color:var(--text-secondary);">${user?.email || ''}</p>
        </div>
      </div>
      <div class="flex gap-2 mt-3">
        <button onclick="salvarMeuNome()" class="btn-primary text-sm">Salvar Nome</button>
        <button onclick="abrirAltSenha()" class="btn-secondary text-sm">Alterar Senha</button>
      </div>
    </div>`;

  if (tipo === 'master') {
    html += `<div class="rounded-xl border overflow-hidden" style="background:var(--bg-card);border-color:var(--border);">
      <div class="px-4 py-2 border-b" style="background:var(--bg-sidebar);border-color:var(--border);">
        <span class="font-semibold text-sm" style="color:var(--text);">Usuários do CRM</span>
      </div>
      <div id="usersList" class="p-2 text-sm" style="color:var(--text-muted);">Carregando...</div>
    </div>`;
  }

  html += `
    <div id="altSenhaModal" class="hidden mt-4 rounded-xl p-4 border" style="background:var(--bg-card);border-color:var(--border);">
      <p class="font-semibold text-sm mb-3" style="color:var(--text);">Alterar Senha</p>
      <div class="space-y-2">
        <div><input id="altPwAtual" type="password" class="input-fw text-sm" placeholder="Senha atual"></div>
        <div><input id="altPwNova" type="password" class="input-fw text-sm" placeholder="Nova senha (mín 8 caracteres)"></div>
        <div><input id="altPwConf" type="password" class="input-fw text-sm" placeholder="Confirmar nova senha"></div>
      </div>
      <p id="altPwError" class="text-red-400 text-xs mt-2 hidden"></p>
      <div class="flex gap-2 mt-3">
        <button onclick="alterarSenhaSettings()" class="btn-primary text-sm">Salvar</button>
        <button onclick="fecharAltSenha()" class="btn-secondary text-sm">Cancelar</button>
      </div>
    </div>`;

  content.innerHTML = html;

  if (tipo === 'master') {
    carregarListaUsuarios();
  }
}

function fecharConfig() {
  document.getElementById('settingsModal').classList.add('hidden');
}

async function salvarMeuNome() {
  const novoNome = document.getElementById('settingsNome').value.trim();
  if (!novoNome) { mostrarToast('Digite um nome'); return; }
  const { error } = await sb.auth.updateUser({ data: { nome: novoNome } });
  if (error) { mostrarToast('Erro ao salvar'); return; }
  usuarioNome = novoNome;
  document.getElementById('sidebarUser').textContent = novoNome;
  document.getElementById('sidebarAvatar').textContent = novoNome[0].toUpperCase();
  mostrarToast('Nome atualizado ✅');
}

async function abrirAltSenha() {
  document.getElementById('altSenhaModal').classList.remove('hidden');
  document.getElementById('altPwError').classList.add('hidden');
  document.getElementById('altPwAtual').value = '';
  document.getElementById('altPwNova').value = '';
  document.getElementById('altPwConf').value = '';
}

function fecharAltSenha() {
  document.getElementById('altSenhaModal').classList.add('hidden');
}

async function alterarSenhaSettings() {
  const atual = document.getElementById('altPwAtual').value;
  const nova = document.getElementById('altPwNova').value;
  const conf = document.getElementById('altPwConf').value;
  const errEl = document.getElementById('altPwError');

  if (!atual || !nova || !conf) {
    errEl.textContent = 'Preencha todos os campos';
    errEl.classList.remove('hidden'); return;
  }
  if (nova.length < 8) {
    errEl.textContent = 'Nova senha: mínimo 8 caracteres';
    errEl.classList.remove('hidden'); return;
  }
  if (nova !== conf) {
    errEl.textContent = 'Senhas não conferem';
    errEl.classList.remove('hidden'); return;
  }

  const email = (await sb.auth.getUser()).data?.user?.email;
  const { error: signInError } = await sb.auth.signInWithPassword({ email, password: atual });
  if (signInError) {
    errEl.textContent = 'Senha atual incorreta';
    errEl.classList.remove('hidden'); return;
  }

  const { error } = await sb.auth.updateUser({ password: nova });
  if (error) {
    errEl.textContent = error.message;
    errEl.classList.remove('hidden'); return;
  }

  mostrarToast('Senha alterada com sucesso 🔒');
  fecharAltSenha();
}

async function carregarListaUsuarios() {
  const el = document.getElementById('usersList');
  try {
    const { data, error } = await sb.from('profiles').select('*').order('created_at');
    if (error || !data) {
      el.innerHTML = '<p class="p-2" style="color:var(--text-muted);">Use o metadata do Auth. Lista via admin em breve.</p>';
      return;
    }
    let html = '<table class="w-full text-xs"><thead><tr class="text-left text-gray-500 uppercase"><th class="px-2 py-1">Nome</th><th class="px-2 py-1">Email</th><th class="px-2 py-1">Tipo</th></tr></thead><tbody>';
    for (const p of data) {
      html += `<tr style="border-top:1px solid var(--border);"><td class="px-2 py-1" style="color:var(--text-secondary);">${p.nome}</td><td class="px-2 py-1" style="color:var(--text-secondary);">${p.email}</td><td class="px-2 py-1">${p.tipo === 'master' ? '👑 Master' : 'Usuário'}</td></tr>`;
    }
    html += '</tbody></table>';
    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = '<p class="p-2" style="color:var(--text-muted);">Tabela de perfis não disponível.</p>';
  }
}
