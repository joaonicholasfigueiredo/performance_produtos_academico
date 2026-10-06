function setFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    showToast("Selecione um arquivo no formato .xlsx.", "error");
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showToast("O arquivo excede o limite de 50 MB.", "error");
    return;
  }

  currentFile = file;
  selectedFileName.textContent = file.name;
  selectedFileSize.textContent = formatBytes(file.size);
  selectedFile.hidden = false;
  dropZone.hidden = true;
  analyzeButton.disabled = false;
}

function clearFile() {
  currentFile = null;
  fileInput.value = "";
  selectedFile.hidden = true;
  dropZone.hidden = false;
  analyzeButton.disabled = true;
}

async function refreshBaseStatus() {
  try {
    const status = await request("/api/base/status");
    document.querySelector("#base-status-title").textContent = status.exists
      ? "Base acumulativa disponível"
      : "Aguardando a primeira importação";
    document.querySelector("#base-row-count").textContent = numberFormatter.format(status.total_rows);
    document.querySelector("#base-period-count").textContent = numberFormatter.format(status.periods.length);
    exportButton.disabled = !status.exists;
    wipeButton.disabled = !status.exists;
  } catch {
    document.querySelector("#base-status-title").textContent = "Não foi possível verificar a base";
    exportButton.disabled = true;
    wipeButton.disabled = true;
  }
}

function openLoading() {
  modalBackdrop.hidden = false;
  modalLoading.hidden = false;
  modalConfirmation.hidden = true;
  modalSuccess.hidden = true;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.style.overflow = "";
}

function renderPreview(rows) {
  document.querySelector("#preview-head").innerHTML = `<tr>${previewColumns.map(column => `<th>${column}</th>`).join("")}</tr>`;
  document.querySelector("#preview-body").innerHTML = rows.map(row => {
    const cells = previewColumns.map(column => {
      let value = row[column] ?? "0";
      if (typeof value === "number") value = decimalFormatter.format(value);
      return `<td>${escapeHtml(String(value))}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showConfirmation(data) {
  currentAnalysis = data;
  document.querySelector("#period-label").textContent = data.period_label;
  document.querySelector("#summary-rows").textContent = numberFormatter.format(data.rows);
  document.querySelector("#summary-blanks").textContent = numberFormatter.format(data.blank_values_filled);
  document.querySelector("#summary-converted").textContent = numberFormatter.format(data.text_numbers_converted);
  document.querySelector("#existing-period-warning").hidden = !data.period_already_exists;
  renderPreview(data.preview);
  modalLoading.hidden = true;
  modalConfirmation.hidden = false;
}

async function analyzeFile() {
  if (!currentFile) return;
  openLoading();
  analyzeButton.disabled = true;

  const formData = new FormData();
  formData.append("file", currentFile);

  try {
    const result = await request("/api/importacoes/analisar", {
      method: "POST",
      body: formData,
    });
    showConfirmation(result);
  } catch (error) {
    closeModal();
    showToast(error.message, "error");
  } finally {
    analyzeButton.disabled = !currentFile;
  }
}

async function cancelImport() {
  cancelButton.disabled = true;
  if (currentAnalysis?.token) {
    const data = new FormData();
    data.append("token", currentAnalysis.token);
    try {
      await request("/api/importacoes/cancelar", { method: "POST", body: data });
    } catch {}
  }
  currentAnalysis = null;
  cancelButton.disabled = false;
  closeModal();
}

async function confirmImport() {
  if (!currentAnalysis) return;
  continueButton.disabled = true;
  continueButton.textContent = "Atualizando base…";

  const data = new FormData();
  data.append("token", currentAnalysis.token);
  data.append("file_name", currentAnalysis.file_name);

  try {
    const result = await request("/api/importacoes/confirmar", {
      method: "POST",
      body: data,
    });
    if (result.action === "updated") {
      document.querySelector("#success-title").textContent = `${result.period_label} atualizado`;
      document.querySelector("#success-message").textContent =
        `${numberFormatter.format(result.changed_rows)} registro(s) sofreram alteração: ` +
        `${numberFormatter.format(result.inserted_rows)} incluído(s), ` +
        `${numberFormatter.format(result.updated_rows)} atualizado(s) e ` +
        `${numberFormatter.format(result.removed_rows)} removido(s). O log foi salvo localmente.`;
    } else {
      document.querySelector("#success-title").textContent = `${result.period_label} importado`;
      document.querySelector("#success-message").textContent =
        `${numberFormatter.format(result.inserted_rows)} linha(s) adicionada(s). ` +
        `A base agora possui ${numberFormatter.format(result.total_rows)} registros.`;
    }
    modalConfirmation.hidden = true;
    modalSuccess.hidden = false;
    clearFile();
    await refreshBaseStatus();
    trackingPeriodsLoaded = false;
    agenciesPeriodsLoaded = false;
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    continueButton.disabled = false;
    continueButton.innerHTML = 'Continuar importação <svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>';
  }
}

dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => setFile(fileInput.files[0]));
removeFileButton.addEventListener("click", clearFile);
analyzeButton.addEventListener("click", analyzeFile);
cancelButton.addEventListener("click", cancelImport);
continueButton.addEventListener("click", confirmImport);
finishButton.addEventListener("click", () => {
  currentAnalysis = null;
  closeModal();
});

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
}
dropZone.addEventListener("drop", event => setFile(event.dataTransfer.files[0]));

exportButton.addEventListener("click", async () => {
  exportButton.disabled = true;
  try {
    const response = await fetch(appUrl("/api/exportacoes/base"));
    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.detail || "Não foi possível exportar a base.");
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const fileName = match?.[1] || "acompanhamento_produtos.xlsx";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("Arquivo exportado com sucesso.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    await refreshBaseStatus();
  }
});

function openWipeConfirmation() {
  wipeModalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
  wipeCancelButton.focus();
}

function closeWipeConfirmation() {
  wipeModalBackdrop.hidden = true;
  document.body.style.overflow = "";
}

wipeButton.addEventListener("click", openWipeConfirmation);
wipeCancelButton.addEventListener("click", closeWipeConfirmation);
wipeConfirmButton.addEventListener("click", async () => {
  wipeConfirmButton.disabled = true;
  wipeConfirmButton.textContent = "Excluindo…";
  const formData = new FormData();
  formData.append("confirmacao", "APAGAR_TODA_BASE");

  try {
    const result = await request("/api/base/limpar", {
      method: "POST",
      body: formData,
    });
    closeWipeConfirmation();
    trackingPeriodsLoaded = false;
    agenciesPeriodsLoaded = false;
    trackingProducts = [];
    await refreshBaseStatus();
    showToast(
      `${numberFormatter.format(result.removed_rows)} registro(s) e ${numberFormatter.format(result.removed_periods)} período(s) foram removidos.`
    );
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    wipeConfirmButton.disabled = false;
    wipeConfirmButton.textContent = "Confirmar exclusão";
  }
});

const importView = document.querySelector("#import-view");
