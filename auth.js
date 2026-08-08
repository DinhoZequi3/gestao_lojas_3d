const SUPABASE_URL = "https://rmuwpurdjpasxbangrvy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KdoppxbhUU5BjCC2BhP3_Q_hmtZmnb9";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const loginScreen = document.getElementById("login-screen");
const appRoot = document.querySelector(".app");
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login