function getActiveAnalyticCombos() {
  return activeTrackingScope === "FOCO"
    ? FOCUS_ANALYTIC_COMBOS
    : ANALYTIC_COMBOS;
}

function getSelectedCombo() {
  return getActiveAnalyticCombos().find(
    combo => combo.id === selectedAnalyticCombo
  ) || null;
}

function getAnalyticProductsForCombo(comboId = selectedAnalyticCombo) {
  const combo = getActiveAnalyticCombos().find(item => item.id === comboId);
  if (!combo) return analyticProducts;
  const productNames = new Set(combo.products);
  return analyticProducts.filter(product =>
    productNames.has(product.produto.toUpperCase())
  );
}

function countProductTargets(product) {
  const importedPeriods = new Set(analyticPeriods.map(period => period.value));
  const points = product?.points.filter(point => importedPeriods.has(point.period)) || [];
  return {
    targets: analyticPeriods.length,
    achieved: points.filter(point => point.percentual_atingido >= 100).length,
  };
}

function getIndividualScoreEntries(comboId = "") {
  const activeCombos = getActiveAnalyticCombos();
  const combos = comboId
    ? activeCombos.filter(combo => combo.id === comboId)
    : activeCombos;
  return combos.flatMap(combo => combo.requirements.map(requirement => ({
    combo,
    label: requirement.label,
    product: analyticProducts.find(product =>
      requirement.aliases.includes(product.produto.toUpperCase())
    ) || null,
  })));
}

function calculateIndividualScore(entries) {
  const productScores = entries.map(entry => ({
    ...entry,
    ...countProductTargets(entry.product),
  }));
  const target = entries.length * analyticPeriods.length;
  const points = productScores.reduce((total, item) => total + item.achieved, 0);
  return {
    target,
    points,
    rate: target ? points / target * 100 : 0,
    products: productScores,
    productCount: entries.length,
    monthCount: analyticPeriods.length,
  };
}

function comboScorePeriods() {
  const start = analyticRange?.start;
  const end = analyticRange?.end;
  if (!start || !end) return analyticPeriods;
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  if (![startYear, startMonth, endYear, endMonth].every(Number.isFinite)) {
    return analyticPeriods;
  }
  const existingLabels = new Map(
    analyticPeriods.map(period => [period.value, period.label])
  );
  const monthLabels = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  const periods = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const value = `${year}-${String(month).padStart(2, "0")}`;
    periods.push({
      value,
      label: existingLabels.get(value) || `${monthLabels[month - 1]}/${year}`,
    });
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return periods;
}

function calculateComboScore(combo) {
  const requiredProducts = combo.requirements.map(requirement => ({
    label: requirement.label,
    product: analyticProducts.find(product =>
      requirement.aliases.includes(product.produto.toUpperCase())
    ) || null,
  }));
  const periods = comboScorePeriods();
  const months = periods.map(period => {
    const productResults = requiredProducts.map(requirement => {
      const point = requirement.product?.points.find(
        item => item.period === period.value
      );
      const percentage = point?.percentual_atingido ?? null;
      const hasData = Boolean(
        point && (point.meta !== null || point.producao !== null)
      );
      return {
        label: requirement.label,
        product: requirement.product?.produto || null,
        percentage,
        achieved: percentage !== null && percentage >= 100,
        unavailableLabel: !requirement.product
          ? "Ausente"
          : !hasData
            ? "Sem dados"
            : "Sem meta",
      };
    });
    const achieved =
      productResults.length > 0
      && productResults.every(result => result.achieved);
    return {
      period: period.value,
      label: period.label,
      point: achieved ? 1 : 0,
      achieved,
      products: productResults,
    };
  });
  const target = periods.length;
  const points = months.reduce((total, month) => total + month.point, 0);
  return {
    combo,
    target,
    points,
    rate: target ? points / target * 100 : 0,
    months,
    productCount: requiredProducts.length,
  };
}

function renderAnalyticComboButtons() {
  const isFocus = activeTrackingScope === "FOCO";
  analyticComboFilter.hidden = isFocus;
  if (isFocus) {
    selectedAnalyticCombo = "";
    analyticComboButtons.innerHTML = "";
    return;
  }
  const activeCombos = getActiveAnalyticCombos();
  const buttonItems = [
    {
      id: "",
      label: "Todos",
      count: analyticProducts.length,
    },
    ...activeCombos.map(combo => ({
      id: combo.id,
      label: combo.label.replace("Combo ", ""),
      count: getAnalyticProductsForCombo(combo.id).length,
    })),
  ];
  analyticComboButtons.innerHTML = buttonItems.map(item => `
    <button class="analytic-combo-button ${selectedAnalyticCombo === item.id ? "active" : ""}"
      type="button" data-combo="${item.id}" aria-pressed="${selectedAnalyticCombo === item.id}">
      <span>${escapeHtml(item.label)}</span>
      <small>${numberFormatter.format(item.count)}</small>
    </button>
  `).join("");
}

function renderAnalyticComboKpis() {
  if (activeTrackingScope === "FOCO") {
    analyticComboKpis.hidden = true;
    analyticComboKpis.innerHTML = "";
    return;
  }
  const activeCombos = getActiveAnalyticCombos();
  const combo = getSelectedCombo();
  const comboScores = activeCombos.map(calculateComboScore);
  const selectedScore = combo
    ? comboScores.find(score => score.combo.id === combo.id)
    : null;
  const individualEntries = getIndividualScoreEntries(combo?.id || "");
  const individualScore = calculateIndividualScore(individualEntries);
  const isIndividualMode = selectedAnalyticScoreMode === "individual";
  const targetPoints = isIndividualMode
    ? individualScore.target
    : selectedScore
      ? selectedScore.target
      : comboScores.reduce((total, score) => total + score.target, 0);
  const achievedPoints = isIndividualMode
    ? individualScore.points
    : selectedScore
      ? selectedScore.points
      : comboScores.reduce((total, score) => total + score.points, 0);
  const attainmentRate = targetPoints
    ? achievedPoints / targetPoints * 100
    : 0;
  const productDetailMetrics = individualEntries.map(entry => {
      const metrics = countProductTargets(entry.product);
      return {
        label: entry.product ? humanizeProduct(entry.product.produto) : entry.label,
        monogram: entry.product
          ? productInitials(entry.product.produto)
          : entry.label.split(" ").map(word => word[0]).join("").slice(0, 2).toUpperCase(),
        target: metrics.targets,
        points: metrics.achieved,
        targetLabel: "DECORRIDAS",
        pointsLabel: "ATINGIDAS",
        description: `${percentageFormatter.format(
          metrics.targets ? metrics.achieved / metrics.targets * 100 : 0
        )}% das metas atingidas${entry.product ? "" : " · produto sem dados"}`,
      };
    });
  const comboDetailMetrics = comboScores.map(score => ({
        label: score.combo.label,
        monogram: score.combo.label
          .replace("Combo ", "")
          .split(" ")
          .filter(word => word.toLowerCase() !== "e")
          .map(word => word[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        target: score.target,
        points: score.points,
        targetLabel: "META",
        pointsLabel: "PONTOS",
        description:
          `${percentageFormatter.format(score.rate)}% da pontuação`
          + ` · ${numberFormatter.format(score.productCount)} produto(s)`,
      }));
  const individualComboMetrics = activeCombos.map(item => {
    const score = calculateIndividualScore(getIndividualScoreEntries(item.id));
    return {
      label: item.label,
      monogram: item.label
        .replace("Combo ", "")
        .split(" ")
        .filter(word => word.toLowerCase() !== "e")
        .map(word => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      target: score.target,
      points: score.points,
      targetLabel: "DECORRIDAS",
      pointsLabel: "ATINGIDAS",
      description:
        `${percentageFormatter.format(score.rate)}% de aproveitamento`
        + ` · ${numberFormatter.format(score.productCount)} produto(s)`,
    };
  });
  const detailMetrics = combo
    ? productDetailMetrics
    : isIndividualMode
      ? individualComboMetrics
      : comboDetailMetrics;
  const monthlyAudit = selectedScore && !isIndividualMode
    ? `
      <section class="combo-monthly-audit" aria-label="Apuração mensal do ${escapeHtml(combo.label)}">
        <div class="combo-monthly-audit-heading">
          <div>
            <span class="eyebrow">MEMÓRIA DE CÁLCULO</span>
            <h4>Apuração mensal do combo</h4>
          </div>
          <p>Cada mês vale 1 ponto somente quando todos os produtos atingem 100% ou mais.</p>
        </div>
        <div class="combo-monthly-audit-scroll">
          ${selectedScore.months.map(month => `
            <article class="combo-month-card ${month.achieved ? "achieved" : "missed"}">
              <header>
                <span>${escapeHtml(month.label)}</span>
                <strong>${month.point} ${month.point === 1 ? "ponto" : "pontos"}</strong>
              </header>
              <div class="combo-month-products">
                ${month.products.map(product => `
                  <span class="${product.achieved ? "achieved" : "missed"}">
                    <i aria-hidden="true">${product.achieved ? "✓" : "×"}</i>
                    <small>${escapeHtml(product.label)}</small>
                    <strong>${product.percentage === null
                      ? product.unavailableLabel
                      : `${percentageFormatter.format(product.percentage)}%`}</strong>
                  </span>
                `).join("")}
              </div>
            </article>
          `).join("")}
        </div>
      </section>`
    : "";
  const modeTitle = isIndividualMode ? "Pontuação individual" : "Pontuação por combo";
  const targetLabel = isIndividualMode ? "Decorridas" : "Meta";
  const pointsLabel = isIndividualMode ? "Atingidas" : "Pontos";
  const rateLabel = isIndividualMode ? "Aproveitamento" : "Atingimento";
  const formula = isIndividualMode
    ? `${numberFormatter.format(individualScore.productCount)} produto(s) × ${numberFormatter.format(individualScore.monthCount)} mês(es) importado(s) = ${numberFormatter.format(individualScore.target)} oportunidades`
    : selectedScore
      ? `${numberFormatter.format(selectedScore.target)} mês(es) decorrido(s) · máximo de 1 ponto por mês`
      : `${numberFormatter.format(comboScores.length)} combo(s) × ${numberFormatter.format(comboScorePeriods().length)} mês(es) decorrido(s)`;
  const leadingRate = Math.max(...comboScores.map(score => score.rate), 0);
  const comboComparison = !combo && !isIndividualMode
    ? `
      <div class="combo-compact-comparison" aria-label="Comparativo da pontuação por combo">
        ${comboScores.map(score => {
          const name = score.combo.label.replace("Combo ", "");
          const isLeading = score.rate === leadingRate && leadingRate > 0;
          return `
            <article class="combo-compact-item ${isLeading ? "leading" : ""}">
              <div><span>${escapeHtml(name)}</span><strong>${percentageFormatter.format(score.rate)}%</strong></div>
              <div class="combo-compact-progress" aria-hidden="true"><i style="width:${Math.min(Math.max(score.rate, 0), 100)}%"></i></div>
              <small>${numberFormatter.format(score.points)}/${numberFormatter.format(score.target)} meses</small>
            </article>`;
        }).join("")}
      </div>`
    : "";

  analyticComboKpis.hidden = false;
  analyticComboKpis.innerHTML = `
    <div class="analytic-score-mode-bar">
      <div class="analytic-score-mode-copy">
        <strong>${modeTitle}</strong>
        <small>${isIndividualMode ? "Pontua cada produto que atingiu a meta." : "Pontua o combo quando todos os produtos atingem a meta."}</small>
      </div>
      <div class="analytic-score-mode-toggle" role="group" aria-label="Alternar forma de pontuação">
        <button class="analytic-score-mode-button ${!isIndividualMode ? "active" : ""}" type="button" data-score-mode="combo" aria-pressed="${!isIndividualMode}">Combo</button>
        <button class="analytic-score-mode-button ${isIndividualMode ? "active" : ""}" type="button" data-score-mode="individual" aria-pressed="${isIndividualMode}">Individual</button>
      </div>
    </div>
    <div class="combo-kpi-heading">
      <div>
        <h3>${escapeHtml(combo ? combo.label : "Resultado consolidado")}</h3>
        <p>${escapeHtml(formula)}</p>
      </div>
      <div class="combo-kpi-overview">
        <span class="rate"><small>${rateLabel}</small><strong>${percentageFormatter.format(attainmentRate)}%</strong></span>
        <span class="achieved"><small>${pointsLabel}</small><strong>${numberFormatter.format(achievedPoints)}</strong></span>
        <span class="targets"><small>${targetLabel}</small><strong>${numberFormatter.format(targetPoints)}</strong></span>
      </div>
    </div>
    ${comboComparison}
    ${monthlyAudit}
    <div class="combo-product-kpi-grid" ${!combo && !isIndividualMode ? "hidden" : ""}>
      ${detailMetrics.length
        ? detailMetrics.map(item => {
          const productRate = item.target ? item.points / item.target * 100 : 0;
          return `
            <article class="combo-product-kpi">
              <div class="combo-product-kpi-name">
                <span class="product-monogram">${escapeHtml(item.monogram)}</span>
                <strong>${escapeHtml(item.label)}</strong>
              </div>
              <div class="combo-product-kpi-values">
                <span><small>${item.targetLabel}</small><strong>${numberFormatter.format(item.target)}</strong></span>
                <span><small>${item.pointsLabel}</small><strong>${numberFormatter.format(item.points)}</strong></span>
              </div>
              <div class="combo-product-kpi-progress">
                <span style="width:${Math.min(Math.max(productRate, 0), 100)}%"></span>
              </div>
              <small class="combo-product-kpi-rate">${escapeHtml(item.description)}</small>
            </article>`;
        }).join("")
        : '<p class="combo-kpi-empty">Nenhum produto está presente na base para o filtro atual.</p>'}
    </div>`;
}

function renderAnalyticTable() {
  const selectedProduct = selectedAnalyticProduct;
  const productByAgency = activeTrackingScope === "FOCO"
    && analyticPerspective === "product_by_agency";
  const agencyByProduct = activeTrackingScope === "FOCO"
    && analyticPerspective === "agency_by_product";
  const comboProducts = getAnalyticProductsForCombo();
  const filteredProducts = comboProducts;
  const showCompleteCombo = Boolean(selectedAnalyticCombo);
  const showAllFocusProducts = activeTrackingScope === "FOCO"
    && (productByAgency ? !selectedProduct : true);
  const pageSize = showCompleteCombo || showAllFocusProducts
    ? Math.max(filteredProducts.length, 1)
    : analyticPageSize;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  analyticPage = Math.min(Math.max(analyticPage, 1), totalPages);
  const pageStart = (analyticPage - 1) * pageSize;
  const visibleProducts = filteredProducts.slice(
    pageStart,
    pageStart + pageSize
  );

  document.querySelector("#analytic-table-head").innerHTML = `
    <tr>
      <th>PRODUTO</th>
      ${analyticPeriods.map(period =>
        `<th class="month-header">${escapeHtml(period.label)}</th>`
      ).join("")}
    </tr>`;

  const body = document.querySelector("#analytic-table-body");
  if (!visibleProducts.length) {
    body.innerHTML = `<tr class="matrix-empty-row"><td colspan="${analyticPeriods.length + 1}">Nenhum produto encontrado.</td></tr>`;
  } else {
    body.innerHTML = visibleProducts.map(product => {
      const productContent = `
        <span class="product-cell">
          ${productByAgency ? "" : `<span class="product-monogram">${escapeHtml(productInitials(product.produto))}</span>`}
          <span class="product-details">
            <span class="product-name">${escapeHtml(humanizeProduct(product.produto))}</span>
            ${!productByAgency && product.regra_calculo === "saldo_mensal_nao_acumulado"
              ? '<small class="calculation-rule">Saldo mensal · sem acumular</small>'
              : ""}
          </span>
        </span>`;
      const productHeading = productByAgency
        ? `<span class="analytic-product-summary">${productContent}</span>`
        : `<button class="analytic-product-button ${agencyByProduct ? "expandable" : ""} ${selectedProduct === product.produto ? "selected" : ""}" type="button" data-product="${encodeURIComponent(product.produto)}" aria-pressed="${selectedProduct === product.produto}" aria-expanded="${agencyByProduct ? selectedProduct === product.produto : false}" aria-label="${selectedProduct === product.produto ? "Ocultar" : "Exibir"} evolução de ${escapeHtml(humanizeProduct(product.produto))}">${productContent}${agencyByProduct ? `<span class="analytic-product-expand-icon" aria-hidden="true">${selectedProduct === product.produto ? "−" : "+"}</span>` : ""}</button>`;
      const productRow = `
      <tr>
        <td>${productHeading}</td>
        ${product.points.map(point => {
          if (point.meta === null && point.producao === null) {
            return '<td><div class="monthly-missing">Sem dados</div></td>';
          }
          const percentage = point.percentual_atingido === null
            ? "Sem meta"
            : `${percentageFormatter.format(point.percentual_atingido)}% atingido`;
          const achievementClass = point.percentual_atingido === null
            ? "no-target"
            : point.percentual_atingido >= 100
              ? "achievement-met"
              : "achievement-missed";
          return `
            <td>
              <div class="monthly-comparison">
                <span class="monthly-value">
                  <small>META</small>
                  <strong>${escapeHtml(formatMatrixValue(product.produto, point.meta))}</strong>
                </span>
                <span class="monthly-value production">
                  <small>PRODUÇÃO</small>
                  <strong>${escapeHtml(formatMatrixValue(product.produto, point.producao))}</strong>
                </span>
                <span class="monthly-achievement ${achievementClass}">${escapeHtml(percentage)}</span>
              </div>
            </td>`;
        }).join("")}
      </tr>`;
      const chartRow = agencyByProduct && selectedProduct === product.produto
        ? `<tr class="focus-agency-expanded-row analytic-product-expanded-row"><td colspan="${analyticPeriods.length + 1}">${renderFocusAgencyInlineChart(product, product.produto, {
          eyebrow: "EVOLUÇÃO DO PRODUTO",
          label: humanizeProduct(product.produto),
        })}</td></tr>`
        : "";
      return productRow + chartRow;
    }).join("");
  }

  const firstVisible = filteredProducts.length ? pageStart + 1 : 0;
  const lastVisible = Math.min(pageStart + visibleProducts.length, filteredProducts.length);
  document.querySelector("#analytic-count").textContent =
    `Exibindo ${numberFormatter.format(firstVisible)}–${numberFormatter.format(lastVisible)} de ${numberFormatter.format(filteredProducts.length)} produto(s)`;
  document.querySelector("#analytic-page-indicator").textContent =
    `Página ${numberFormatter.format(analyticPage)} de ${numberFormatter.format(totalPages)}`;
  analyticPreviousPage.disabled = analyticPage <= 1;
  analyticNextPage.disabled = analyticPage >= totalPages;
  analyticPagination.hidden = Boolean(selectedAnalyticCombo) || showAllFocusProducts;
  analyticPageNote.textContent = showAllFocusProducts
    ? `${numberFormatter.format(filteredProducts.length)} produtos exibidos nesta visão`
    : selectedAnalyticCombo
    ? `${numberFormatter.format(comboProducts.length)} produto(s) no combo selecionado`
    : "Máximo de 3 produtos por página";
}
