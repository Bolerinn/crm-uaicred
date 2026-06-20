// ========== KEYBOARD SHORTCUTS ==========
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && e.target.hasAttribute('contenteditable')) {
    e.preventDefault();
    e.target.blur();
  }
});

// ========== SESSION RESUME ==========
(async () => {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      usuarioEmail = session.user.email;

      const precisaTrocar = await initProfile();

      document.getElementById('sidebarUser').textContent = usuarioNome || session.user.email.split('@')[0];
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
    }
  } catch(e) {
    console.error('Session resume error:', e);
  }
})();
