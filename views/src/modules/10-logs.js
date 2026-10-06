const auditFieldLabels = {
  PRODUTO: "Produto",
  META_MENSAL: "Meta mensal",
  PRODUCAO_MENSAL: "Produção mensal",
  META_TRIMESTRAL: "Meta trimestral",
  PRODUCAO_TRIMESTRAL: "Produção trimestral",
  META_SEMESTRAL: "Meta semestral",
  PRODUCAO_SEMESTRAL: "Produção semestral",
  META_ANUAL: "Meta anual",
  PRODUCAO_ANUAL: "Produção anual",
  META_NO_PERIODO: "Meta no período",
  PRODUCAO_NO_PERIODO: "Produção no período",
};

function setLogsState(state) {
  logsLoading.hidden = state !== "loading";
  logsEmpty.hidden = state !== "empty";
  logsContent.hidden = state !== "content";
}

function formatLogDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAuditValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return decimalFormatter.format(value);
  return String(value);
}

function renderChangedValues(entry) {
  return entry.changed_fields.map(field => {
    const beforeValue = entry.before?.[field];
    const afterValue = entry.after?.[field];
    const before = formatAuditValue(beforeValue);
    const after = formatAuditValue(afterValue);
    const hasNumericComparison =
      typeof beforeValue === "number"
      && Number.isFinite(beforeValue)
      && typeof afterValue === "number"
      && Number.isFinite(afterValue);
    const direction = !hasNumericComparison || afterValue === beforeValue
      ? ""
      : afterValue > beforeValue
        ? "increase"
        : "decrease";
    const trend = direction
      ? `<i class="value-trend ${direction}" role="img"
          aria-label="${direction === "increase" ? "Valor superior ao anterior" : "Valor inferior ao anterior"}"
          title="${direction === "increase" ? "Valor superior ao anterior" : "Valor inferior ao anterior"}">
          <span aria-hidden="true">${direction === "increase" ? "↑" : "↓"}</span>
        </i>`
      : "";
    return `
      <span class="value-change">
        <strong>${escapeHtml(auditFieldLabels[field] || field)}</strong>
        <span class="value-change-values">
          ${escapeHtml(before)}
          <i class="value-change-arrow" aria-hidden="true">→</i>
          ${escapeHtml(after)}
          ${trend}
        </span>
      </span>`;
  }).join("");
}

function formatLogPeriodName(period) {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  const monthName = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
  }).format(new Date(year, month - 1, 1));
  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
}

function getFilteredLogEntries() {
  const query = logSearch.value.trim().toLocaleLowerCase("pt-BR");
  return logEntries.filter(entry => {
    const matchesPeriod =
      !selectedLogPeriod || entry.period === selectedLogPeriod;
    const matchesSearch =
      `${entry.produto} ${entry.id_produto} ${entry.pa} ${entry.period_label}`
        .toLocaleLowerCase("pt-BR")
        .includes(query);
    return matchesPeriod && matchesSearch;
  });
}

function closeLogPeriodMenu() {
  logPeriodMenu.hidden = true;
  logPeriodButton.setAttribute("aria-expanded", "false");
}

function renderLogPeriodMenu() {
  const periods = [...new Set(logEntries.map(entry => entry.period))]
    .filter(Boolean)
    .sort();
  if (selectedLogPeriod && !periods.includes(selectedLogPeriod)) {
    selectedLogPeriod = "";
  }
  logPeriodButtonLabel.textContent = selectedLogPeriod
    ? formatLogPeriodName(selectedLogPeriod)
    : "Todos os períodos";
  logPeriodMenu.innerHTML = [
    { value: "", label: "Todos os períodos", count: logEntries.length },
    ...periods.map(period => ({
      value: period,
      label: formatLogPeriodName(period),
      count: logEntries.filter(entry => entry.period === period).length,
    })),
  ].map(item => `
    <button class="log-period-option ${selectedLogPeriod === item.value ? "active" : ""}"
      type="button" role="option" aria-selected="${selectedLogPeriod === item.value}"
      data-period="${item.value}">
      <span>${escapeHtml(item.label)}</span>
      <small>${numberFormatter.format(item.count)}</small>
    </button>
  `).join("");
}

function renderLogsTable() {
  const query = logSearch.value.trim().toLocaleLowerCase("pt-BR");
  const filtered = getFilteredLogEntries();
  const totalPages = Math.max(1, Math.ceil(filtered.length / logsPageSize));
  logsPage = Math.min(Math.max(logsPage, 1), totalPages);
  const pageStart = (logsPage - 1) * logsPageSize;
  const visibleEntries = filtered.slice(pageStart, pageStart + logsPageSize);
  const typeLabels = {
    ATUALIZADO: "Atualizado",
    INCLUIDO: "Incluído",
    REMOVIDO: "Removido",
  };

  const body = document.querySelector("#logs-table-body");
  if (!filtered.length) {
    body.innerHTML = '<tr class="matrix-empty-row"><td colspan="6">Nenhuma alteração encontrada.</td></tr>';
  } else {
    body.innerHTML = visibleEntries.map(entry => `
      <tr>
        <td class="log-date">${escapeHtml(formatLogDate(entry.occurred_at))}</td>
        <td><strong>${escapeHtml(entry.period_label)}</strong></td>
        <td>
          <span class="product-cell">
            <span class="product-monogram">${escapeHtml(productInitials(entry.produto))}</span>
            <span><strong>${escapeHtml(humanizeProduct(entry.produto))}</strong><small>ID ${escapeHtml(entry.id_produto)}</small></span>
          </span>
        </td>
        <td><span class="pa-badge">PA ${escapeHtml(entry.pa)}</span></td>
        <td><span class="log-type ${entry.type.toLowerCase()}">${typeLabels[entry.type] || entry.type}</span></td>
        <td><div class="value-changes">${renderChangedValues(entry)}</div></td>
      </tr>`).join("");
  }
  const firstVisible = filtered.length ? pageStart + 1 : 0;
  const lastVisible = Math.min(pageStart + visibleEntries.length, filtered.length);
  document.querySelector("#logs-count").textContent = query
    ? `Exibindo ${numberFormatter.format(firstVisible)}–${numberFormatter.format(lastVisible)} de ${numberFormatter.format(filtered.length)} resultado(s) · ${numberFormatter.format(logEntries.length)} no total`
    : `Exibindo ${numberFormatter.format(firstVisible)}–${numberFormatter.format(lastVisible)} de ${numberFormatter.format(filtered.length)} alteração(ões)`;
  logsPageIndicator.textContent =
    `Página ${numberFormatter.format(logsPage)} de ${numberFormatter.format(totalPages)}`;
  logsPreviousPage.disabled = logsPage <= 1;
  logsNextPage.disabled = logsPage >= totalPages;
}

async function loadLogs() {
  setLogsState("loading");
  refreshLogsButton.disabled = true;
  try {
    const data = await request("/api/logs");
    logEntries = data.entries;
    logsPage = 1;
    renderLogPeriodMenu();
    if (!data.summary.updates) {
      setLogsState("empty");
      return;
    }
    document.querySelector("#log-kpi-updates").textContent =
      numberFormatter.format(data.summary.updates);
    document.querySelector("#log-kpi-changes").textContent =
      numberFormatter.format(data.summary.changes);
    document.querySelector("#log-kpi-periods").textContent =
      numberFormatter.format(data.summary.periods);
    renderLogsTable();
    setLogsState("content");
  } catch (error) {
    setLogsState("empty");
    showToast(error.message, "error");
  } finally {
    refreshLogsButton.disabled = false;
  }
}
