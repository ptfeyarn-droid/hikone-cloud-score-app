(function () {
  const elements = {
    refreshButton: document.getElementById("refreshButton"),
    compareButton: document.getElementById("compareButton"),
    locationSelect: document.getElementById("locationSelect"),
    nightTitle: document.getElementById("nightTitle"),
    nightWindow: document.getElementById("nightWindow"),
    statusMessage: document.getElementById("statusMessage"),
    locationCompare: document.getElementById("locationCompare"),
    locationCompareCards: document.getElementById("locationCompareCards"),
    verdictPanel: document.getElementById("verdictPanel"),
    nightSummary: document.getElementById("nightSummary"),
    modelCards: document.getElementById("modelCards"),
    mobileModelCards: document.getElementById("mobileModelCards"),
    chart: document.getElementById("forecastChart"),
    chartLegend: document.getElementById("chartLegend"),
    forecastRows: document.getElementById("forecastRows")
  };

  let lastAssessment = null;
  let lastComparisons = [];
  let lastAstroUrlBuilder = null;

  function setLoading(isLoading) {
    elements.refreshButton.disabled = isLoading;
    elements.refreshButton.setAttribute("aria-busy", String(isLoading));
    elements.locationSelect.disabled = isLoading;
  }

  function setCompareLoading(isLoading) {
    elements.compareButton.disabled = isLoading;
    elements.compareButton.setAttribute("aria-busy", String(isLoading));
  }

  function setWindowLabel(windowRange) {
    elements.nightWindow.textContent = `${windowRange.label} / Asia/Tokyo`;
  }

  function renderLocationOptions(locations, selectedLocationId) {
    elements.locationSelect.innerHTML = locations
      .map(
        (location) => `
          <option value="${location.id}" ${location.id === selectedLocationId ? "selected" : ""}>
            ${location.name}
          </option>
        `
      )
      .join("");
  }

  function setLocation(location) {
    elements.nightTitle.textContent = location.name;
    elements.locationSelect.value = location.id;

    if (lastComparisons.length) {
      renderLocationComparison(lastComparisons, location.id, lastAstroUrlBuilder);
    }
  }

  function setStatus(message, tone = "neutral") {
    elements.statusMessage.textContent = message;
    elements.statusMessage.dataset.tone = tone;
  }

  function formatValue(value, digits = 0) {
    if (!Number.isFinite(value)) {
      return "--";
    }

    return value.toFixed(digits);
  }

  function formatHour(time) {
    return time.slice(5).replace("T", " ");
  }

  function formatClock(time) {
    return time.slice(11);
  }

  function formatRecommendation(windowRange) {
    if (!windowRange) {
      return "おすすめ時間帯なし";
    }

    return `${formatClock(windowRange.start)}〜${formatClock(windowRange.end)}`;
  }

  function formatGambleWindow(windowRange) {
    if (!windowRange) {
      return "賭け候補なし";
    }

    return `${formatClock(windowRange.start)}〜${formatClock(windowRange.end)}`;
  }

  function getPrimaryWarning(assessment) {
    if (assessment.nightWarnings.length) {
      return assessment.nightWarnings[0].label;
    }

    if (assessment.confidence.level === "低") {
      return "予報割れ注意";
    }

    return "目立つ注意なし";
  }

  function renderLocationComparison(comparisons, selectedLocationId, buildAstroAppUrl) {
    lastComparisons = comparisons;
    lastAstroUrlBuilder = buildAstroAppUrl;
    elements.locationCompare.hidden = false;
    elements.locationCompareCards.innerHTML = comparisons
      .map((item) => {
        const assessment = item.assessment;
        const isSelected = item.location.id === selectedLocationId;

        return `
          <article class="location-compare-card ${isSelected ? "is-selected" : ""}">
            <button class="location-switch-button" type="button" data-location-id="${item.location.id}">
              ${item.location.name}
            </button>
            <div class="compare-grade">
              <strong>${assessment.overallGrade.grade}</strong>
              <span>${assessment.overallGrade.label}</span>
            </div>
            <dl>
              <div><dt>総合スコア</dt><dd>${formatValue(assessment.overallScore)}</dd></div>
              <div><dt>おすすめ</dt><dd>${formatRecommendation(assessment.recommendedWindow)}</dd></div>
              <div><dt>賭け候補</dt><dd>${formatGambleWindow(assessment.gambleWindow)}</dd></div>
              <div><dt>信頼度</dt><dd>${assessment.confidence.level}</dd></div>
              <div><dt>最大差</dt><dd>${formatValue(assessment.modelDifference.maxDifference)}${Number.isFinite(assessment.modelDifference.maxDifference) ? "%" : ""}</dd></div>
              <div><dt>主な注意</dt><dd>${getPrimaryWarning(assessment)}</dd></div>
            </dl>
            <a class="astro-app-link" href="${buildAstroAppUrl(item.location)}">
              この地点で天文条件を見る
            </a>
          </article>
        `;
      })
      .join("");
  }

  function renderVerdict(assessment) {
    const lowConfidenceCallout = (
      (assessment.overallGrade.grade === "D" || assessment.overallGrade.grade === "E") &&
      assessment.confidence.level === "低"
    )
      ? '<span class="warning-chip urgent-callout"><strong>直前の空・衛星画像確認推奨</strong></span>'
      : "";
    const nearFieldCallout = (
      (assessment.overallGrade.grade === "D" || assessment.overallGrade.grade === "E") &&
      assessment.gambleWindow
    )
      ? '<span class="warning-chip near-field-callout"><strong>遠征は非推奨。ただし自宅・近場なら直前確認の価値あり</strong></span>'
      : "";
    const warnings = assessment.nightWarnings.length
      ? assessment.nightWarnings
          .map(
            (warning) => `
              <span class="warning-chip" data-kind="${warning.id}">
                <strong>${warning.label}</strong>
                ${warning.detail}
              </span>
            `
          )
          .join("")
      : '<span class="clear-chip">目立つ注意フラグなし</span>';

    elements.verdictPanel.hidden = false;
    elements.verdictPanel.innerHTML = `
      <div class="grade-block" data-tone="${assessment.overallGrade.tone}">
        <span class="eyebrow">今夜の総合判定</span>
        <div class="grade-line">
          <strong>${assessment.overallGrade.grade}</strong>
          <span>${assessment.overallGrade.label}</span>
        </div>
        <div class="mobile-score-inline">
          <span class="eyebrow">総合スコア</span>
          <strong>${Number.isFinite(assessment.overallScore) ? assessment.overallScore : "--"}</strong>
          <span>JMA / GFS 集計</span>
        </div>
      </div>
      <div class="verdict-copy">
        <div class="verdict-metrics">
          <div class="window-metric">
            <span class="eyebrow">おすすめ時間帯</span>
            <strong class="recommendation">${formatRecommendation(assessment.recommendedWindow)}</strong>
          </div>
          <div class="window-metric gamble-metric">
            <span class="eyebrow">賭け候補時間帯</span>
            <strong class="recommendation">${formatGambleWindow(assessment.gambleWindow)}</strong>
            <span class="muted">${assessment.gambleWindow ? `理由: ${assessment.gambleWindow.reason}` : "片方のモデルだけ良い時間はありません。"}</span>
          </div>
          <div class="confidence-block" data-tone="${assessment.confidence.tone}">
            <span class="eyebrow">信頼度</span>
            <strong>${assessment.confidence.level}</strong>
            <div class="difference-summary">
              <span>最大差 <strong>${formatValue(assessment.modelDifference.maxDifference)}${Number.isFinite(assessment.modelDifference.maxDifference) ? "%" : ""}</strong></span>
              <span>予報割れ <strong>${assessment.modelDifference.splitTotal} 時間</strong></span>
              <span>最大差時刻 <strong>${assessment.modelDifference.maxDifferenceTime ? formatHour(assessment.modelDifference.maxDifferenceTime) : "--"}</strong></span>
            </div>
          </div>
        </div>
        <p class="muted">JMA と GFS の平均スコアが 70 点以上の連続区間だけをおすすめ候補にしています。</p>
        <p class="muted">${assessment.confidence.note}</p>
        <div class="warning-row">${warnings}${lowConfidenceCallout}${nearFieldCallout}</div>
      </div>
    `;
  }

  function renderCloudLayers(assessment) {
    const layers = [
      { label: "総雲量", value: assessment.cloudLayers.total },
      { label: "低層雲", value: assessment.cloudLayers.low },
      { label: "中層雲", value: assessment.cloudLayers.mid },
      { label: "高層雲", value: assessment.cloudLayers.high }
    ];

    return `
      <div class="cloud-layer-grid" aria-label="雲量内訳">
        ${layers
          .map(
            (layer) => `
              <div class="cloud-layer">
                <span>${layer.label}</span>
                <strong>${formatValue(layer.value)}%</strong>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  function renderNightSummary(assessment) {
    const scoreText = Number.isFinite(assessment.overallScore) ? assessment.overallScore : "--";
    const modelCount = assessment.ensembleModels.length;
    const validHours = assessment.hourlyConsensus.filter((row) => Number.isFinite(row.score)).length;

    elements.nightSummary.hidden = false;
    elements.nightSummary.innerHTML = `
      <div class="score-panel">
        <span class="eyebrow">総合スコア</span>
        <strong class="score-value">${scoreText}</strong>
        <span class="muted">JMA / GFS 集計 0 - 100</span>
      </div>
      <div class="score-copy">
        <span class="score-badge" data-tone="${assessment.overallAssessment.tone}">
          ${assessment.overallAssessment.label}
        </span>
        <strong>${assessment.overallAssessment.note}</strong>
        <p class="muted">${modelCount} 系列、${validHours} 時間の比較平均です。Best Match は参考表示で集計には含めません。</p>
        ${renderCloudLayers(assessment)}
      </div>
    `;
  }

  function renderModelCards(assessment) {
    const cards = assessment.models
      .map((model) => {
        const scoreText = Number.isFinite(model.averageScore) ? model.averageScore : "--";
        const bestHour = model.bestRow ? formatHour(model.bestRow.time) : "--";

        return `
          <article class="model-card" style="--model-color:${model.source.color}">
            <div>
              <h3>${model.source.label}</h3>
              <p class="muted">${model.source.detail}</p>
              ${model.isEnsemble ? "" : '<span class="reference-tag">参考表示</span>'}
            </div>
            <div class="model-score">
              <strong>${scoreText}</strong>
              <span class="mini-badge" data-tone="${model.assessment.tone}">${model.assessment.label}</span>
            </div>
            <p class="muted">70 点以上: ${model.shootableHours} 時間 / 最高候補: ${bestHour}</p>
          </article>
        `;
      })
      .join("");

    elements.modelCards.innerHTML = cards;
    elements.mobileModelCards.innerHTML = cards;
  }

  function renderLegend(assessment) {
    const cloudItems = assessment.models.map((model) => ({
      label: `${model.source.label} 総雲量`,
      color: model.source.color
    }));
    const items = [
      ...cloudItems,
      {
        label: "JMA / GFS 平均スコア",
        color: "#b56a16"
      }
    ];

    elements.chartLegend.innerHTML = items
      .map(
        (item) => `
          <span class="legend-item">
            <span class="legend-line" style="--legend-color:${item.color}"></span>
            ${item.label}
          </span>
        `
      )
      .join("");
  }

  function renderRows(assessment) {
    elements.forecastRows.innerHTML = assessment.comparisonRows
      .map(
        (row) => `
          <tr>
            <td>${formatHour(row.time)}</td>
            <td>${formatValue(row.jmaCloudCover)}</td>
            <td>${formatValue(row.gfsCloudCover)}</td>
            <td class="${row.modelDifference >= 40 ? "difference-alert" : "difference-stable"}">
              ${formatValue(row.modelDifference)}${Number.isFinite(row.modelDifference) ? "%" : ""}
              ${row.modelDifferenceLabel ? `<span>${row.modelDifferenceLabel}</span>` : ""}
            </td>
            <td>${formatValue(row.jmaScore)}</td>
            <td>${formatValue(row.gfsScore)}</td>
            <td class="row-score">${formatValue(row.averageScore)}</td>
            <td>${formatValue(row.relative_humidity_2m)}</td>
            <td>${formatValue(row.dewPointSpread, 1)}</td>
            <td>${row.warnings.length ? row.warnings.join(" / ") : "--"}</td>
          </tr>
        `
      )
      .join("");
  }

  function resizeCanvas(canvas) {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(canvas.clientWidth, 320);
    const height = Math.max(canvas.clientHeight, 260);

    canvas.width = Math.floor(width * devicePixelRatio);
    canvas.height = Math.floor(height * devicePixelRatio);

    const context = canvas.getContext("2d");
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    return { context, width, height };
  }

  function drawGrid(context, width, height, plot) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#e8dfcf";
    context.lineWidth = 1;
    context.font = '12px "Segoe UI", sans-serif';
    context.fillStyle = "#5c655e";

    [0, 25, 50, 75, 100].forEach((value) => {
      const y = plot.bottom - (value / 100) * plot.height;
      context.beginPath();
      context.moveTo(plot.left, y);
      context.lineTo(plot.right, y);
      context.stroke();
      context.fillText(String(value), 8, y + 4);
    });
  }

  function getX(index, count, plot) {
    if (count <= 1) {
      return plot.left + plot.width / 2;
    }

    return plot.left + (index / (count - 1)) * plot.width;
  }

  function drawLine(context, rows, valueKey, color, plot, options = {}) {
    context.save();
    context.strokeStyle = color;
    context.lineWidth = options.lineWidth || 2.5;
    context.setLineDash(options.dashed ? [8, 6] : []);
    context.beginPath();

    let drawing = false;

    rows.forEach((row, index) => {
      const value = row[valueKey];
      if (!Number.isFinite(value)) {
        drawing = false;
        return;
      }

      const x = getX(index, rows.length, plot);
      const y = plot.bottom - (value / 100) * plot.height;

      if (!drawing) {
        context.moveTo(x, y);
        drawing = true;
      } else {
        context.lineTo(x, y);
      }
    });

    context.stroke();
    context.restore();
  }

  function drawXAxis(context, times, plot) {
    context.save();
    context.fillStyle = "#5c655e";
    context.font = '12px "Segoe UI", sans-serif';
    const labelStep = plot.width < 340 ? 4 : plot.width < 520 ? 3 : 2;

    times.forEach((time, index) => {
      const showLabel = index === 0 || index === times.length - 1 || index % labelStep === 0;
      if (!showLabel) {
        return;
      }

      const x = getX(index, times.length, plot);
      context.fillText(time.slice(11), Math.max(0, x - 14), plot.bottom + 22);
    });

    context.restore();
  }

  function drawChart(assessment) {
    const times = assessment.hourlyConsensus.map((row) => row.time);
    if (!times.length) {
      return;
    }

    const { context, width, height } = resizeCanvas(elements.chart);
    const plot = {
      left: 44,
      right: width - 18,
      top: 18,
      bottom: height - 42
    };
    plot.width = plot.right - plot.left;
    plot.height = plot.bottom - plot.top;

    drawGrid(context, width, height, plot);
    drawXAxis(context, times, plot);

    assessment.models.forEach((model) => {
      drawLine(context, model.rows, "cloud_cover", model.source.color, plot);
    });

    drawLine(context, assessment.hourlyConsensus, "score", "#b56a16", plot, {
      dashed: true,
      lineWidth: 3
    });
  }

  function renderForecast(assessment, astroAppUrl) {
    lastAssessment = assessment;
    renderVerdict(assessment);
    renderNightSummary(assessment);
    renderAstroAppLink(astroAppUrl);
    renderModelCards(assessment);
    renderLegend(assessment);
    renderRows(assessment);
    drawChart(assessment);
  }

  function renderAstroAppLink(astroAppUrl) {
    if (!astroAppUrl) {
      return;
    }

    const button = `
      <a class="astro-app-link detail-astro-link" href="${astroAppUrl}">
        この地点で天文条件を見る
      </a>
    `;
    elements.verdictPanel.insertAdjacentHTML("beforeend", button);
  }

  function redrawChart() {
    if (lastAssessment) {
      drawChart(lastAssessment);
    }
  }

  window.CloudAppUi = {
    setLoading,
    setCompareLoading,
    renderLocationOptions,
    renderLocationComparison,
    setLocation,
    setWindowLabel,
    setStatus,
    renderForecast,
    redrawChart
  };
})();
