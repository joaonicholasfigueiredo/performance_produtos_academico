function setTrackingState(state) {
  trackingLoading.hidden = state !== "loading";
  trackingEmpty.hidden = state !== "empty";
  trackingContent.hidden = state !== "content";
  trackingExportButton.disabled = state !== "content";
}

async function loadTrackingPeriods() {
  const data = await request("/api/acompanhamento/periodos");
  const options = data.periods
    .map(period => `<option value="${period.value}">${escapeHtml(period.label)}</option>`)
    .join("");
  periodStart.innerHTML = options;
  periodEnd.innerHTML = options;
  periodStart.value = data.default_start;
  periodEnd.value = data.default_end;
  unitSelect.innerHTML = data.units
    .map(unit => `<option value="${escapeHtml(unit.value)}">${escapeHtml(unit.label)}</option>`)
    .join("");
  unitSelect.value = data.default_unit;
  trackingPeriodsLoaded = true;
}

function humanizeProduct(value) {
  const acronyms = new Set(["PF", "PJ", "MI", "VGBL"]);
  return value
    .toLowerCase()
    .split("_")
    .map(part => {
      const upperPart = part.toUpperCase();
      if (acronyms.has(upperPart)) return upperPart;
      return part ? part[0].toUpperCase() + part.slice(1) : "";
    })
    .join(" ");
}

function productInitials(value) {
  return value
    .split("_")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || "—";
}

function formatReferencePeriod(value) {
  if (!value) return "";
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(date).replace(".", "");
}

function usesUnitValues(productName) {
  return productName.toUpperCase().startsWith("PREVIDENCIA");
}

function formatMatrixValue(productName, value) {
  return usesUnitValues(productName)
    ? matrixValueFormatter.format(value)
    : matrixCurrencyFormatter.format(value);
}

function compareTrackingProducts(first, second) {
  const { key, direction } = trackingSort;
  let comparison = 0;

  if (key === "produto") {
    comparison = humanizeProduct(first.produto).localeCompare(
      humanizeProduct(second.produto),
      "pt-BR",
      { sensitivity: "base" }
    );
  } else if (key === "status") {
    const statusOrder = { sem_meta: 1, nao_aderente: 2, aderente: 3 };
    comparison = statusOrder[first.status] - statusOrder[second.status];
  } else {
    const firstValue = first[key];
    const secondValue = second[key];
    if (firstValue === null && secondValue === null) comparison = 0;
    else if (firstValue === null) return 1;
    else if (secondValue === null) return -1;
    else comparison = firstValue - secondValue;
  }

  return direction === "asc" ? comparison : -comparison;
}

function updateSortIndicators() {
  document.querySelectorAll(".sort-button").forEach(button => {
    const isActive = button.dataset.sort === trackingSort.key;
    const icon = button.querySelector(".sort-icon");
    button.classList.toggle("active", isActive);
    icon.textContent = isActive
      ? trackingSort.direction === "asc"
        ? "↑"
        : "↓"
      : "↕";
    button.closest("th").setAttribute(
      "aria-sort",
      isActive
        ? trackingSort.direction === "asc"
          ? "ascending"
          : "descending"
        : "none"
    );
  });
}

function renderTrackingTable() {
  const query = productSearch.value.trim().toLocaleLowerCase("pt-BR");
  const filtered = trackingProducts.filter(product =>
    humanizeProduct(product.produto).toLocaleLowerCase("pt-BR").includes(query)
  ).sort(compareTrackingProducts);

  const body = document.querySelector("#tracking-table-body");
  if (!filtered.length) {
    body.innerHTML = '<tr class="matrix-empty-row"><td colspan="6">Nenhum produto encontrado.</td></tr>';
  } else {
    body.innerHTML = filtered.map(product => {
      const hasTarget = product.percentual_atingido !== null;
      const percentage = hasTarget
        ? `${percentageFormatter.format(product.percentual_atingido)}%`
        : "—";
      const progressWidth = hasTarget
        ? Math.min(Math.max(product.percentual_atingido, 0), 100)
        : 0;
      const statusLabel = {
        aderente: "Aderente",
        nao_aderente: "Não aderente",
        sem_meta: "Sem meta",
      }[product.status];
      const statusClass = product.status.replaceAll("_", "-");
      const usesLatestBalance =
        trackingCalculation?.value === "MENSAL"
        && product.regra_calculo === "ultimo_saldo_anual";
      const isUnitValue = usesUnitValues(product.produto);
      const valueAlignmentClass = isUnitValue ? "unit-value" : "monetary-value";
      const gapClass = product.gap >= 0 ? "positive-gap" : "negative-gap";
      const gapAlignmentClass = isUnitValue ? "" : "monetary-value";
      const gapPrefix = product.gap > 0 ? "+" : "";
      const ruleNote = usesLatestBalance
        ? `<small class="calculation-rule" title="Meta e produção anuais do mês mais recente, sem somatório mensal">Saldo de ${escapeHtml(formatReferencePeriod(product.periodo_referencia))}</small>`
        : "";

      return `
        <tr>
          <td>
            <span class="product-cell">
              <span class="product-monogram">${escapeHtml(productInitials(product.produto))}</span>
              <span class="product-details">
                <span class="product-name">${escapeHtml(humanizeProduct(product.produto))}</span>
                ${ruleNote}
              </span>
            </span>
          </td>
          <td class="numeric ${valueAlignmentClass}">${formatMatrixValue(product.produto, product.meta_acumulada)}</td>
          <td class="numeric ${valueAlignmentClass}"><strong>${formatMatrixValue(product.produto, product.producao_acumulada)}</strong></td>
          <td class="achievement-cell">
            <div class="achievement-value"><span>${percentage}</span></div>
            <div class="progress-track">
              <div class="progress-fill ${product.status === "aderente" ? "adherent" : ""} ${!hasTarget ? "no-target" : ""}" style="width:${progressWidth}%"></div>
            </div>
          </td>
          <td class="numeric gap-value ${gapClass} ${gapAlignmentClass}">${gapPrefix}${formatMatrixValue(product.produto, product.gap)}</td>
          <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
        </tr>`;
    }).join("");
  }

  const total = trackingProducts.length;
  document.querySelector("#matrix-count").textContent =
    `${numberFormatter.format(filtered.length)} de ${numberFormatter.format(total)} produto(s)`;
  updateSortIndicators();
}

function renderAchievementDistribution(products) {
  const measuredProducts = products.filter(
    product => product.percentual_atingido !== null
  );
  const bands = [
    { label: "100% ou mais", className: "excellent", test: value => value >= 100 },
    { label: "75% a 99,9%", className: "good", test: value => value >= 75 && value < 100 },
    { label: "50% a 74,9%", className: "attention", test: value => value >= 50 && value < 75 },
    { label: "25% a 49,9%", className: "warning", test: value => value >= 25 && value < 50 },
    { label: "Abaixo de 25%", className: "critical", test: value => value < 25 },
  ];
  const maximum = Math.max(
    1,
    ...bands.map(band =>
      measuredProducts.filter(product => band.test(product.percentual_atingido)).length
    )
  );

  document.querySelector("#achievement-distribution").innerHTML = bands.map(band => {
    const count = measuredProducts.filter(
      product => band.test(product.percentual_atingido)
    ).length;
    const width = count ? Math.max((count / maximum) * 100, 8) : 0;
    return `
      <div class="distribution-band ${band.className}${count === 0 ? " is-empty" : ""}">
        <div class="distribution-band-label">
          <span>${band.label}</span>
          <strong>${numberFormatter.format(count)}</strong>
        </div>
        <div class="distribution-track" aria-hidden="true">
          <span style="width:${width}%"></span>
        </div>
      </div>`;
  }).join("");

  document.querySelector("#achievement-distribution-total").textContent =
    `${numberFormatter.format(measuredProducts.length)} produto(s) com meta`;
}

function renderTracking(data) {
  trackingProducts = data.products;
  trackingCalculation = data.calculation;
  const summary = data.summary;
  const productCountLabel = `${numberFormatter.format(summary.products)} Produtos`;
  const activeNavCount = activeTrackingScope === "FOCO"
    ? navFocusCount
    : navTrackingCount;
  const activeNav = activeTrackingScope === "FOCO" ? navFocus : navTracking;
  trackingPageDescription.textContent = activeTrackingScope === "FOCO"
    ? `${productCountLabel} foco · acompanhe os indicadores prioritários no consolidado e por PA.`
    : `${productCountLabel} · compare a produção realizada com a meta por produto.`;
  activeNavCount.textContent = activeTrackingScope === "FOCO"
    ? `${productCountLabel} foco`
    : productCountLabel;
  activeNav.setAttribute(
    "aria-label",
    `Produção Acumulada - ${productCountLabel}${activeTrackingScope === "FOCO" ? " foco" : ""}`
  );
  document.querySelector("#kpi-products").textContent = numberFormatter.format(summary.products);
  document.querySelector("#kpi-period").textContent = data.calculation.uses_latest_period
    ? `posição de ${formatReferencePeriod(data.calculation.reference_period)}`
    : `${numberFormatter.format(summary.months_with_data)} mês(es) com dados`;
  document.querySelector("#kpi-adherent").textContent =
    `${numberFormatter.format(summary.adherent)} de ${numberFormatter.format(summary.with_target)}`;
  document.querySelector("#kpi-rate").textContent =
    `${percentageFormatter.format(summary.adherence_rate)}%`;
  document.querySelector("#kpi-not-adherent").textContent =
    numberFormatter.format(summary.not_adherent);
  document.querySelector("#kpi-without-target").textContent =
    `${numberFormatter.format(summary.without_target)} produto(s) sem meta`;
  const measuredProducts = data.products.filter(product => product.percentual_atingido !== null);
  const rankedProducts = [...measuredProducts].sort((first, second) =>
    second.percentual_atingido - first.percentual_atingido
  );
  const opportunityProducts = measuredProducts
    .filter(product => product.gap < 0)
    .sort((first, second) => first.gap - second.gap);
  const bestProduct = rankedProducts[0];
  const criticalProduct = opportunityProducts[0];
  const formatInsightGap = product => {
    if (!product) return "—";
    const prefix = product.gap > 0 ? "+" : "";
    return `${prefix}${formatMatrixValue(product.produto, product.gap)}`;
  };
  document.querySelector("#executive-best-product").textContent = bestProduct
    ? humanizeProduct(bestProduct.produto)
    : "Sem dados";
  document.querySelector("#executive-best-product-detail").textContent = bestProduct
    ? `${percentageFormatter.format(bestProduct.percentual_atingido)}% de atingimento · gap ${formatInsightGap(bestProduct)}`
    : "Nenhum produto com meta no período";
  document.querySelector("#executive-critical-product").textContent = criticalProduct
    ? humanizeProduct(criticalProduct.produto)
    : "Nenhum gap negativo";
  document.querySelector("#executive-critical-product-detail").textContent = criticalProduct
    ? `${percentageFormatter.format(criticalProduct.percentual_atingido)}% de atingimento · gap ${formatInsightGap(criticalProduct)}`
    : "Todos os produtos com meta estão acima do objetivo";
  document.querySelector("#executive-briefing-context").textContent =
    `${data.range.start_label} a ${data.range.end_label} · ${data.unit.label}`;
  const referenceLabel = formatReferencePeriod(data.calculation.reference_period);
  const isSinglePeriod = data.range.start === data.range.end;
  const calculationDescription = data.calculation.value === "ANUAL"
    ? `${data.calculation.meta_field} × ${data.calculation.production_field} · posição de ${referenceLabel}`
    : isSinglePeriod
      ? `valores mensais de ${referenceLabel}`
      : `soma mensal de ${data.range.start_label} a ${data.range.end_label}`;
  document.querySelector("#matrix-subtitle").textContent =
    `${data.scope.label} · ${data.unit.label} · ${calculationDescription}.`;
  document.querySelector("#matrix-title").textContent = data.calculation.value === "ANUAL"
    ? `Produção anual (${referenceLabel})`
    : isSinglePeriod
      ? `Produção no período (${referenceLabel})`
      : `Produção no período (${data.range.start_label} a ${data.range.end_label})`;
  document.querySelector("#tracking-meta-header").textContent = data.calculation.value === "ANUAL"
    ? "META ANUAL"
    : "META NO PERÍODO";
  document.querySelector("#tracking-production-header").textContent = data.calculation.value === "ANUAL"
    ? "PRODUÇÃO ANUAL"
    : "PRODUÇÃO NO PERÍODO";
  const adherenceRate = Math.min(Math.max(summary.adherence_rate || 0, 0), 100);
  const adherenceDonut = document.querySelector("#adherence-donut");
  adherenceDonut.style.setProperty("--adherence", `${adherenceRate * 3.6}deg`);
  adherenceDonut.setAttribute(
    "aria-label",
    `Taxa de aderência de ${percentageFormatter.format(adherenceRate)}%`
  );
  document.querySelector("#adherence-donut-value").textContent =
    `${percentageFormatter.format(adherenceRate)}%`;
  renderAchievementDistribution(data.products);
  renderTrackingTable();
}

function getFilteredUnitSummaryUnits(data) {
  const selectedUnit = unitSummaryAnalyticUnitFilter.value;
  return data.units.filter(unit => !selectedUnit || unit.pa === selectedUnit);
}

function renderUnitSummary(data) {
  unitSummaryData = data;
  unitSummaries = data.units;
  const isSinglePeriod = data.range.start === data.range.end;
  const scoringLabel = `${numberFormatter.format(data.scope.products_per_month)} produtos × ${numberFormatter.format(data.scope.months)} mês(es) = ${numberFormatter.format(data.scope.target)} metas por unidade`;
  document.querySelector("#unit-summary-subtitle").textContent = isSinglePeriod
    ? `${scoringLabel} · ${data.range.start_label}.`
    : `${scoringLabel} · ${data.range.start_label} a ${data.range.end_label}.`;
  document.querySelector("#unit-summary-count").textContent =
    `${numberFormatter.format(data.units.length)} unidade(s) comparada(s)`;
  populateUnitSummaryAnalyticFilters(data);

  const executiveRankedUnits = [...data.units].sort((first, second) =>
    second.adherence_rate - first.adherence_rate
      || second.adherent - first.adherent
      || String(first.code || first.pa).localeCompare(
        String(second.code || second.pa),
        "pt-BR",
        { numeric: true }
      )
  );
  const leadingUnit = executiveRankedUnits[0];
  const attentionUnit = executiveRankedUnits[executiveRankedUnits.length - 1];
  const setExecutiveUnit = (prefix, unit) => {
    document.querySelector(`#executive-${prefix}-unit`).textContent = unit
      ? `PA ${unit.code || unit.pa} · ${unit.name || unit.label}`
      : "Sem dados";
    document.querySelector(`#executive-${prefix}-unit-detail`).textContent = unit
      ? `${percentageFormatter.format(unit.adherence_rate)}% · ${numberFormatter.format(unit.adherent)} de ${numberFormatter.format(unit.with_target)} metas atingidas`
      : "Nenhuma unidade disponível";
  };
  setExecutiveUnit("leading", leadingUnit);
  setExecutiveUnit("attention", attentionUnit);

  if (!data.units.length) {
    unitSummaryTableBody.innerHTML = `
      <tr class="matrix-empty-row"><td colspan="4">Nenhuma unidade encontrada para o filtro selecionado.</td></tr>`;
    unitSummaryMonthlyHead.innerHTML = "";
    unitSummaryMonthlyBody.innerHTML = `
      <tr class="matrix-empty-row"><td>Nenhuma unidade encontrada para o filtro selecionado.</td></tr>`;
    unitSummaryAnalyticHead.innerHTML = "";
    unitSummaryAnalyticBody.innerHTML = `
      <tr class="matrix-empty-row"><td>Nenhuma unidade encontrada para o filtro selecionado.</td></tr>`;
    applyUnitSummaryViewMode();
    return;
  }

  const sortedUnits = [...getFilteredUnitSummaryUnits(data)].sort(compareUnitSummaries);
  unitSummaryTableBody.innerHTML = sortedUnits.map(unit => {
    const rate = Math.min(Math.max(unit.adherence_rate || 0, 0), 100);
    const selectedClass = unitSelect.value === unit.pa ? "selected-unit" : "";
    return `
      <tr class="${selectedClass}">
        <td><span class="unit-name"><i>PA ${escapeHtml(unit.code || unit.pa)}</i><strong>${escapeHtml(unit.name || unit.label)}</strong></span></td>
        <td class="unit-summary-number">${numberFormatter.format(unit.products)}</td>
        <td class="unit-summary-number achieved">${numberFormatter.format(unit.adherent)}</td>
        <td>
          <div class="unit-rate-cell">
            <strong>${percentageFormatter.format(unit.adherence_rate)}%</strong>
            <span aria-hidden="true"><i style="width:${rate}%"></i></span>
          </div>
        </td>
      </tr>`;
  }).join("");

  renderUnitSummaryMonthly(data);
  renderUnitSummaryAnalytic(data);
  updateUnitSortIndicators();
  applyUnitSummaryViewMode();
}

function renderUnitSummaryMonthly(data) {
  const periods = data.units[0]?.monthly || [];
  unitSummaryMonthlyHead.innerHTML = `
    <tr>
      <th>UNIDADE</th>
      ${periods.map(month => `<th>${escapeHtml(month.period_label)}</th>`).join("")}
    </tr>`;

  const unitsByCode = [...getFilteredUnitSummaryUnits(data)].sort((first, second) =>
    String(first.code || first.pa).localeCompare(
      String(second.code || second.pa),
      "pt-BR",
      { numeric: true }
    )
  );
  unitSummaryMonthlyBody.innerHTML = unitsByCode.map(unit => {
    const selectedClass = unitSelect.value === unit.pa ? "selected-unit" : "";
    return `
      <tr class="${selectedClass}">
        <td><span class="unit-name"><i>PA ${escapeHtml(unit.code || unit.pa)}</i><strong>${escapeHtml(unit.name || unit.label)}</strong></span></td>
        ${(unit.monthly || []).map(month => {
          const target = month.target ?? data.scope.products_per_month ?? 0;
          return `
            <td class="unit-summary-number monthly-achieved${month.adherent > 0 ? " has-achievement" : ""}"
              aria-label="${numberFormatter.format(month.adherent)} de ${numberFormatter.format(target)} metas atingidas">
              <strong>${numberFormatter.format(month.adherent)}</strong><span>/${numberFormatter.format(target)}</span>
            </td>`;
        }).join("")}
      </tr>`;
  }).join("");
}

function populateUnitSummaryAnalyticFilters(data) {
  const selectedUnit = unitSummaryAnalyticUnitFilter.value;
  const selectedMonth = unitSummaryAnalyticMonthFilter.value;
  const unitsByCode = [...data.units].sort((first, second) =>
    String(first.code || first.pa).localeCompare(
      String(second.code || second.pa),
      "pt-BR",
      { numeric: true }
    )
  );
  const periods = data.units[0]?.monthly || [];

  unitSummaryAnalyticUnitFilter.innerHTML = `
    <option value="">Todas as agências</option>
    ${unitsByCode.map(unit => `
      <option value="${escapeHtml(unit.pa)}">PA ${escapeHtml(unit.code || unit.pa)} — ${escapeHtml(unit.name || unit.label)}</option>`).join("")}`;
  unitSummaryAnalyticMonthFilter.innerHTML = `
    <option value="">Todos os meses</option>
    ${periods.map(month => `
      <option value="${escapeHtml(month.period)}">${escapeHtml(month.period_label)}</option>`).join("")}`;

  unitSummaryAnalyticUnitFilter.value = unitsByCode.some(unit => unit.pa === selectedUnit)
    ? selectedUnit
    : "";
  unitSummaryAnalyticMonthFilter.value = periods.some(month => month.period === selectedMonth)
    ? selectedMonth
    : "";
}

function renderUnitSummaryAnalytic(data) {
  const selectedUnit = unitSummaryAnalyticUnitFilter.value;
  const selectedMonth = unitSummaryAnalyticMonthFilter.value;
  const periods = (data.units[0]?.monthly || []).filter(
    month => !selectedMonth || month.period === selectedMonth
  );
  const scoreForUnit = unit => (unit.monthly || [])
    .filter(month => !selectedMonth || month.period === selectedMonth)
    .reduce((total, month) => total + (month.adherent || 0), 0);
  const orderedUnits = [...data.units].sort((first, second) => {
    const scoreDifference = unitSummaryAnalyticSortDirection === "desc"
      ? scoreForUnit(second) - scoreForUnit(first)
      : scoreForUnit(first) - scoreForUnit(second);
    if (scoreDifference) return scoreDifference;
    return String(first.code || first.pa).localeCompare(
      String(second.code || second.pa),
      "pt-BR",
      { numeric: true }
    );
  });
  const visibleUnits = orderedUnits.filter(
    unit => !selectedUnit || unit.pa === selectedUnit
  );

  unitSummaryAnalyticHead.innerHTML = `
    <tr>
      <th aria-sort="${unitSummaryAnalyticSortDirection === "desc" ? "descending" : "ascending"}">
        <button id="unit-summary-analytic-sort-button" class="unit-summary-analytic-sort-button active" type="button" aria-label="Ordenar agências por metas atingidas: ${unitSummaryAnalyticSortDirection === "desc" ? "maior para menor" : "menor para maior"}" title="Ordenar pela quantidade de metas atingidas no período">
          AGÊNCIA
          <span aria-hidden="true">${unitSummaryAnalyticSortDirection === "desc" ? "↓" : "↑"}</span>
        </button>
      </th>
      ${periods.map(month => `<th>${escapeHtml(month.period_label.toLocaleUpperCase("pt-BR"))}</th>`).join("")}
    </tr>`;

  const rows = visibleUnits.map(unit => {
      const selectedClass = unitSelect.value === unit.pa ? "selected-unit" : "";
      const scoreMonths = (unit.monthly || []).filter(
        month => !selectedMonth || month.period === selectedMonth
      );
      const achievedCount = selectedMonth
        ? scoreMonths.reduce(
          (total, month) => total + (month.adherent || 0),
          0
        )
        : unit.adherent;
      const targetCount = selectedMonth
        ? scoreMonths.reduce(
          (total, month) => total + (month.target || 0),
          0
        )
        : unit.products;
      const scoreLabel = !selectedMonth && data.calculation.value === "ANUAL"
        ? "metas anuais"
        : "metas no período";
      return `
        <tr class="${selectedClass}">
          <td>
            <span class="unit-summary-agency-cell">
              <span class="unit-name"><i>PA ${escapeHtml(unit.code || unit.pa)}</i><strong>${escapeHtml(unit.name || unit.label)}</strong></span>
              <small class="unit-summary-agency-score"><strong>${numberFormatter.format(achievedCount)}/${numberFormatter.format(targetCount)}</strong> ${scoreLabel}</small>
            </span>
          </td>
          ${periods.map(period => {
            const month = (unit.monthly || []).find(item => item.period === period.period);
            const products = month?.achieved_products || [];
            const productTags = products.length
              ? products.map(product => `
                  <span class="unit-product-tag">${escapeHtml(humanizeProduct(product))}</span>`).join("")
              : '<span class="unit-product-empty">—</span>';
            return `<td><div class="unit-product-tags">${productTags}</div></td>`;
          }).join("")}
        </tr>`;
  });
  unitSummaryAnalyticBody.innerHTML = rows.length
    ? rows.join("")
    : `<tr class="matrix-empty-row"><td colspan="${periods.length + 1}">Nenhum resultado para os filtros selecionados.</td></tr>`;
  return rows.length;
}

function applyUnitSummaryViewMode() {
  const isTotal = unitSummaryViewMode === "total";
  const isMonthly = unitSummaryViewMode === "monthly";
  const isAnalytic = unitSummaryViewMode === "analytic";
  unitSummaryTotalButton.classList.toggle("active", isTotal);
  unitSummaryTotalButton.setAttribute("aria-selected", String(isTotal));
  unitSummaryMonthlyButton.classList.toggle("active", isMonthly);
  unitSummaryMonthlyButton.setAttribute("aria-selected", String(isMonthly));
  unitSummaryAnalyticButton.classList.toggle("active", isAnalytic);
  unitSummaryAnalyticButton.setAttribute("aria-selected", String(isAnalytic));
  unitSummaryMonthFilterLabel.hidden = !isAnalytic;
  unitSummaryTotalView.hidden = !isTotal;
  unitSummaryMonthlyView.hidden = !isMonthly;
  unitSummaryAnalyticView.hidden = !isAnalytic;
  if (!unitSummaryData) return;
  const visibleUnitCount = getFilteredUnitSummaryUnits(unitSummaryData).length;
  document.querySelector("#unit-summary-count").textContent = isMonthly
    ? `${numberFormatter.format(visibleUnitCount)} unidade(s) · ${numberFormatter.format(unitSummaryData.scope.period_months ?? unitSummaryData.scope.months)} mês(es) detalhado(s)`
    : isAnalytic
      ? `${numberFormatter.format(renderUnitSummaryAnalytic(unitSummaryData))} agência(s) exibida(s)`
    : `${numberFormatter.format(visibleUnitCount)} unidade(s) comparada(s)`;
  unitSummaryCriteria.lastChild.textContent = isMonthly
    ? " Quantidade de produtos com atingimento mensal igual ou superior a 100%"
    : isAnalytic
      ? " Produtos que atingiram 100% ou mais da meta em cada mês"
    : " Cada produto pode pontuar uma vez por mês ao atingir 100% da meta";
}

function compareUnitSummaries(first, second) {
  const { key, direction } = unitSummarySort;
  let comparison;
  if (key === "pa") {
    const firstNumeric = /^\d+$/.test(first.pa);
    const secondNumeric = /^\d+$/.test(second.pa);
    if (firstNumeric && secondNumeric) comparison = Number(first.pa) - Number(second.pa);
    else comparison = String(first.pa).localeCompare(String(second.pa), "pt-BR", { numeric: true });
  } else {
    comparison = (first.adherence_rate || 0) - (second.adherence_rate || 0);
    if (comparison === 0) comparison = (first.adherent || 0) - (second.adherent || 0);
  }
  return direction === "asc" ? comparison : -comparison;
}

function updateUnitSortIndicators() {
  document.querySelectorAll(".unit-sort-button").forEach(button => {
    const isActive = button.dataset.unitSort === unitSummarySort.key;
    const icon = button.querySelector(".sort-icon");
    button.classList.toggle("active", isActive);
    icon.textContent = isActive
      ? unitSummarySort.direction === "asc" ? "↑" : "↓"
      : "↕";
    button.closest("th").setAttribute(
      "aria-sort",
      isActive ? (unitSummarySort.direction === "asc" ? "ascending" : "descending") : "none"
    );
  });
}
