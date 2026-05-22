(function () {
  const api = window.CloudAppApi;
  const scoring = window.CloudAppScoring;
  const ui = window.CloudAppUi;
  const refreshButton = document.getElementById("refreshButton");

  async function refreshForecast() {
    ui.setLoading(true);
    ui.setStatus("Open-Meteo から夜間データを取得しています...");

    try {
      const apiResult = await api.fetchNightForecasts();
      ui.setWindowLabel(apiResult.windowRange);

      if (!apiResult.models.length) {
        const failure = apiResult.errors.map((error) => error.message).join(" / ");
        throw new Error(failure || "モデル別データを取得できませんでした。");
      }

      const assessment = scoring.assessNight(apiResult);
      ui.renderForecast(assessment);

      if (apiResult.errors.length) {
        const failedLabels = apiResult.errors.map((error) => error.source.label).join(", ");
        ui.setStatus(`${failedLabels} の取得に失敗しました。取得済みモデルで表示しています。`, "partial");
      } else {
        ui.setStatus("夜間データを更新しました。3 系列の差と時間別スコアを確認できます。");
      }
    } catch (error) {
      ui.setStatus(error instanceof Error ? error.message : String(error), "error");
    } finally {
      ui.setLoading(false);
    }
  }

  refreshButton.addEventListener("click", refreshForecast);
  window.addEventListener("resize", ui.redrawChart);
  ui.setWindowLabel(api.getTonightWindow());
  refreshForecast();
})();
