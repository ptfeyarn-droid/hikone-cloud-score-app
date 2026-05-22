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

  function getTonightWindow(referenceDate = new Date()) {
    const today = getTokyoDateParts(referenceDate);
    const tomorrow = addDays(today, 1);
    const startDate = formatDateKey(today);
    const endDate = formatDateKey(tomorrow);

    return {
      start: `${startDate}T18:00`,
      end: `${endDate}T06:00`,
      label: `${startDate} 18:00 - ${endDate} 06:00`
    };
  }

  function buildForecastUrl(source, location) {
    const url = new URL(source.endpoint);
    url.searchParams.set("latitude", location.latitude);
    url.searchParams.set("longitude", location.longitude);
    url.searchParams.set("timezone", config.timezone);
    url.searchParams.set("forecast_days", "2");
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

  async function fetchNightForecasts(location) {
    const windowRange = getTonightWindow();
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
    getTonightWindow
  };
})();
