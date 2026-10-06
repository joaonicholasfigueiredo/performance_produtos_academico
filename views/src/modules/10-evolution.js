const evolutionLoading = document.querySelector("#evolution-loading");
const evolutionEmpty = document.querySelector("#evolution-empty");
const evolutionEmptyMessage = document.querySelector("#evolution-empty-message");
const evolutionContent = document.querySelector("#evolution-content");
const evolutionUnitFilter = document.querySelector("#evolution-unit-filter");
const evolutionProductFilter = document.querySelector("#evolution-product-filter");
const evolutionReference = document.querySelector("#evolution-reference");
const evolutionKpis = document.querySelector("#evolution-kpis");
const evolutionChartSubtitle = document.querySelector("#evolution-chart-subtitle");
const evolutionChart = document.querySelector("#evolution-chart");
const evolutionToggleValues = document.querySelector("#evolution-toggle-values");
const evolutionGuidanceTitle = document.querySelector("#evolution-guidance-title");
const evolutionGuidanceCopy = document.querySelector("#evolution-guidance-copy");
const evolutionGuidanceDetails = document.querySelector("#evolution-guidance-details");
const evolutionTableReading = document.querySelector("#evolution-table-reading");
const evolutionTableBody = document.querySelector("#evolution-table-body");
let evolutionRequestId = 0;
let evolutionShowValues = true;
let evolutionLastData = null;

function setEvolutionState(state, message = "") {
  evolutionLoading.hidden = state !== "loading";
  evolutionEmpty.hidden = state !== "empty";
  evolutionContent.hidden = state !== "content";
  if (message) evolutionEmptyMessage.textContent = message;
}

function evolutionValue(product, value) {
  return value === null || value === undefined ? "—" : formatMatrixValue(product, value);
}

function renderEvolutionChart(data) {
  const width = 1180;
  const height = 330;
  const plot = { left: 92, right: 1154, top: 34, bottom: 274 };
  const values = data.points.flatMap(point => [
    point.actual_production,
    point.ideal_target,
    point.recommended_projection,
  ]).filter(value => value !== null && Number.isFinite(value));
  const scale = buildChartScale([...values, data.summary.annual_target, 1], 5);
  const maximum = scale.maximum;
  const x = index => plot.left + (plot.right - plot.left) * index / 11;
  const y = value => plot.bottom - (plot.bottom - plot.top) * value / maximum;
  const pathFor = key => {
    const points = data.points
      .map((point, index) => point[key] === null ? null : [x(index), y(point[key])])
      .filter(Boolean);
    return points.length ? `M ${points.map(point => point.join(" ")).join(" L ")}` : "";
  };
  const grid = scale.ticks.map(value => {
    const position = y(value);
    return `<g><line x1="${plot.left}" y1="${position}" x2="${plot.right}" y2="${position}"/><text x="${plot.left - 14}" y="${position + 4}" text-anchor="end">${escapeHtml(compactChartValue(value, data.product.value))}</text></g>`;
  }).join("");
  const labels = data.points.map((point, index) =>
    `<text x="${x(index)}" y="${plot.bottom + 28}" text-anchor="middle">${escapeHtml(point.period_label.split("/")[0])}</text>`
  ).join("");
  const actualDots = data.points.map((point, index) => point.actual_production === null
    ? ""
    : `<circle cx="${x(index)}" cy="${y(point.actual_production)}" r="4"><title>${escapeHtml(point.period_label)}: ${escapeHtml(evolutionValue(data.product.value, point.actual_production))}</title></circle>`
  ).join("");
  const referenceIndex = data.points.findIndex(point => point.period === data.reference_period);
  const referenceX = x(Math.max(referenceIndex, 0));
  const futureStart = referenceIndex < 11 ? (referenceX + x(referenceIndex + 1)) / 2 : plot.right;
  const annualTargetY = y(data.summary.annual_target);
  const targetLabel = `Meta anual  ${compactChartValue(data.summary.annual_target, data.product.value)}`;
  const labelY = (value, index, future = false) => {
    const offset = future
      ? (index === 11 ? 31 : -25)
      : (index % 2 === 0 ? -27 : 34);
    return Math.min(Math.max(y(value) + offset, plot.top + 31), plot.bottom - 22);
  };
  const actualValueLabels = evolutionShowValues
    ? data.points.map((point, index) => {
        if (point.actual_production === null) return "";
        const previous = index > 0 ? data.points[index - 1] : null;
        let variation = null;
        if (previous?.monthly_production !== null && previous?.monthly_production !== undefined
            && point.monthly_production !== null && point.monthly_production !== undefined
            && previous.monthly_production !== 0) {
          variation = (point.monthly_production - previous.monthly_production)
            / Math.abs(previous.monthly_production) * 100;
        }
        const variationClass = variation === null || Math.abs(variation) < .05
          ? "neutral" : variation > 0 ? "positive" : "negative";
        const variationText = variation === null
          ? "início do ano"
          : `${variation > .05 ? "↑" : variation < -.05 ? "↓" : "→"} ${percentageFormatter.format(Math.abs(variation))}% no mês`;
        return `
          <g class="evolution-point-label actual ${variationClass}" transform="translate(${x(index)}, ${labelY(point.actual_production, index)})">
            <text class="value" text-anchor="middle">${escapeHtml(compactChartValue(point.actual_production, data.product.value))}</text>
            <text class="variation" y="13" text-anchor="middle">${escapeHtml(variationText)}</text>
          </g>`;
      }).join("")
    : "";
  const futureDots = data.points.map((point, index) => index <= referenceIndex || point.recommended_projection === null
    ? ""
    : `<circle cx="${x(index)}" cy="${y(point.recommended_projection)}" r="3.5"><title>${escapeHtml(point.period_label)}: ${escapeHtml(evolutionValue(data.product.value, point.recommended_projection))}</title></circle>`
  ).join("");
  const futureValueLabels = evolutionShowValues
    ? data.points.map((point, index) => {
        if (index <= referenceIndex || point.recommended_projection === null) return "";
        return `
          <g class="evolution-point-label plan" transform="translate(${x(index)}, ${labelY(point.recommended_projection, index, true)})">
            <text class="value" text-anchor="middle">${escapeHtml(compactChartValue(point.recommended_projection, data.product.value))}</text>
            <text class="variation" y="13" text-anchor="middle">+${escapeHtml(compactChartValue(point.evolution_plan, data.product.value))} planejado</text>
          </g>`;
      }).join("")
    : "";
  evolutionChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolução anual de ${escapeHtml(humanizeProduct(data.product.value))}">
      <rect class="evolution-plot-background" x="${plot.left}" y="${plot.top}" width="${plot.right - plot.left}" height="${plot.bottom - plot.top}" rx="5"/>
      ${referenceIndex < 11 ? `<rect class="evolution-future-zone" x="${futureStart}" y="${plot.top}" width="${plot.right - futureStart}" height="${plot.bottom - plot.top}"/>` : ""}
      <g class="evolution-chart-grid">${grid}${labels}</g>
      <line class="evolution-target-line" x1="${plot.left}" y1="${annualTargetY}" x2="${plot.right}" y2="${annualTargetY}"/>
      <text class="evolution-target-label" x="${plot.right - 10}" y="${annualTargetY - 9}" text-anchor="end">${escapeHtml(targetLabel)}</text>
      <path class="evolution-line ideal" d="${pathFor("ideal_target")}"/>
      <path class="evolution-line required" d="${pathFor("recommended_projection")}"/>
      <path class="evolution-line actual" d="${pathFor("actual_production")}"/>
      <g class="evolution-dots">${actualDots}</g>
      <g class="evolution-plan-dots">${futureDots}</g>
      <g class="evolution-value-labels">${actualValueLabels}${futureValueLabels}</g>
      <line class="evolution-reference-line" x1="${referenceX}" y1="${plot.top}" x2="${referenceX}" y2="${plot.bottom}"/>
      <text class="evolution-reference-label" x="${referenceX}" y="${plot.top + 15}" text-anchor="middle">Mês atual</text>
      ${referenceIndex < 11 ? `<text class="evolution-zone-label" x="${futureStart + 14}" y="${plot.top + 18}">Planejamento até dezembro</text>` : ""}
    </svg>`;
}

function renderEvolution(data) {
  evolutionLastData = data;
  const product = data.product.value;
  const summary = data.summary;
  const selectedUnit = evolutionUnitFilter.value;
  const selectedProduct = evolutionProductFilter.value;
  evolutionUnitFilter.innerHTML = data.units.map(unit =>
    `<option value="${escapeHtml(unit.value)}">${escapeHtml(unit.label)}</option>`
  ).join("");
  evolutionUnitFilter.value = data.units.some(unit => unit.value === selectedUnit)
    ? selectedUnit : data.unit.value;
  evolutionProductFilter.innerHTML = data.products.map(item =>
    `<option value="${escapeHtml(item)}">${escapeHtml(humanizeProduct(item))}</option>`
  ).join("");
  evolutionProductFilter.value = data.products.includes(selectedProduct)
    ? selectedProduct : product;
  evolutionReference.textContent = `Ano ${data.year} · dados até ${data.reference_label}`;
  const percentage = summary.percentage === null ? "—" : `${percentageFormatter.format(summary.percentage)}%`;
  const actionTitle = summary.status === "atingida"
    ? "Meta atingida: preserve o resultado"
    : summary.status === "sem_meta"
      ? "Produto sem meta anual"
      : summary.will_reach_target
        ? "Manter a base atual"
        : "Melhorar a base mensal";
  const annualTargetText = evolutionValue(product, summary.annual_target);
  const currentProductionText = evolutionValue(product, summary.current_production);
  const averagePaceText = evolutionValue(product, summary.average_monthly_pace);
  const requiredPaceText = evolutionValue(product, summary.required_per_month);
  const unitLabel = data.unit.label.replace("—", "-");
  const productLabel = humanizeProduct(product);
  evolutionKpis.innerHTML = `
    <article><span>Meta anual</span><strong>${escapeHtml(annualTargetText)}</strong><small>${escapeHtml(productLabel)} · ano ${data.year}</small></article>
    <article><span>Produção acumulada</span><strong>${escapeHtml(currentProductionText)}</strong><small>${percentage} da meta até ${escapeHtml(data.reference_label)}</small></article>
    <article><span>Média mensal realizada</span><strong>${escapeHtml(averagePaceText)}</strong><small>média de janeiro a ${escapeHtml(data.reference_label)}</small></article>
    <article class="pace"><span>Mínimo mensal necessário</span><strong>${escapeHtml(requiredPaceText)}</strong><small>para alcançar a meta até dezembro</small></article>`;
  evolutionChartSubtitle.textContent = `${data.unit.label} · ${humanizeProduct(product)} · ${actionTitle}`;
  evolutionGuidanceTitle.textContent = actionTitle;
  const contextParagraphs = [
    `A meta anual de <strong>${escapeHtml(productLabel)}</strong> do <strong>${escapeHtml(unitLabel)}</strong> é de <strong>${escapeHtml(annualTargetText)}</strong>.`,
    `Até ${escapeHtml(data.reference_label)}, a produção acumulada é de <strong>${escapeHtml(currentProductionText)}</strong>. A média realizada é de <strong>${escapeHtml(averagePaceText)} por mês</strong>.`,
  ];
  let decisionCopy = "";
  if (summary.status === "atingida") {
    decisionCopy = `A meta anual já foi alcançada. <strong>Decisão: preservar a base atual e acompanhar a manutenção do resultado.</strong>`;
  } else if (summary.status === "sem_meta") {
    decisionCopy = "Não existe meta anual positiva para calcular a necessidade até dezembro.";
  } else if (summary.will_reach_target) {
    decisionCopy = `Mantendo essa média, o fechamento estimado é de <strong>${escapeHtml(evolutionValue(product, summary.projected_year_end))}</strong>, acima da meta. <strong>Decisão: manter a base mensal atual, sem reduzir o ritmo.</strong>`;
  } else {
    const increasePercentage = summary.average_monthly_pace > 0
      ? summary.pace_increase_required / summary.average_monthly_pace * 100
      : null;
    const percentageCopy = increasePercentage === null
      ? ""
      : ` (${percentageFormatter.format(increasePercentage)}%)`;
    decisionCopy = `Para atingir a meta, a produção precisa subir para pelo menos <strong>${escapeHtml(requiredPaceText)} por mês</strong>. Isso exige acrescentar <strong>${escapeHtml(evolutionValue(product, summary.pace_increase_required))}${percentageCopy}</strong> à média mensal atual. <strong>Decisão: melhorar a base mensal.</strong>`;
  }
  evolutionGuidanceCopy.innerHTML = `
    ${contextParagraphs.map(paragraph => `<p>${paragraph}</p>`).join("")}
    <p class="decision">${decisionCopy}</p>`;
  const projectedDifference = Math.abs(summary.projected_variance);
  const projectionLabel = summary.projected_variance >= 0 ? "Folga estimada" : "Déficit estimado";
  const projectionExplanation = summary.projected_variance >= 0
    ? "valor acima da meta se a média atual for mantida"
    : "valor que ainda faltará se a média atual não melhorar";
  evolutionGuidanceDetails.innerHTML = `
    <div><dt>Produção em ${escapeHtml(data.reference_label)}<small>resultado registrado somente no mês atual</small></dt><dd>${escapeHtml(evolutionValue(product, summary.current_month_production))}</dd></div>
    <div><dt>Fechamento estimado em dezembro<small>mantendo a média mensal realizada até agora</small></dt><dd>${escapeHtml(evolutionValue(product, summary.projected_year_end))}</dd></div>
    <div><dt>${projectionLabel}<small>${projectionExplanation}</small></dt><dd>${escapeHtml(evolutionValue(product, projectedDifference))}</dd></div>`;
  const currentPoint = data.points.find(point => point.period === data.reference_period);
  const currentDeficit = currentPoint?.accumulated_deficit || 0;
  const currentSurplus = currentPoint?.accumulated_surplus || 0;
  const planText = evolutionValue(product, summary.recommended_per_month);
  const baseTargetText = evolutionValue(product, summary.base_monthly_target);
  const additionalText = evolutionValue(product, summary.plan_additional_to_base);
  const accumulatedReading = currentDeficit > 0
    ? `carrega um <strong>déficit acumulado de ${escapeHtml(evolutionValue(product, currentDeficit))}</strong> em relação à trilha anual`
    : currentSurplus > 0
      ? `está <strong>${escapeHtml(evolutionValue(product, currentSurplus))} acima da trilha anual</strong>`
      : "está exatamente na trilha anual";
  const planDecision = summary.status === "atingida"
    ? `A meta já foi atingida. O plano preserva o ritmo de <strong>${escapeHtml(planText)} por mês</strong>.`
    : summary.plan_additional_to_base > 0
      ? `Para fechar dezembro em 100% ou mais, o plano é produzir <strong>${escapeHtml(planText)} por mês</strong>: <strong>${escapeHtml(additionalText)}</strong> além da meta-base mensal de ${escapeHtml(baseTargetText)}.`
      : `A base atual é suficiente. O plano é manter <strong>${escapeHtml(planText)} por mês</strong>, sem adicional de recuperação sobre a meta-base.`;
  evolutionTableReading.innerHTML = `
    <span class="reading-marker" aria-hidden="true"></span>
    <p>Até <strong>${escapeHtml(data.reference_label)}</strong>, a agência ${accumulatedReading}. ${planDecision}</p>`;
  renderEvolutionChart(data);
  evolutionTableBody.innerHTML = data.points.map(point => {
    const isCurrent = point.period === data.reference_period;
    const isFuture = !point.has_data;
    const rowClass = isCurrent ? "current" : isFuture ? "future" : "history";
    const gapClass = point.monthly_gap === null
      ? "" : point.monthly_gap >= 0 ? "positive" : "negative";
    const gapPrefix = point.monthly_gap > 0 ? "+" : "";
    const monthlyTargetNote = point.monthly_target_source === "annual_reference"
      ? "meta-base anual"
      : "meta importada";
    const deficitCell = isFuture
      ? `<span class="table-muted">—</span><small>será acompanhado</small>`
      : point.accumulated_deficit > 0
        ? `<strong class="negative">${escapeHtml(evolutionValue(product, point.accumulated_deficit))}</strong><small>a recuperar</small>`
        : `<strong class="positive">${escapeHtml(evolutionValue(product, 0))}</strong><small>${point.accumulated_surplus > 0 ? `${escapeHtml(evolutionValue(product, point.accumulated_surplus))} de folga` : "na trilha anual"}</small>`;
    let planCell = `<span class="table-muted">—</span><small>mês encerrado</small>`;
    if (isCurrent && summary.months_remaining > 0) {
      planCell = `<strong>${escapeHtml(planText)}</strong><small>ritmo definido neste fechamento</small>`;
    } else if (isFuture) {
      const additional = point.plan_additional_to_base > 0
        ? `+${escapeHtml(evolutionValue(product, point.plan_additional_to_base))} além da meta-base`
        : "manter a base, sem adicional";
      planCell = `<strong>${escapeHtml(evolutionValue(product, point.evolution_plan))}</strong><small>${additional}</small>`;
    }
    return `
      <tr class="${rowClass}">
        <td><strong>${escapeHtml(point.period_label)}</strong>${isCurrent ? "<small>Mês atual</small>" : isFuture ? "<small>Planejado</small>" : "<small>Realizado</small>"}</td>
        <td><strong>${escapeHtml(evolutionValue(product, point.monthly_target))}</strong><small>${monthlyTargetNote}</small></td>
        <td><strong>${escapeHtml(evolutionValue(product, point.monthly_production))}</strong><small>${isFuture ? "aguardando resultado" : "produção do mês"}</small></td>
        <td class="gap-cell ${gapClass}"><strong>${point.monthly_gap === null ? "—" : `${gapPrefix}${escapeHtml(evolutionValue(product, point.monthly_gap))}`}</strong><small>${point.monthly_gap === null ? "a apurar" : point.monthly_gap >= 0 ? "meta mensal superada" : "abaixo da meta mensal"}</small></td>
        <td class="deficit-cell">${deficitCell}</td>
        <td class="plan-value">${planCell}</td>
      </tr>`;
  }).join("");
}

async function loadEvolutionView(resetProduct = false) {
  const requestId = ++evolutionRequestId;
  setEvolutionState("loading");
  try {
    const params = new URLSearchParams();
    if (evolutionUnitFilter.value) params.set("pa", evolutionUnitFilter.value);
    if (!resetProduct && evolutionProductFilter.value) params.set("produto", evolutionProductFilter.value);
    const data = await request(`/api/acompanhamento/estudo-evolucao?${params}`);
    if (requestId !== evolutionRequestId) return;
    renderEvolution(data);
    setEvolutionState("content");
  } catch (error) {
    if (requestId !== evolutionRequestId) return;
    setEvolutionState("empty", error.message);
  }
}

evolutionUnitFilter.addEventListener("change", () => loadEvolutionView(true));
evolutionProductFilter.addEventListener("change", () => loadEvolutionView(false));
evolutionToggleValues.addEventListener("click", () => {
  evolutionShowValues = !evolutionShowValues;
  evolutionToggleValues.setAttribute("aria-pressed", String(evolutionShowValues));
  evolutionToggleValues.textContent = evolutionShowValues ? "Ocultar valores" : "Exibir valores";
  if (evolutionLastData) renderEvolutionChart(evolutionLastData);
});
