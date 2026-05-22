(function () {
  const api = window.CloudAppApi;
  const config = window.CloudAppConfig;
  const scoring = window.CloudAppScoring;
  const ui = window.CloudAppUi;
  const refreshButton = document.getElementById("refreshButton");
  const compareButton = document.getElementById("compareButton");
  const locationSelect = document.getElementById("locationSelect");
  const locationCompareCards = document.getElementById("locationCompareCards");
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

  function buildAstroAppUrl(site) {
    const url = new URL(config.astroAppUrl);
    url.searchParams.set("site", site.name);
    url.searchParams.set("lat", site.latitude);
    url.searchParams.set("lon", site.longitude);
    url.searchParams.set("elev", site.elevation);
    url.searchParams.set("date", api.getTokyoDateKey());
    url.searchParams.set("time", "21:00");
    url.searchParams.set("return", window.location.href);
    return url.toString();
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
      ui.renderForecast(assessment, buildAstroAppUrl(apiResult.location));

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

  function compareByScore(left, right) {
    const leftScore = Number.isFinite(left.assessment.overallScore) ? left.assessment.overallScore : -1;
    const rightScore = Number.isFinite(right.assessment.overallScore) ? right.assessment.overallScore : -1;
    return rightScore - leftScore;
  }

  async function compareLocations() {
    ui.setCompareLoading(true);
    ui.setStatus("全地点の比較データを順番に取得しています...");

    const comparisons = [];
    const failures = [];

    try {
      for (const location of config.locations) {
        try {
          ui.setStatus(`${location.name} を比較用に取得しています...`);
          const apiResult = await api.fetchNightForecasts(location);
          if (!apiResult.models.length) {
            throw new Error("モデル別データがありません。");
          }

          comparisons.push({
            location,
            assessment: scoring.assessNight(apiResult)
          });
        } catch (error) {
          failures.push(`${location.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      comparisons.sort(compareByScore);
      ui.renderLocationComparison(comparisons, selectedLocation.id, buildAstroAppUrl);

      if (failures.length) {
        ui.setStatus(`地点比較を更新しました。一部失敗: ${failures.join(" / ")}`, "partial");
      } else {
        ui.setStatus("地点比較を更新しました。地点名を押すと詳細表示へ切り替わります。");
      }
    } finally {
      ui.setCompareLoading(false);
    }
  }

  function selectLocation(locationId) {
    const nextLocation = findLocation(locationId);
    if (!nextLocation) {
      return;
    }

    selectedLocation = nextLocation;
    storeLocationId(selectedLocation.id);
    ui.setLocation(selectedLocation);
    refreshForecast();
  }

  function changeLocation(event) {
    const nextLocation = findLocation(event.target.value);
    if (!nextLocation || nextLocation.id === selectedLocation.id) {
      return;
    }

    selectLocation(nextLocation.id);
  }

  function switchFromComparison(event) {
    const locationButton = event.target.closest("[data-location-id]");
    if (!locationButton) {
      return;
    }

    selectLocation(locationButton.dataset.locationId);
  }

  refreshButton.addEventListener("click", refreshForecast);
  compareButton.addEventListener("click", compareLocations);
  locationSelect.addEventListener("change", changeLocation);
  locationCompareCards.addEventListener("click", switchFromComparison);
  window.addEventListener("resize", ui.redrawChart);
  ui.renderLocationOptions(config.locations, selectedLocation.id);
  ui.setLocation(selectedLocation);
  ui.setWindowLabel(api.getTonightWindow());
  refreshForecast();

  window.CloudAppLinks = {
    buildAstroAppUrl
  };
})();
