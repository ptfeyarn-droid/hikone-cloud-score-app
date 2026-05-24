(function () {
  const api = window.CloudAppApi;
  const config = window.CloudAppConfig;
  const scoring = window.CloudAppScoring;
  const ui = window.CloudAppUi;
  const refreshButton = document.getElementById("refreshButton");
  const compareButton = document.getElementById("compareButton");
  const locationSelect = document.getElementById("locationSelect");
  const dateModeSelect = document.getElementById("dateModeSelect");
  const customDateInput = document.getElementById("customDateInput");
  const locationCompareCards = document.getElementById("locationCompareCards");
  const STORAGE_KEY = "hikone-cloud-score-location";
  const DATE_MODE_STORAGE_KEY = "hikone-cloud-score-date-mode";
  const DATE_MODES = [
    { id: "today", label: "今日の夜", offset: 0 },
    { id: "tomorrow", label: "明日の夜", offset: 1 },
    { id: "day-after-tomorrow", label: "明後日の夜", offset: 2 },
    { id: "custom", label: "日付指定", offset: null }
  ];
  let selectedLocation = getInitialLocation();
  let selectedDateMode = getInitialDateMode();
  let customDateKey = api.getDateKeyForOffset(0);
  let selectedDateOffset = getSelectedDateOffset();

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

  function getStoredDateMode() {
    try {
      return window.localStorage.getItem(DATE_MODE_STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function storeDateMode(dateMode) {
    try {
      if (dateMode === "custom") {
        window.localStorage.removeItem(DATE_MODE_STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(DATE_MODE_STORAGE_KEY, dateMode);
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

  function findDateMode(dateModeId) {
    return DATE_MODES.find((dateMode) => dateMode.id === dateModeId);
  }

  function getInitialDateMode() {
    const storedMode = getStoredDateMode();
    return findDateMode(storedMode) && storedMode !== "custom" ? storedMode : "today";
  }

  function getSelectedDateOffset() {
    if (selectedDateMode === "custom") {
      return api.getOffsetForDateKey(customDateKey);
    }

    return findDateMode(selectedDateMode).offset;
  }

  function getDateSelection() {
    if (selectedDateMode === "custom") {
      selectedDateOffset = api.getOffsetForDateKey(customDateKey);
      return { dateKey: customDateKey };
    }

    selectedDateOffset = getSelectedDateOffset();
    return { offset: selectedDateOffset };
  }

  function getSelectedNightWindow() {
    return api.getNightWindow(getDateSelection());
  }

  function syncDateControls() {
    ui.setDateControls(
      selectedDateMode,
      selectedDateMode === "custom" ? customDateKey : api.getDateKeyForOffset(selectedDateOffset),
      api.getDateKeyForOffset(0),
      api.getDateKeyForOffset(5)
    );
  }

  function formatWindowForUrl(windowRange) {
    if (!windowRange) {
      return "";
    }

    return `${windowRange.start.slice(11)}-${windowRange.end.slice(11)}`;
  }

  function setOptionalParam(params, name, value) {
    if (value === null || value === undefined || value === "") {
      return;
    }

    params.set(name, value);
  }

  function buildAstroAppUrl(site, summary = {}) {
    const url = new URL(config.astroAppUrl);
    const params = new URLSearchParams();
    params.set("site", site.name);
    params.set("lat", site.latitude);
    params.set("lon", site.longitude);
    params.set("elev", site.elevation);
    params.set("date", getSelectedNightWindow().dateKey);
    params.set("time", "21:00");
    params.set("return", window.location.href);
    setOptionalParam(params, "cloudScore", summary.overallScore);
    setOptionalParam(params, "cloudGrade", summary.overallGrade && summary.overallGrade.grade);
    setOptionalParam(params, "reliability", summary.confidence && summary.confidence.level);
    setOptionalParam(params, "bestWindow", formatWindowForUrl(summary.recommendedWindow));
    setOptionalParam(params, "gambleWindow", formatWindowForUrl(summary.gambleWindow));
    url.search = params.toString();
    return url.toString();
  }

  function setSiteParams(url, site) {
    url.searchParams.set("site", site.name);
    url.searchParams.set("lat", site.latitude);
    url.searchParams.set("lon", site.longitude);
    url.searchParams.set("zoom", "9");
    return url.toString();
  }

  function buildScwUrl(site) {
    return setSiteParams(new URL(config.externalWeatherUrls.scw), site);
  }

  function buildGpvUrl(site) {
    return setSiteParams(new URL(config.externalWeatherUrls.gpv), site);
  }

  function getLinkBuilders() {
    return {
      astro: buildAstroAppUrl,
      scw: buildScwUrl,
      gpv: buildGpvUrl
    };
  }

  function openExternalWeatherLink(event) {
    const button = event.target.closest("[data-external-weather-url]");
    if (!button) {
      return;
    }

    window.open(button.dataset.externalWeatherUrl, "_blank", "noopener,noreferrer");
  }

  async function refreshForecast() {
    ui.setLoading(true);
    const dateSelection = getDateSelection();
    const windowRange = api.getNightWindow(dateSelection);
    ui.setStatus(`${selectedLocation.name} の ${windowRange.label} を Open-Meteo から取得しています...`);

    try {
      const apiResult = await api.fetchNightForecasts(selectedLocation, dateSelection);
      ui.setWindowLabel(apiResult.windowRange);
      ui.setLocation(apiResult.location);

      if (!apiResult.models.length) {
        const failure = apiResult.errors.map((error) => error.message).join(" / ");
        throw new Error(failure || "モデル別データを取得できませんでした。");
      }

      const assessment = scoring.assessNight(apiResult);
      ui.renderForecast(assessment, {
        astroAppUrl: buildAstroAppUrl(apiResult.location, assessment),
        scwUrl: buildScwUrl(apiResult.location),
        gpvUrl: buildGpvUrl(apiResult.location)
      });

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
    const dateSelection = getDateSelection();
    const windowRange = api.getNightWindow(dateSelection);
    ui.setStatus(`全地点の ${windowRange.label} 比較データを順番に取得しています...`);

    const comparisons = [];
    const failures = [];

    try {
      for (const location of config.locations) {
        try {
          ui.setStatus(`${location.name} の ${windowRange.label} を比較用に取得しています...`);
          const apiResult = await api.fetchNightForecasts(location, dateSelection);
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
      ui.renderLocationComparison(comparisons, selectedLocation.id, getLinkBuilders());

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

  function changeDateMode(event) {
    const nextMode = event.target.value;
    if (!findDateMode(nextMode) || nextMode === selectedDateMode) {
      return;
    }

    selectedDateMode = nextMode;
    if (selectedDateMode !== "custom") {
      selectedDateOffset = getSelectedDateOffset();
      storeDateMode(selectedDateMode);
    } else {
      storeDateMode("custom");
      if (!customDateKey) {
        customDateKey = api.getDateKeyForOffset(0);
      }
    }

    syncDateControls();
    ui.setWindowLabel(getSelectedNightWindow());
    ui.clearLocationComparison();
    refreshForecast();
  }

  function changeCustomDate(event) {
    if (selectedDateMode !== "custom" || !event.target.value) {
      return;
    }

    customDateKey = event.target.value;
    selectedDateOffset = getSelectedDateOffset();
    syncDateControls();
    ui.setWindowLabel(getSelectedNightWindow());
    ui.clearLocationComparison();
    refreshForecast();
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
  dateModeSelect.addEventListener("change", changeDateMode);
  customDateInput.addEventListener("change", changeCustomDate);
  locationCompareCards.addEventListener("click", switchFromComparison);
  document.addEventListener("click", openExternalWeatherLink);
  window.addEventListener("resize", ui.redrawChart);
  ui.renderLocationOptions(config.locations, selectedLocation.id);
  ui.renderDateOptions(DATE_MODES, selectedDateMode);
  syncDateControls();
  ui.setLocation(selectedLocation);
  ui.setWindowLabel(getSelectedNightWindow());
  refreshForecast();

  window.CloudAppLinks = {
    buildAstroAppUrl,
    buildScwUrl,
    buildGpvUrl
  };
})();
