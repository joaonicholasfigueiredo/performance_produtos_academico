async function loadTrackingData() {
  const requestId = ++trackingRequestId;
  setTrackingState("loading");
  try {
    const params = new URLSearchParams({
      inicio: periodStart.value,
      fim: periodEnd.value,
      pa: unitSelect.value,
      base_calculo: selectedCalculationBasis,
      escopo: activeTrackingScope,
    });
    const unitParams = new URLSearchParams({
      inicio: periodStart.value,
      fim: periodEnd.value,
      base_calculo: selectedCalculationBasis,
      escopo: activeTrackingScope,
    });
    const allUnitsParams = new URLSearchParams(params);
    allUnitsParams.set("pa", "SINGULAR");
    const needsSeparateAllUnitsData = activeTrackingScope === "FOCO"
      && unitSelect.value !== "SINGULAR";
    const [data, analyticData, allUnitsAnalyticData, unitData, focusAgencyData] = await Promise.all([
      request(`/api/acompanhamento/producao-acumulada?${params}`),
      request(`/api/acompanhamento/producao-analitica?${params}`),
      needsSeparateAllUnitsData
        ? request(`/api/acompanhamento/producao-analitica?${allUnitsParams}`)
        : Promise.resolve(null),
      request(`/api/acompanhamento/resumo-unidades?${unitParams}`),
      activeTrackingScope === "FOCO"
        ? request(`/api/acompanhamento/desempenho-produtos-foco?${unitParams}`)
        : Promise.resolve(null),
    ]);
    if (requestId !== trackingRequestId) return;
    focusAgencyPerformanceData = focusAgencyData;
    analyticDataByUnit = analyticData;
    analyticDataAllUnits = activeTrackingScope === "FOCO"
      ? allUnitsAnalyticData || analyticData
      : null;
    renderTracking(data);
    renderAnalytic(getActiveAnalyticData());
    renderUnitSummary(unitData);
    setTrackingState("content");
  } catch (error) {
    if (requestId !== trackingRequestId) return;
    setTrackingState("empty");
    showToast(error.message, "error");
  }
}

async function loadTrackingView() {
  setTrackingState("loading");
  try {
    if (!trackingPeriodsLoaded) await loadTrackingPeriods();
    await loadTrackingData();
  } catch (error) {
    setTrackingState("empty");
  }
}

async function exportTrackingTable() {
  const originalContent = trackingExportButton.innerHTML;
  trackingExportButton.disabled = true;
  trackingExportButton.textContent = "Preparando Excel…";

  try {
    const params = new URLSearchParams({
      visao: selectedTrackingMode === "analytic" ? "ANALITICO" : "SINTETICO",
      inicio: periodStart.value,
      fim: periodEnd.value,
      pa: selectedTrackingMode === "analytic"
        && activeTrackingScope === "FOCO"
        && analyticPerspective === "product_by_agency"
        ? "SINGULAR"
        : selectedTrackingMode === "analytic"
          && activeTrackingScope === "FOCO"
          && analyticPerspective === "agency_by_product"
          ? selectedAnalyticAgency
          : unitSelect.value,
      base_calculo: selectedCalculationBasis,
      escopo: activeTrackingScope,
    });
    if (selectedTrackingMode === "analytic"
        && activeTrackingScope === "FOCO"
        && analyticPerspective === "product_by_agency"
        && selectedAnalyticProduct) {
      params.set("produtos", selectedAnalyticProduct);
    } else if (selectedTrackingMode === "analytic" && selectedAnalyticCombo) {
      const productNames = getAnalyticProductsForCombo().map(product => product.produto);
      if (productNames.length) params.set("produtos", productNames.join("|"));
    }
    if (selectedTrackingMode === "synthetic" && productSearch.value.trim()) {
      params.set("busca", productSearch.value.trim());
    }

    const response = await fetch(appUrl(`/api/exportacoes/acompanhamento?${params}`));
    if (!response.ok) {
      let message = "Não foi possível gerar o relatório gerencial.";
      try {
        const body = await response.json();
        message = body.detail || message;
      } catch {}
      throw new Error(message);
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^";]+)"?/);
    const fileName = match?.[1] || "relatorio_acompanhamento.xlsx";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    showToast("Relatório gerencial exportado com sucesso.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    trackingExportButton.innerHTML = originalContent;
    trackingExportButton.disabled = trackingContent.hidden;
  }
}
