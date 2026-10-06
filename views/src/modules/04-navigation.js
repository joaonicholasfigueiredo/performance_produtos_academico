const trackingView = document.querySelector("#tracking-view");
const agenciesView = document.querySelector("#agencies-view");
const evolutionView = document.querySelector("#evolution-view");
const logsView = document.querySelector("#logs-view");
const navImport = document.querySelector("#nav-import");
const navTracking = document.querySelector("#nav-tracking");
const navTrackingCount = document.querySelector("#nav-tracking-count");
const navFocus = document.querySelector("#nav-focus");
const navFocusCount = document.querySelector("#nav-focus-count");
const navAgencies = document.querySelector("#nav-agencies");
const navEvolution = document.querySelector("#nav-evolution");
const navLogs = document.querySelector("#nav-logs");
const adminNavigation = document.querySelector("#admin-navigation");

function setAdminModulesVisibility(isAdmin) {
  adminNavigation.hidden = !isAdmin;
  navImport.hidden = !isAdmin;
  navLogs.hidden = !isAdmin;
  if (!isAdmin) {
    importView.hidden = true;
    logsView.hidden = true;
  }
}
const agenciesLoading = document.querySelector("#agencies-loading");
const agenciesEmpty = document.querySelector("#agencies-empty");
const agenciesContent = document.querySelector("#agencies-content");
const agenciesPeriodStart = document.querySelector("#agencies-period-start");
const agenciesPeriodEnd = document.querySelector("#agencies-period-end");
const agenciesBasisButtons = document.querySelectorAll(".agencies-basis-button");
const agenciesCardGrid = document.querySelector("#agencies-card-grid");
const agenciesExportPdfButton = document.querySelector("#agencies-export-pdf-button");
const trackingPageTitle = document.querySelector("#tracking-page-title");
const trackingPageDescription = document.querySelector("#tracking-page-description");
const trackingLoading = document.querySelector("#tracking-loading");
const trackingEmpty = document.querySelector("#tracking-empty");
const trackingContent = document.querySelector("#tracking-content");
const trackingExportButton = document.querySelector("#tracking-export-button");
const unitSummaryTableBody = document.querySelector("#unit-summary-table-body");
const unitSummaryTotalButton = document.querySelector("#unit-summary-total-button");
const unitSummaryMonthlyButton = document.querySelector("#unit-summary-monthly-button");
const unitSummaryAnalyticButton = document.querySelector("#unit-summary-analytic-button");
const unitSummaryTotalView = document.querySelector("#unit-summary-total-view");
const unitSummaryMonthlyView = document.querySelector("#unit-summary-monthly-view");
const unitSummaryAnalyticView = document.querySelector("#unit-summary-analytic-view");
const unitSummaryMonthlyHead = document.querySelector("#unit-summary-monthly-head");
const unitSummaryMonthlyBody = document.querySelector("#unit-summary-monthly-body");
const unitSummaryAnalyticHead = document.querySelector("#unit-summary-analytic-head");
const unitSummaryAnalyticBody = document.querySelector("#unit-summary-analytic-body");
const unitSummaryAnalyticUnitFilter = document.querySelector("#unit-summary-analytic-unit-filter");
const unitSummaryAnalyticMonthFilter = document.querySelector("#unit-summary-analytic-month-filter");
const unitSummaryMonthFilterLabel = document.querySelector("#unit-summary-month-filter-label");
const unitSummaryCriteria = document.querySelector("#unit-summary-criteria");
const periodStart = document.querySelector("#period-start");
const periodEnd = document.querySelector("#period-end");
const unitSelect = document.querySelector("#unit-select");
const trackingUnitFilter = unitSelect.closest(".unit-filter");
const calculationBasisButtons = document.querySelectorAll(".calculation-basis-button");
const productSearch = document.querySelector("#product-search");
const analyticViewButton = document.querySelector("#analytic-view-button");
const syntheticViewButton = document.querySelector("#synthetic-view-button");
const analyticPanel = document.querySelector("#analytic-panel");
const syntheticPanel = document.querySelector("#synthetic-panel");
const analyticChartHint = document.querySelector("#analytic-chart-hint");
const analyticChartCard = document.querySelector("#analytic-chart-card");
const analyticChartMetaModelSelect = document.querySelector("#analytic-chart-meta-model");
const analyticChartProductionModelSelect = document.querySelector("#analytic-chart-production-model");
const analyticChartShowVariationInput = document.querySelector("#analytic-chart-show-variation");
const analyticChartShowValuesInput = document.querySelector("#analytic-chart-show-values");
const analyticPreviousPage = document.querySelector("#analytic-previous-page");
const analyticNextPage = document.querySelector("#analytic-next-page");
const analyticPagination = document.querySelector("#analytic-pagination");
const analyticPageNote = document.querySelector("#analytic-page-note");
const analyticComboButtons = document.querySelector("#analytic-combo-buttons");
const analyticComboKpis = document.querySelector("#analytic-combo-kpis");
const analyticComboFilter = document.querySelector("#analytic-combo-filter");
const analyticPerspectiveBar = document.querySelector("#analytic-perspective-bar");
const analyticPerspectiveDescription = document.querySelector("#analytic-perspective-description");
const analyticPerspectiveContext = document.querySelector("#analytic-perspective-context");
const productByAgencyButton = document.querySelector("#product-by-agency-button");
const agencyByProductButton = document.querySelector("#agency-by-product-button");
const analyticMatrixEyebrow = document.querySelector("#analytic-matrix-eyebrow");
const analyticMatrixTitle = document.querySelector("#analytic-matrix-title");
const analyticMatrixCard = document.querySelector("#analytic-matrix-card");
const focusProductTabs = document.querySelector("#focus-product-tabs");
const focusProductTabsLabel = document.querySelector("#focus-product-tabs-label");
const focusProductTabList = document.querySelector("#focus-product-tab-list");
const focusConsolidatedKpis = document.querySelector("#focus-consolidated-kpis");
const focusConsolidatedKpisGrid = document.querySelector("#focus-consolidated-kpis-grid");
const focusConsolidatedKpisContext = document.querySelector("#focus-consolidated-kpis-context");
const focusConsolidatedPeriodButton = document.querySelector("#focus-consolidated-period-button");
const focusConsolidatedAnnualButton = document.querySelector("#focus-consolidated-annual-button");
const focusAgencyPerformance = document.querySelector("#focus-agency-performance");
const focusAgencyPerformanceTitle = document.querySelector("#focus-agency-performance-title");
const focusAgencyPerformanceSubtitle = document.querySelector("#focus-agency-performance-subtitle");
const focusAgencyPerformanceKpis = document.querySelector("#focus-agency-performance-kpis");
const focusAgencyPerformanceActions = document.querySelector(".focus-agency-performance-actions");
const focusAgencyTableView = document.querySelector("#focus-agency-table-view");
const focusAgencyChartView = document.querySelector("#focus-agency-chart-view");
const focusAgencyTableContent = document.querySelector("#focus-agency-table-content");
const focusAgencyTableFooter = document.querySelector("#focus-agency-table-footer");
const focusAgencyPagination = document.querySelector("#focus-agency-pagination");
const focusAgencyPageNote = document.querySelector("#focus-agency-page-note");
const focusAgencyPerformanceHead = document.querySelector("#focus-agency-performance-head");
const focusAgencyPerformanceBody = document.querySelector("#focus-agency-performance-body");
const focusAgencyPerformanceCount = document.querySelector("#focus-agency-performance-count");
const focusAgencyPageIndicator = document.querySelector("#focus-agency-page-indicator");
const focusAgencyPreviousPage = document.querySelector("#focus-agency-previous-page");
const focusAgencyNextPage = document.querySelector("#focus-agency-next-page");
const logsLoading = document.querySelector("#logs-loading");
const logsEmpty = document.querySelector("#logs-empty");
const logsContent = document.querySelector("#logs-content");
const logSearch = document.querySelector("#log-search");
const refreshLogsButton = document.querySelector("#refresh-logs-button");
const logPeriodFilter = document.querySelector(".log-period-filter");
const logPeriodButton = document.querySelector("#log-period-button");
const logPeriodButtonLabel = document.querySelector("#log-period-button-label");
const logPeriodMenu = document.querySelector("#log-period-menu");
const logsPreviousPage = document.querySelector("#logs-previous-page");
const logsNextPage = document.querySelector("#logs-next-page");
const logsPageIndicator = document.querySelector("#logs-page-indicator");
let trackingRequestId = 0;
let selectedCalculationBasis = "NO_PERIODO";
let selectedTrackingMode = "synthetic";
let agenciesPeriodsLoaded = false;
let agenciesRequestId = 0;
let agenciesData = null;
let selectedAgenciesCalculationBasis = "NO_PERIODO";
const agencyCardSorts = new Map();

function selectTrackingMode(mode) {
  const isAnalytic = mode === "analytic";
  selectedTrackingMode = isAnalytic ? "analytic" : "synthetic";
  analyticPanel.hidden = !isAnalytic;
  syntheticPanel.hidden = isAnalytic;
  analyticViewButton.classList.toggle("active", isAnalytic);
  syntheticViewButton.classList.toggle("active", !isAnalytic);
  analyticViewButton.setAttribute("aria-selected", String(isAnalytic));
  syntheticViewButton.setAttribute("aria-selected", String(!isAnalytic));
  updateTrackingUnitFilterVisibility();
}

function updateTrackingUnitFilterVisibility() {
  const usesInternalNavigation = activeTrackingScope === "FOCO"
    && selectedTrackingMode === "analytic";
  trackingUnitFilter.hidden = usesInternalNavigation;
}

function updateNavigation(view) {
  if (!currentUserIsAdmin && (view === "importar" || view === "logs")) {
    view = "acompanhamento";
    if (window.location.hash !== "#acompanhamento") {
      window.history.replaceState(null, "", "#acompanhamento");
    }
  }
  const isFocus = view === "foco";
  const isTracking = view === "acompanhamento" || isFocus;
  const isAgencies = view === "agencias";
  const isEvolution = view === "evolucao";
  const isLogs = view === "logs";
  const nextScope = isFocus ? "FOCO" : "GERAL";
  if (isTracking && activeTrackingScope !== nextScope) {
    activeTrackingScope = nextScope;
    selectedAnalyticCombo = "";
    selectedAnalyticProduct = "";
    selectedAnalyticAgency = "";
    analyticPage = 1;
    analyticPerspective = "product_by_agency";
  }
  importView.hidden = !currentUserIsAdmin || isTracking || isAgencies || isEvolution || isLogs;
  trackingView.hidden = !isTracking;
  agenciesView.hidden = !isAgencies;
  evolutionView.hidden = !isEvolution;
  logsView.hidden = !currentUserIsAdmin || !isLogs;
  navImport.classList.toggle("active", currentUserIsAdmin && !isTracking && !isAgencies && !isEvolution && !isLogs);
  navTracking.classList.toggle("active", isTracking && !isFocus);
  navFocus.classList.toggle("active", isFocus);
  navAgencies.classList.toggle("active", isAgencies);
  navEvolution.classList.toggle("active", isEvolution);
  navLogs.classList.toggle("active", currentUserIsAdmin && isLogs);
  navImport.toggleAttribute("aria-current", currentUserIsAdmin && !isTracking && !isAgencies && !isEvolution && !isLogs);
  navTracking.toggleAttribute("aria-current", isTracking && !isFocus);
  navFocus.toggleAttribute("aria-current", isFocus);
  navAgencies.toggleAttribute("aria-current", isAgencies);
  navEvolution.toggleAttribute("aria-current", isEvolution);
  navLogs.toggleAttribute("aria-current", isLogs);
  updateTrackingUnitFilterVisibility();
  if (isTracking) {
    trackingPageTitle.textContent = isFocus
      ? "Produção acumulada"
      : "Produção acumulada";
    trackingPageDescription.textContent = isFocus
      ? "7 produtos foco · acompanhe os indicadores prioritários no consolidado e por PA."
      : "19 produtos · compare a produção realizada com a meta por produto.";
    loadTrackingView();
  }
  if (isAgencies) loadAgenciesView();
  if (isEvolution) loadEvolutionView();
  if (isLogs) loadLogs();
}

async function handleRoute() {
  const route = window.location.hash.replace("#", "");
  updateNavigation(
    route === "acompanhamento"
      ? "acompanhamento"
      : route === "foco"
      ? "foco"
      : route === "agencias"
      ? "agencias"
      : route === "evolucao"
      ? "evolucao"
      : route === "logs"
      ? "logs"
      : "importar"
  );
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}
