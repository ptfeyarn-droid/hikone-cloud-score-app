(function () {
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function safeNumber(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
  }

  function roundScore(value) {
    return Math.round(clamp(value, 0, 100));
  }

  function getCloudPenalty(row) {
    return (
      safeNumber(row.cloud_cover) * 0.5 +
      safeNumber(row.cloud_cover_low) * 0.25 +
      safeNumber(row.cloud_cover_mid) * 0.15 +
      safeNumber(row.cloud_cover_high) * 0.1
    );
  }

  function getHumidityPenalty(row) {
    const humidity = safeNumber(row.relative_humidity_2m);
    return humidity > 80 ? Math.min(14, (humidity - 80) * 0.7) : 0;
  }

  function getPrecipitationPenalty(row) {
    const precipitation = safeNumber(row.precipitation);
    return precipitation > 0 ? Math.min(60, 20 + precipitation * 35) : 0;
  }

  function scoreHour(row) {
    if (!Number.isFinite(row.cloud_cover)) {
      return {
        ...row,
        score: null,
        scoreDetail: null
      };
    }

    const cloudPenalty = getCloudPenalty(row);
    const humidityPenalty = getHumidityPenalty(row);
    const precipitationPenalty = getPrecipitationPenalty(row);
    const score = roundScore(100 - cloudPenalty - humidityPenalty - precipitationPenalty);

    return {
      ...row,
      score,
      scoreDetail: {
        cloudPenalty: Math.round(cloudPenalty),
        humidityPenalty: Math.round(humidityPenalty),
        precipitationPenalty: Math.round(precipitationPenalty)
      }
    };
  }

  function average(values) {
    const valid = values.filter(Number.isFinite);
    if (!valid.length) {
      return null;
    }

    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }

  function describeScore(score) {
    if (!Number.isFinite(score)) {
      return {
        tone: "poor",
        label: "判定待ち",
        note: "有効なスコアがありません。"
      };
    }

    if (score >= 75) {
      return {
        tone: "good",
        label: "撮影候補",
        note: "雲量と降水の見立ては比較的良好です。モデル差も確認してください。"
      };
    }

    if (score >= 45) {
      return {
        tone: "watch",
        label: "要確認",
        note: "撮影できる時間帯が混じる可能性があります。時間別の山を見てください。"
      };
    }

    return {
      tone: "poor",
      label: "厳しめ",
      note: "雲量、降水、高湿度のいずれかが強く効いています。"
    };
  }

  function summarizeModel(model) {
    const rows = model.rows.map(scoreHour);
    const validScores = rows.map((row) => row.score).filter(Number.isFinite);
    const averageScore = average(validScores);
    const shootableHours = validScores.filter((score) => score >= 70).length;
    const bestRow = rows.reduce((best, row) => {
      if (!Number.isFinite(row.score)) {
        return best;
      }

      if (!best || row.score > best.score) {
        return row;
      }

      return best;
    }, null);

    return {
      ...model,
      rows,
      averageScore: Number.isFinite(averageScore) ? roundScore(averageScore) : null,
      shootableHours,
      bestRow,
      assessment: describeScore(averageScore)
    };
  }

  function summarizeByTime(models) {
    const buckets = new Map();

    models.forEach((model) => {
      model.rows.forEach((row) => {
        if (!buckets.has(row.time)) {
          buckets.set(row.time, []);
        }

        buckets.get(row.time).push(row.score);
      });
    });

    return Array.from(buckets.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([time, scores]) => ({
        time,
        score: Number.isFinite(average(scores)) ? roundScore(average(scores)) : null
      }));
  }

  function assessNight(apiResult) {
    const models = apiResult.models.map(summarizeModel);
    const modelScores = models.map((model) => model.averageScore);
    const overallAverage = average(modelScores);
    const overallScore = Number.isFinite(overallAverage) ? roundScore(overallAverage) : null;

    return {
      ...apiResult,
      models,
      overallScore,
      overallAssessment: describeScore(overallAverage),
      hourlyConsensus: summarizeByTime(models)
    };
  }

  window.CloudAppScoring = {
    assessNight,
    describeScore
  };
})();
