(function () {
  const api = window.CloudAppApi;
  const config = window.CloudAppConfig;
  const scoring = window.CloudAppScoring;
  const ui = window.CloudAppUi;
  const refreshButton = document.getElementById("refreshButton");
  const locationSelect = document.getElementById("locationSelect");
  const STORAGE_KEY = "hikone-cloud-score-location";
  let selectedLocation = getInitialLocation();

  function getStoredLocationId() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function storeLocationId(locationId) {
    try {
      window.localStorage.setItem(STORAGE_KEY, locationId);
    } catch (error) {
      // localStorage can be unavailable in restricted browser modes.
    }
  }

  function findLocation(locationId) {
    return config.locations.find((location) => location.id === locationId);
  }

  function getInitialLocation() {
    return findLocation(getStoredLocationId()) || findLocation(config.defaultLocationId) || config.locations[0];
  }

  async function refreshForecast() {
    ui.setLoading(true);
    ui.setStatus(`${selectedLocation.name} の夜間データを Open-Meteo から取得しています...`);

    try {
      const apiResult = await api.fetchNightForecasts(selectedLocation);
      ui.setWindowLabel(apiResult.windowRange);
      ui.setLocation(apiResult.location);

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

  function changeLocation(event) {
    const nextLocation = findLocation(event.target.value);
    if (!nextLocation || nextLocation.id === selectedLocation.id) {
      return;
    }

    selectedLocation = nextLocation;
    storeLocationId(selectedLocation.id);
    ui.setLocation(selectedLocation);
    refreshForecast();
  }

  refreshButton.addEventListener("click", refreshForecast);
  locationSelect.addEventListener("change", changeLocation);
  window.addEventListener("resize", ui.redrawChart);
  ui.renderLocationOptions(config.locations, selectedLocation.id);
  ui.setLocation(selectedLocation);
  ui.setWindowLabel(api.getTonightWindow());
  refreshForecast();
})();
