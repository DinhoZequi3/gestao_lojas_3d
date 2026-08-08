const SUPABASE_URL = "https://rmuwpurdjpasxbangrvy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KdoppxbhUU5BjCC2BhP3_Q_hmtZmnb9";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const loginScreen = document.getElementById("login-screen");
const appRoot = document.querySelector(".app");
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const loginButton = document.getElementById("login-submit");
const logoutButton = document.getElementById("btn-logout");

// Mantemos também uma cópia local como segurança/offline.
const localDbSaveState = dbSaveState;
let activeUserId = null;
let loadedUserId = null;
let activationPromise = null;

function showLogin() {
  loginScreen.hidden = false;
  appRoot.hidden = true;
}

function showApp() {
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

// Substitui a persistência do app: salva localmente E no Supabase quando há usuário logado.
dbSaveState = async function cloudDbSaveState(value) {
  await localDbSaveState(value);
  if (!activeUserId) return;

  const { error } = await supabaseClient
    .from("app_state")
    .upsert({
      user_id: activeUserId,
      state: value,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

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

  if (loadedUserId === session.user.id) {
    showApp();
    return;
  }

  if (activationPromise) return activationPromise;

  activationPromise = (async () => {
    await waitForLocalAppInit();
    activeUserId = session.user.id;
    setCloudHint("Conectando ao banco online…");

    const { data, error } = await supabaseClient
      .from("app_state")
      .select("state")
      .eq("user_id", activeUserId)
      .maybeSingle();

    if (error) {
      console.error("Falha ao carregar dados online.", error);
      setCloudHint("Não foi possível carregar o banco online. Usando a cópia deste navegador.");
      loadedUserId = activeUserId;
      showApp();
      return;
    }

    if (data && data.state) {
      // Já há dados na nuvem: eles viram a fonte principal e também atualizam o cache local.
      state = normalizeState(data.state);
      await localDbSaveState(state);
      redrawAppFromState();
      setCloudHint("Dados sincronizados online com sua conta.");
    } else {
      // Primeira utilização: leva para a nuvem os dados que já existiam neste navegador.
      await dbSaveState(state);
      setCloudHint("Dados deste navegador enviados para o banco online.");
    }

    loadedUserId = activeUserId;
    showApp();
  })();

  try {
    await activationPromise;
  } finally {
    activationPromise = null;
  }
}

async function checkSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    showLogin();
    return;
  }
  await activateSession(data.session);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  loginButton.disabled = true;
  loginButton.textContent = "Entrando...";

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: loginEmail.value.trim(),
    password: loginPassword.value,
  });

  loginButton.disabled = false;
  loginButton.textContent = "Entrar";

  if (error) {
    loginError.textContent = friendlyAuthError(error);
    return;
  }

  loginPassword.value = "";
  await activateSession(data.session);
});

logoutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  activeUserId = null;
  loadedUserId = null;
  loginPassword.value = "";
  showLogin();
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
  // Executa fora do callback interno do Auth para evitar chamadas aninhadas ao Supabase.
  setTimeout(() => {
    if (session) activateSession(session);
    else {
      activeUserId = null;
      loadedUserId = null;
      showLogin();
    }
  }, 0);
});

checkSession();
