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
  const weeklyOutlookCards = document.getElementById("weeklyOutlookCards");
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
  let currentForecastBundle = null;
  let currentWeeklyAssessments = [];

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
      api.getDateKeyForOffset(config.latestNightOffset)
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

  function getSelectedDateKey() {
    return getSelectedNightWindow().dateKey;
  }

  function buildWeeklyAssessments(forecastBundle) {
    return api.getUpcomingNightSelections().map((selection) => {
      const apiResult = api.buildNightForecasts(forecastBundle, { dateKey: selection.dateKey });
      return {
        ...selection,
        assessment: scoring.assessNight(apiResult)
      };
    });
  }

  function getSelectedAssessmentEntry() {
    const selectedDateKey = getSelectedDateKey();
    const weeklyEntry = currentWeeklyAssessments.find((entry) => entry.dateKey === selectedDateKey);

    if (weeklyEntry) {
      return weeklyEntry;
    }

    if (!currentForecastBundle) {
      return null;
    }

    const apiResult = api.buildNightForecasts(currentForecastBundle, { dateKey: selectedDateKey });
    return {
      dateKey: selectedDateKey,
      title: api.getNightTitle(selectedDateKey),
      dateLabel: selectedDateKey,
      windowRange: apiResult.windowRange,
      assessment: scoring.assessNight(apiResult)
    };
  }

  function renderCurrentSelection(statusMessage) {
    const selectedEntry = getSelectedAssessmentEntry();
    if (!selectedEntry) {
      return;
    }

    ui.setWindowLabel(selectedEntry.windowRange);
    ui.renderWeeklyOutlook(currentWeeklyAssessments, selectedEntry.dateKey);
    ui.renderForecast(selectedEntry.assessment, {
      astroAppUrl: buildAstroAppUrl(selectedLocation, selectedEntry.assessment),
      scwUrl: buildScwUrl(selectedLocation),
      gpvUrl: buildGpvUrl(selectedLocation)
    });

    if (statusMessage) {
      ui.setStatus(statusMessage);
      return;
    }

    if (currentForecastBundle && currentForecastBundle.errors.length) {
      const failedLabels = currentForecastBundle.errors.map((error) => error.source.label).join(", ");
      ui.setStatus(`${failedLabels} の取得に失敗しました。取得済みモデルで表示しています。`, "partial");
    } else {
      ui.setStatus("1週間の夜スコアを更新しました。カードから各夜の詳細を切り替えられます。");
    }
  }

  async function refreshForecast() {
    ui.setLoading(true);
    const dateSelection = getDateSelection();
    const windowRange = api.getNightWindow(dateSelection);
    ui.setStatus(`${selectedLocation.name} の ${windowRange.label} を Open-Meteo から取得しています...`);

    try {
      currentForecastBundle = await api.fetchForecastBundle(selectedLocation);
      ui.setLocation(selectedLocation);

      if (!currentForecastBundle.models.length) {
        const failure = currentForecastBundle.errors.map((error) => error.message).join(" / ");
        throw new Error(failure || "モデル別データを取得できませんでした。");
      }

      currentWeeklyAssessments = buildWeeklyAssessments(currentForecastBundle);
      renderCurrentSelection();
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
          const forecastBundle = await api.fetchForecastBundle(location);
          if (!forecastBundle.models.length) {
            throw new Error("モデル別データがありません。");
          }

          const apiResult = api.buildNightForecasts(forecastBundle, dateSelection);

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
    ui.clearLocationComparison();

    if (currentForecastBundle) {
      renderCurrentSelection(`${api.getNightTitle(getSelectedDateKey())}へ切り替えました。取得済みの1週間データを表示しています。`);
      return;
    }

    refreshForecast();
  }

  function changeCustomDate(event) {
    if (selectedDateMode !== "custom" || !event.target.value) {
      return;
    }

    customDateKey = event.target.value;
    selectedDateOffset = getSelectedDateOffset();
    syncDateControls();
    ui.clearLocationComparison();

    if (currentForecastBundle) {
      renderCurrentSelection(`${api.getNightTitle(customDateKey)}へ切り替えました。取得済みの1週間データを表示しています。`);
      return;
    }

    refreshForecast();
  }

  function switchWeeklyNight(event) {
    const dateButton = event.target.closest("[data-date-key]");
    if (!dateButton) {
      return;
    }

    customDateKey = dateButton.dataset.dateKey;
    selectedDateMode = "custom";
    selectedDateOffset = getSelectedDateOffset();
    storeDateMode("custom");
    syncDateControls();
    ui.clearLocationComparison();
    renderCurrentSelection(`${api.getNightTitle(customDateKey)}へ切り替えました。取得済みの1週間データを表示しています。`);
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
  weeklyOutlookCards.addEventListener("click", switchWeeklyNight);
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
