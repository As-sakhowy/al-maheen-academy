(() => {
  const settings = window.ALMAHEEN_SUPABASE || {};
  const configured = settings.url && settings.anonKey && !settings.url.includes('PASTE_') && !settings.anonKey.includes('PASTE_');
  if (!window.supabase || !configured) {
    const msg = 'Supabase browser settings are not configured yet. Follow ADMIN-SETUP.md.';
    const target = document.getElementById('loginMessage');
    if (target) target.textContent = msg;
    window.amaAuthReady = Promise.resolve(null);
    return;
  }
  const client = window.supabase.createClient(settings.url, settings.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  window.amaSupabase = client;
  window.amaAuthReady = client.auth.getSession().then(({ data }) => data.session || null);

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      const button = document.getElementById('loginButton');
      const message = document.getElementById('loginMessage');
      button.disabled = true; button.textContent = 'Signing in…'; message.textContent = '';
      const { data, error } = await client.auth.signInWithPassword({ email: document.getElementById('email').value.trim(), password: document.getElementById('password').value });
      if (error) { message.textContent = error.message; button.disabled = false; button.textContent = 'Sign in securely'; return; }
      const result = await fetch('../api/admin?action=overview', { headers: { Authorization: `Bearer ${data.session.access_token}` } });
      if (!result.ok) { await client.auth.signOut(); const payload = await result.json().catch(() => ({})); message.textContent = payload.error || 'This account could not be verified as an administrator.'; button.disabled = false; button.textContent = 'Sign in securely'; return; }
      window.location.href = 'index.html';
    });
    client.auth.getSession().then(({ data }) => { if (data.session) window.location.href = 'index.html'; });
  }
})();
