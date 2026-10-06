function toggleSidebar() {
  const isCollapsed = document.body.classList.toggle("sidebar-collapsed");
  sidebarToggleButton.setAttribute("aria-expanded", String(!isCollapsed));
  sidebarToggleButton.setAttribute(
    "aria-label",
    isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral",
  );
  sidebarToggleLabel.textContent = isCollapsed ? "Expandir menu" : "Recolher menu";
}

sidebarToggleButton.addEventListener("click", toggleSidebar);

const backToTopButton = document.querySelector("#back-to-top");
let backToTopFrame = 0;

function updateBackToTopVisibility() {
  backToTopFrame = 0;
  const isVisible = window.scrollY > 420;
  backToTopButton.classList.toggle("is-visible", isVisible);
  backToTopButton.setAttribute("aria-hidden", String(!isVisible));
  backToTopButton.tabIndex = isVisible ? 0 : -1;
}

window.addEventListener("scroll", () => {
  if (backToTopFrame) return;
  backToTopFrame = window.requestAnimationFrame(updateBackToTopVisibility);
}, { passive: true });

backToTopButton.addEventListener("click", () => {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  window.scrollTo({ top: 0, left: 0, behavior });
});

updateBackToTopVisibility();

function applyReactiveFilters(event) {
  if (periodStart.value > periodEnd.value) {
    if (event.currentTarget === periodStart) {
      periodEnd.value = periodStart.value;
    } else {
      periodStart.value = periodEnd.value;
    }
  }
  loadTrackingData();
}

for (const filter of [periodStart, periodEnd, unitSelect]) {
  filter.addEventListener("change", applyReactiveFilters);
}
for (const filter of [agenciesPeriodStart, agenciesPeriodEnd]) {
  filter.addEventListener("change", event => {
    if (agenciesPeriodStart.value > agenciesPeriodEnd.value) {
      if (event.currentTarget === agenciesPeriodStart) {
        agenciesPeriodEnd.value = agenciesPeriodStart.value;
      } else {
        agenciesPeriodStart.value = agenciesPeriodEnd.value;
      }
    }
    loadAgenciesData();
  });
}
agenciesBasisButtons.forEach(button => {
  button.addEventListener("click", () => {
    const basis = button.dataset.agenciesBasis;
    if (!basis || basis === selectedAgenciesCalculationBasis) return;
    selectedAgenciesCalculationBasis = basis;
    agenciesBasisButtons.forEach(item => {
      const isActive = item.dataset.agenciesBasis === selectedAgenciesCalculationBasis;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    });
    loadAgenciesData();
  });
});
agenciesCardGrid.addEventListener("click", event => {
  const button = event.target.closest(".agency-sort-button");
  if (!button || !agenciesData) return;
  const pa = decodeURIComponent(button.dataset.agencyPa);
  const key = button.dataset.agencySort;
  const current = agencyCardSorts.get(pa) || { key: "produto", direction: "asc" };
  const next = current.key === key
    ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
    : { key, direction: key === "produto" ? "asc" : "desc" };
  agencyCardSorts.set(pa, next);
  renderAgencyCards(agenciesData);
});
document.querySelector("#agency-ranking-body").addEventListener("click", event => {
  const button = event.target.closest(".agency-ranking-detail");
  if (!button) return;
  const target = document.getElementById(button.dataset.agencyTarget || "");
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.focus({ preventScroll: true });
});
document.querySelector(".agency-ranking-table thead").addEventListener("click", event => {
  const button = event.target.closest(".agency-comparison-sort");
  if (!button || !agenciesData) return;
  const key = button.dataset.agencyComparisonSort;
  agencyComparisonSort = agencyComparisonSort.key === key
    ? { key, direction: agencyComparisonSort.direction === "asc" ? "desc" : "asc" }
    : { key, direction: key === "name" ? "asc" : "desc" };
  renderAgencyCards(agenciesData);
});
agenciesExportPdfButton.addEventListener("click", exportAgenciesPdf);
calculationBasisButtons.forEach(button => {
  button.addEventListener("click", () => {
    const basis = button.dataset.calculationBasis;
    if (!basis || basis === selectedCalculationBasis) return;
    selectedCalculationBasis = basis;
    calculationBasisButtons.forEach(item => {
      const isActive = item.dataset.calculationBasis === selectedCalculationBasis;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    });
    loadTrackingData();
  });
});
document.querySelectorAll(".sort-button").forEach(button => {
  button.addEventListener("click", () => {
    const key = button.dataset.sort;
    if (trackingSort.key === key) {
      trackingSort.direction = trackingSort.direction === "asc" ? "desc" : "asc";
    } else {
      trackingSort = {
        key,
        direction: key === "produto" ? "asc" : "desc",
      };
    }
    renderTrackingTable();
  });
});
document.querySelectorAll(".unit-sort-button").forEach(button => {
  button.addEventListener("click", () => {
    const key = button.dataset.unitSort;
    if (unitSummarySort.key === key) {
      unitSummarySort.direction = unitSummarySort.direction === "asc" ? "desc" : "asc";
    } else {
      unitSummarySort = { key, direction: key === "pa" ? "asc" : "desc" };
    }
    if (unitSummaryData) renderUnitSummary(unitSummaryData);
  });
});
unitSummaryTotalButton.addEventListener("click", () => {
  unitSummaryViewMode = "total";
  applyUnitSummaryViewMode();
});
unitSummaryMonthlyButton.addEventListener("click", () => {
  unitSummaryViewMode = "monthly";
  applyUnitSummaryViewMode();
});
unitSummaryAnalyticButton.addEventListener("click", () => {
  unitSummaryViewMode = "analytic";
  applyUnitSummaryViewMode();
});
unitSummaryAnalyticUnitFilter.addEventListener("change", () => {
  if (!unitSummaryData) return;
  renderUnitSummary(unitSummaryData);
});
unitSummaryAnalyticMonthFilter.addEventListener("change", () => {
  if (!unitSummaryData) return;
  renderUnitSummaryAnalytic(unitSummaryData);
  applyUnitSummaryViewMode();
});
unitSummaryAnalyticHead.addEventListener("click", event => {
  const sortButton = event.target.closest("#unit-summary-analytic-sort-button");
  if (!sortButton || !unitSummaryData) return;
  unitSummaryAnalyticSortDirection =
    unitSummaryAnalyticSortDirection === "desc" ? "asc" : "desc";
  renderUnitSummaryAnalytic(unitSummaryData);
});
analyticViewButton.addEventListener("click", () => selectTrackingMode("analytic"));
syntheticViewButton.addEventListener("click", () => selectTrackingMode("synthetic"));
productByAgencyButton.addEventListener("click", () => {
  if (activeTrackingScope !== "FOCO" || analyticPerspective === "product_by_agency") return;
  analyticPerspective = "product_by_agency";
  selectedAnalyticProduct = "";
  analyticPage = 1;
  focusAgencyPage = 1;
  focusAgencyViewMode = "table";
  expandedFocusAgency = "";
  renderAnalytic(getActiveAnalyticData());
});
agencyByProductButton.addEventListener("click", () => {
  if (activeTrackingScope !== "FOCO" || analyticPerspective === "agency_by_product") return;
  analyticPerspective = "agency_by_product";
  selectedAnalyticProduct = "";
  selectedAnalyticAgency = "";
  analyticPage = 1;
  focusAgencyPage = 1;
  focusAgencyViewMode = "table";
  expandedFocusAgency = "";
  renderAnalytic(getActiveAnalyticData());
});
trackingExportButton.addEventListener("click", exportTrackingTable);
focusProductTabList.addEventListener("click", event => {
  const tab = event.target.closest(".focus-product-tab");
  if (!tab || activeTrackingScope !== "FOCO") return;
  if (analyticPerspective === "product_by_agency") {
    selectedAnalyticProduct = decodeURIComponent(tab.dataset.product || "");
  } else {
    const agency = decodeURIComponent(tab.dataset.agency || "");
    if (!agency || agency === selectedAnalyticAgency) return;
    selectedAnalyticAgency = agency;
    selectedAnalyticProduct = "";
    renderAnalytic(getActiveAnalyticData());
    return;
  }
  focusAgencyPage = 1;
  focusAgencyViewMode = "table";
  expandedFocusAgency = "";
  applyAnalyticInternalPage();
});
focusConsolidatedPeriodButton.addEventListener("click", () => {
  if (focusConsolidatedKpiBasis === "period") return;
  focusConsolidatedKpiBasis = "period";
  renderFocusConsolidatedKpis();
});
focusConsolidatedAnnualButton.addEventListener("click", () => {
  if (focusConsolidatedKpiBasis === "annual") return;
  focusConsolidatedKpiBasis = "annual";
  renderFocusConsolidatedKpis();
});
focusAgencyTableView.addEventListener("click", () => {
  if (focusAgencyViewMode === "table") return;
  focusAgencyViewMode = "table";
  renderFocusAgencyPerformance();
  renderAnalyticChart();
});
focusAgencyChartView.addEventListener("click", () => {
  if (focusAgencyViewMode === "chart") return;
  focusAgencyViewMode = "chart";
  expandedFocusAgency = "";
  renderFocusAgencyPerformance();
  renderAnalyticChart();
});
analyticChartMetaModelSelect.addEventListener("change", () => {
  analyticChartMetaModel = analyticChartMetaModelSelect.value === "columns" ? "columns" : "line";
  renderAnalyticChart();
});
analyticChartProductionModelSelect.addEventListener("change", () => {
  analyticChartProductionModel = analyticChartProductionModelSelect.value === "columns" ? "columns" : "line";
  renderAnalyticChart();
});
analyticChartShowVariationInput.addEventListener("change", () => {
  analyticChartShowVariation = analyticChartShowVariationInput.checked;
  renderAnalyticChart();
});
analyticChartShowValuesInput.addEventListener("change", () => {
  analyticChartShowValues = analyticChartShowValuesInput.checked;
  renderAnalyticChart();
});
analyticComboButtons.addEventListener("click", event => {
  const comboButton = event.target.closest(".analytic-combo-button");
  if (!comboButton) return;
  const clickedCombo = comboButton.dataset.combo;
  selectedAnalyticCombo =
    selectedAnalyticCombo === clickedCombo ? "" : clickedCombo;
  selectedAnalyticProduct = "";
  analyticPage = 1;
  renderAnalyticComboButtons();
  renderAnalyticComboKpis();
  renderAnalyticTable();
  renderAnalyticChart();
});
analyticComboKpis.addEventListener("click", event => {
  const modeButton = event.target.closest(".analytic-score-mode-button");
  if (!modeButton) return;
  const mode = modeButton.dataset.scoreMode;
  if (!mode || mode === selectedAnalyticScoreMode) return;
  selectedAnalyticScoreMode = mode;
  renderAnalyticComboKpis();
});
document.querySelector("#analytic-table-body").addEventListener("click", event => {
  if (activeTrackingScope === "FOCO"
      && analyticPerspective === "product_by_agency") return;
  const productButton = event.target.closest(".analytic-product-button");
  if (!productButton) return;
  const clickedProduct = decodeURIComponent(productButton.dataset.product);
  selectedAnalyticProduct =
    selectedAnalyticProduct === clickedProduct ? "" : clickedProduct;
  focusAgencyPage = 1;
  renderAnalyticTable();
  applyAnalyticInternalPage();
});
analyticPreviousPage.addEventListener("click", () => {
  if (analyticPage <= 1) return;
  analyticPage -= 1;
  renderAnalyticTable();
});
analyticNextPage.addEventListener("click", () => {
  const productCount = getAnalyticProductsForCombo().length;
  const totalPages = Math.max(1, Math.ceil(productCount / analyticPageSize));
  if (analyticPage >= totalPages) return;
  analyticPage += 1;
  renderAnalyticTable();
});
focusAgencyPreviousPage.addEventListener("click", () => {
  if (focusAgencyPage <= 1) return;
  focusAgencyPage -= 1;
  renderFocusAgencyPerformance();
});
focusAgencyNextPage.addEventListener("click", () => {
  const product = focusAgencyPerformanceData?.products.find(
    item => item.produto === selectedAnalyticProduct
  );
  const totalPages = Math.max(
    1,
    Math.ceil((product?.units.length || 0) / focusAgencyPageSize)
  );
  if (focusAgencyPage >= totalPages) return;
  focusAgencyPage += 1;
  renderFocusAgencyPerformance();
});
focusAgencyPerformanceHead.addEventListener("click", event => {
  const sortButton = event.target.closest("#focus-agency-sort-button");
  if (!sortButton) return;
  focusAgencySortDirection = focusAgencySortDirection === "desc" ? "asc" : "desc";
  focusAgencyPage = 1;
  renderFocusAgencyPerformance();
});
focusAgencyPerformanceBody.addEventListener("click", event => {
  const unitButton = event.target.closest(".focus-agency-unit-button");
  if (!unitButton || focusAgencyViewMode !== "table") return;
  const unitKey = decodeURIComponent(unitButton.dataset.pa || "");
  expandedFocusAgency = expandedFocusAgency === unitKey ? "" : unitKey;
  renderFocusAgencyPerformance();
});
productSearch.addEventListener("input", renderTrackingTable);
logSearch.addEventListener("input", () => {
  logsPage = 1;
  renderLogsTable();
});
logPeriodButton.addEventListener("click", () => {
  const willOpen = logPeriodMenu.hidden;
  logPeriodMenu.hidden = !willOpen;
  logPeriodButton.setAttribute("aria-expanded", String(willOpen));
});
logPeriodMenu.addEventListener("click", event => {
  const option = event.target.closest(".log-period-option");
  if (!option) return;
  selectedLogPeriod = option.dataset.period;
  logsPage = 1;
  renderLogPeriodMenu();
  closeLogPeriodMenu();
  renderLogsTable();
});
logsPreviousPage.addEventListener("click", () => {
  if (logsPage <= 1) return;
  logsPage -= 1;
  renderLogsTable();
});
logsNextPage.addEventListener("click", () => {
  const filteredCount = getFilteredLogEntries().length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / logsPageSize));
  if (logsPage >= totalPages) return;
  logsPage += 1;
  renderLogsTable();
});
document.addEventListener("click", event => {
  if (!logPeriodFilter.contains(event.target)) closeLogPeriodMenu();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeLogPeriodMenu();
    closeUserMenus();
  }
});
refreshLogsButton.addEventListener("click", loadLogs);
window.addEventListener("hashchange", handleRoute);

async function initializeApp() {
  await loadCurrentUser();
  if (currentUserIsAdmin) await refreshBaseStatus();
  await handleRoute();
}

initializeApp();
