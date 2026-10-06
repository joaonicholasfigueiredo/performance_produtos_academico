function compactChartValue(value, productName) {
  if (usesUnitValues(productName)) {
    return new Intl.NumberFormat("pt-BR", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return `R$ ${new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

function niceChartNumber(value, round) {
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / (10 ** exponent);
  let niceFraction;
  if (round) {
    niceFraction = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  } else {
    niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  }
  return niceFraction * (10 ** exponent);
}

function buildChartScale(values, maximumTicks = 5) {
  const rawMinimum = Math.min(0, ...values);
  const rawMaximum = Math.max(0, ...values);
  const rawRange = rawMaximum - rawMinimum || Math.max(Math.abs(rawMaximum), 1);
  const range = niceChartNumber(rawRange, false);
  const spacing = niceChartNumber(range / (maximumTicks - 1), true);
  const minimum = Math.floor(rawMinimum / spacing) * spacing;
  const maximum = Math.ceil(rawMaximum / spacing) * spacing || spacing;
  const tickCount = Math.round((maximum - minimum) / spacing);
  return {
    minimum,
    maximum,
    ticks: Array.from({ length: tickCount + 1 }, (_, index) => minimum + spacing * index),
  };
}

function renderAnalyticChart() {
  const selectedProduct = selectedAnalyticProduct;
  const product = analyticProducts.find(item => item.produto === selectedProduct);
  const productByAgency = activeTrackingScope === "FOCO"
    && analyticPerspective === "product_by_agency";
  const agencyByProduct = activeTrackingScope === "FOCO"
    && analyticPerspective === "agency_by_product";

  if (!product) {
    analyticChartHint.hidden = activeTrackingScope === "FOCO";
    analyticChartCard.hidden = true;
    return;
  }

  if (agencyByProduct) {
    analyticChartHint.hidden = true;
    analyticChartCard.hidden = true;
    return;
  }

  if (productByAgency && focusAgencyViewMode !== "chart") {
    analyticChartHint.hidden = true;
    analyticChartCard.hidden = true;
    return;
  }

  analyticChartHint.hidden = true;
  analyticChartCard.hidden = false;
  analyticChartMetaModelSelect.value = analyticChartMetaModel;
  analyticChartProductionModelSelect.value = analyticChartProductionModel;
  analyticChartShowVariationInput.checked = analyticChartShowVariation;
  analyticChartShowValuesInput.checked = analyticChartShowValues;
  analyticChartCard.dataset.metaModel = analyticChartMetaModel;
  analyticChartCard.dataset.productionModel = analyticChartProductionModel;
  document.querySelector("#analytic-chart-title").textContent =
    humanizeProduct(product.produto);
  const chartDescription = product.regra_calculo === "saldo_mensal_nao_acumulado"
    ? "Evolução mensal do saldo, sem soma entre os meses."
    : "Evolução da meta e da produção mensal.";
  document.querySelector("#analytic-chart-subtitle").textContent =
    `${chartDescription} · ${analyticUnit?.label || "Unidade selecionada"}`;

  const productionVariation = index => {
    if (index === 0) return null;
    const current = product.points[index].producao;
    const previous = product.points[index - 1].producao;
    if (current === null || previous === null) return undefined;
    if (previous === 0) return current === 0 ? 0 : undefined;
    return ((current - previous) / Math.abs(previous)) * 100;
  };
  const variationLabel = (variation, detailed = true) => {
    if (variation === null) return detailed ? "Base inicial" : "Base";
    if (variation === undefined) return detailed ? "Variação não disponível" : "n/d";
    const prefix = variation > 0 ? "+" : "";
    const formatted = `${prefix}${percentageFormatter.format(variation)}%`;
    return detailed ? `${formatted} contra o mês anterior` : formatted;
  };
  const variationClass = variation => {
    if (variation === null || variation === undefined || variation === 0) return "neutral";
    return variation > 0 ? "positive" : "negative";
  };

  const width = 1080;
  const height = 440;
  const margin = { top: 42, right: 34, bottom: 82, left: 96 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const validValues = product.points.flatMap(point =>
    [point.meta, point.producao].filter(value => value !== null)
  );
  const scale = buildChartScale(validValues.length ? validValues : [0, 1]);
  const xAt = index => product.points.length === 1
    ? margin.left + plotWidth / 2
    : margin.left + (plotWidth * index) / (product.points.length - 1);
  const hasColumns = analyticChartMetaModel === "columns"
    || analyticChartProductionModel === "columns";
  const chartXAt = index => hasColumns
    ? margin.left + (plotWidth * (index + .5)) / Math.max(product.points.length, 1)
    : xAt(index);
  const yAt = value =>
    margin.top
    + ((scale.maximum - value) / (scale.maximum - scale.minimum)) * plotHeight;
  const baselineY = yAt(Math.max(scale.minimum, Math.min(0, scale.maximum)));

  function linePath(key) {
    let path = "";
    let drawing = false;
    product.points.forEach((point, index) => {
      const value = point[key];
      if (value === null) {
        drawing = false;
        return;
      }
      path += `${drawing ? " L" : " M"} ${chartXAt(index).toFixed(2)} ${yAt(value).toFixed(2)}`;
      drawing = true;
    });
    return path.trim();
  }

  function areaPaths(key) {
    const segments = [];
    let segment = [];
    const flush = () => {
      if (!segment.length) return;
      const first = segment[0];
      const last = segment[segment.length - 1];
      const line = segment
        .map(point =>
          `L ${chartXAt(point.index).toFixed(2)} ${yAt(point.value).toFixed(2)}`
        )
        .join(" ");
      segments.push(
        `M ${chartXAt(first.index).toFixed(2)} ${baselineY.toFixed(2)} `
        + `${line} L ${chartXAt(last.index).toFixed(2)} ${baselineY.toFixed(2)} Z`
      );
      segment = [];
    };
    product.points.forEach((point, index) => {
      if (point[key] === null) {
        flush();
      } else {
        segment.push({ index, value: point[key] });
      }
    });
    flush();
    return segments;
  }

  const grid = scale.ticks.map(value => {
    const y = yAt(value);
    return `
      <line class="chart-grid-line" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"/>
      <text class="chart-axis-label" x="${margin.left - 12}" y="${y + 4}" text-anchor="end">${escapeHtml(compactChartValue(value, product.produto))}</text>`;
  }).join("");
  const columnSlotWidth = plotWidth / Math.max(product.points.length, 1);
  const columnWidth = Math.min(28, Math.max(10, columnSlotWidth * .24));
  const seriesXAt = (key, index) => {
    const center = chartXAt(index);
    const model = key === "meta" ? analyticChartMetaModel : analyticChartProductionModel;
    const bothColumns = analyticChartMetaModel === "columns"
      && analyticChartProductionModel === "columns";
    if (model !== "columns" || !bothColumns) return center;
    return key === "meta"
      ? center - columnWidth / 2 - 2
      : center + columnWidth / 2 + 2;
  };
  const verticalGuides = product.points.map((point, index) => `
    <line class="chart-column-guide" x1="${chartXAt(index)}" y1="${margin.top}" x2="${chartXAt(index)}" y2="${baselineY}"/>
  `).join("");
  const xAxis = product.points.map((point, index) => {
    const variation = productionVariation(index);
    const shortVariation = variationLabel(variation, false);
    const badgeWidth = Math.max(42, Math.min(72, shortVariation.length * 6 + 16));
    return `
      <text class="chart-x-label" x="${chartXAt(index)}" y="${analyticChartShowVariation ? height - 48 : height - 25}" text-anchor="middle">${escapeHtml(point.period_label)}</text>
      ${analyticChartShowVariation ? `
        <g class="chart-variation-badge ${variationClass(variation)}">
          <rect x="${chartXAt(index) - badgeWidth / 2}" y="${height - 35}" width="${badgeWidth}" height="21" rx="10.5"/>
          <text x="${chartXAt(index)}" y="${height - 21}" text-anchor="middle">${escapeHtml(shortVariation)}</text>
        </g>` : ""}`;
  }).join("");
  const dots = (key, className) => product.points.map((point, index) => {
    if (point[key] === null) return "";
    const variation = key === "producao" ? productionVariation(index) : null;
    const titleSuffix = key === "producao"
      ? ` · ${variationLabel(variation, true)}`
      : "";
    return `
      <g class="chart-point">
        <circle class="${className}-halo" cx="${chartXAt(index)}" cy="${yAt(point[key])}" r="9"/>
        <circle class="${className}" cx="${chartXAt(index)}" cy="${yAt(point[key])}" r="${key === "producao" ? 4.5 : 3.5}">
          <title>${escapeHtml(point.period_label)} — ${escapeHtml(formatMatrixValue(product.produto, point[key]))}${escapeHtml(titleSuffix)}</title>
        </circle>
      </g>`;
  }).join("");
  const valueLabels = key => product.points.map((point, index) => {
    const value = point[key];
    if (!analyticChartShowValues || value === null) return "";
    const y = yAt(value);
    const otherKey = key === "meta" ? "producao" : "meta";
    const otherValue = point[otherKey];
    const closeToOtherSeries = otherValue !== null && Math.abs(y - yAt(otherValue)) < 30;
    const placeBelow = y < margin.top + 34 || (key === "producao" && closeToOtherSeries);
    const x = seriesXAt(key, index);
    const label = compactChartValue(value, product.produto);
    const labelWidth = Math.max(50, Math.min(94, label.length * 6.2 + 18));
    const boxY = placeBelow ? y + 13 : y - 35;
    const connectorEnd = placeBelow ? boxY : boxY + 22;
    return `
      <g class="chart-value-callout ${key === "meta" ? "meta" : "production"}">
        <line x1="${x}" y1="${y}" x2="${x}" y2="${connectorEnd}"/>
        <rect x="${x - labelWidth / 2}" y="${boxY}" width="${labelWidth}" height="22" rx="7"/>
        <text x="${x}" y="${boxY + 14.5}" text-anchor="middle">${escapeHtml(label)}</text>
      </g>`;
  }).join("");
  const columns = key => product.points.map((point, index) => {
    const center = seriesXAt(key, index);
    const value = point[key];
    if (value === null) return "";
    const x = center - columnWidth / 2;
    const valueY = yAt(value);
    const y = Math.min(valueY, baselineY);
    const barHeight = Math.max(Math.abs(baselineY - valueY), 1);
    const series = key === "meta" ? "Meta" : "Produção";
    return `
      <rect class="chart-column-${key === "meta" ? "meta" : "production"}" x="${x}" y="${y}" width="${columnWidth}" height="${barHeight}" rx="3">
        <title>${series}: ${escapeHtml(formatMatrixValue(product.produto, value))} · ${escapeHtml(point.period_label)}</title>
      </rect>`;
  }).join("");

  const latestIndex = product.points.reduce(
    (result, point, index) => point.producao !== null ? index : result,
    -1
  );
  const latestPoint = latestIndex >= 0 ? product.points[latestIndex] : null;
  const latestVariation = latestIndex >= 0 ? productionVariation(latestIndex) : undefined;
  const latestAchievement = latestPoint?.percentual_atingido;
  const focusProduct = focusAgencyPerformanceData?.products.find(
    item => item.produto === selectedProduct
  );
  const consolidated = focusProduct?.consolidated;
  const metricCard = (label, value, className = "") => `
    <article class="${className}">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(value)}</strong>
    </article>`;
  const metricValue = (summary, key) => summary?.[key] === null
    || summary?.[key] === undefined
    ? "—"
    : formatMatrixValue(product.produto, summary[key]);
  const percentageValue = summary => summary?.percentual_atingido === null
    || summary?.percentual_atingido === undefined
    ? "—"
    : `${percentageFormatter.format(summary.percentual_atingido)}%`;
  const gapValue = summary => summary?.gap === null || summary?.gap === undefined
    ? "—"
    : `${summary.gap > 0 ? "+" : ""}${formatMatrixValue(product.produto, summary.gap)}`;
  const gapClass = summary => summary?.gap > 0
    ? "positive"
    : summary?.gap < 0 ? "negative" : "";
  const focusPerformancePanel = (label, summary) => {
    const percentage = summary?.percentual_atingido;
    const hasTarget = percentage !== null && percentage !== undefined;
    const isAchieved = hasTarget && percentage >= 100;
    const tone = !hasTarget ? "neutral" : isAchieved ? "positive" : "negative";
    const status = !hasTarget ? "Sem meta" : isAchieved ? "Meta atingida" : "Abaixo da meta";
    const progress = hasTarget ? Math.min(Math.max(percentage, 0), 100) : 0;
    return `
      <article class="focus-performance-panel ${tone}">
        <header>
          <div><small>${escapeHtml(label)}</small><strong>${percentageValue(summary)}</strong></div>
          <span>${escapeHtml(status)}</span>
        </header>
        <div class="focus-performance-progress" aria-hidden="true"><i style="width:${progress}%"></i></div>
        <dl>
          <div><dt>Meta</dt><dd>${escapeHtml(metricValue(summary, "meta_acumulada"))}</dd></div>
          <div><dt>Produção</dt><dd>${escapeHtml(metricValue(summary, "producao_acumulada"))}</dd></div>
          <div class="${gapClass(summary)}"><dt>Gap</dt><dd>${escapeHtml(gapValue(summary))}</dd></div>
        </dl>
      </article>`;
  };
  const chartSummary = document.querySelector("#analytic-chart-summary");
  chartSummary.classList.toggle("focus-product-chart-summary", productByAgency);
  chartSummary.innerHTML = productByAgency && consolidated
    ? focusPerformancePanel("No período", consolidated.period)
      + focusPerformancePanel("Acumulado anual", consolidated.annual)
    : latestPoint ? `
      <article>
        <small>REFERÊNCIA MAIS RECENTE</small>
        <strong>${escapeHtml(latestPoint.period_label)}</strong>
      </article>
      <article>
        <small>META DO MÊS</small>
        <strong>${latestPoint.meta === null
          ? "—"
          : escapeHtml(formatMatrixValue(product.produto, latestPoint.meta))}</strong>
      </article>
      <article class="production">
        <small>PRODUÇÃO DO MÊS</small>
        <strong>${escapeHtml(formatMatrixValue(product.produto, latestPoint.producao))}</strong>
      </article>
      <article class="${variationClass(latestVariation)}">
        <small>VARIAÇÃO MENSAL</small>
        <strong>${escapeHtml(variationLabel(latestVariation, false))}</strong>
        <span>${latestAchievement === null
          ? "Sem meta no período"
          : `${escapeHtml(percentageFormatter.format(latestAchievement))}% da meta`}</span>
      </article>` : "";

  const chartElement = document.querySelector("#analytic-chart");
  chartElement.setAttribute(
    "aria-label",
    `Evolução mensal de meta em ${analyticChartMetaModel === "columns" ? "colunas" : "linhas"} e produção em ${analyticChartProductionModel === "columns" ? "colunas" : "linhas"} para ${humanizeProduct(product.produto)}`
  );
  const productionAreas = areaPaths("producao")
    .map(path => `<path class="chart-area-production" d="${path}"/>`)
    .join("");
  chartElement.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="production-area-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#14896c" stop-opacity=".20"/>
          <stop offset="100%" stop-color="#14896c" stop-opacity=".015"/>
        </linearGradient>
      </defs>
      <rect class="chart-plot-background" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" rx="12"/>
      ${verticalGuides}
      ${grid}
      ${analyticChartProductionModel === "line" ? productionAreas : ""}
      <line class="chart-baseline" x1="${margin.left}" y1="${baselineY}" x2="${width - margin.right}" y2="${baselineY}"/>
      ${analyticChartMetaModel === "line" ? `
        <path class="chart-line-meta" d="${linePath("meta")}"/>
        ${dots("meta", "chart-dot-meta")}
      ` : columns("meta")}
      ${analyticChartProductionModel === "line" ? `
        <path class="chart-line-production" d="${linePath("producao")}"/>
        ${dots("producao", "chart-dot-production")}
      ` : columns("producao")}
      ${valueLabels("meta")}
      ${valueLabels("producao")}
      ${xAxis}
    </svg>`;
}

function focusAgencyTargetScore(unit) {
  const points = unit.points || [];
  const annualTarget = focusAgencyPerformanceData?.calculation?.value === "ANUAL"
    ? 12
    : null;
  return {
    target: annualTarget ?? points.filter(
      point => point.percentual_atingido !== null
    ).length,
    achieved: points.filter(
      point => point.percentual_atingido !== null
        && point.percentual_atingido >= 100
    ).length,
  };
}

function compareFocusAgencyCodes(first, second) {
  const firstCode = String(first.code || first.pa || "");
  const secondCode = String(second.code || second.pa || "");
  const firstNumeric = Number(firstCode);
  const secondNumeric = Number(secondCode);
  if (Number.isFinite(firstNumeric) && Number.isFinite(secondNumeric)) {
    return firstNumeric - secondNumeric;
  }
  return firstCode.localeCompare(secondCode, "pt-BR", { numeric: true });
}

function renderFocusAgencyInlineChart(unit, productName, options = {}) {
  const points = unit.points || [];
  const values = points.flatMap(point =>
    [point.meta, point.producao].filter(value => value !== null)
  );
  const width = 1040;
  const height = 280;
  const margin = { top: 28, right: 28, bottom: 52, left: 82 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const scale = buildChartScale(values.length ? values : [0, 1]);
  const xAt = index => points.length === 1
    ? margin.left + plotWidth / 2
    : margin.left + plotWidth * index / (points.length - 1);
  const yAt = value => margin.top
    + (scale.maximum - value) / (scale.maximum - scale.minimum) * plotHeight;
  const linePath = key => points.reduce((path, point, index) => {
    if (point[key] === null) return path;
    return `${path}${path ? " L" : "M"} ${xAt(index).toFixed(2)} ${yAt(point[key]).toFixed(2)}`;
  }, "");
  const grid = scale.ticks.map(value => `
    <line class="chart-grid-line" x1="${margin.left}" y1="${yAt(value)}" x2="${width - margin.right}" y2="${yAt(value)}"/>
    <text class="chart-axis-label" x="${margin.left - 10}" y="${yAt(value) + 4}" text-anchor="end">${escapeHtml(compactChartValue(value, productName))}</text>
  `).join("");
  const labels = points.map((point, index) => `
    <text class="chart-x-label" x="${xAt(index)}" y="${height - 20}" text-anchor="middle">${escapeHtml(point.period_label)}</text>
  `).join("");
  const dots = (key, className) => points.map((point, index) => point[key] === null
    ? ""
    : `<circle class="${className}" cx="${xAt(index)}" cy="${yAt(point[key])}" r="4"><title>${escapeHtml(point.period_label)} — ${escapeHtml(formatMatrixValue(productName, point[key]))}</title></circle>`
  ).join("");

  const chartLabel = options.label || unit.label;
  const chartEyebrow = options.eyebrow || "EVOLUÇÃO DO PA";
  return `
    <section class="focus-agency-inline-chart" aria-label="Evolução mensal de ${escapeHtml(chartLabel)}">
      <header>
        <div>
          <span class="eyebrow">${escapeHtml(chartEyebrow)}</span>
          <strong>${escapeHtml(chartLabel)}</strong>
        </div>
        <span class="focus-agency-inline-legend" aria-label="Legenda do gráfico">
          <span><i class="meta"></i>Meta mensal</span>
          <span><i class="production"></i>Produção mensal</span>
        </span>
      </header>
      <div>
        <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
          ${grid}
          <path class="chart-line-meta" d="${linePath("meta")}"/>
          <path class="chart-line-production" d="${linePath("producao")}"/>
          ${dots("meta", "chart-dot-meta")}
          ${dots("producao", "chart-dot-production")}
          ${labels}
        </svg>
      </div>
    </section>`;
}

function renderFocusAgencyPerformance() {
  const isFocus = activeTrackingScope === "FOCO"
    && analyticPerspective === "product_by_agency";
  const product = focusAgencyPerformanceData?.products.find(
    item => item.produto === selectedAnalyticProduct
  );
  focusAgencyPerformance.hidden = !isFocus || !product;
  if (!isFocus || !product) return;

  const periods = focusAgencyPerformanceData.periods || [];
  const sortedUnits = [...product.units].sort((first, second) => {
    const firstScore = focusAgencyTargetScore(first).achieved;
    const secondScore = focusAgencyTargetScore(second).achieved;
    const scoreDifference = focusAgencySortDirection === "desc"
      ? secondScore - firstScore
      : firstScore - secondScore;
    return scoreDifference || compareFocusAgencyCodes(first, second);
  });
  const isTableView = focusAgencyViewMode === "table";
  focusAgencyTableView.classList.toggle("active", isTableView);
  focusAgencyTableView.setAttribute("aria-selected", String(isTableView));
  focusAgencyChartView.classList.toggle("active", !isTableView);
  focusAgencyChartView.setAttribute("aria-selected", String(!isTableView));
  focusAgencyTableContent.hidden = !isTableView;
  focusAgencyTableFooter.hidden = !isTableView;
  focusAgencyPerformanceKpis.hidden = !isTableView;

  const summary = product.summary;
  const periodSummary = product.consolidated?.period;
  const annualSummary = product.consolidated?.annual;
  const annualPercentage = annualSummary?.percentual_atingido;
  const annualStatus = annualSummary?.status;
  const annualStatusLabel = annualStatus === "aderente"
    ? "Aderente"
    : annualStatus === "nao_aderente" ? "Não aderente" : "Sem meta";
  const annualStatusClass = annualStatus === "aderente"
    ? "adherent"
    : annualStatus === "nao_aderente" ? "not-adherent" : "no-target";
  const productionRanking = [...product.units]
    .filter(unit => Number.isFinite(Number(unit.producao_acumulada)))
    .sort((first, second) =>
      Number(second.producao_acumulada) - Number(first.producao_acumulada)
      || compareFocusAgencyCodes(first, second)
    );
  const highestProductionUnit = productionRanking[0] || null;
  const lowestProductionUnit = productionRanking[productionRanking.length - 1] || null;
  const agencyVolumeKpi = (label, unit, tone) => {
    if (!unit) {
      return `<span class="agency-volume ${tone}"><small>${label}</small><strong>—</strong><em>Sem dados</em></span>`;
    }
    const agencyLabel = `PA ${unit.code || unit.pa} · ${unit.name || unit.label}`;
    return `
      <span class="agency-volume ${tone}" title="${escapeHtml(agencyLabel)}">
        <small>${label}</small>
        <strong>${escapeHtml(agencyLabel)}</strong>
        <em>${escapeHtml(formatMatrixValue(product.produto, unit.producao_acumulada))}</em>
      </span>`;
  };
  focusAgencyPerformanceTitle.textContent = humanizeProduct(product.produto);
  focusAgencyPerformanceSubtitle.textContent =
    isTableView
      ? `${numberFormatter.format(summary.units)} agências · clique em um PA para expandir sua evolução mensal.`
      : `Comportamento consolidado de ${focusAgencyPerformanceData.range.start_label} a ${focusAgencyPerformanceData.range.end_label}.`;
  focusAgencyPerformanceKpis.innerHTML = `
    <span class="currency"><small>META NO PERÍODO</small><strong>${periodSummary ? escapeHtml(formatMatrixValue(product.produto, periodSummary.meta_acumulada)) : "—"}</strong></span>
    <span class="currency production"><small>PRODUÇÃO NO PERÍODO</small><strong>${periodSummary ? escapeHtml(formatMatrixValue(product.produto, periodSummary.producao_acumulada)) : "—"}</strong></span>
    ${agencyVolumeKpi("MAIOR PRODUÇÃO · PA", highestProductionUnit, "highest")}
    ${agencyVolumeKpi("MENOR PRODUÇÃO · PA", lowestProductionUnit, "lowest")}
    <span class="${annualPercentage >= 100 ? "achieved" : "missed"}"><small>% DA META ANUAL</small><strong>${annualPercentage === null || annualPercentage === undefined ? "—" : `${percentageFormatter.format(annualPercentage)}%`}</strong></span>
    <span class="adhesion ${annualStatusClass}"><small>ADERÊNCIA ANUAL</small><strong><i aria-hidden="true"></i>${escapeHtml(annualStatusLabel)}</strong></span>`;

  if (!isTableView) return;

  focusAgencyPerformanceHead.innerHTML = `
    <tr>
      <th>
        <button id="focus-agency-sort-button" class="agency-sort-button focus-agency-sort-button active" type="button" aria-label="Ordenar agências por metas atingidas: ${focusAgencySortDirection === "desc" ? "maior para menor" : "menor para maior"}" title="Ordenar pela quantidade de metas atingidas no período">
          AGÊNCIA
          <span aria-hidden="true">${focusAgencySortDirection === "desc" ? "↓" : "↑"}</span>
        </button>
      </th>
      ${periods.map(period =>
        `<th class="month-header">${escapeHtml(period.label)}</th>`
      ).join("")}
    </tr>`;
  const targetScoreLabel = focusAgencyPerformanceData.calculation.value === "ANUAL"
    ? "metas anuais"
    : "metas no período";
  focusAgencyPerformanceBody.innerHTML = sortedUnits.length
    ? sortedUnits.map(unit => {
      const { target: targetCount, achieved: achievedCount } =
        focusAgencyTargetScore(unit);
      const unitKey = String(unit.pa);
      const expanded = expandedFocusAgency === unitKey;
      const agencyRow = `
      <tr>
        <td>
          <button class="focus-agency-unit focus-agency-unit-button" type="button" data-pa="${encodeURIComponent(unitKey)}" aria-expanded="${expanded}" title="${expanded ? "Ocultar" : "Exibir"} evolução mensal do PA">
            <span class="unit-name"><i>PA ${escapeHtml(unit.code || unit.pa)}</i><strong>${escapeHtml(unit.name || unit.label)}</strong></span>
            <small><strong>${numberFormatter.format(achievedCount)}/${numberFormatter.format(targetCount)}</strong> ${targetScoreLabel}</small>
            <span class="focus-agency-expand-icon" aria-hidden="true">${expanded ? "−" : "+"}</span>
          </button>
        </td>
        ${unit.points.map(point => {
          if (point.meta === null && point.producao === null) {
            return '<td><div class="monthly-missing">Sem dados</div></td>';
          }
          const pointStatus = point.status || (
            point.percentual_atingido === null
              ? "sem_meta"
              : point.percentual_atingido >= 100
                ? "aderente"
                : "nao_aderente"
          );
          const isAdherent = pointStatus === "aderente";
          const achievementClass = isAdherent
            ? "achievement-met"
            : pointStatus === "nao_aderente"
              ? "achievement-missed"
              : "no-target";
          const statusLabel = isAdherent
            ? "Aderente"
            : pointStatus === "nao_aderente"
              ? "Não aderente"
              : "Sem meta";
          const percentage = point.percentual_atingido === null
            ? "—"
            : `${percentageFormatter.format(point.percentual_atingido)}%`;
          const gap = point.gap === null
            ? "—"
            : `${point.gap > 0 ? "+" : ""}${formatMatrixValue(product.produto, point.gap)}`;
          const gapClass = point.gap === null
            ? "neutral-gap"
            : point.gap >= 0 ? "positive-gap" : "negative-gap";
          return `
            <td>
              <div class="monthly-comparison focus-agency-month-card ${achievementClass}">
                <span class="monthly-value">
                  <small>META</small>
                  <strong>${escapeHtml(formatMatrixValue(product.produto, point.meta))}</strong>
                </span>
                <span class="monthly-value production">
                  <small>PRODUÇÃO</small>
                  <strong>${escapeHtml(formatMatrixValue(product.produto, point.producao))}</strong>
                </span>
                <span class="focus-agency-month-result">
                  <span><small>ATINGIMENTO</small><strong>${escapeHtml(percentage)}</strong></span>
                  <span class="${gapClass}"><small>GAP</small><strong>${escapeHtml(gap)}</strong></span>
                </span>
                <strong class="focus-agency-month-status ${achievementClass}">
                  <i aria-hidden="true"></i>${escapeHtml(statusLabel)}
                </strong>
              </div>
            </td>`;
        }).join("")}
      </tr>`;
      const chartRow = expanded
        ? `<tr class="focus-agency-expanded-row"><td colspan="${periods.length + 1}">${renderFocusAgencyInlineChart(unit, product.produto)}</td></tr>`
        : "";
      return agencyRow + chartRow;
    }).join("")
    : `<tr class="matrix-empty-row"><td colspan="${periods.length + 1}">Nenhuma agência possui dados para este produto.</td></tr>`;

  focusAgencyPerformanceCount.textContent =
    `${numberFormatter.format(sortedUnits.length)} agência(s) exibida(s)`;
  focusAgencyPagination.hidden = true;
  focusAgencyPageNote.textContent = "Clique no nome do PA para visualizar sua evolução";
}

function getFocusAnalyticAgencies() {
  const unitsByPa = new Map();
  (focusAgencyPerformanceData?.products || []).forEach(product => {
    (product.units || []).forEach(unit => {
      if (!unitsByPa.has(String(unit.pa))) unitsByPa.set(String(unit.pa), unit);
    });
  });
  return [...unitsByPa.values()].sort(compareFocusAgencyCodes);
}

function buildFocusAgencyAnalyticData() {
  const source = analyticDataAllUnits || analyticDataByUnit;
  const agencies = getFocusAnalyticAgencies();
  if (!source || !agencies.length) return source;
  if (!agencies.some(unit => String(unit.pa) === selectedAnalyticAgency)) {
    selectedAnalyticAgency = String(agencies[0].pa);
  }
  const selectedUnit = agencies.find(
    unit => String(unit.pa) === selectedAnalyticAgency
  );
  const products = (focusAgencyPerformanceData?.products || []).map(product => {
    const unit = (product.units || []).find(
      item => String(item.pa) === selectedAnalyticAgency
    );
    const baseProduct = (source.products || []).find(
      item => item.produto === product.produto
    ) || {};
    return unit
      ? { ...baseProduct, ...unit, produto: product.produto, points: unit.points || [] }
      : null;
  }).filter(Boolean);
  return {
    ...source,
    range: focusAgencyPerformanceData.range || source.range,
    periods: focusAgencyPerformanceData.periods || source.periods,
    products,
    unit: {
      value: selectedAnalyticAgency,
      label: selectedUnit?.label || `PA ${selectedUnit?.code || selectedAnalyticAgency}`,
    },
  };
}

function getActiveAnalyticData() {
  const productByAgency = activeTrackingScope === "FOCO"
    && analyticPerspective === "product_by_agency";
  if (activeTrackingScope === "FOCO" && !productByAgency) {
    return buildFocusAgencyAnalyticData();
  }
  return productByAgency
    ? analyticDataAllUnits || analyticDataByUnit
    : analyticDataByUnit || analyticDataAllUnits;
}

function renderFocusProductTabs() {
  const productByAgency = activeTrackingScope === "FOCO"
    && analyticPerspective === "product_by_agency";
  const isFocus = activeTrackingScope === "FOCO";
  focusProductTabs.hidden = !isFocus;
  if (!isFocus) {
    focusProductTabList.innerHTML = "";
    return;
  }

  focusProductTabsLabel.textContent = productByAgency
    ? "NAVEGAR POR PRODUTO"
    : "NAVEGAR POR AGÊNCIA";
  focusProductTabs.setAttribute(
    "aria-label",
    productByAgency ? "Selecionar produto" : "Selecionar agência"
  );
  const tabs = productByAgency
    ? [
      { value: "", label: "Consolidado" },
      ...analyticProducts.map(product => ({
        value: product.produto,
        label: humanizeProduct(product.produto),
      })),
    ]
    : getFocusAnalyticAgencies().map(unit => ({
      value: String(unit.pa),
      label: `PA ${unit.code || unit.pa} · ${unit.name || unit.label}`,
    }));
  focusProductTabList.innerHTML = tabs.map(tab => {
    const selected = productByAgency
      ? selectedAnalyticProduct === tab.value
      : selectedAnalyticAgency === tab.value;
    return `
      <button class="focus-product-tab ${selected ? "active" : ""}" type="button" role="tab" ${productByAgency ? `data-product="${encodeURIComponent(tab.value)}"` : `data-agency="${encodeURIComponent(tab.value)}"`} aria-selected="${selected}">
        ${escapeHtml(tab.label)}
      </button>`;
  }).join("");
}

function renderFocusConsolidatedKpis() {
  const isVisible = activeTrackingScope === "FOCO"
    && analyticPerspective === "product_by_agency"
    && !selectedAnalyticProduct;
  focusConsolidatedKpis.hidden = !isVisible;
  if (!isVisible) {
    focusConsolidatedKpisGrid.innerHTML = "";
    return;
  }

  const focusProducts = focusAgencyPerformanceData?.products || [];
  const isAnnual = focusConsolidatedKpiBasis === "annual";
  focusConsolidatedPeriodButton.classList.toggle("active", !isAnnual);
  focusConsolidatedAnnualButton.classList.toggle("active", isAnnual);
  focusConsolidatedPeriodButton.setAttribute("aria-pressed", String(!isAnnual));
  focusConsolidatedAnnualButton.setAttribute("aria-pressed", String(isAnnual));
  focusConsolidatedKpisContext.textContent = isAnnual
    ? "Produção acumulada em relação à meta anual"
    : "Produção em relação à meta no período";
  focusConsolidatedKpisGrid.innerHTML = analyticProducts.map(product => {
    const focusProduct = focusProducts.find(item => item.produto === product.produto);
    const summary = focusProduct?.consolidated?.[isAnnual ? "annual" : "period"];
    const percentage = summary?.percentual_atingido;
    const status = summary?.status;
    const tone = status === "aderente"
      ? "positive"
      : status === "nao_aderente" ? "negative" : "neutral";
    const statusLabel = status === "aderente"
      ? "Meta atingida"
      : status === "nao_aderente" ? "Abaixo da meta" : "Sem meta";
    const percentageLabel = percentage === null || percentage === undefined
      ? "—"
      : `${percentageFormatter.format(percentage)}%`;
    const production = summary?.producao_acumulada;
    const target = summary?.meta_acumulada;
    const comparison = production === null || production === undefined
      ? "Sem produção"
      : `${compactChartValue(production, product.produto)} de ${target === null || target === undefined ? "—" : compactChartValue(target, product.produto)}`;
    const progress = percentage === null || percentage === undefined
      ? 0
      : Math.min(Math.max(percentage, 0), 100);
    const name = humanizeProduct(product.produto);
    return `
      <article class="focus-consolidated-kpi ${tone}" aria-label="${escapeHtml(name)}: ${escapeHtml(percentageLabel)} de atingimento, ${escapeHtml(statusLabel)}">
        <span title="${escapeHtml(name)}">${escapeHtml(name)}</span>
        <strong>${escapeHtml(percentageLabel)}</strong>
        <div aria-hidden="true"><i style="width:${progress}%"></i></div>
        <small>${escapeHtml(comparison)}</small>
      </article>`;
  }).join("");
}

function applyAnalyticInternalPage() {
  const productByAgency = activeTrackingScope === "FOCO"
    && analyticPerspective === "product_by_agency";
  const productLabel = selectedAnalyticProduct
    ? humanizeProduct(selectedAnalyticProduct)
    : "";

  analyticMatrixCard.hidden = productByAgency && Boolean(selectedAnalyticProduct);
  analyticMatrixCard.classList.toggle(
    "focus-consolidated-matrix",
    productByAgency && !selectedAnalyticProduct
  );
  renderFocusProductTabs();
  renderFocusConsolidatedKpis();
  if (productByAgency) {
    analyticPerspectiveDescription.textContent = selectedAnalyticProduct
      ? `Acompanhamento mensal de ${productLabel} em cada agência.`
      : "Visão consolidada dos sete produtos foco em todas as agências.";
    analyticPerspectiveContext.textContent = productLabel || "Consolidado Singular";
  } else if (activeTrackingScope === "FOCO") {
    analyticPerspectiveDescription.textContent = selectedAnalyticProduct
      ? `Evolução mensal de ${productLabel} na agência selecionada.`
      : "Desempenho mensal dos sete produtos foco na agência selecionada.";
    analyticPerspectiveContext.textContent = analyticUnit?.label || "Selecione uma agência";
  }
  renderFocusAgencyPerformance();
  renderAnalyticChart();
}

function renderAnalytic(data) {
  if (!data) return;
  analyticProducts = data.products;
  analyticPeriods = data.periods;
  analyticRange = data.range;
  analyticUnit = data.unit;
  const productByAgency = activeTrackingScope === "FOCO"
    && analyticPerspective === "product_by_agency";
  analyticPerspectiveBar.hidden = activeTrackingScope !== "FOCO";
  productByAgencyButton.classList.toggle("active", productByAgency);
  productByAgencyButton.setAttribute("aria-selected", String(productByAgency));
  agencyByProductButton.classList.toggle("active", !productByAgency);
  agencyByProductButton.setAttribute("aria-selected", String(!productByAgency));
  analyticPerspectiveDescription.textContent = productByAgency
    ? "Visão consolidada dos sete produtos foco em todas as agências."
    : activeTrackingScope === "FOCO"
      ? "Selecione uma agência para analisar o desempenho de seus sete produtos foco."
      : "Compare a evolução mensal dos produtos da unidade selecionada.";
  analyticPerspectiveContext.textContent = productByAgency
    ? "Consolidado Singular"
    : data.unit.label;
  analyticMatrixEyebrow.textContent = productByAgency
    ? "PA POR PRODUTO"
    : activeTrackingScope === "FOCO" ? "PRODUTO POR PA" : "EVOLUÇÃO MENSAL";
  analyticMatrixTitle.textContent = productByAgency
    ? "Desempenho mensal consolidado por produto"
    : activeTrackingScope === "FOCO"
      ? `Desempenho mensal dos produtos · ${data.unit.label}`
      : "Meta × Produção por produto";
  updateTrackingUnitFilterVisibility();
  selectedAnalyticProduct = getAnalyticProductsForCombo().some(
    product => product.produto === selectedAnalyticProduct
  ) ? selectedAnalyticProduct : "";
  renderAnalyticComboButtons();
  renderAnalyticComboKpis();
  analyticPage = 1;
  focusAgencyPage = 1;
  document.querySelector("#analytic-subtitle").textContent =
    `${data.scope.label} · ${data.unit.label} · evolução de ${data.range.start_label} a ${data.range.end_label}.`;
  renderAnalyticTable();
  applyAnalyticInternalPage();
}
