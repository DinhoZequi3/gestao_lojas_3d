const SUPABASE_URL = "https://rmuwpurdjpasxbangrvy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KdoppxbhUU5BjCC2BhP3_Q_hmtZmnb9";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const loginScreen = document.getElementById("login-screen");
const appRoot = document.querySelector(".app");
const loginForm = document.getElementById("login-form");
const forgotForm = document.getElementById("forgot-form");
const resetForm = document.getElementById("reset-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const loginButton = document.getElementById("login-submit");
const logoutButton = document.getElementById("btn-logout");
const forgotEmail = document.getElementById("forgot-email");
const forgotMessage = document.getElementById("forgot-message");
const forgotButton = document.getElementById("forgot-submit");
const newPassword = document.getElementById("new-password");
const confirmPassword = document.getElementById("confirm-password");
const resetError = document.getElementById("reset-error");
const resetMessage = document.getElementById("reset-message");
const resetButton = document.getElementById("reset-submit");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");

const localDbSaveState = dbSaveState;
let activeUserId = null;
let loadedUserId = null;
let activationPromise = null;
let recoveryMode = false;

function showOnlyAuthForm(form) {
  loginForm.hidden = form !== loginForm;
  forgotForm.hidden = form !== forgotForm;
  resetForm.hidden = form !== resetForm;
}

function showLogin() {
  loginScreen.hidden = false;
  appRoot.hidden = true;
  if (!recoveryMode) {
    showOnlyAuthForm(loginForm);
    authTitle.textContent = "Gestão de Lojas";
    authSubtitle.textContent = "Entre para acessar o painel da loja Zequi Gamer.";
  }
}

function showForgot() {
  loginScreen.hidden = false;
  appRoot.hidden = true;
  showOnlyAuthForm(forgotForm);
  authTitle.textContent = "Recuperar senha";
  authSubtitle.textContent = "Informe seu e-mail cadastrado para receber o link de recuperação.";
  forgotMessage.textContent = "";
  forgotEmail.value = loginEmail.value.trim();
}

function showReset() {
  recoveryMode = true;
  loginScreen.hidden = false;
  appRoot.hidden = true;
  showOnlyAuthForm(resetForm);
  authTitle.textContent = "Criar nova senha";
  authSubtitle.textContent = "Escolha uma nova senha para sua conta.";
  resetError.textContent = "";
  resetMessage.textContent = "";
}

function showApp() {
  if (recoveryMode) return;
  loginScreen.hidden = true;
  appRoot.hidden = false;
}

function setCloudHint(text) {
  const hint = document.querySelector(".sidebar-footer .hint");
  if (hint) hint.textContent = text;
}

function friendlyAuthError(error) {
  const message = (error && error.message ? error.message : "").toLowerCase();
  if (message.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("rate limit")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  return "Não foi possível entrar. Confira seus dados e tente novamente.";
}

function waitForLocalAppInit() {
  return new Promise(resolve => {
    const started = Date.now();
    const timer = setInterval(() => {
      const content = document.getElementById("content");
      const stillLoading = content && content.textContent.includes("Carregando dados");
      if (!stillLoading || Date.now() - started > 5000) {
        clearInterval(timer);
        resolve();
      }
    }, 50);
  });
}

function redrawAppFromState() {
  renderNav();
  renderContent();
  renderBrand();
  applySidebarState();
  applyTheme();
}

dbSaveState = async function cloudDbSaveState(value) {
  await localDbSaveState(value);
  if (!activeUserId) return;

  const { error } = await supabaseClient
    .from("app_state")
    .upsert({ user_id: activeUserId, state: value, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

  if (error) {
    console.error("Falha ao sincronizar dados com o Supabase.", error);
    setCloudHint("Sem sincronização online no momento. Uma cópia continua salva neste navegador.");
    return;
  }
  setCloudHint("Dados sincronizados online com sua conta.");
};

async function activateSession(session) {
  if (!session || !session.user) {
    activeUserId = null;
    loadedUserId = null;
    showLogin();
    return;
  }
  if (recoveryMode) return;
  if (loadedUserId === session.user.id) { showApp(); return; }
  if (activationPromise) return activationPromise;

  activationPromise = (async () => {
    await waitForLocalAppInit();
    activeUserId = session.user.id;
    setCloudHint("Conectando ao banco online…");

    const { data, error } = await supabaseClient.from("app_state").select("state").eq("user_id", activeUserId).maybeSingle();
    if (error) {
      console.error("Falha ao carregar dados online.", error);
      setCloudHint("Não foi possível carregar o banco online. Usando a cópia deste navegador.");
      loadedUserId = activeUserId;
      showApp();
      return;
    }

    if (data && data.state) {
      state = normalizeState(data.state);
      await localDbSaveState(state);
      redrawAppFromState();
      setCloudHint("Dados sincronizados online com sua conta.");
    } else {
      await dbSaveState(state);
      setCloudHint("Dados deste navegador enviados para o banco online.");
    }
    loadedUserId = activeUserId;
    showApp();
  })();

  try { await activationPromise; } finally { activationPromise = null; }
}

async function checkSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) { showLogin(); return; }
  await activateSession(data.session);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  loginButton.disabled = true;
  loginButton.textContent = "Entrando...";
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email: loginEmail.value.trim(), password: loginPassword.value });
  loginButton.disabled = false;
  loginButton.textContent = "Entrar";
  if (error) { loginError.textContent = friendlyAuthError(error); return; }
  loginPassword.value = "";
  await activateSession(data.session);
});

document.getElementById("btn-forgot-password").addEventListener("click", showForgot);
document.getElementById("btn-back-login").addEventListener("click", () => {
  recoveryMode = false;
  showOnlyAuthForm(loginForm);
  authTitle.textContent = "Gestão de Lojas";
  authSubtitle.textContent = "Entre para acessar o painel da loja Zequi Gamer.";
});

forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  forgotMessage.textContent = "";
  forgotButton.disabled = true;
  forgotButton.textContent = "Enviando...";
  const redirectTo = window.location.origin + window.location.pathname;
  try {
    await supabaseClient.auth.resetPasswordForEmail(forgotEmail.value.trim(), { redirectTo });
  } catch (e) {
    console.error("Falha ao solicitar recuperação de senha.", e);
  }
  forgotButton.disabled = false;
  forgotButton.textContent = "Enviar link de recuperação";
  forgotMessage.textContent = "Se esse e-mail estiver cadastrado, enviaremos as instruções de recuperação. Confira também a caixa de spam.";
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetError.textContent = "";
  resetMessage.textContent = "";
  if (newPassword.value.length < 8) { resetError.textContent = "Use uma senha com pelo menos 8 caracteres."; return; }
  if (newPassword.value !== confirmPassword.value) { resetError.textContent = "As duas senhas não são iguais."; return; }
  resetButton.disabled = true;
  resetButton.textContent = "Salvando...";
  const { error } = await supabaseClient.auth.updateUser({ password: newPassword.value });
  resetButton.disabled = false;
  resetButton.textContent = "Salvar nova senha";
  if (error) { resetError.textContent = "Não foi possível alterar a senha. Solicite um novo link de recuperação."; return; }
  resetMessage.textContent = "Senha alterada com sucesso. Você já pode entrar com a nova senha.";
  newPassword.value = "";
  confirmPassword.value = "";
  await supabaseClient.auth.signOut();
  recoveryMode = false;
  setTimeout(() => {
    history.replaceState({}, document.title, window.location.pathname);
    showOnlyAuthForm(loginForm);
    authTitle.textContent = "Gestão de Lojas";
    authSubtitle.textContent = "Entre para acessar o painel da loja Zequi Gamer.";
    showLogin();
  }, 1800);
});

logoutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  activeUserId = null;
  loadedUserId = null;
  loginPassword.value = "";
  showLogin();
});

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    showReset();
    return;
  }
  setTimeout(() => {
    if (recoveryMode) return;
    if (session) activateSession(session);
    else {
      activeUserId = null;
      loadedUserId = null;
      showLogin();
    }
  }, 0);
});

checkSession();
