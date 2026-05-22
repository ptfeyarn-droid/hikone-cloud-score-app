(function () {
  window.CloudAppConfig = {
    timezone: "Asia/Tokyo",
    astroAppUrl: "https://ptfeyarn-droid.github.io/hikone-astro-app/",
    defaultLocationId: "hikone",
    locations: [
      {
        id: "hikone",
        name: "彦根市",
        latitude: 35.2744,
        longitude: 136.2597,
        elevation: 95
      },
      {
        id: "taga",
        name: "多賀町",
        latitude: 35.2241,
        longitude: 136.2907,
        elevation: 140
      },
      {
        id: "maibara",
        name: "米原市",
        latitude: 35.3167,
        longitude: 136.2833,
        elevation: 105
      },
      {
        id: "nagahama",
        name: "長浜市",
        latitude: 35.3815,
        longitude: 136.2755,
        elevation: 85
      },
      {
        id: "yogo",
        name: "余呉",
        latitude: 35.55,
        longitude: 136.2,
        elevation: 150
      },
      {
        id: "suzuka-foothills",
        name: "鈴鹿山麓候補地",
        latitude: 35.235,
        longitude: 136.34,
        elevation: 320
      }
    ],
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
