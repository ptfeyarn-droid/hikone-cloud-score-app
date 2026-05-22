(function () {
  window.CloudAppConfig = {
    location: {
      label: "滋賀県彦根市",
      latitude: 35.2744,
      longitude: 136.2597,
      timezone: "Asia/Tokyo"
    },
    hourlyFields: [
      "cloud_cover",
      "cloud_cover_low",
      "cloud_cover_mid",
      "cloud_cover_high",
      "temperature_2m",
      "relative_humidity_2m",
      "dew_point_2m",
      "precipitation"
    ],
    ensembleModels: ["jma", "gfs"],
    sources: [
      {
        id: "best_match",
        label: "Best Match",
        detail: "Open-Meteo 自動選択 / 参考値",
        endpoint: "https://api.open-meteo.com/v1/forecast",
        color: "#1f7a62"
      },
      {
        id: "jma",
        label: "JMA",
        detail: "JMA MSM / GSM",
        endpoint: "https://api.open-meteo.com/v1/jma",
        color: "#2c6795"
      },
      {
        id: "gfs",
        label: "GFS",
        detail: "NOAA GFS",
        endpoint: "https://api.open-meteo.com/v1/gfs",
        color: "#6a5ea8"
      }
    ]
  };
})();
