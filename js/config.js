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
      },
      {
        id: "echizen-coast",
        name: "越前海岸",
        latitude: 35.982582,
        longitude: 135.958589,
        elevation: 30
      },
      {
        id: "oi-natasho",
        name: "おおい町 名田庄",
        latitude: 35.394665,
        longitude: 135.584363,
        elevation: 210
      },
      {
        id: "kamiishizu",
        name: "上石津町",
        latitude: 35.2591873,
        longitude: 136.4714183,
        elevation: 180
      },
      {
        id: "eigenji-dam",
        name: "永源寺ダム",
        latitude: 35.07530946,
        longitude: 136.33362386,
        elevation: 278
      },
      {
        id: "ozuchi-dam",
        name: "青土ダム",
        latitude: 34.95778032,
        longitude: 136.30369742,
        elevation: 295
      },
      {
        id: "mitsue",
        name: "御杖村",
        latitude: 34.488391,
        longitude: 136.16591,
        elevation: 520
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
