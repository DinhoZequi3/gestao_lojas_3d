/* ===================== Configuração ===================== */

const STORAGE_KEY = "gestaoLojas3D_v1";

const STORE_META = [
  { key: "shopee", label: "Shopee", color: "#EE4D2D" },
  { key: "ml", label: "Mercado Livre", color: "#FFC400" },
  { key: "tiktok", label: "TikTok Shop", color: "#111111" },
];

const PRINTERS = ["A1", "A1 mini"];
const TIPO_3D = "Impressão 3D";
const TIPO_REVENDA = "Revenda";

const DEVOLUCAO_CATEGORIAS = [
  { key: "defeito", label: "Defeito" },
  { key: "arrependimento", label: "Arrependimento" },
  { key: "nao_encontrado", label: "Não encontrou o cliente" },
];
// dentro de "Defeito" precisa dizer se o produto voltou danificado (perda total dos custos)
// ou se a plataforma pagou o valor do produto (só entra a taxa de R$ 15)
const DEFEITO_SUBTIPOS = [
  { key: "danificado", label: "Defeito de fabricação" },
  { key: "pago_plataforma", label: "Danificado: Pago pela plataforma" },
];
// valor inicial sugerido pro campo "Valor da Devolução" quando marca "Defeito de fabricação"
// (o usuário pode editar esse valor livremente, caso a caso)
const DEFAULT_VALOR_DEVOLUCAO = 15.0;

// custo fixo de etiqueta + QR code, cobrado em todo produto de todas as lojas
const CUSTO_ETIQUETA = 0.10;

/* ===================== Estado ===================== */

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultState() {
  const fil1 = uid(), fil2 = uid(), fil3 = uid();
  const packA = uid(), packB = uid();
  const exampleProduct3D = (impressora, filamentoId, data, numeroPedido) => ({
    id: uid(),
    example: true,
    produto: "(exemplo) Vaso Geométrico P",
    data,
    numeroPedido,
    tipo: TIPO_3D,
    impressora,
    filamentoId,
    precoVenda: 45.0,
    recebido: 38.7,
    taxaME: false,
    peso: 120,
    tempo: 3.5,
    embalagemId: packA,
    gastoLevar: 1.0,
  });

  const exampleProdutoRevenda = (data, numeroPedido) => ({
    id: uid(),
    example: true,
    produto: "(exemplo) Mini Console Portátil",
    data,
    numeroPedido,
    tipo: TIPO_REVENDA,
    precoVenda: 89.9,
    recebido: 76.0,
    taxaME: false,
    insumos: 25.0,
    embalagemId: packB,
    gastoLevar: 1.0,
  });

  return {
    filaments: [
      { id: fil1, nome: "PLA Preto Genérico", preco: 79.9, obs: "exemplo — edite ou apague" },
      { id: fil2, nome: "PLA Branco Voolt", preco: 94.9, obs: "exemplo — edite ou apague" },
      { id: fil3, nome: "PETG Preto Bambu Lab", preco: 129.9, obs: "exemplo — edite ou apague" },
    ],
    packagings: [
      { id: packA, nome: "Caixa de Papelão P", preco: 40.0, quantidade: 20, obs: "exemplo — edite ou apague" },
      { id: packB, nome: "Envelope Plástico Rígido", preco: 30.0, quantidade: 10, obs: "exemplo — edite ou apague" },
    ],
    params: {
      potA1: 120,
      potA1Mini: 70,
      tarifa: 0.7894,
    },
    profile: {
      nome: "Gestão de Lojas",
      icone: null,
    },
    stores: {
      shopee: [exampleProduct3D("A1", fil1, "2026-06-15", "SHP-100234"), exampleProdutoRevenda("2026-06-20", "SHP-100311")],
      ml: [exampleProduct3D("A1 mini", fil2, "2026-07-10", "ML-582910"), exampleProdutoRevenda("2026-07-18", "ML-583067")],
      tiktok: [exampleProduct3D("A1", fil3, "2026-08-05", "TT-004821"), exampleProdutoRevenda("2026-08-06", "TT-004835")],
    },
    pricing: {
      threeD: [{
        id: uid(), example: true, produto: "(exemplo) Chaveiro Personalizado",
        impressora: "A1 mini", filamentoId: fil2, peso: 15, tempo: 0.8,
        embalagemId: packA, gastoLevar: 0.3, taxaME: false, taxaPlataforma: 40, margemDesejada: 45,
      }],
      produtos: [{
        id: uid(), example: true, produto: "(exemplo) Capinha de Celular",
        insumos: 8.0, embalagemId: packB, gastoLevar: 0.5, taxaME: false, taxaPlataforma: 40, margemDesejada: 50,
      }],
    },
    devolucoes: [
      { id: uid(), example: true, numeroPedido: "SHP-100311", categoria: "arrependimento", data: "2026-06-25" },
      { id: uid(), example: true, numeroPedido: "ML-582910", categoria: "defeito", subtipoDefeito: "danificado", valorDevolucao: 15.0, data: "2026-07-15" },
    ],
    ads: [
      { id: uid(), example: true, storeKey: "shopee", valor: 35.0, data: "2026-06-10" },
    ],
  };
}

// state começa com um placeholder; só é usado de verdade depois que init() carrega
// os dados reais do banco (IndexedDB) — ver seção "Banco de dados local" mais abaixo.
let state = defaultState();

function normalizeState(parsed) {
  STORE_META.forEach(s => { if (!parsed.stores[s.key]) parsed.stores[s.key] = []; });
  if (!parsed.profile) parsed.profile = { nome: "Gestão de Lojas", icone: null };
  if (!parsed.pricing) parsed.pricing = { threeD: [], produtos: [] };
  if (!parsed.pricing.threeD) parsed.pricing.threeD = [];
  if (!parsed.pricing.produtos) parsed.pricing.produtos = [];
  if (!parsed.devolucoes) parsed.devolucoes = [];
  if (!parsed.packagings) parsed.packagings = [];
  if (!parsed.ads) parsed.ads = [];
  return parsed;
}

// soma o que foi gasto em ADS, com filtros opcionais de loja/ano/mês
// (usado no Resumo e nos KPIs para que o gasto com anúncios conte no custo/lucro da loja)
function adsGastoFiltered({ store, year, month } = {}) {
  return state.ads
    .filter(a => a.data)
    .filter(a => !store || a.storeKey === store)
    .filter(a => !year || a.data.slice(0, 4) === year)
    .filter(a => !month || a.data.slice(0, 7) === month)
    .reduce((s, a) => s + n(a.valor), 0);
}

// procura, em todas as lojas (3D e Produtos), o pedido com esse número
function findProductByOrderNumber(numeroPedido) {
  const needle = String(numeroPedido || "").trim().toLowerCase();
  if (!needle) return null;
  for (const meta of STORE_META) {
    const found = state.stores[meta.key].find(r => (r.numeroPedido || "").trim().toLowerCase() === needle);
    if (found) return { row: found, storeKey: meta.key, storeLabel: meta.label, storeColor: meta.color };
  }
  return null;
}

// custo (impacto financeiro) de uma devolução:
// - defeito de fabricação: não recebe nada, perde embalagem + gasto p/ levar + o valor de
//   devolução informado no cadastro (campo editável, não é mais fixo em R$ 15)
// - danificado: pago pela plataforma: recebe o valor completo — sem custo extra de devolução
// - defeito sem sub-tipo escolhido ainda: custo indefinido (pede pra completar o cadastro)
// - arrependimento / não encontrou o cliente: só perde embalagem + gasto p/ levar (o produto
//   volta inteiro e pode ser revendido, então o custo de produção não conta como perda)
function calcDevolucao(dev) {
  const match = findProductByOrderNumber(dev.numeroPedido);
  if (!match) return { match: null, custoTotal: null };

  const row = match.row;
  const embalagem = getPackagingUnitPrice(row.embalagemId);
  const gastoLevar = n(row.gastoLevar);

  let custoTotal = null;
  if (dev.categoria === "defeito") {
    if (dev.subtipoDefeito === "danificado") custoTotal = embalagem + gastoLevar + CUSTO_ETIQUETA + n(dev.valorDevolucao);
    else if (dev.subtipoDefeito === "pago_plataforma") custoTotal = 0;
  } else if (dev.categoria === "arrependimento" || dev.categoria === "nao_encontrado") {
    custoTotal = embalagem + gastoLevar + CUSTO_ETIQUETA;
  }

  return { match, custoTotal };
}

// caminho inverso: dado um número de pedido, existe alguma devolução registrada pra ele?
// usado dentro de calcRow() para que o Lucro do produto nas Lojas/Resumo/KPIs reflita a devolução
function findDevolucaoByOrderNumber(numeroPedido) {
  const needle = String(numeroPedido || "").trim().toLowerCase();
  if (!needle) return null;
  return state.devolucoes.find(d => String(d.numeroPedido || "").trim().toLowerCase() === needle) || null;
}

// junta os produtos de todas as lojas num só array, marcando de qual loja cada um veio
function allRows() {
  const out = [];
  STORE_META.forEach(meta => {
    state.stores[meta.key].forEach(row => out.push(Object.assign({ _storeKey: meta.key, _storeLabel: meta.label, _storeColor: meta.color }, row)));
  });
  return out;
}

function saveState() {
  dbSaveState(state).catch(e => {
    console.error("Falha ao salvar no banco de dados local.", e);
    showToast("⚠ Não foi possível salvar. Exporte um backup para não perder dados.");
  });
}

/* ===================== Banco de dados local (IndexedDB) =====================
   Antes os dados ficavam só numa string no localStorage. Agora usamos o IndexedDB,
   que é um banco de dados de verdade dentro do navegador: transacional, com muito
   mais espaço de armazenamento e mais confiável para guardar tudo isso a longo prazo.
   Continua 100% local (sem servidor) e continua funcionando no GitHub Pages.
   Essa camada foi isolada de propósito: quando virarmos isso num app instalável,
   é aqui (e só aqui) que trocaríamos IndexedDB por SQLite, sem mexer no resto do código. */

const DB_NAME = "gestaoLojas3D";
const DB_VERSION = 1;
const DB_STORE = "state";
const DB_KEY = "app";

let dbPromise = null;

function openDatabase() {
  if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB não suportado neste navegador."));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Migra dados antigos salvos em localStorage (versões anteriores do site) para o
// IndexedDB, na primeira vez que o app abrir com o banco novo. Não apaga o backup
// antigo do localStorage — ele só deixa de ser usado.
function migrateFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch (e) {
    console.error("Não foi possível ler dados antigos do localStorage.", e);
    return null;
  }
}

async function dbSaveState(value) {
  try {
    const db = await openDatabase();
    await idbPut(db, DB_KEY, value);
  } catch (e) {
    // navegador sem suporte a IndexedDB (ou bloqueado) — usa localStorage como plano B
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }
}

// Carrega o estado salvo: tenta o IndexedDB primeiro; se não houver nada lá,
// tenta migrar do localStorage antigo; se não houver suporte a IndexedDB
// (navegador muito antigo/restrito), cai de volta para o localStorage puro.
async function dbLoadState() {
  try {
    const db = await openDatabase();
    const saved = await idbGet(db, DB_KEY);
    if (saved) return normalizeState(saved);

    const migrated = migrateFromLocalStorage();
    if (migrated) {
      await idbPut(db, DB_KEY, migrated);
      return migrated;
    }
    return defaultState();
  } catch (e) {
    console.error("IndexedDB indisponível, usando localStorage como alternativa.", e);
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : defaultState();
  }
}

/* ===================== Utilitários numéricos ===================== */

function n(v) {
  const num = parseFloat(v);
  return isNaN(num) ? 0 : num;
}

function hasVal(v) {
  return v !== "" && v !== null && v !== undefined && !isNaN(parseFloat(v));
}

function fmtCurrency(v) {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPercent(v) {
  return (v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

/* ===================== Datas (dd/mm/aaaa) =====================
   Internamente as datas continuam guardadas como string ISO "AAAA-MM-DD" (é o que
   permite ordenar, filtrar por mês/ano e alimentar os KPIs sem gambiarra). Só a
   exibição/digitação nos campos de data é convertida pra dd/mm/aaaa, que é o formato
   que faz sentido pro usuário brasileiro. */

// "AAAA-MM-DD" -> "DD/MM/AAAA" (pra mostrar no campo)
function formatDateBR(iso) {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// "DD/MM/AAAA" -> "AAAA-MM-DD" (só retorna algo se a data for válida de verdade)
function parseDateBR(str) {
  const m = String(str || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10), month = parseInt(m[2], 10), year = parseInt(m[3], 10);
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// aplica a máscara dd/mm/aaaa enquanto o usuário digita (só dígitos, insere as barras sozinho)
function maskDateTyping(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

// liga a máscara + validação num input de data em texto; chama onValidDate(iso) só quando
// o que foi digitado já forma uma data real e completa
function attachDateMask(el, onValidDate) {
  el.addEventListener("input", () => {
    const masked = maskDateTyping(el.value);
    if (masked !== el.value) el.value = masked;
    const iso = parseDateBR(el.value);
    if (iso) onValidDate(iso);
  });
}

/* ===================== Cálculos ===================== */

function getFilamentPrice(filamentoId) {
  const f = state.filaments.find(f => f.id === filamentoId);
  return f ? n(f.preco) : 0;
}

// preço por unidade da embalagem: preço total pago dividido pela quantidade que veio no pacote
function getPackagingUnitPrice(embalagemId) {
  const p = state.packagings.find(p => p.id === embalagemId);
  if (!p) return 0;
  const qty = n(p.quantidade);
  return qty > 0 ? n(p.preco) / qty : 0;
}

function buildPackagingOptions(selectedId) {
  return ['<option value="">—</option>']
    .concat(state.packagings.map(p => `<option value="${p.id}" ${p.id === selectedId ? "selected" : ""}>${escapeHtml(p.nome || "(sem nome)")}</option>`))
    .join("");
}

function getPrinterPower(impressora) {
  if (impressora === "A1") return n(state.params.potA1);
  if (impressora === "A1 mini") return n(state.params.potA1Mini);
  return 0;
}

function calcRow(row) {
  const precoVenda = hasVal(row.precoVenda) ? n(row.precoVenda) : null;
  const recebido = hasVal(row.recebido) ? n(row.recebido) : null;

  const taxaRS = precoVenda !== null && recebido !== null ? precoVenda - recebido : null;
  const taxaPct = taxaRS !== null && precoVenda ? taxaRS / precoVenda : null;

  const custoFilamento = n(row.peso) / 1000 * getFilamentPrice(row.filamentoId);
  const custoEnergia = n(row.tempo) * (getPrinterPower(row.impressora) / 1000) * n(state.params.tarifa);
  const embalagem = getPackagingUnitPrice(row.embalagemId);
  const gastoLevar = n(row.gastoLevar);
  const insumos = n(row.insumos); // custo de insumos dos produtos de revenda (ex: pendrive, memory card)
  // taxa opcional de 4% (ME) sobre o preço de venda — usada nas lojas em que você vende como ME
  const custoTaxaME = row.taxaME ? n(row.precoVenda) * 0.04 : 0;
  // custo fixo de etiqueta + QR code, cobrado em todo produto
  const custoEtiqueta = CUSTO_ETIQUETA;

  const custoTotal = custoFilamento + custoEnergia + embalagem + gastoLevar + custoEtiqueta + insumos + custoTaxaME;

  // se esse pedido está registrado na aba Devoluções, o lucro final muda:
  // - defeito de fabricação: você não recebe nada e perde embalagem + gasto p/ levar + etiqueta,
  //   mais o valor de devolução informado no cadastro
  // - danificado: pago pela plataforma: a loja reembolsa o valor total do produto — recebe
  //   normalmente, sem custo extra de devolução
  // - defeito sem sub-tipo escolhido ainda: mantém o cálculo normal até você completar o cadastro
  // - arrependimento / não encontrou o cliente: você não recebe nada pela venda — só perde
  //   o que já gastou com embalagem, frete e etiqueta (o produto volta inteiro e pode ser revendido)
  const devolucao = row.numeroPedido ? findDevolucaoByOrderNumber(row.numeroPedido) : null;

  let lucro, margem;
  if (devolucao && devolucao.categoria === "defeito" && devolucao.subtipoDefeito === "danificado") {
    lucro = -(embalagem + gastoLevar + custoEtiqueta) - n(devolucao.valorDevolucao);
    margem = precoVenda ? lucro / precoVenda : null;
  } else if (devolucao && devolucao.categoria === "defeito" && devolucao.subtipoDefeito === "pago_plataforma") {
    lucro = recebido !== null ? recebido - custoTotal : null;
    margem = lucro !== null && precoVenda ? lucro / precoVenda : null;
  } else if (devolucao && (devolucao.categoria === "arrependimento" || devolucao.categoria === "nao_encontrado")) {
    lucro = -(embalagem + gastoLevar + custoEtiqueta);
    margem = precoVenda ? lucro / precoVenda : null;
  } else {
    lucro = recebido !== null ? recebido - custoTotal : null;
    margem = lucro !== null && precoVenda ? lucro / precoVenda : null;
  }

  return { taxaRS, taxaPct, custoFilamento, custoEnergia, custoEmbalagem: embalagem, custoEtiqueta, custoTaxaME, custoTotal, lucro, margem, devolucao };
}

// Calcula o preço de venda sugerido a partir dos custos + margem desejada (%).
// Parte da mesma definição de margem usada no resto do site (lucro / preço de venda),
// considerando também a taxa média cobrada pela plataforma (ex: 40%) e a taxa ME de 4%
// (se marcada), as duas incidindo sobre o preço final:
//   precoVenda = custoBase / (1 - taxaPlataforma% - taxaME% - margem%)
function calcPricing(row) {
  const custoFilamento = n(row.peso) / 1000 * getFilamentPrice(row.filamentoId);
  const custoEnergia = n(row.tempo) * (getPrinterPower(row.impressora) / 1000) * n(state.params.tarifa);
  const embalagem = getPackagingUnitPrice(row.embalagemId);
  const gastoLevar = n(row.gastoLevar);
  const insumos = n(row.insumos);
  const custoBase = custoFilamento + custoEnergia + embalagem + gastoLevar + insumos;

  const margem = n(row.margemDesejada) / 100;
  const taxaMEFrac = row.taxaME ? 0.04 : 0;
  const taxaPlataformaFrac = n(row.taxaPlataforma) / 100;
  const denom = 1 - taxaPlataformaFrac - taxaMEFrac - margem;

  let precoSugerido = null, taxaPlataformaRS = null, recebidoEstimado = null, custoTaxaME = 0, custoTotal = custoBase, lucro = null;
  if (denom > 0) {
    precoSugerido = custoBase / denom;
    taxaPlataformaRS = precoSugerido * taxaPlataformaFrac;
    custoTaxaME = precoSugerido * taxaMEFrac;
    custoTotal = custoBase + custoTaxaME;
    recebidoEstimado = precoSugerido - taxaPlataformaRS;
    lucro = recebidoEstimado - custoTotal;
  }

  return {
    custoFilamento, custoEnergia, custoEmbalagem: embalagem, custoBase, custoTaxaME, custoTotal,
    taxaPlataformaRS, recebidoEstimado, precoSugerido, lucro,
    margemInvalida: denom <= 0,
  };
}

/* ===================== Navegação ===================== */

let activeTab = "filamentos";

function renderNav() {
  const nav = document.getElementById("nav");
  const items = [];

  items.push(navGroupLabel("Produção"));
  items.push(navItem("filamentos", "Filamentos", "◆"));
  items.push(navItem("embalagens", "Embalagens", "▭"));
  items.push(navItem("parametros", "Parâmetros", "⚙"));
  items.push(navItem("precificacao", "Precificação", "%"));

  items.push(navGroupLabel("Lojas"));
  STORE_META.forEach(s => items.push(navItem(s.key, s.label, null, s.color)));

  items.push(navGroupLabel("Marketing"));
  items.push(navItem("ads", "ADS", "◎"));

  items.push(navGroupLabel("Pós-venda"));
  items.push(navItem("devolucoes", "Devoluções", "↺"));

  items.push(navGroupLabel("Visão Geral"));
  items.push(navItem("resumo", "Resumo", "▤"));
  items.push(navItem("kpis", "KPIs", "▲"));

  items.push(navGroupLabel("Conta"));
  items.push(navItem("perfil", "Perfil", "◐"));

  nav.innerHTML = items.join("");

  nav.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      renderNav();
      renderContent();
    });
  });
}

function navGroupLabel(text) {
  return `<div class="nav-group-label">${text}</div>`;
}

function navItem(key, label, icon, color) {
  const active = key === activeTab ? "active" : "";
  const marker = color
    ? `<span class="nav-dot" style="background:${color}"></span>`
    : `<span style="width:16px;text-align:center;color:#8F98A1;">${icon}</span>`;
  return `<button class="nav-item ${active}" data-tab="${key}" title="${label}">${marker}<span class="nav-label">${label}</span></button>`;
}

/* ===================== Render: conteúdo principal ===================== */

function renderContent() {
  const content = document.getElementById("content");
  content.innerHTML = "";

  if (activeTab === "filamentos") content.appendChild(renderFilamentsPanel());
  else if (activeTab === "embalagens") content.appendChild(renderPackagingsPanel());
  else if (activeTab === "parametros") content.appendChild(renderParamsPanel());
  else if (activeTab === "precificacao") content.appendChild(renderPricingPanel());
  else if (activeTab === "ads") content.appendChild(renderAdsPanel());
  else if (activeTab === "devolucoes") content.appendChild(renderDevolucoesPanel());
  else if (activeTab === "resumo") content.appendChild(renderResumoPanel());
  else if (activeTab === "kpis") content.appendChild(renderKpisPanel());
  else if (activeTab === "perfil") content.appendChild(renderPerfilPanel());
  else content.appendChild(renderStorePanel(activeTab));
}

/* ---------- Filamentos ---------- */

function renderFilamentsPanel() {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <header class="panel-header">
      <div>
        <h1 class="page-title">Filamentos</h1>
        <p class="panel-sub">Cadastre cada filamento que você compra com o preço por kg. Eles aparecem no seletor de cada produto.</p>
      </div>
      <div class="panel-actions">
        <button class="primary-btn" id="fil-add">+ Novo filamento</button>
      </div>
    </header>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Filamento (material + cor)</th>
            <th class="num">Preço por Kg (R$)</th>
            <th>Observações</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="fil-body"></tbody>
      </table>
    </div>
  `;

  const tbody = panel.querySelector("#fil-body");
  if (state.filaments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">Nenhum filamento cadastrado ainda.</div></td></tr>`;
  } else {
    state.filaments.forEach(f => tbody.appendChild(filamentRow(f)));
  }

  panel.querySelector("#fil-add").addEventListener("click", () => {
    state.filaments.push({ id: uid(), nome: "", preco: 0, obs: "" });
    saveState();
    renderContent();
  });

  return panel;
}

function filamentRow(f) {
  const tr = document.createElement("tr");
  if (f.obs && f.obs.includes("exemplo")) tr.classList.add("example-row");
  tr.innerHTML = `
    <td><input type="text" value="${escapeAttr(f.nome)}" data-field="nome" placeholder="Ex: PLA Vermelho"></td>
    <td class="num"><input type="number" step="0.01" value="${f.preco}" data-field="preco"></td>
    <td><input type="text" value="${escapeAttr(f.obs || "")}" data-field="obs" placeholder="opcional"></td>
    <td><button class="icon-btn" data-action="delete" title="Remover">✕</button></td>
  `;

  tr.querySelectorAll("input").forEach(input => {
    input.addEventListener("input", () => {
      const field = input.dataset.field;
      f[field] = field === "preco" ? n(input.value) : input.value;
      saveState();
      // recalcula colunas de custo de filamento em todas as lojas, sem redesenhar tudo
      recalcAllStoreTables();
    });
  });

  tr.querySelector('[data-action="delete"]').addEventListener("click", () => {
    if (!confirm(`Remover o filamento "${f.nome || "(sem nome)"}"? Produtos que usam ele ficarão sem filamento selecionado.`)) return;
    state.filaments = state.filaments.filter(x => x.id !== f.id);
    saveState();
    renderContent();
  });

  return tr;
}

/* ---------- Embalagens ---------- */

function renderPackagingsPanel() {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <header class="panel-header">
      <div>
        <h1 class="page-title">Embalagens</h1>
        <p class="panel-sub">Cadastre cada embalagem que você compra: o preço total pago e a quantidade de unidades que vieram no pacote. O preço por unidade é calculado sozinho e aparece no seletor de cada produto — assim você não precisa digitar o custo da embalagem à mão.</p>
      </div>
      <div class="panel-actions">
        <button class="primary-btn" id="pack-add">+ Nova embalagem</button>
      </div>
    </header>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Embalagem</th>
            <th class="num">Preço Pago (R$)</th>
            <th class="num">Quantidade (un)</th>
            <th class="num calc">Preço Unitário (R$/un)</th>
            <th>Observações</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="pack-body"></tbody>
      </table>
    </div>
  `;

  const tbody = panel.querySelector("#pack-body");
  if (state.packagings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">Nenhuma embalagem cadastrada ainda.</div></td></tr>`;
  } else {
    state.packagings.forEach(p => tbody.appendChild(packagingRow(p)));
  }

  panel.querySelector("#pack-add").addEventListener("click", () => {
    state.packagings.push({ id: uid(), nome: "", preco: 0, quantidade: 1, obs: "" });
    saveState();
    renderContent();
  });

  return panel;
}

function packagingRow(p) {
  const tr = document.createElement("tr");
  if (p.obs && p.obs.includes("exemplo")) tr.classList.add("example-row");
  tr.innerHTML = `
    <td><input type="text" value="${escapeAttr(p.nome)}" data-field="nome" placeholder="Ex: Caixa de papelão P"></td>
    <td class="num"><input type="number" step="0.01" value="${p.preco}" data-field="preco"></td>
    <td class="num"><input type="number" step="1" value="${p.quantidade}" data-field="quantidade"></td>
    <td class="num calc-cell" data-out="unitPrice">—</td>
    <td><input type="text" value="${escapeAttr(p.obs || "")}" data-field="obs" placeholder="opcional"></td>
    <td><button class="icon-btn" data-action="delete" title="Remover">✕</button></td>
  `;

  const updateUnitPrice = () => {
    tr.querySelector('[data-out="unitPrice"]').textContent = fmtCurrency(getPackagingUnitPrice(p.id));
  };

  tr.querySelectorAll("input").forEach(input => {
    input.addEventListener("input", () => {
      const field = input.dataset.field;
      p[field] = (field === "preco" || field === "quantidade") ? n(input.value) : input.value;
      saveState();
      updateUnitPrice();
      // recalcula colunas de custo de embalagem em todas as lojas, sem redesenhar tudo
      recalcAllStoreTables();
    });
  });

  tr.querySelector('[data-action="delete"]').addEventListener("click", () => {
    if (!confirm(`Remover a embalagem "${p.nome || "(sem nome)"}"? Produtos que usam ela ficarão sem embalagem selecionada.`)) return;
    state.packagings = state.packagings.filter(x => x.id !== p.id);
    saveState();
    renderContent();
  });

  updateUnitPrice();
  return tr;
}

/* ---------- Parâmetros ---------- */

function renderParamsPanel() {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <header class="panel-header">
      <div>
        <h1 class="page-title">Parâmetros</h1>
        <p class="panel-sub">Valem para todas as lojas. Usados para calcular o custo de energia de cada peça impressa.</p>
      </div>
    </header>
    <div class="param-grid">
      <div class="param-card">
        <label>Potência Bambu Lab A1</label>
        <div class="unit-input">
          <input type="number" step="1" id="p-a1" value="${state.params.potA1}">
          <span class="unit">W</span>
        </div>
        <p class="param-note">Consumo médio durante a impressão (não a potência máxima da fonte). Confirme com um wattímetro se possível.</p>
      </div>
      <div class="param-card">
        <label>Potência Bambu Lab A1 mini</label>
        <div class="unit-input">
          <input type="number" step="1" id="p-a1mini" value="${state.params.potA1Mini}">
          <span class="unit">W</span>
        </div>
        <p class="param-note">A A1 mini consome menos que a A1 por ter mesa e volume de impressão menores.</p>
      </div>
      <div class="param-card">
        <label>Tarifa de Energia</label>
        <div class="unit-input">
          <input type="number" step="0.0001" id="p-tarifa" value="${state.params.tarifa}">
          <span class="unit">R$/kWh</span>
        </div>
        <p class="param-note">Tarifa base Enel SP (TUSD+TE), vigente desde 04/07/2026, sem impostos. Sua conta de luz mostra o valor real (geralmente entre R$ 0,90 e R$ 1,05 em SP capital) — recomendamos usar esse valor.</p>
      </div>
    </div>
  `;

  panel.querySelector("#p-a1").addEventListener("input", e => {
    state.params.potA1 = n(e.target.value);
    saveState();
    recalcAllStoreTables();
  });
  panel.querySelector("#p-a1mini").addEventListener("input", e => {
    state.params.potA1Mini = n(e.target.value);
    saveState();
    recalcAllStoreTables();
  });
  panel.querySelector("#p-tarifa").addEventListener("input", e => {
    state.params.tarifa = n(e.target.value);
    saveState();
    recalcAllStoreTables();
  });

  return panel;
}

/* ---------- Lojas ---------- */

// qual sub-aba está ativa dentro de cada loja — vive só na sessão, não é salva no banco
let storeViewType = "3d";
// texto de busca por Nº do pedido na tela de Lojas — vive só na sessão, não é salvo no banco
let storeSearch = "";

function head3D() {
  return `
    <th class="col-produto">Produto</th>
    <th>Data</th>
    <th>Nº Pedido</th>
    <th>Impressora</th>
    <th>Filamento</th>
    <th>Embalagem</th>
    <th class="num">Venda (R$)</th>
    <th class="num">Recebido (R$)</th>
    <th class="num calc">Taxa (R$)</th>
    <th class="num calc">Taxa (%)</th>
    <th class="center">ME 4%</th>
    <th class="num calc">Taxa ME (R$)</th>
    <th class="num">Peso (g)</th>
    <th class="num">Tempo (h)</th>
    <th class="num calc">Filamento (R$)</th>
    <th class="num calc">Energia (R$)</th>
    <th class="num calc">Embalagem (R$)</th>
    <th class="num">Gasto p/ Levar (R$)</th>
    <th class="num calc">Etiqueta (R$)</th>
    <th class="num calc">Custo Total (R$)</th>
    <th class="num calc">Lucro (R$)</th>
    <th class="num calc">Margem</th>
    <th></th>
  `;
}

function headProdutos() {
  return `
    <th class="col-produto">Produto</th>
    <th>Data</th>
    <th>Nº Pedido</th>
    <th>Embalagem</th>
    <th class="num">Venda (R$)</th>
    <th class="num">Recebido (R$)</th>
    <th class="num calc">Taxa (R$)</th>
    <th class="num calc">Taxa (%)</th>
    <th class="center">ME 4%</th>
    <th class="num calc">Taxa ME (R$)</th>
    <th class="num">Insumos (R$)</th>
    <th class="num calc">Embalagem (R$)</th>
    <th class="num">Gasto p/ Levar (R$)</th>
    <th class="num calc">Etiqueta (R$)</th>
    <th class="num calc">Custo Total (R$)</th>
    <th class="num calc">Lucro (R$)</th>
    <th class="num calc">Margem</th>
    <th></th>
  `;
}

function renderStorePanel(storeKey) {
  const meta = STORE_META.find(s => s.key === storeKey);
  const is3D = storeViewType === "3d";

  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <header class="panel-header">
      <div>
        <h1 class="store-title"><span class="store-dot" style="background:${meta.color}"></span>${meta.label} — Gestão de Produtos</h1>
        <p class="panel-sub">Preencha os campos de cada produto. Os valores calculados atualizam sozinhos. Ordenado da data mais recente para a mais antiga.</p>
      </div>
      <div class="panel-actions">
        <input type="text" id="store-search" class="search-input" placeholder="Buscar por Nº do pedido..." value="${escapeAttr(storeSearch)}">
        <button class="primary-btn" data-action="add-row">+ Novo produto${is3D ? " 3D" : ""}</button>
        <button class="ghost-btn small" data-action="export-csv">Exportar CSV</button>
      </div>
    </header>
    <div class="segmented" id="store-type-tabs">
      <button class="segmented-btn ${is3D ? "active" : ""}" data-type="3d">Impressão 3D</button>
      <button class="segmented-btn ${!is3D ? "active" : ""}" data-type="produtos">Produtos</button>
    </div>
    <div class="table-wrap">
      <table class="data-table store-table">
        <thead><tr>${is3D ? head3D() : headProdutos()}</tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  const tbody = panel.querySelector("tbody");

  // pega os produtos dessa loja/sub-aba, filtrados pela busca (Nº do pedido) e ordenados
  // por data — sempre do mais recente pro mais antigo; sem data vai pro final
  function getRows() {
    let rows = state.stores[storeKey].filter(r => is3D ? r.tipo !== TIPO_REVENDA : r.tipo === TIPO_REVENDA);
    const needle = storeSearch.trim().toLowerCase();
    if (needle) rows = rows.filter(r => (r.numeroPedido || "").toLowerCase().includes(needle));
    rows.sort((a, b) => {
      if (!a.data && !b.data) return 0;
      if (!a.data) return 1;
      if (!b.data) return -1;
      return b.data.localeCompare(a.data);
    });
    return rows;
  }

  // reconstrói só o corpo da tabela (não mexe no campo de busca, pra não perder o foco enquanto digita)
  function drawRows() {
    const rows = getRows();
    tbody.innerHTML = "";
    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const needle = storeSearch.trim();
      const msg = needle ? `Nenhum pedido encontrado para "${escapeHtml(needle)}".` : 'Nenhum produto cadastrado ainda. Clique em "Novo produto".';
      tr.innerHTML = `<td colspan="${is3D ? 23 : 18}"><div class="empty-state">${msg}</div></td>`;
      tbody.appendChild(tr);
    } else {
      rows.forEach(row => tbody.appendChild(is3D ? storeRow3D(storeKey, row) : storeRowProduto(storeKey, row)));
    }
  }

  drawRows();

  panel.querySelector('[data-action="add-row"]').addEventListener("click", () => {
    const base = {
      id: uid(), example: false, produto: "", data: new Date().toISOString().slice(0, 10), numeroPedido: "",
      precoVenda: "", recebido: "", taxaME: false, embalagemId: "", gastoLevar: "",
    };
    const newRow = is3D
      ? Object.assign(base, { tipo: TIPO_3D, impressora: "", filamentoId: "", peso: "", tempo: "" })
      : Object.assign(base, { tipo: TIPO_REVENDA, insumos: "" });
    state.stores[storeKey].push(newRow);
    saveState();
    drawRows();
  });

  panel.querySelector('[data-action="export-csv"]').addEventListener("click", () => exportStoreCSV(storeKey));

  panel.querySelector("#store-search").addEventListener("input", e => {
    storeSearch = e.target.value;
    drawRows();
  });

  panel.querySelectorAll(".segmented-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      storeViewType = btn.dataset.type;
      renderContent();
    });
  });

  return panel;
}

function bindRowInputs(tr, row) {
  tr.querySelectorAll("input, select").forEach(el => {
    if (el.dataset.field === "data") {
      attachDateMask(el, iso => {
        row.data = iso;
        saveState();
        updateRowCalcCells(tr, row);
      });
      return;
    }
    const evt = el.type === "checkbox" ? "change" : "input";
    el.addEventListener(evt, () => {
      const field = el.dataset.field;
      if (field === "taxaME") {
        row.taxaME = el.checked;
      } else {
        row[field] = el.value;
      }
      saveState();
      updateRowCalcCells(tr, row);
    });
  });
}

function bindRowDelete(tr, storeKey, row) {
  tr.querySelector('[data-action="delete"]').addEventListener("click", () => {
    if (!confirm(`Remover o produto "${row.produto || "(sem nome)"}"?`)) return;
    state.stores[storeKey] = state.stores[storeKey].filter(r => r.id !== row.id);
    saveState();
    renderContent();
  });
}

function storeRow3D(storeKey, row) {
  const tr = document.createElement("tr");
  tr.dataset.rowId = row.id;
  if (row.example) tr.classList.add("example-row");

  const filamentOptions = ['<option value="">—</option>']
    .concat(state.filaments.map(f => `<option value="${f.id}" ${f.id === row.filamentoId ? "selected" : ""}>${escapeHtml(f.nome || "(sem nome)")}</option>`))
    .join("");

  const printerOptions = ['<option value="">—</option>']
    .concat(PRINTERS.map(p => `<option value="${p}" ${p === row.impressora ? "selected" : ""}>${p}</option>`))
    .join("");

  tr.innerHTML = `
    <td class="col-produto"><input type="text" value="${escapeAttr(row.produto)}" data-field="produto" placeholder="Nome do produto"></td>
    <td><input type="text" inputmode="numeric" class="date-input" maxlength="10" value="${formatDateBR(row.data)}" data-field="data" placeholder="dd/mm/aaaa"></td>
    <td><input type="text" value="${escapeAttr(row.numeroPedido || "")}" data-field="numeroPedido" placeholder="Nº do pedido"></td>
    <td><select data-field="impressora">${printerOptions}</select></td>
    <td><select data-field="filamentoId">${filamentOptions}</select></td>
    <td><select data-field="embalagemId">${buildPackagingOptions(row.embalagemId)}</select></td>
    <td class="num"><input type="number" step="0.01" value="${row.precoVenda}" data-field="precoVenda"></td>
    <td class="num"><input type="number" step="0.01" value="${row.recebido}" data-field="recebido"></td>
    <td class="num calc-cell" data-out="taxaRS">—</td>
    <td class="num calc-cell" data-out="taxaPct">—</td>
    <td class="center"><input type="checkbox" data-field="taxaME" ${row.taxaME ? "checked" : ""} title="Aplicar 4% sobre o preço de venda (ME)"></td>
    <td class="num calc-cell" data-out="custoTaxaME">—</td>
    <td class="num"><input type="number" step="0.1" value="${row.peso}" data-field="peso"></td>
    <td class="num"><input type="number" step="0.1" value="${row.tempo}" data-field="tempo"></td>
    <td class="num calc-cell" data-out="custoFilamento">—</td>
    <td class="num calc-cell" data-out="custoEnergia">—</td>
    <td class="num calc-cell" data-out="custoEmbalagem">—</td>
    <td class="num"><input type="number" step="0.01" value="${row.gastoLevar}" data-field="gastoLevar"></td>
    <td class="num calc-cell" data-out="custoEtiqueta" title="Custo fixo de etiqueta + QR code">—</td>
    <td class="num calc-cell" data-out="custoTotal">—</td>
    <td class="num calc-cell" data-out="lucro">—</td>
    <td class="num" data-out="margem">—</td>
    <td><button class="icon-btn" data-action="delete" title="Remover produto">✕</button></td>
  `;

  bindRowInputs(tr, row);
  bindRowDelete(tr, storeKey, row);
  updateRowCalcCells(tr, row);
  return tr;
}

function storeRowProduto(storeKey, row) {
  const tr = document.createElement("tr");
  tr.dataset.rowId = row.id;
  if (row.example) tr.classList.add("example-row");

  tr.innerHTML = `
    <td class="col-produto"><input type="text" value="${escapeAttr(row.produto)}" data-field="produto" placeholder="Nome do produto"></td>
    <td><input type="text" inputmode="numeric" class="date-input" maxlength="10" value="${formatDateBR(row.data)}" data-field="data" placeholder="dd/mm/aaaa"></td>
    <td><input type="text" value="${escapeAttr(row.numeroPedido || "")}" data-field="numeroPedido" placeholder="Nº do pedido"></td>
    <td><select data-field="embalagemId">${buildPackagingOptions(row.embalagemId)}</select></td>
    <td class="num"><input type="number" step="0.01" value="${row.precoVenda}" data-field="precoVenda"></td>
    <td class="num"><input type="number" step="0.01" value="${row.recebido}" data-field="recebido"></td>
    <td class="num calc-cell" data-out="taxaRS">—</td>
    <td class="num calc-cell" data-out="taxaPct">—</td>
    <td class="center"><input type="checkbox" data-field="taxaME" ${row.taxaME ? "checked" : ""} title="Aplicar 4% sobre o preço de venda (ME)"></td>
    <td class="num calc-cell" data-out="custoTaxaME">—</td>
    <td class="num"><input type="number" step="0.01" value="${row.insumos}" data-field="insumos" title="Custo dos insumos usados (ex: pendrive, memory card)"></td>
    <td class="num calc-cell" data-out="custoEmbalagem">—</td>
    <td class="num"><input type="number" step="0.01" value="${row.gastoLevar}" data-field="gastoLevar"></td>
    <td class="num calc-cell" data-out="custoEtiqueta" title="Custo fixo de etiqueta + QR code">—</td>
    <td class="num calc-cell" data-out="custoTotal">—</td>
    <td class="num calc-cell" data-out="lucro">—</td>
    <td class="num" data-out="margem">—</td>
    <td><button class="icon-btn" data-action="delete" title="Remover produto">✕</button></td>
  `;

  bindRowInputs(tr, row);
  bindRowDelete(tr, storeKey, row);
  updateRowCalcCells(tr, row);
  return tr;
}

function updateRowCalcCells(tr, row) {
  const c = calcRow(row);
  setCalc(tr, "taxaRS", c.taxaRS === null ? "—" : fmtCurrency(c.taxaRS));
  setCalc(tr, "taxaPct", c.taxaPct === null ? "—" : fmtPercent(c.taxaPct));
  setCalc(tr, "custoFilamento", fmtCurrency(c.custoFilamento));
  setCalc(tr, "custoEnergia", fmtCurrency(c.custoEnergia));
  setCalc(tr, "custoEmbalagem", fmtCurrency(c.custoEmbalagem));
  setCalc(tr, "custoEtiqueta", fmtCurrency(c.custoEtiqueta));
  setCalc(tr, "custoTaxaME", fmtCurrency(c.custoTaxaME));
  setCalc(tr, "custoTotal", fmtCurrency(c.custoTotal));

  const lucroCell = tr.querySelector('[data-out="lucro"]');
  if (lucroCell) {
    if (c.lucro === null) {
      lucroCell.textContent = "—";
    } else if (c.devolucao) {
      let catLabel = DEVOLUCAO_CATEGORIAS.find(x => x.key === c.devolucao.categoria)?.label || "Devolução";
      if (c.devolucao.categoria === "defeito") {
        const subLabel = DEFEITO_SUBTIPOS.find(x => x.key === c.devolucao.subtipoDefeito)?.label;
        catLabel = subLabel || "Defeito — tipo pendente";
      }
      lucroCell.innerHTML = `${fmtCurrency(c.lucro)} <span class="devolucao-tag" title="Pedido em devolução: ${catLabel}">↺</span>`;
    } else {
      lucroCell.textContent = fmtCurrency(c.lucro);
    }
  }

  const margemCell = tr.querySelector('[data-out="margem"]');
  if (c.margem === null) {
    margemCell.innerHTML = `<span class="margin-empty">—</span>`;
  } else {
    const cls = c.margem >= 0.4 ? "margin-good" : c.margem >= 0.2 ? "margin-warn" : "margin-bad";
    margemCell.innerHTML = `<span class="margin-badge ${cls}">${fmtPercent(c.margem)}</span>`;
  }
}

function setCalc(tr, key, text) {
  const cell = tr.querySelector(`[data-out="${key}"]`);
  if (cell) cell.textContent = text;
}

function recalcAllStoreTables() {
  // se a aba atual é uma loja, atualiza as linhas visíveis sem redesenhar os inputs (preserva foco)
  if (STORE_META.some(s => s.key === activeTab)) {
    document.querySelectorAll("tbody tr[data-row-id]").forEach(tr => {
      const row = state.stores[activeTab].find(r => r.id === tr.dataset.rowId);
      if (row) updateRowCalcCells(tr, row);
    });
  }
  if (activeTab === "precificacao") {
    const listKey = pricingViewType === "3d" ? "threeD" : "produtos";
    document.querySelectorAll("tbody tr[data-row-id]").forEach(tr => {
      const row = state.pricing[listKey].find(r => r.id === tr.dataset.rowId);
      if (row) updatePricingRowCalcCells(tr, row);
    });
  }
  if (activeTab === "resumo") renderContent();
}

/* ---------- Precificação ---------- */

// qual sub-aba está ativa na tela de Precificação — vive só na sessão, não é salva no banco
let pricingViewType = "3d";

function headPricing3D() {
  return `
    <th class="col-produto">Produto</th>
    <th>Impressora</th>
    <th>Filamento</th>
    <th>Embalagem</th>
    <th class="num">Peso (g)</th>
    <th class="num">Tempo (h)</th>
    <th class="num calc">Filamento (R$)</th>
    <th class="num calc">Energia (R$)</th>
    <th class="num calc">Embalagem (R$)</th>
    <th class="num">Gasto p/ Levar (R$)</th>
    <th class="center">ME 4%</th>
    <th class="num">Taxa Plataforma (%)</th>
    <th class="num">Margem Desejada (%)</th>
    <th class="num calc">Custo Total (R$)</th>
    <th class="num calc">Taxa Plataforma (R$)</th>
    <th class="num calc">Preço Sugerido (R$)</th>
    <th class="num calc">Recebido Estimado (R$)</th>
    <th class="num calc">Lucro Estimado (R$)</th>
    <th></th>
  `;
}

function headPricingProdutos() {
  return `
    <th class="col-produto">Produto</th>
    <th>Embalagem</th>
    <th class="num">Insumos (R$)</th>
    <th class="num calc">Embalagem (R$)</th>
    <th class="num">Gasto p/ Levar (R$)</th>
    <th class="center">ME 4%</th>
    <th class="num">Taxa Plataforma (%)</th>
    <th class="num">Margem Desejada (%)</th>
    <th class="num calc">Custo Total (R$)</th>
    <th class="num calc">Taxa Plataforma (R$)</th>
    <th class="num calc">Preço Sugerido (R$)</th>
    <th class="num calc">Recebido Estimado (R$)</th>
    <th class="num calc">Lucro Estimado (R$)</th>
    <th></th>
  `;
}

function renderPricingPanel() {
  const is3D = pricingViewType === "3d";
  const listKey = is3D ? "threeD" : "produtos";
  const rows = state.pricing[listKey];

  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <header class="panel-header">
      <div>
        <h1 class="page-title">Precificação</h1>
        <p class="panel-sub">Informe os custos, a taxa média da plataforma e a margem que você quer ganhar — o preço de venda sugerido é calculado sozinho (considerando também a taxa ME de 4%, se marcada).</p>
      </div>
      <div class="panel-actions">
        <button class="primary-btn" data-action="add-row">+ Novo item${is3D ? " 3D" : ""}</button>
      </div>
    </header>
    <div class="segmented" id="pricing-type-tabs">
      <button class="segmented-btn ${is3D ? "active" : ""}" data-type="3d">Impressão 3D</button>
      <button class="segmented-btn ${!is3D ? "active" : ""}" data-type="produtos">Produtos</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>${is3D ? headPricing3D() : headPricingProdutos()}</tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  const tbody = panel.querySelector("tbody");
  if (rows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="${is3D ? 19 : 14}"><div class="empty-state">Nenhum item de precificação ainda. Clique em "Novo item".</div></td>`;
    tbody.appendChild(tr);
  } else {
    rows.forEach(row => tbody.appendChild(is3D ? pricingRow3D(row) : pricingRowProduto(row)));
  }

  panel.querySelector('[data-action="add-row"]').addEventListener("click", () => {
    const base = { id: uid(), example: false, produto: "", embalagemId: "", gastoLevar: "", taxaME: false, taxaPlataforma: 40, margemDesejada: "" };
    const newRow = is3D
      ? Object.assign(base, { impressora: "", filamentoId: "", peso: "", tempo: "" })
      : Object.assign(base, { insumos: "" });
    state.pricing[listKey].push(newRow);
    saveState();
    renderContent();
  });

  panel.querySelectorAll(".segmented-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      pricingViewType = btn.dataset.type;
      renderContent();
    });
  });

  return panel;
}

function bindPricingRowInputs(tr, row) {
  tr.querySelectorAll("input, select").forEach(el => {
    const evt = el.type === "checkbox" ? "change" : "input";
    el.addEventListener(evt, () => {
      const field = el.dataset.field;
      if (field === "taxaME") {
        row.taxaME = el.checked;
      } else {
        row[field] = el.value;
      }
      saveState();
      updatePricingRowCalcCells(tr, row);
    });
  });
}

function bindPricingRowDelete(tr, listKey, row) {
  tr.querySelector('[data-action="delete"]').addEventListener("click", () => {
    if (!confirm(`Remover "${row.produto || "(sem nome)"}" da precificação?`)) return;
    state.pricing[listKey] = state.pricing[listKey].filter(r => r.id !== row.id);
    saveState();
    renderContent();
  });
}

function pricingRow3D(row) {
  const tr = document.createElement("tr");
  tr.dataset.rowId = row.id;
  if (row.example) tr.classList.add("example-row");

  const filamentOptions = ['<option value="">—</option>']
    .concat(state.filaments.map(f => `<option value="${f.id}" ${f.id === row.filamentoId ? "selected" : ""}>${escapeHtml(f.nome || "(sem nome)")}</option>`))
    .join("");

  const printerOptions = ['<option value="">—</option>']
    .concat(PRINTERS.map(p => `<option value="${p}" ${p === row.impressora ? "selected" : ""}>${p}</option>`))
    .join("");

  tr.innerHTML = `
    <td class="col-produto"><input type="text" value="${escapeAttr(row.produto)}" data-field="produto" placeholder="Nome do produto"></td>
    <td><select data-field="impressora">${printerOptions}</select></td>
    <td><select data-field="filamentoId">${filamentOptions}</select></td>
    <td><select data-field="embalagemId">${buildPackagingOptions(row.embalagemId)}</select></td>
    <td class="num"><input type="number" step="0.1" value="${row.peso}" data-field="peso"></td>
    <td class="num"><input type="number" step="0.1" value="${row.tempo}" data-field="tempo"></td>
    <td class="num calc-cell" data-out="custoFilamento">—</td>
    <td class="num calc-cell" data-out="custoEnergia">—</td>
    <td class="num calc-cell" data-out="custoEmbalagem">—</td>
    <td class="num"><input type="number" step="0.01" value="${row.gastoLevar}" data-field="gastoLevar"></td>
    <td class="center"><input type="checkbox" data-field="taxaME" ${row.taxaME ? "checked" : ""} title="Considerar 4% de taxa ME sobre o preço sugerido"></td>
    <td class="num"><input type="number" step="1" value="${row.taxaPlataforma}" data-field="taxaPlataforma" placeholder="Ex: 40" title="Comissão média cobrada pela plataforma sobre o preço de venda"></td>
    <td class="num"><input type="number" step="1" value="${row.margemDesejada}" data-field="margemDesejada" placeholder="Ex: 40"></td>
    <td class="num calc-cell" data-out="custoTotal">—</td>
    <td class="num calc-cell" data-out="taxaPlataformaRS">—</td>
    <td class="num calc-cell price-highlight" data-out="precoSugerido">—</td>
    <td class="num calc-cell" data-out="recebidoEstimado">—</td>
    <td class="num calc-cell" data-out="lucroEstimado">—</td>
    <td><button class="icon-btn" data-action="delete" title="Remover">✕</button></td>
  `;

  bindPricingRowInputs(tr, row);
  bindPricingRowDelete(tr, "threeD", row);
  updatePricingRowCalcCells(tr, row);
  return tr;
}

function pricingRowProduto(row) {
  const tr = document.createElement("tr");
  tr.dataset.rowId = row.id;
  if (row.example) tr.classList.add("example-row");

  tr.innerHTML = `
    <td class="col-produto"><input type="text" value="${escapeAttr(row.produto)}" data-field="produto" placeholder="Nome do produto"></td>
    <td><select data-field="embalagemId">${buildPackagingOptions(row.embalagemId)}</select></td>
    <td class="num"><input type="number" step="0.01" value="${row.insumos}" data-field="insumos" title="Custo dos insumos usados (ex: pendrive, memory card)"></td>
    <td class="num calc-cell" data-out="custoEmbalagem">—</td>
    <td class="num"><input type="number" step="0.01" value="${row.gastoLevar}" data-field="gastoLevar"></td>
    <td class="center"><input type="checkbox" data-field="taxaME" ${row.taxaME ? "checked" : ""} title="Considerar 4% de taxa ME sobre o preço sugerido"></td>
    <td class="num"><input type="number" step="1" value="${row.taxaPlataforma}" data-field="taxaPlataforma" placeholder="Ex: 40" title="Comissão média cobrada pela plataforma sobre o preço de venda"></td>
    <td class="num"><input type="number" step="1" value="${row.margemDesejada}" data-field="margemDesejada" placeholder="Ex: 40"></td>
    <td class="num calc-cell" data-out="custoTotal">—</td>
    <td class="num calc-cell" data-out="taxaPlataformaRS">—</td>
    <td class="num calc-cell price-highlight" data-out="precoSugerido">—</td>
    <td class="num calc-cell" data-out="recebidoEstimado">—</td>
    <td class="num calc-cell" data-out="lucroEstimado">—</td>
    <td><button class="icon-btn" data-action="delete" title="Remover">✕</button></td>
  `;

  bindPricingRowInputs(tr, row);
  bindPricingRowDelete(tr, "produtos", row);
  updatePricingRowCalcCells(tr, row);
  return tr;
}

function updatePricingRowCalcCells(tr, row) {
  const c = calcPricing(row);
  setCalc(tr, "custoFilamento", fmtCurrency(c.custoFilamento));
  setCalc(tr, "custoEnergia", fmtCurrency(c.custoEnergia));
  setCalc(tr, "custoEmbalagem", fmtCurrency(c.custoEmbalagem));
  setCalc(tr, "custoTotal", fmtCurrency(c.custoTotal));
  setCalc(tr, "taxaPlataformaRS", c.taxaPlataformaRS !== null ? fmtCurrency(c.taxaPlataformaRS) : "—");
  setCalc(tr, "precoSugerido", c.precoSugerido !== null ? fmtCurrency(c.precoSugerido) : "—");
  setCalc(tr, "recebidoEstimado", c.recebidoEstimado !== null ? fmtCurrency(c.recebidoEstimado) : "—");
  setCalc(tr, "lucroEstimado", c.lucro !== null ? fmtCurrency(c.lucro) : "—");

  const precoCell = tr.querySelector('[data-out="precoSugerido"]');
  if (precoCell) {
    precoCell.title = c.margemInvalida
      ? "Margem desejada muito alta para esses custos — reduza a margem ou os custos."
      : "";
  }
}

/* ---------- ADS ---------- */

function renderAdsPanel() {
  const panel = document.createElement("section");
  panel.className = "panel";
  const rows = state.ads;

  panel.innerHTML = `
    <header class="panel-header">
      <div>
        <h1 class="page-title">ADS</h1>
        <p class="panel-sub">Registre quanto você pagou em anúncios em cada loja. Esse valor entra automaticamente no custo (e reduz o lucro) daquela loja no Resumo e nos KPIs.</p>
      </div>
      <div class="panel-actions">
        <button class="primary-btn" data-action="add-row">+ Novo ADS</button>
      </div>
    </header>
  `;

  if (rows.length > 0) {
    const grid = document.createElement("div");
    grid.className = "summary-grid";
    const totalGeral = rows.reduce((s, a) => s + n(a.valor), 0);
    grid.innerHTML = [
      kpiCard("Total em ADS", fmtCurrency(totalGeral), `${rows.length} registro(s)`),
      ...STORE_META.map(meta => kpiCard(meta.label, fmtCurrency(adsGastoFiltered({ store: meta.key })), "gasto em ADS")),
    ].join("");
    panel.appendChild(grid);
  }

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap";
  const table = document.createElement("table");
  table.className = "data-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Loja</th>
        <th class="num">Valor Pago (R$)</th>
        <th>Data</th>
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4"><div class="empty-state">Nenhum registro de ADS ainda. Clique em "Novo ADS".</div></td>`;
    tbody.appendChild(tr);
  } else {
    rows.forEach(a => tbody.appendChild(adsRow(a)));
  }

  tableWrap.appendChild(table);
  panel.appendChild(tableWrap);

  panel.querySelector('[data-action="add-row"]').addEventListener("click", () => {
    state.ads.push({ id: uid(), example: false, storeKey: "", valor: "", data: new Date().toISOString().slice(0, 10) });
    saveState();
    renderContent();
  });

  return panel;
}

function adsRow(a) {
  const tr = document.createElement("tr");
  tr.dataset.rowId = a.id;
  if (a.example) tr.classList.add("example-row");

  const storeOptions = ['<option value="">— selecione a loja —</option>']
    .concat(STORE_META.map(meta => `<option value="${meta.key}" ${meta.key === a.storeKey ? "selected" : ""}>${meta.label}</option>`))
    .join("");

  tr.innerHTML = `
    <td><select data-field="storeKey">${storeOptions}</select></td>
    <td class="num"><input type="number" step="0.01" value="${a.valor}" data-field="valor"></td>
    <td><input type="text" inputmode="numeric" class="date-input" maxlength="10" value="${formatDateBR(a.data)}" data-field="data" placeholder="dd/mm/aaaa"></td>
    <td><button class="icon-btn" data-action="delete" title="Remover">✕</button></td>
  `;

  const dataEl = tr.querySelector('[data-field="data"]');
  attachDateMask(dataEl, iso => {
    a.data = iso;
    saveState();
  });

  tr.querySelectorAll('[data-field]:not([data-field="data"])').forEach(el => {
    el.addEventListener("input", () => {
      a[el.dataset.field] = el.value;
      saveState();
    });
  });

  tr.querySelector('[data-action="delete"]').addEventListener("click", () => {
    if (!confirm("Remover este registro de ADS?")) return;
    state.ads = state.ads.filter(x => x.id !== a.id);
    saveState();
    renderContent();
  });

  return tr;
}

/* ---------- Devoluções ---------- */

function renderDevolucoesPanel() {
  const panel = document.createElement("section");
  panel.className = "panel";
  const rows = state.devolucoes;

  panel.innerHTML = `
    <header class="panel-header">
      <div>
        <h1 class="page-title">Devoluções</h1>
        <p class="panel-sub">Selecione o produto pelo pedido (igual ao seletor de filamentos). O Lucro desse pedido nas telas de Lojas, Resumo e KPIs é atualizado sozinho: em "Danificado: Pago pela plataforma" você recebe o valor completo, normalmente, sem custo extra; em "Defeito de fabricação" você não recebe nada e perde embalagem + gasto p/ levar + etiqueta (R$ 0,10) + o valor de devolução que você informar; em arrependimento ou pedido não encontrado, você não recebe nada e só perde embalagem + gasto p/ levar + etiqueta.</p>
      </div>
      <div class="panel-actions">
        <button class="primary-btn" data-action="add-row">+ Nova devolução</button>
      </div>
    </header>
  `;

  if (rows.length > 0) {
    let custoTotalGeral = 0;
    const porCategoria = { defeito: 0, arrependimento: 0, nao_encontrado: 0 };
    rows.forEach(dev => {
      const c = calcDevolucao(dev);
      if (c.custoTotal !== null) custoTotalGeral += c.custoTotal;
      if (dev.categoria && porCategoria[dev.categoria] !== undefined) porCategoria[dev.categoria]++;
    });

    const grid = document.createElement("div");
    grid.className = "summary-grid";
    grid.innerHTML = [
      kpiCard("Devoluções", String(rows.length), "registradas"),
      kpiCard("Custo Total", fmtCurrency(custoTotalGeral), "conforme categoria de cada devolução"),
      kpiCard("Defeito", String(porCategoria.defeito), "danificado ou pago pela plataforma"),
      kpiCard("Arrependimento / Não encontrado", String(porCategoria.arrependimento + porCategoria.nao_encontrado), "sem recebimento"),
    ].join("");
    panel.appendChild(grid);
  }

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap";
  const table = document.createElement("table");
  table.className = "data-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th class="col-produto">Produto</th>
        <th>Loja</th>
        <th>Categoria</th>
        <th>Tipo de Defeito</th>
        <th class="num">Valor da Devolução (R$)</th>
        <th>Data</th>
        <th class="num calc">Custo Total (R$)</th>
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="8"><div class="empty-state">Nenhuma devolução registrada ainda. Clique em "Nova devolução".</div></td>`;
    tbody.appendChild(tr);
  } else {
    rows.forEach(dev => tbody.appendChild(devolucaoRow(dev)));
  }

  tableWrap.appendChild(table);
  panel.appendChild(tableWrap);

  panel.querySelector('[data-action="add-row"]').addEventListener("click", () => {
    state.devolucoes.push({
      id: uid(), example: false, numeroPedido: "", categoria: "", subtipoDefeito: "", valorDevolucao: "",
      data: new Date().toISOString().slice(0, 10),
    });
    saveState();
    renderContent();
  });

  return panel;
}

// lista de produtos (de todas as lojas, 3D e Produtos) que já têm Nº Pedido preenchido —
// é essa lista que alimenta o seletor de Produto na aba Devoluções, igual ao de filamentos
function buildDevolucaoProductOptions(selectedNumeroPedido) {
  const options = ['<option value="">— selecione o produto —</option>'];
  STORE_META.forEach(meta => {
    state.stores[meta.key].forEach(row => {
      if (!row.numeroPedido) return;
      const label = `${row.produto || "(sem nome)"} — ${row.numeroPedido} (${meta.label})`;
      options.push(`<option value="${escapeAttr(row.numeroPedido)}" ${row.numeroPedido === selectedNumeroPedido ? "selected" : ""}>${escapeHtml(label)}</option>`);
    });
  });
  return options.join("");
}

function devolucaoRow(dev) {
  const tr = document.createElement("tr");
  tr.dataset.rowId = dev.id;
  if (dev.example) tr.classList.add("example-row");

  const catOptions = ['<option value="">—</option>']
    .concat(DEVOLUCAO_CATEGORIAS.map(c => `<option value="${c.key}" ${c.key === dev.categoria ? "selected" : ""}>${c.label}</option>`))
    .join("");

  const subtipoCell = dev.categoria === "defeito"
    ? `<select data-field="subtipoDefeito">${['<option value="">— selecione —</option>']
        .concat(DEFEITO_SUBTIPOS.map(s => `<option value="${s.key}" ${s.key === dev.subtipoDefeito ? "selected" : ""}>${s.label}</option>`))
        .join("")}</select>`
    : `<span class="devolucao-subtipo-vazio">—</span>`;

  const valorDevolucaoCell = dev.subtipoDefeito === "danificado"
    ? `<input type="number" step="0.01" value="${dev.valorDevolucao ?? DEFAULT_VALOR_DEVOLUCAO}" data-field="valorDevolucao" placeholder="Ex: 15,00">`
    : `<span class="devolucao-subtipo-vazio">—</span>`;

  tr.innerHTML = `
    <td class="col-produto"><select data-field="numeroPedido">${buildDevolucaoProductOptions(dev.numeroPedido)}</select></td>
    <td data-out="loja">—</td>
    <td><select data-field="categoria">${catOptions}</select></td>
    <td data-cell="subtipo">${subtipoCell}</td>
    <td class="num" data-cell="valorDevolucao">${valorDevolucaoCell}</td>
    <td><input type="text" inputmode="numeric" class="date-input" maxlength="10" value="${formatDateBR(dev.data)}" data-field="data" placeholder="dd/mm/aaaa"></td>
    <td class="num calc-cell" data-out="custoTotal">—</td>
    <td><button class="icon-btn" data-action="delete" title="Remover">✕</button></td>
  `;

  tr.querySelector('[data-field="categoria"]').addEventListener("input", e => {
    dev.categoria = e.target.value;
    if (dev.categoria !== "defeito") dev.subtipoDefeito = "";
    saveState();
    renderContent(); // precisa refazer a linha pra mostrar/esconder o seletor de sub-tipo e o campo de valor
  });

  const subtipoEl = tr.querySelector('[data-field="subtipoDefeito"]');
  if (subtipoEl) {
    subtipoEl.addEventListener("input", e => {
      dev.subtipoDefeito = e.target.value;
      if (dev.subtipoDefeito === "danificado" && !hasVal(dev.valorDevolucao)) {
        dev.valorDevolucao = DEFAULT_VALOR_DEVOLUCAO; // sugestão inicial — o usuário pode editar
      }
      saveState();
      renderContent(); // precisa refazer a linha pra mostrar/esconder o campo de valor da devolução
    });
  }

  const dataEl = tr.querySelector('[data-field="data"]');
  attachDateMask(dataEl, iso => {
    dev.data = iso;
    saveState();
    updateDevolucaoRowCalcCells(tr, dev);
  });

  tr.querySelectorAll('input[data-field]:not([data-field="data"]), select[data-field]:not([data-field="categoria"]):not([data-field="subtipoDefeito"])').forEach(el => {
    el.addEventListener("input", () => {
      const field = el.dataset.field;
      dev[field] = el.value;
      saveState();
      updateDevolucaoRowCalcCells(tr, dev);
    });
  });

  tr.querySelector('[data-action="delete"]').addEventListener("click", () => {
    if (!confirm("Remover esta devolução?")) return;
    state.devolucoes = state.devolucoes.filter(d => d.id !== dev.id);
    saveState();
    renderContent();
  });

  updateDevolucaoRowCalcCells(tr, dev);
  return tr;
}

function updateDevolucaoRowCalcCells(tr, dev) {
  const c = calcDevolucao(dev);
  const lojaCell = tr.querySelector('[data-out="loja"]');

  if (c.match) {
    lojaCell.innerHTML = `<span class="nav-dot" style="background:${c.match.storeColor}"></span>${c.match.storeLabel}`;
  } else if (dev.numeroPedido) {
    lojaCell.innerHTML = `<span class="devolucao-not-found">produto não encontrado</span>`;
  } else {
    lojaCell.textContent = "—";
  }

  const custoCell = tr.querySelector('[data-out="custoTotal"]');
  if (custoCell) {
    if (c.custoTotal !== null) {
      custoCell.textContent = fmtCurrency(c.custoTotal);
      custoCell.title = "";
    } else if (dev.categoria === "defeito") {
      custoCell.textContent = "—";
      custoCell.title = 'Escolha o tipo de defeito ("Defeito de fabricação" ou "Danificado: Pago pela plataforma") para calcular o custo.';
    } else {
      custoCell.textContent = "—";
      custoCell.title = "";
    }
  }
}

/* ---------- Resumo ---------- */

function renderResumoPanel() {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <header class="panel-header">
      <div>
        <h1 class="page-title">Resumo — Todas as Lojas</h1>
        <p class="panel-sub">Totais calculados automaticamente a partir de cada loja.</p>
      </div>
    </header>
  `;

  const totals = STORE_META.map(meta => {
    const rows = state.stores[meta.key];
    let faturamento = 0, recebido = 0, custoTotal = 0, lucro = 0;
    rows.forEach(row => {
      const c = calcRow(row);
      faturamento += n(row.precoVenda);
      recebido += hasVal(row.recebido) ? n(row.recebido) : 0;
      custoTotal += c.custoTotal;
      lucro += c.lucro !== null ? c.lucro : 0;
    });
    // o que foi pago em ADS pra essa loja também conta como custo e reduz o lucro
    const gastoAds = adsGastoFiltered({ store: meta.key });
    lucro -= gastoAds;
    const margem = faturamento ? lucro / faturamento : null;
    return { meta, faturamento, recebido, custoTotal, gastoAds, lucro, margem, count: rows.length };
  });

  const grid = document.createElement("div");
  grid.className = "summary-grid";
  totals.forEach(t => {
    const card = document.createElement("div");
    card.className = "summary-card";
    card.style.borderLeftColor = t.meta.color;
    card.innerHTML = `
      <div class="label">${t.meta.label}</div>
      <div class="value">${fmtCurrency(t.lucro)}</div>
      <div class="sub">lucro líquido (já descontando ADS) · ${t.count} produto(s)</div>
    `;
    grid.appendChild(card);
  });
  const gastoAdsGeral = totals.reduce((s, t) => s + t.gastoAds, 0);
  const adsCard = document.createElement("div");
  adsCard.innerHTML = kpiCard("Gasto Total em ADS", fmtCurrency(gastoAdsGeral), "todas as lojas · já descontado do lucro acima");
  grid.appendChild(adsCard.firstElementChild);
  panel.appendChild(grid);

  const table = document.createElement("table");
  table.className = "data-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Loja</th>
        <th class="num">Faturamento (R$)</th>
        <th class="num">Recebido (R$)</th>
        <th class="num">Custo Total (R$)</th>
        <th class="num">Gasto ADS (R$)</th>
        <th class="num">Lucro Total (R$)</th>
        <th class="num">Margem Média</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  let totFat = 0, totRec = 0, totCusto = 0, totAds = 0, totLucro = 0;
  totals.forEach(t => {
    totFat += t.faturamento; totRec += t.recebido; totCusto += t.custoTotal; totAds += t.gastoAds; totLucro += t.lucro;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.meta.label}</td>
      <td class="num">${fmtCurrency(t.faturamento)}</td>
      <td class="num">${fmtCurrency(t.recebido)}</td>
      <td class="num">${fmtCurrency(t.custoTotal)}</td>
      <td class="num">${fmtCurrency(t.gastoAds)}</td>
      <td class="num">${fmtCurrency(t.lucro)}</td>
      <td class="num">${t.margem === null ? "—" : fmtPercent(t.margem)}</td>
    `;
    tbody.appendChild(tr);
  });
  const totalMargem = totFat ? totLucro / totFat : null;
  const trTotal = document.createElement("tr");
  trTotal.style.fontWeight = "600";
  trTotal.innerHTML = `
    <td>TOTAL GERAL</td>
    <td class="num">${fmtCurrency(totFat)}</td>
    <td class="num">${fmtCurrency(totRec)}</td>
    <td class="num">${fmtCurrency(totCusto)}</td>
    <td class="num">${fmtCurrency(totAds)}</td>
    <td class="num">${fmtCurrency(totLucro)}</td>
    <td class="num">${totalMargem === null ? "—" : fmtPercent(totalMargem)}</td>
  `;
  tbody.appendChild(trTotal);

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.appendChild(table);
  panel.appendChild(wrap);

  return panel;
}

/* ---------- KPIs ---------- */

// filtro de período/loja da tela de KPIs — vive só na sessão, não é salvo no banco
let kpiState = { store: "", year: "", month: "" };

const KPI_CATEGORIES = [
  { key: TIPO_3D, label: "Impressão 3D", color: "#FF6A1A" },
  { key: TIPO_REVENDA, label: "Produtos", color: "#1B6B6B" },
];

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function monthLabel(m) {
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[parseInt(mo, 10) - 1]}/${y}`;
}

function kpiCard(label, value, sub) {
  return `<div class="summary-card"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;
}

// soma (ou subtrai) meses de uma string "YYYY-MM", tratando virada de ano
function monthAddOffset(monthStr, offset) {
  const [y, m] = monthStr.split("-").map(Number);
  const total = y * 12 + (m - 1) + offset;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12 + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

// lista todos os meses entre "from" e "to" (inclusive), mesmo os que não têm nenhum dado —
// usada pra manter a linha do tempo do gráfico completa, sem "buracos" de meses ausentes
function monthRangeInclusive(from, to) {
  const result = [];
  let cur = from;
  while (true) {
    result.push(cur);
    if (cur === to) break;
    cur = monthAddOffset(cur, 1);
  }
  return result;
}

// Crescimento nos últimos 12 meses: compara o faturamento do mês mais recente com o de 12 meses
// atrás — mas se o histórico for menor que isso, usa o primeiro mês que já teve faturamento
// como ponto de partida, em vez de "quebrar" ou considerar um mês sem dado nenhum.
// Não é afetado pelos filtros de Ano/Mês (sempre olha a janela móvel mais recente); respeita
// só o filtro de loja, porque "kpiRows" já vem filtrado por loja de quem chamou.
function calcCrescimento12Meses(kpiRows) {
  const meses = [...new Set(kpiRows.map(r => r.data.slice(0, 7)))].sort();
  if (meses.length < 2) return { valor: null, detalhe: "dados insuficientes" };

  const ultimoMes = meses[meses.length - 1];
  const primeiroMes = meses[0];
  const janela12 = monthAddOffset(ultimoMes, -11);
  const mesBase = primeiroMes > janela12 ? primeiroMes : janela12;

  if (mesBase === ultimoMes) return { valor: null, detalhe: "dados insuficientes" };

  const faturamentoDoMes = m => kpiRows.filter(r => r.data.slice(0, 7) === m).reduce((s, r) => s + n(r.precoVenda), 0);
  const fatBase = faturamentoDoMes(mesBase);
  const fatUltimo = faturamentoDoMes(ultimoMes);

  if (fatBase <= 0) return { valor: null, detalhe: "sem faturamento no mês inicial" };

  return {
    valor: (fatUltimo - fatBase) / fatBase,
    detalhe: `${monthLabel(mesBase)} → ${monthLabel(ultimoMes)}`,
  };
}

function renderKpisPanel() {
  const panel = document.createElement("section");
  panel.className = "panel";

  // só entram nos KPIs pedidos reais (sem os produtos de exemplo) com data preenchida
  const kpiRowsAll = allRows().filter(r => !r.example && r.data);

  if (kpiState.store && !STORE_META.some(s => s.key === kpiState.store)) kpiState.store = "";
  const kpiRows = kpiState.store ? kpiRowsAll.filter(r => r._storeKey === kpiState.store) : kpiRowsAll;

  const years = [...new Set(kpiRows.map(r => r.data.slice(0, 4)))].sort();
  const months = [...new Set(kpiRows.map(r => r.data.slice(0, 7)))].sort();

  if (kpiState.year && !years.includes(kpiState.year)) { kpiState.year = ""; kpiState.month = ""; }
  if (kpiState.month && kpiState.month.slice(0, 4) !== kpiState.year) kpiState.month = "";
  if (kpiState.month && !months.includes(kpiState.month)) kpiState.month = "";

  const monthsInYear = months.filter(m => !kpiState.year || m.slice(0, 4) === kpiState.year);

  const storeOptions = ['<option value="">Todas as lojas</option>']
    .concat(STORE_META.map(s => `<option value="${s.key}" ${s.key === kpiState.store ? "selected" : ""}>${s.label}</option>`))
    .join("");
  const yearOptions = ['<option value="">Todos os anos</option>']
    .concat(years.map(y => `<option value="${y}" ${y === kpiState.year ? "selected" : ""}>${y}</option>`))
    .join("");
  const monthOptions = ['<option value="">Todos os meses</option>']
    .concat(monthsInYear.map(m => `<option value="${m}" ${m === kpiState.month ? "selected" : ""}>${MONTH_NAMES[parseInt(m.slice(5, 7), 10) - 1]}</option>`))
    .join("");

  panel.innerHTML = `
    <header class="panel-header">
      <div>
        <h1 class="page-title">KPIs — Análise de Vendas</h1>
        <p class="panel-sub">Baseado nos pedidos com a coluna "Data" preenchida em cada loja. Produtos de exemplo não entram na conta.</p>
      </div>
      <div class="panel-actions">
        <select id="kpi-store">${storeOptions}</select>
        <select id="kpi-year">${yearOptions}</select>
        <select id="kpi-month">${monthOptions}</select>
      </div>
    </header>
  `;

  const bindFilters = () => {
    panel.querySelector("#kpi-store").addEventListener("change", e => {
      kpiState.store = e.target.value;
      renderContent();
    });
    panel.querySelector("#kpi-year").addEventListener("change", e => {
      kpiState.year = e.target.value;
      kpiState.month = "";
      renderContent();
    });
    panel.querySelector("#kpi-month").addEventListener("change", e => {
      kpiState.month = e.target.value;
      renderContent();
    });
  };

  if (kpiRows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = 'Nenhum pedido com data cadastrada ainda. Preencha a coluna "Data" nos seus produtos para ver os KPIs aqui.';
    panel.appendChild(empty);
    bindFilters();
    return panel;
  }

  const filtered = kpiRows.filter(r => {
    if (kpiState.year && r.data.slice(0, 4) !== kpiState.year) return false;
    if (kpiState.month && r.data.slice(0, 7) !== kpiState.month) return false;
    return true;
  });

  let faturamento = 0, custoTotal = 0, lucro = 0, devolvidos = 0;
  const pedidos = filtered.length;
  filtered.forEach(row => {
    const c = calcRow(row);
    faturamento += n(row.precoVenda);
    custoTotal += c.custoTotal;
    lucro += c.lucro !== null ? c.lucro : 0;
    if (row.numeroPedido && findDevolucaoByOrderNumber(row.numeroPedido)) devolvidos++;
  });

  // o que foi pago em ADS no mesmo período/loja filtrados também conta como custo e reduz o lucro
  const gastoAds = adsGastoFiltered({ store: kpiState.store, year: kpiState.year, month: kpiState.month });
  lucro -= gastoAds;

  const margem = faturamento ? lucro / faturamento : null;
  const ticket = pedidos ? faturamento / pedidos : null;
  const taxaDevolucao = pedidos ? devolvidos / pedidos : null;

  const crescimento = calcCrescimento12Meses(kpiRows);

  const grid = document.createElement("div");
  grid.className = "summary-grid";
  grid.innerHTML = [
    kpiCard("Faturamento", fmtCurrency(faturamento), `${pedidos} pedido(s)`),
    kpiCard("Lucro Líquido", fmtCurrency(lucro), margem !== null ? `margem ${fmtPercent(margem)}` : "—"),
    kpiCard("Custo Total", fmtCurrency(custoTotal), "filamento + energia + taxas + embalagem"),
    kpiCard("Gasto ADS", fmtCurrency(gastoAds), "já descontado do lucro líquido"),
    kpiCard("Ticket Médio", ticket !== null ? fmtCurrency(ticket) : "—", "por pedido"),
    kpiCard("Devoluções", String(devolvidos), taxaDevolucao !== null ? `${fmtPercent(taxaDevolucao)} dos pedidos` : "sem pedidos"),
    kpiCard("Crescimento (12 meses)", crescimento.valor !== null ? fmtPercent(crescimento.valor) : "—", crescimento.detalhe),
  ].join("");
  panel.appendChild(grid);

  panel.appendChild(renderRevenueChart(kpiRows, months));
  if (!kpiState.store) panel.appendChild(renderKpiStoreBreakdown(filtered));
  panel.appendChild(renderKpiCategoryBreakdown(filtered));
  panel.appendChild(renderTopProducts(filtered));

  bindFilters();
  return panel;
}

// Gráfico de faturamento que se adapta ao período escolhido:
// mês específico selecionado -> barras por dia daquele mês
// ano selecionado (sem mês)   -> barras por mês daquele ano
// nada selecionado            -> barras por mês de todo o histórico
function renderRevenueChart(kpiRows, allMonths) {
  const wrap = document.createElement("div");
  wrap.className = "panel-block";

  let title, bars;

  if (kpiState.month) {
    const [y, mo] = kpiState.month.split("-").map(Number);
    const daysInMonth = new Date(y, mo, 0).getDate();
    const monthRows = kpiRows.filter(r => r.data.slice(0, 7) === kpiState.month);
    title = `Faturamento por dia — ${MONTH_NAMES[mo - 1]}/${y}`;
    bars = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${kpiState.month}-${String(d).padStart(2, "0")}`;
      const dayRows = monthRows.filter(r => r.data === dayStr);
      let fat = 0;
      dayRows.forEach(r => { fat += n(r.precoVenda); });
      bars.push({ label: String(d).padStart(2, "0"), fat, count: dayRows.length });
    }
  } else if (kpiState.year) {
    const yearRows = kpiRows.filter(r => r.data.slice(0, 4) === kpiState.year);
    title = `Faturamento por mês — ${kpiState.year}`;
    bars = MONTH_NAMES.map((name, idx) => {
      const mKey = `${kpiState.year}-${String(idx + 1).padStart(2, "0")}`;
      const mRows = yearRows.filter(r => r.data.slice(0, 7) === mKey);
      let fat = 0;
      mRows.forEach(r => { fat += n(r.precoVenda); });
      return { label: name, fat, count: mRows.length };
    });
  } else {
    title = "Faturamento por mês";
    // preenche os meses "vazios" entre o primeiro e o último mês com venda, pra manter a
    // linha do tempo completa mesmo quando não vendeu nada em algum mês do meio
    const monthsRange = allMonths.length ? monthRangeInclusive(allMonths[0], allMonths[allMonths.length - 1]) : [];
    bars = monthsRange.map(m => {
      const mRows = kpiRows.filter(r => r.data.slice(0, 7) === m);
      let fat = 0;
      mRows.forEach(r => { fat += n(r.precoVenda); });
      return { label: monthLabel(m), fat, count: mRows.length };
    });
  }

  wrap.innerHTML = `<h2 class="block-title">${title}</h2>`;

  const max = Math.max(1, ...bars.map(x => x.fat));
  const chart = document.createElement("div");
  chart.className = "bar-chart";
  bars.forEach(x => {
    const pct = x.fat > 0 ? Math.max(2, (x.fat / max) * 100) : 0;
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span class="bar-label">${x.label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
      <span class="bar-value">${fmtCurrency(x.fat)}${x.count ? ` · ${x.count} pedido(s)` : ""}</span>
    `;
    chart.appendChild(row);
  });
  wrap.appendChild(chart);
  return wrap;
}

function renderKpiStoreBreakdown(rows) {
  const wrap = document.createElement("div");
  wrap.className = "panel-block";
  wrap.innerHTML = `<h2 class="block-title">Por loja (período selecionado)</h2>`;

  const byStore = STORE_META.map(meta => {
    const storeRows = rows.filter(r => r._storeKey === meta.key);
    let fat = 0;
    storeRows.forEach(r => { fat += n(r.precoVenda); });
    return { meta, fat, count: storeRows.length };
  });
  const total = byStore.reduce((sum, x) => sum + x.fat, 0);

  const pieWrap = document.createElement("div");
  pieWrap.className = "pie-wrap";

  if (total <= 0) {
    pieWrap.innerHTML = `<div class="empty-state">Sem faturamento nesse período.</div>`;
    wrap.appendChild(pieWrap);
    return wrap;
  }

  let acc = 0;
  const slices = byStore.filter(x => x.fat > 0).map(x => {
    const start = (acc / total) * 360;
    acc += x.fat;
    const end = (acc / total) * 360;
    return `${x.meta.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
  }).join(", ");

  const pie = document.createElement("div");
  pie.className = "pie-chart";
  pie.style.background = `conic-gradient(${slices})`;
  pieWrap.appendChild(pie);

  const legend = document.createElement("div");
  legend.className = "pie-legend";
  legend.innerHTML = byStore.map(x => {
    const pct = total ? (x.fat / total) * 100 : 0;
    return `
      <div class="pie-legend-item">
        <span class="nav-dot" style="background:${x.meta.color}"></span>
        <span class="pie-legend-label">${x.meta.label}</span>
        <span class="pie-legend-value">${fmtCurrency(x.fat)} · ${pct.toFixed(1)}% · ${x.count} pedido(s)</span>
      </div>
    `;
  }).join("");
  pieWrap.appendChild(legend);

  wrap.appendChild(pieWrap);
  return wrap;
}

function renderKpiCategoryBreakdown(rows) {
  const wrap = document.createElement("div");
  wrap.className = "panel-block";
  wrap.innerHTML = `<h2 class="block-title">Por categoria (período selecionado)</h2>`;

  const byCat = KPI_CATEGORIES.map(cat => {
    const catRows = rows.filter(r => r.tipo === cat.key);
    let fat = 0;
    catRows.forEach(r => { fat += n(r.precoVenda); });
    return { cat, fat, count: catRows.length };
  });
  const total = byCat.reduce((sum, x) => sum + x.fat, 0);

  const pieWrap = document.createElement("div");
  pieWrap.className = "pie-wrap";

  if (total <= 0) {
    pieWrap.innerHTML = `<div class="empty-state">Sem faturamento nesse período.</div>`;
    wrap.appendChild(pieWrap);
    return wrap;
  }

  let acc = 0;
  const slices = byCat.filter(x => x.fat > 0).map(x => {
    const start = (acc / total) * 360;
    acc += x.fat;
    const end = (acc / total) * 360;
    return `${x.cat.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
  }).join(", ");

  const pie = document.createElement("div");
  pie.className = "pie-chart";
  pie.style.background = `conic-gradient(${slices})`;
  pieWrap.appendChild(pie);

  const legend = document.createElement("div");
  legend.className = "pie-legend";
  legend.innerHTML = byCat.map(x => {
    const pct = total ? (x.fat / total) * 100 : 0;
    return `
      <div class="pie-legend-item">
        <span class="nav-dot" style="background:${x.cat.color}"></span>
        <span class="pie-legend-label">${x.cat.label}</span>
        <span class="pie-legend-value">${fmtCurrency(x.fat)} · ${pct.toFixed(1)}% · ${x.count} pedido(s)</span>
      </div>
    `;
  }).join("");
  pieWrap.appendChild(legend);

  wrap.appendChild(pieWrap);
  return wrap;
}

function renderTopProducts(rows) {
  const wrap = document.createElement("div");
  wrap.className = "panel-block";
  wrap.innerHTML = `<h2 class="block-title">Top produtos por lucro (período selecionado)</h2>`;

  const byProduct = {};
  rows.forEach(r => {
    const key = (r.produto || "(sem nome)").trim() || "(sem nome)";
    const c = calcRow(r);
    if (!byProduct[key]) byProduct[key] = { produto: key, lucro: 0, pedidos: 0, faturamento: 0 };
    byProduct[key].lucro += c.lucro !== null ? c.lucro : 0;
    byProduct[key].faturamento += n(r.precoVenda);
    byProduct[key].pedidos += 1;
  });
  const top = Object.values(byProduct).sort((a, b) => b.lucro - a.lucro).slice(0, 5);

  if (top.length === 0) {
    wrap.innerHTML += `<div class="empty-state">Sem dados para esse período.</div>`;
    return wrap;
  }

  const table = document.createElement("table");
  table.className = "data-table";
  table.innerHTML = `
    <thead><tr><th>Produto</th><th class="num">Pedidos</th><th class="num">Faturamento (R$)</th><th class="num">Lucro (R$)</th></tr></thead>
    <tbody>${top.map(p => `
      <tr>
        <td>${escapeHtml(p.produto)}</td>
        <td class="num">${p.pedidos}</td>
        <td class="num">${fmtCurrency(p.faturamento)}</td>
        <td class="num">${fmtCurrency(p.lucro)}</td>
      </tr>
    `).join("")}</tbody>
  `;
  const tblWrap = document.createElement("div");
  tblWrap.className = "table-wrap";
  tblWrap.appendChild(table);
  wrap.appendChild(tblWrap);
  return wrap;
}

/* ---------- Perfil ---------- */

function resizeImageToDataURL(file, maxSize) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Não foi possível ler essa imagem."));
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = Math.round(height * (maxSize / width)); width = maxSize; }
        } else {
          if (height > maxSize) { width = Math.round(width * (maxSize / height)); height = maxSize; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderBrand() {
  const nameEl = document.querySelector(".brand-text strong");
  const markEl = document.querySelector(".brand-mark");
  const nome = (state.profile && state.profile.nome) || "Gestão de Lojas";
  if (nameEl) nameEl.textContent = nome;
  if (markEl) {
    markEl.innerHTML = state.profile && state.profile.icone
      ? `<img src="${state.profile.icone}" alt="Ícone" class="brand-icon-img">`
      : "◇";
  }
  document.title = `${nome} — Impressão 3D`;
}

function renderPerfilPanel() {
  const panel = document.createElement("section");
  panel.className = "panel";

  const icone = state.profile.icone;
  panel.innerHTML = `
    <header class="panel-header">
      <div>
        <h1 class="page-title">Perfil</h1>
        <p class="panel-sub">Personalize o nome e o ícone que aparecem no menu lateral.</p>
      </div>
    </header>
    <div class="param-grid">
      <div class="param-card">
        <label>Ícone da loja</label>
        <div class="profile-icon-preview">${icone ? `<img src="${icone}" alt="Ícone atual">` : "◇"}</div>
        <div class="profile-icon-actions">
          <label class="ghost-btn small" for="profile-icon-input">Escolher imagem</label>
          <input type="file" id="profile-icon-input" accept="image/*" hidden>
          ${icone ? `<button class="ghost-btn small" id="profile-icon-remove">Remover</button>` : ""}
        </div>
        <p class="param-note">A imagem é redimensionada automaticamente. Use PNG ou JPG.</p>
      </div>
      <div class="param-card">
        <label>Nome da loja</label>
        <input type="text" class="text-field" id="profile-nome" value="${escapeAttr(state.profile.nome)}" placeholder="Ex: Minha Loja 3D">
        <p class="param-note">Esse nome aparece no topo do menu lateral.</p>
      </div>
    </div>
  `;

  panel.querySelector("#profile-nome").addEventListener("input", e => {
    state.profile.nome = e.target.value;
    saveState();
    renderBrand();
  });

  panel.querySelector("#profile-icon-input").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataURL(file, 160);
      state.profile.icone = dataUrl;
      saveState();
      renderBrand();
      renderContent();
      showToast("Ícone atualizado.");
    } catch (err) {
      console.error(err);
      alert("Não foi possível carregar essa imagem.");
    }
  });

  const removeBtn = panel.querySelector("#profile-icon-remove");
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      state.profile.icone = null;
      saveState();
      renderBrand();
      renderContent();
      showToast("Ícone removido.");
    });
  }

  return panel;
}

/* ===================== Export / Import ===================== */

function exportStoreCSV(storeKey) {
  const meta = STORE_META.find(s => s.key === storeKey);
  const is3D = storeViewType === "3d";
  const rows = state.stores[storeKey].filter(r => is3D ? r.tipo !== TIPO_REVENDA : r.tipo === TIPO_REVENDA);

  const headers = is3D
    ? ["Produto", "Data", "Nº Pedido", "Impressora", "Filamento", "Embalagem", "Venda (R$)", "Recebido (R$)",
      "Taxa (R$)", "Taxa (%)", "ME 4%", "Taxa ME (R$)", "Peso (g)", "Tempo (h)", "Filamento (R$)", "Energia (R$)",
      "Embalagem (R$)", "Gasto p/ Levar (R$)", "Etiqueta (R$)", "Custo Total (R$)", "Lucro (R$)", "Margem (%)"]
    : ["Produto", "Data", "Nº Pedido", "Embalagem", "Venda (R$)", "Recebido (R$)", "Taxa (R$)", "Taxa (%)", "ME 4%", "Taxa ME (R$)",
      "Insumos (R$)", "Embalagem (R$)", "Gasto p/ Levar (R$)", "Etiqueta (R$)", "Custo Total (R$)", "Lucro (R$)", "Margem (%)"];

  const lines = [headers.join(";")];
  rows.forEach(row => {
    const c = calcRow(row);
    const filName = state.filaments.find(f => f.id === row.filamentoId)?.nome || "";
    const packName = state.packagings.find(p => p.id === row.embalagemId)?.nome || "";
    const cells = is3D
      ? [
        row.produto, formatDateBR(row.data), row.numeroPedido || "", row.impressora, filName, packName,
        row.precoVenda, row.recebido,
        c.taxaRS ?? "", c.taxaPct !== null ? (c.taxaPct * 100).toFixed(1) : "",
        row.taxaME ? "Sim" : "Não", c.custoTaxaME.toFixed(2),
        row.peso, row.tempo,
        c.custoFilamento.toFixed(2), c.custoEnergia.toFixed(2),
        c.custoEmbalagem.toFixed(2), row.gastoLevar, c.custoEtiqueta.toFixed(2),
        c.custoTotal.toFixed(2), c.lucro !== null ? c.lucro.toFixed(2) : "",
        c.margem !== null ? (c.margem * 100).toFixed(1) : "",
      ]
      : [
        row.produto, formatDateBR(row.data), row.numeroPedido || "", packName,
        row.precoVenda, row.recebido,
        c.taxaRS ?? "", c.taxaPct !== null ? (c.taxaPct * 100).toFixed(1) : "",
        row.taxaME ? "Sim" : "Não", c.custoTaxaME.toFixed(2),
        row.insumos, c.custoEmbalagem.toFixed(2), row.gastoLevar, c.custoEtiqueta.toFixed(2),
        c.custoTotal.toFixed(2), c.lucro !== null ? c.lucro.toFixed(2) : "",
        c.margem !== null ? (c.margem * 100).toFixed(1) : "",
      ];
    lines.push(cells.map(v => String(v).replace(".", ",").replace(";", ",")).join(";"));
  });

  const sufixo = is3D ? "3D" : "Produtos";
  downloadFile(`${meta.label.replace(/\s+/g, "_")}_${sufixo}.csv`, "\uFEFF" + lines.join("\n"), "text/csv;charset=utf-8");
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById("btn-export").addEventListener("click", () => {
  const dataStr = JSON.stringify(state, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(`backup-gestao-lojas-${date}.json`, dataStr, "application/json");
  showToast("Backup exportado.");
});

document.getElementById("file-import").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported.filaments || !imported.stores || !imported.params) throw new Error("formato inválido");
      if (!confirm("Importar este backup vai substituir todos os dados atuais. Continuar?")) return;
      state = normalizeState(imported);
      saveState();
      activeTab = "filamentos";
      renderNav();
      renderContent();
      renderBrand();
      showToast("Backup importado com sucesso.");
    } catch (err) {
      alert("Não foi possível importar este arquivo. Verifique se é um backup válido gerado por este site.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

/* ===================== Toast ===================== */

let toastTimer = null;
function showToast(msg) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

/* ===================== Helpers ===================== */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}

/* ===================== Sidebar recolher/expandir ===================== */

const SIDEBAR_COLLAPSE_KEY = "gestaoLojas3D_sidebarCollapsed";
let sidebarCollapsed = localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1";

function applySidebarState() {
  const sidebar = document.getElementById("sidebar");
  const btn = document.getElementById("btn-toggle-sidebar");
  sidebar.classList.toggle("collapsed", sidebarCollapsed);
  if (btn) {
    btn.textContent = sidebarCollapsed ? "›" : "‹";
    btn.title = sidebarCollapsed ? "Expandir menu" : "Recolher menu";
  }
}

document.getElementById("btn-toggle-sidebar").addEventListener("click", () => {
  sidebarCollapsed = !sidebarCollapsed;
  localStorage.setItem(SIDEBAR_COLLAPSE_KEY, sidebarCollapsed ? "1" : "0");
  applySidebarState();
});

/* ===================== Tema claro/escuro ===================== */

const THEME_KEY = "gestaoLojas3D_theme";
let theme = localStorage.getItem(THEME_KEY) || "light";

function applyTheme() {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("btn-theme-toggle");
  if (btn) {
    const isDark = theme === "dark";
    btn.querySelector(".btn-icon").textContent = isDark ? "☀" : "☾";
    btn.querySelector(".btn-label").textContent = isDark ? "Modo claro" : "Modo escuro";
    btn.title = isDark ? "Mudar para modo claro" : "Mudar para modo escuro";
  }
}

document.getElementById("btn-theme-toggle").addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
});

applyTheme();

/* ===================== Init ===================== */

async function init() {
  try {
    state = await dbLoadState();
  } catch (e) {
    console.error("Falha ao carregar dados salvos, usando padrão.", e);
    state = defaultState();
  }
  renderNav();
  renderContent();
  renderBrand();
  applySidebarState();
}

init();