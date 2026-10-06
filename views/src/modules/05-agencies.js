function setAgenciesState(state) {
  agenciesLoading.hidden = state !== "loading";
  agenciesEmpty.hidden = state !== "empty";
  agenciesContent.hidden = state !== "content";
  agenciesExportPdfButton.disabled = state !== "content";
}

async function loadAgenciesPeriods() {
  const data = await request("/api/acompanhamento/periodos");
  const options = data.periods
    .map(period => `<option value="${period.value}">${escapeHtml(period.label)}</option>`)
    .join("");
  agenciesPeriodStart.innerHTML = options;
  agenciesPeriodEnd.innerHTML = options;
  agenciesPeriodStart.value = data.default_start;
  agenciesPeriodEnd.value = data.default_end;
  agenciesPeriodsLoaded = true;
}

function compareAgencyProducts(first, second, sort) {
  let comparison = 0;
  if (sort.key === "produto") {
    comparison = humanizeProduct(first.produto).localeCompare(
      humanizeProduct(second.produto),
      "pt-BR",
      { sensitivity: "base" }
    );
  } else {
    const firstValue = first[sort.key];
    const secondValue = second[sort.key];
    if (firstValue === null && secondValue === null) comparison = 0;
    else if (firstValue === null) return 1;
    else if (secondValue === null) return -1;
    else comparison = firstValue - secondValue;
  }
  return sort.direction === "asc" ? comparison : -comparison;
}

function agencySortButton(unit, key, label, sort) {
  const isActive = sort.key === key;
  const icon = isActive ? (sort.direction === "asc" ? "↑" : "↓") : "↕";
  const ariaSort = isActive
    ? (sort.direction === "asc" ? "ascending" : "descending")
    : "none";
  return `
    <th aria-sort="${ariaSort}">
      <button class="agency-sort-button ${isActive ? "active" : ""}" type="button"
        data-agency-pa="${encodeURIComponent(unit.pa)}" data-agency-sort="${key}">
        ${label} <span aria-hidden="true">${icon}</span>
      </button>
    </th>`;
}

function renderAgencyCards(data) {
  agenciesData = data;
  const rankedUnits = [...data.units].sort((first, second) =>
    second.summary.adherence_rate - first.summary.adherence_rate
      || first.code.localeCompare(second.code, "pt-BR", { numeric: true })
  );
  const displayedUnits = [...data.units].sort((first, second) =>
    first.code.localeCompare(second.code, "pt-BR", { numeric: true })
  );
  const rankByPa = new Map(rankedUnits.map((unit, index) => [unit.pa, index + 1]));
  const comparisonUnits = [...data.units].sort((first, second) => {
    let comparison = 0;
    if (agencyComparisonSort.key === "name") {
      comparison = first.name.localeCompare(second.name, "pt-BR", {
        sensitivity: "base",
        numeric: true,
      });
    } else if (agencyComparisonSort.key === "adherent") {
      comparison = first.summary.adherent - second.summary.adherent;
    } else if (agencyComparisonSort.key === "adherence_rate") {
      comparison = first.summary.adherence_rate - second.summary.adherence_rate;
    } else {
      comparison = first.code.localeCompare(second.code, "pt-BR", { numeric: true });
    }
    return agencyComparisonSort.direction === "asc" ? comparison : -comparison;
  });
  const leadingUnit = rankedUnits[0];
  const attentionUnit = rankedUnits[rankedUnits.length - 1];
  const averageRate = rankedUnits.length
    ? rankedUnits.reduce((total, unit) => total + unit.summary.adherence_rate, 0) / rankedUnits.length
    : 0;
  const isSinglePeriod = data.range.start === data.range.end;
  const isAnnual = data.calculation.value === "ANUAL";
  const referenceLabel = formatReferencePeriod(data.calculation.reference_period);
  document.querySelector("#agencies-title").textContent = isAnnual
    ? `Resultado anual por PA · ${referenceLabel}`
    : isSinglePeriod
      ? `Resultado por PA · ${data.range.start_label}`
      : `Resultado por PA · ${data.range.start_label} a ${data.range.end_label}`;
  document.querySelector("#agencies-subtitle").textContent = isAnnual
    ? "Última posição disponível das metas e produções anuais de cada produto."
    : isSinglePeriod
      ? "Meta e produção do mês selecionado."
      : "Soma mensal no intervalo; produtos de saldo usam a posição do último mês disponível.";
  document.querySelector("#agencies-count").textContent =
    `${numberFormatter.format(data.summary.units)} unidade(s)`;
  document.querySelector("#agencies-average-rate").textContent =
    `${percentageFormatter.format(averageRate)}%`;
  document.querySelector("#agencies-leading-unit").textContent = leadingUnit
    ? `PA ${leadingUnit.code} · ${leadingUnit.name}`
    : "—";
  document.querySelector("#agencies-leading-rate").textContent = leadingUnit
    ? `${percentageFormatter.format(leadingUnit.summary.adherence_rate)}% de aderência`
    : "Sem dados no período";
  document.querySelector("#agencies-attention-unit").textContent = attentionUnit
    ? `PA ${attentionUnit.code} · ${attentionUnit.name}`
    : "—";
  document.querySelector("#agencies-attention-rate").textContent = attentionUnit
    ? `${percentageFormatter.format(attentionUnit.summary.adherence_rate)}% de aderência`
    : "Sem dados no período";
  document.querySelector("#agency-ranking-period").textContent = isAnnual
    ? `Anual · ${referenceLabel}`
    : isSinglePeriod
      ? data.range.start_label
      : `${data.range.start_label} a ${data.range.end_label}`;
  document.querySelectorAll(".agency-comparison-sort").forEach(button => {
    const isActive = button.dataset.agencyComparisonSort === agencyComparisonSort.key;
    button.classList.toggle("active", isActive);
    button.querySelector("span").textContent = isActive
      ? agencyComparisonSort.direction === "asc" ? "↑" : "↓"
      : "↕";
    button.closest("th").setAttribute(
      "aria-sort",
      isActive ? agencyComparisonSort.direction === "asc" ? "ascending" : "descending" : "none"
    );
  });
  document.querySelector("#agency-ranking-body").innerHTML = comparisonUnits.map(unit => {
    const summary = unit.summary;
    const rate = Math.min(Math.max(summary.adherence_rate || 0, 0), 100);
    const rank = rankByPa.get(unit.pa);
    const emphasisClass = rank === 1
      ? "is-leading"
      : rank === rankedUnits.length
        ? "is-attention"
        : "";
    return `
      <tr class="${emphasisClass}">
        <td>
          <span class="agency-ranking-name">
            <i>PA ${escapeHtml(unit.code)}</i>
            <strong>${escapeHtml(unit.name)}</strong>
          </span>
        </td>
        <td><strong>${numberFormatter.format(summary.adherent)}</strong> de ${numberFormatter.format(summary.with_target)}</td>
        <td>
          <div class="agency-ranking-rate">
            <strong>${percentageFormatter.format(summary.adherence_rate)}%</strong>
            <span aria-hidden="true"><i style="width:${rate}%"></i></span>
          </div>
        </td>
        <td><button class="agency-ranking-detail" type="button" data-agency-target="agency-card-${escapeHtml(unit.code)}">Ver produtos</button></td>
      </tr>`;
  }).join("");

  agenciesCardGrid.innerHTML = displayedUnits.map(unit => {
    const summary = unit.summary;
    const sort = agencyCardSorts.get(unit.pa) || { key: "produto", direction: "asc" };
    const sortedProducts = [...unit.products].sort((first, second) =>
      compareAgencyProducts(first, second, sort)
    );
    const rows = sortedProducts.map(product => {
      const percentage = product.percentual_atingido === null
        ? "—"
        : `${percentageFormatter.format(product.percentual_atingido)}%`;
      const achievementClass = product.percentual_atingido === null
        ? "without-target"
        : product.percentual_atingido >= 100
          ? "achievement-met"
          : "achievement-not-met";
      const gapClass = product.gap >= 0 ? "positive-gap" : "negative-gap";
      const gapPrefix = product.gap > 0 ? "+" : "";
      return `
        <tr>
          <td title="${escapeHtml(humanizeProduct(product.produto))}">${escapeHtml(humanizeProduct(product.produto))}</td>
          <td>${escapeHtml(formatMatrixValue(product.produto, product.meta_acumulada))}</td>
          <td><strong>${escapeHtml(formatMatrixValue(product.produto, product.producao_acumulada))}</strong></td>
          <td class="${achievementClass}">${percentage}</td>
          <td class="${gapClass}">${gapPrefix}${escapeHtml(formatMatrixValue(product.produto, product.gap))}</td>
        </tr>`;
    }).join("");
    return `
      <article id="agency-card-${escapeHtml(unit.code)}" class="agency-card" tabindex="-1">
        <header class="agency-card-header">
          <span class="agency-code">PA ${escapeHtml(unit.code)}</span>
          <div>
            <span class="agency-rank">${rankByPa.get(unit.pa)}ª em aderência no período</span>
            <h3>${escapeHtml(unit.name)}</h3>
            <p>${numberFormatter.format(summary.adherent)} de ${numberFormatter.format(summary.with_target)} metas de produto atingidas</p>
          </div>
          <div class="agency-rate-group">
            <strong class="agency-rate">${percentageFormatter.format(summary.adherence_rate)}%</strong>
            <span>aderência</span>
          </div>
        </header>
        <div class="agency-table-wrap">
          <table class="agency-products-table">
            <thead><tr>
              ${agencySortButton(unit, "produto", "PRODUTO", sort)}
              <th>${isAnnual ? "META ANUAL" : "META NO PERÍODO"}</th>
              ${agencySortButton(unit, "producao_acumulada", isAnnual ? "PRODUÇÃO ANUAL" : "PRODUÇÃO NO PERÍODO", sort)}
              ${agencySortButton(unit, "percentual_atingido", "%", sort)}
              ${agencySortButton(unit, "gap", "GAP", sort)}
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </article>`;
  }).join("");
}

async function loadAgenciesData() {
  const requestId = ++agenciesRequestId;
  setAgenciesState("loading");
  try {
    const params = new URLSearchParams({
      inicio: agenciesPeriodStart.value,
      fim: agenciesPeriodEnd.value,
      base_calculo: selectedAgenciesCalculationBasis,
    });
    const data = await request(`/api/acompanhamento/agencias?${params}`);
    if (requestId !== agenciesRequestId) return;
    renderAgencyCards(data);
    setAgenciesState("content");
  } catch (error) {
    if (requestId !== agenciesRequestId) return;
    setAgenciesState("empty");
    showToast(error.message, "error");
  }
}

async function loadAgenciesView() {
  setAgenciesState("loading");
  try {
    if (!agenciesPeriodsLoaded) await loadAgenciesPeriods();
    await loadAgenciesData();
  } catch (error) {
    setAgenciesState("empty");
  }
}

async function exportAgenciesPdf() {
  const originalContent = agenciesExportPdfButton.innerHTML;
  agenciesExportPdfButton.disabled = true;
  agenciesExportPdfButton.textContent = "Preparando PDF…";
  try {
    const params = new URLSearchParams({
      inicio: agenciesPeriodStart.value,
      fim: agenciesPeriodEnd.value,
      base_calculo: selectedAgenciesCalculationBasis,
    });
    const response = await fetch(appUrl(`/api/exportacoes/acompanhamento-agencias?${params}`));
    if (!response.ok) {
      let message = "Não foi possível gerar o relatório das agências.";
      try {
        const body = await response.json();
        message = body.detail || message;
      } catch {}
      throw new Error(message);
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^";]+)"?/);
    const fileName = match?.[1] || "acompanhamento_agencias.pdf";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    showToast("Acompanhamento das agências exportado em PDF.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    agenciesExportPdfButton.innerHTML = originalContent;
    agenciesExportPdfButton.disabled = agenciesContent.hidden;
  }
}
