const fileInput = document.querySelector("#file-input");
const dropZone = document.querySelector("#drop-zone");
const selectedFile = document.querySelector("#selected-file");
const selectedFileName = document.querySelector("#selected-file-name");
const selectedFileSize = document.querySelector("#selected-file-size");
const removeFileButton = document.querySelector("#remove-file");
const analyzeButton = document.querySelector("#analyze-button");
const exportButton = document.querySelector("#export-button");
const wipeButton = document.querySelector("#wipe-button");
const modalBackdrop = document.querySelector("#modal-backdrop");
const modalLoading = document.querySelector("#modal-loading");
const modalConfirmation = document.querySelector("#modal-confirmation");
const modalSuccess = document.querySelector("#modal-success");
const cancelButton = document.querySelector("#cancel-button");
const continueButton = document.querySelector("#continue-button");
const finishButton = document.querySelector("#finish-button");
const wipeModalBackdrop = document.querySelector("#wipe-modal-backdrop");
const wipeCancelButton = document.querySelector("#wipe-cancel-button");
const wipeConfirmButton = document.querySelector("#wipe-confirm-button");
const userArea = document.querySelector("#user-area");
const userMenuButton = document.querySelector("#user-menu-button");
const userMenu = document.querySelector("#user-menu");
const sidebarToggleButton = document.querySelector("#sidebar-toggle");
const sidebarToggleLabel = document.querySelector("#sidebar-toggle-label");

const APP_ROOT_PATH = document.querySelector("meta[name=\"app-root-path\"]")?.content || "";

let currentUserIsAdmin = false;

function appUrl(path) {
  if (!path.startsWith("/")) return path;
  return `${APP_ROOT_PATH}${path}`;
}

let currentFile = null;
let currentAnalysis = null;
let trackingProducts = [];
let trackingCalculation = null;
let unitSummaries = [];
let unitSummaryData = null;
let unitSummaryViewMode = "total";
let unitSummaryAnalyticSortDirection = "desc";
let trackingPeriodsLoaded = false;
let logEntries = [];
let logsPage = 1;
let selectedLogPeriod = "";
const logsPageSize = 5;
let analyticProducts = [];
let analyticPeriods = [];
let analyticRange = null;
let analyticUnit = null;
let analyticDataByUnit = null;
let analyticDataAllUnits = null;
let analyticPage = 1;
let analyticPerspective = "product_by_agency";
let selectedAnalyticAgency = "";
let selectedAnalyticCombo = "";
let selectedAnalyticProduct = "";
let selectedAnalyticScoreMode = "combo";
let focusAgencyPerformanceData = null;
let focusAgencyPage = 1;
let focusAgencySortDirection = "desc";
let focusAgencyViewMode = "table";
let focusConsolidatedKpiBasis = "period";
let analyticChartMetaModel = "line";
let analyticChartProductionModel = "line";
let analyticChartShowVariation = true;
let analyticChartShowValues = true;
let expandedFocusAgency = "";
let activeTrackingScope = "GERAL";
const analyticPageSize = 3;
const focusAgencyPageSize = 4;
const ANALYTIC_COMBOS = [
  {
    id: "credito",
    label: "Combo Crédito",
    products: ["CREDITO_PF", "CREDITO_PESSOAL", "CREDITO_PJ", "CREDITO_RURAL"],
    requirements: [
      { label: "Crédito PF", aliases: ["CREDITO_PF", "CREDITO_PESSOAL"] },
      { label: "Crédito PJ", aliases: ["CREDITO_PJ"] },
      { label: "Crédito Rural", aliases: ["CREDITO_RURAL"] },
    ],
  },
  {
    id: "servicos",
    label: "Combo Serviços",
    products: ["CONSORCIOS", "CAMBIO", "COOPCERTO"],
    requirements: [
      { label: "Consórcios", aliases: ["CONSORCIOS"] },
      { label: "Câmbio", aliases: ["CAMBIO"] },
      { label: "Coopcerto", aliases: ["COOPCERTO"] },
    ],
  },
  {
    id: "investimentos",
    label: "Combo Investimentos",
    products: [
      "POUPANCA",
      "RENDA_FIXA",
      "FUNDOS",
      "PREVIDENCIA",
      "PREVIDENCIA_MI",
      "PREVIDENCIA_VGBL",
    ],
    requirements: [
      { label: "Poupança", aliases: ["POUPANCA"] },
      { label: "Renda Fixa", aliases: ["RENDA_FIXA"] },
      { label: "Fundos", aliases: ["FUNDOS"] },
      { label: "Previdência", aliases: ["PREVIDENCIA"] },
      { label: "Previdência MI", aliases: ["PREVIDENCIA_MI"] },
      { label: "Previdência VGBL", aliases: ["PREVIDENCIA_VGBL"] },
    ],
  },
  {
    id: "recebimentos_pagamentos",
    label: "Combo Recebimentos e Pagamentos",
    products: ["SICOOBCARD", "COBRANCA", "SIPAG"],
    requirements: [
      { label: "Sicoobcard", aliases: ["SICOOBCARD"] },
      { label: "Cobrança", aliases: ["COBRANCA"] },
      { label: "Sipag", aliases: ["SIPAG"] },
    ],
  },
  {
    id: "protecao",
    label: "Combo Proteção",
    products: [
      "SEGUROS_GERAIS",
      "SEGURO_RURAL",
      "SEGURO_VIDA",
      "SEGURO_VIDA_ARRECADACAO",
      "SEGURO_VIDA_NOVO",
      "VENDA_NOVA_SINGULAR",
      "VENDA_NOVA_PA",
    ],
    requirements: [
      { label: "Seguros Gerais", aliases: ["SEGUROS_GERAIS"] },
      { label: "Seguro Rural", aliases: ["SEGURO_RURAL"] },
      {
        label: "Seguro Vida Arrecadação",
        aliases: ["SEGURO_VIDA", "SEGURO_VIDA_ARRECADACAO", "SEGURO_VIDA_NOVO"],
      },
      {
        label: "Venda Nova",
        aliases: ["VENDA_NOVA_SINGULAR", "VENDA_NOVA_PA"],
      },
    ],
  },
];
const FOCUS_ANALYTIC_COMBOS = [
  {
    id: "foco_servicos",
    label: "Serviços foco",
    products: ["CONSORCIOS"],
    requirements: [
      { label: "Consórcios", aliases: ["CONSORCIOS"] },
    ],
  },
  {
    id: "foco_recebimentos_pagamentos",
    label: "Recebimentos e Pagamentos foco",
    products: ["COBRANCA", "SICOOBCARD", "SIPAG"],
    requirements: [
      { label: "Cobrança", aliases: ["COBRANCA"] },
      { label: "Sicoobcard", aliases: ["SICOOBCARD"] },
      { label: "Sipag", aliases: ["SIPAG"] },
    ],
  },
  {
    id: "foco_protecao",
    label: "Proteção foco",
    products: ["SEGURO_RURAL", "VENDA_NOVA_PA", "SEGUROS_GERAIS"],
    requirements: [
      { label: "Seguro Rural", aliases: ["SEGURO_RURAL"] },
      { label: "Venda Nova PA", aliases: ["VENDA_NOVA_PA"] },
      { label: "Seguros Gerais", aliases: ["SEGUROS_GERAIS"] },
    ],
  },
];
let trackingSort = {
  key: "percentual_atingido",
  direction: "desc",
};
let agencyComparisonSort = {
  key: "pa",
  direction: "asc",
};
let unitSummarySort = {
  key: "pa",
  direction: "asc",
};

const numberFormatter = new Intl.NumberFormat("pt-BR");
const decimalFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const matrixValueFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});
const matrixCurrencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const percentageFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const previewColumns = ["CENTRAL", "COOP", "PA", "PRODUTO", "META_MENSAL", "PRODUCAO_MENSAL", "MÊS/ANO"];
