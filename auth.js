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

function showLogin() {
  loginScreen.hidden = false;
  appRoot.hidden = true;
}

function showApp() {
  loginScreen.hidden = true;
  appRoot.hidden = false;
}

function friendlyAuthError(error) {
  const message = (error && error.message ? error.message : "").toLowerCase();
  if (message.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("rate limit")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  return "Não foi possível entrar. Confira seus dados e tente novamente.";
}

async function checkSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) showLogin();
  else showApp();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  loginButton.disabled = true;
  loginButton.textContent = "Entrando...";

  const { error } = await supabaseClient.auth.signInWithPassword({
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
  showApp();
});

logoutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  loginPassword.value = "";
  showLogin();
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) showApp();
  else showLogin();
});

checkSession();
