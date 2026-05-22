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

  function getDewPointSpread(row) {
    if (!Number.isFinite(row.temperature_2m) || !Number.isFinite(row.dew_point_2m)) {
      return null;
    }

    return Math.max(0, row.temperature_2m - row.dew_point_2m);
  }

  function isThinCloudRisk(row) {
    return Number.isFinite(row.cloud_cover_high) && row.cloud_cover_high >= 65;
  }

  function isDewRisk(row) {
    const dewPointSpread = getDewPointSpread(row);
    return (
      Number.isFinite(row.relative_humidity_2m) &&
      row.relative_humidity_2m >= 88 &&
      Number.isFinite(dewPointSpread) &&
      dewPointSpread <= 2.5
    );
  }

  function calculateCloudScore(hourlyData) {
    if (!Number.isFinite(hourlyData.cloud_cover)) {
      return {
        score: null,
        scoreDetail: null,
        dewPointSpread: getDewPointSpread(hourlyData),
        warnings: []
      };
    }

    const cloudPenalty = getCloudPenalty(hourlyData);
    const humidityPenalty = getHumidityPenalty(hourlyData);
    const precipitationPenalty = getPrecipitationPenalty(hourlyData);
    const score = roundScore(100 - cloudPenalty - humidityPenalty - precipitationPenalty);
    const warnings = [];

    if (isThinCloudRisk(hourlyData)) {
      warnings.push("薄雲注意");
    }

    if (isDewRisk(hourlyData)) {
      warnings.push("結露注意");
    }

    return {
      score,
      dewPointSpread: getDewPointSpread(hourlyData),
      warnings,
      scoreDetail: {
        cloudPenalty: Math.round(cloudPenalty),
        humidityPenalty: Math.round(humidityPenalty),
        precipitationPenalty: Math.round(precipitationPenalty)
      }
    };
  }

  function scoreHour(row) {
    return {
      ...row,
      ...calculateCloudScore(row)
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

  function gradeNight(score) {
    if (!Number.isFinite(score)) {
      return {
        grade: "-",
        tone: "poor",
        label: "判定待ち"
      };
    }

    if (score >= 85) {
      return {
        grade: "A",
        tone: "good",
        label: "撮影向き"
      };
    }

    if (score >= 70) {
      return {
        grade: "B",
        tone: "good",
        label: "撮影可能"
      };
    }

    if (score >= 55) {
      return {
        grade: "C",
        tone: "watch",
        label: "短時間なら可"
      };
    }

    if (score >= 35) {
      return {
        grade: "D",
        tone: "watch",
        label: "厳しい"
      };
    }

    return {
      grade: "E",
      tone: "poor",
      label: "中止推奨"
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

        buckets.get(row.time).push(row);
      });
    });

    return Array.from(buckets.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([time, rows]) => {
        const meanScore = average(rows.map((row) => row.score));
        const dewPointSpread = average(rows.map((row) => row.dewPointSpread));
        const warnings = [];

        if (rows.some((row) => row.warnings.includes("薄雲注意"))) {
          warnings.push("薄雲注意");
        }

        if (rows.some((row) => row.warnings.includes("結露注意"))) {
          warnings.push("結露注意");
        }

        return {
          time,
          score: Number.isFinite(meanScore) ? roundScore(meanScore) : null,
          cloud_cover: average(rows.map((row) => row.cloud_cover)),
          cloud_cover_low: average(rows.map((row) => row.cloud_cover_low)),
          cloud_cover_mid: average(rows.map((row) => row.cloud_cover_mid)),
          cloud_cover_high: average(rows.map((row) => row.cloud_cover_high)),
          temperature_2m: average(rows.map((row) => row.temperature_2m)),
          relative_humidity_2m: average(rows.map((row) => row.relative_humidity_2m)),
          dew_point_2m: average(rows.map((row) => row.dew_point_2m)),
          dewPointSpread,
          precipitation: average(rows.map((row) => row.precipitation)),
          warnings
        };
      });
  }

  function addOneHour(time) {
    const [dateText, hourText] = time.split("T");
    const [year, month, day] = dateText.split("-").map(Number);
    const [hour] = hourText.split(":").map(Number);
    const next = new Date(Date.UTC(year, month - 1, day, hour + 1));
    const nextDate = [
      next.getUTCFullYear(),
      String(next.getUTCMonth() + 1).padStart(2, "0"),
      String(next.getUTCDate()).padStart(2, "0")
    ].join("-");
    return `${nextDate}T${String(next.getUTCHours()).padStart(2, "0")}:00`;
  }

  function getRangeAverage(rows) {
    return average(rows.map((row) => row.score));
  }

  function getRecommendedWindow(hourlyConsensus) {
    const validRows = hourlyConsensus.filter((row) => Number.isFinite(row.score));
    if (!validRows.length) {
      return null;
    }

    const bestScore = Math.max(...validRows.map((row) => row.score));
    const preferredFloor = Math.max(60, bestScore - 10);
    const candidates = [];
    let activeRange = [];

    validRows.forEach((row, index) => {
      const previous = validRows[index - 1];
      const isContinuous = !previous || row.time === addOneHour(previous.time);
      const isPreferred = row.score >= preferredFloor;

      if (!isContinuous || !isPreferred) {
        if (activeRange.length) {
          candidates.push(activeRange);
        }
        activeRange = [];
      }

      if (isPreferred) {
        activeRange.push(row);
      }
    });

    if (activeRange.length) {
      candidates.push(activeRange);
    }

    const rankedRanges = (candidates.length ? candidates : validRows.map((row) => [row]))
      .map((rows) => ({
        rows,
        averageScore: getRangeAverage(rows)
      }))
      .sort((left, right) => {
        if (right.rows.length !== left.rows.length) {
          return right.rows.length - left.rows.length;
        }

        return right.averageScore - left.averageScore;
      });
    const winner = rankedRanges[0];
    const start = winner.rows[0].time;
    const end = addOneHour(winner.rows[winner.rows.length - 1].time);

    return {
      start,
      end,
      averageScore: roundScore(winner.averageScore),
      hourCount: winner.rows.length
    };
  }

  function summarizeCloudLayers(hourlyConsensus) {
    return {
      total: average(hourlyConsensus.map((row) => row.cloud_cover)),
      low: average(hourlyConsensus.map((row) => row.cloud_cover_low)),
      mid: average(hourlyConsensus.map((row) => row.cloud_cover_mid)),
      high: average(hourlyConsensus.map((row) => row.cloud_cover_high))
    };
  }

  function summarizeWarnings(hourlyConsensus) {
    const thinCloudHours = hourlyConsensus.filter((row) => row.warnings.includes("薄雲注意")).length;
    const dewHours = hourlyConsensus.filter((row) => row.warnings.includes("結露注意")).length;
    const warnings = [];

    if (thinCloudHours) {
      warnings.push({
        id: "thin-cloud",
        label: "薄雲注意",
        detail: `高層雲が多い時間: ${thinCloudHours} 時間`
      });
    }

    if (dewHours) {
      warnings.push({
        id: "dew",
        label: "結露注意",
        detail: `高湿度かつ露点差が小さい時間: ${dewHours} 時間`
      });
    }

    return warnings;
  }

  function assessNight(apiResult) {
    const models = apiResult.models.map(summarizeModel);
    const modelScores = models.map((model) => model.averageScore);
    const overallAverage = average(modelScores);
    const overallScore = Number.isFinite(overallAverage) ? roundScore(overallAverage) : null;
    const hourlyConsensus = summarizeByTime(models);

    return {
      ...apiResult,
      models,
      overallScore,
      overallAssessment: describeScore(overallAverage),
      overallGrade: gradeNight(overallAverage),
      hourlyConsensus,
      recommendedWindow: getRecommendedWindow(hourlyConsensus),
      cloudLayers: summarizeCloudLayers(hourlyConsensus),
      nightWarnings: summarizeWarnings(hourlyConsensus)
    };
  }

  window.CloudAppScoring = {
    assessNight,
    calculateCloudScore,
    describeScore,
    gradeNight
  };
})();
