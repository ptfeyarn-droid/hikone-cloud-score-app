(function () {
  const config = window.CloudAppConfig;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function getTokyoDateParts(date) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: config.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const parts = formatter.formatToParts(date);
    const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return {
      year: Number(partMap.year),
      month: Number(partMap.month),
      day: Number(partMap.day)
    };
  }

  function formatDateKey(parts) {
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  }

  function addDays(parts, days) {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));

    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate()
    };
  }

  function parseDateKey(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);

    return { year, month, day };
  }

  function getDateKeyForOffset(offset = 0, referenceDate = new Date()) {
    const today = getTokyoDateParts(referenceDate);
    return formatDateKey(addDays(today, offset));
  }

  function getOffsetForDateKey(dateKey, referenceDate = new Date()) {
    const today = getTokyoDateParts(referenceDate);
    const target = parseDateKey(dateKey);
    const todayTime = Date.UTC(today.year, today.month - 1, today.day);
    const targetTime = Date.UTC(target.year, target.month - 1, target.day);
    return Math.round((targetTime - todayTime) / 86400000);
  }

  function getNightWindow(dateSelection = {}, referenceDate = new Date()) {
    const startDate = dateSelection.dateKey || getDateKeyForOffset(dateSelection.offset || 0, referenceDate);
    const startParts = parseDateKey(startDate);
    const tomorrow = addDays(startParts, 1);
    const endDate = formatDateKey(tomorrow);

    return {
      start: `${startDate}T18:00`,
      end: `${endDate}T06:00`,
      dateKey: startDate,
      label: `${startDate} 18:00 - ${endDate} 06:00`
    };
  }

  function getTonightWindow(referenceDate = new Date()) {
    return getNightWindow({ offset: 0 }, referenceDate);
  }

  function getTokyoDateKey(referenceDate = new Date()) {
    return formatDateKey(getTokyoDateParts(referenceDate));
  }

  function buildForecastUrl(source, location) {
    const url = new URL(source.endpoint);
    url.searchParams.set("latitude", location.latitude);
    url.searchParams.set("longitude", location.longitude);
    url.searchParams.set("timezone", config.timezone);
    url.searchParams.set("forecast_days", "7");
    url.searchParams.set("hourly", config.hourlyFields.join(","));
    return url.toString();
  }

  function assertForecastPayload(source, payload) {
    if (!payload || !payload.hourly || !Array.isArray(payload.hourly.time)) {
      throw new Error(`${source.label}: hourly 予報が見つかりません。`);
    }
  }

  function normalizeRows(source, payload, windowRange) {
    return payload.hourly.time
      .map((time, index) => {
        const row = {
          time,
          sourceId: source.id,
          sourceLabel: source.label,
          sourceDetail: source.detail
        };

        config.hourlyFields.forEach((field) => {
          const values = payload.hourly[field];
          row[field] = Array.isArray(values) ? values[index] : null;
        });

        return row;
      })
      .filter((row) => row.time >= windowRange.start && row.time <= windowRange.end);
  }

  async function fetchSource(source, windowRange, location) {
    const response = await fetch(buildForecastUrl(source, location));
    const payload = await response.json();

    if (!response.ok || payload.error) {
      throw new Error(payload.reason || `${source.label}: API 応答 ${response.status}`);
    }

    assertForecastPayload(source, payload);

    return {
      source,
      rows: normalizeRows(source, payload, windowRange),
      hourlyUnits: payload.hourly_units || {},
      fetchedAt: new Date().toISOString()
    };
  }

  async function fetchNightForecasts(location, dateSelection = {}) {
    const windowRange = getNightWindow(dateSelection);
    const settled = await Promise.allSettled(
      config.sources.map((source) => fetchSource(source, windowRange, location))
    );

    const models = [];
    const errors = [];

    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        models.push(result.value);
      } else {
        errors.push({
          source: config.sources[index],
          message: result.reason instanceof Error ? result.reason.message : String(result.reason)
        });
      }
    });

    return {
      location,
      windowRange,
      models,
      errors
    };
  }

  window.CloudAppApi = {
    fetchNightForecasts,
    getNightWindow,
    getTonightWindow,
    getDateKeyForOffset,
    getOffsetForDateKey,
    getTokyoDateKey
  };
})();
