(function () {
  const elements = {
    refreshButton: document.getElementById("refreshButton"),
    nightWindow: document.getElementById("nightWindow"),
    statusMessage: document.getElementById("statusMessage"),
    nightSummary: document.getElementById("nightSummary"),
    modelCards: document.getElementById("modelCards"),
    chart: document.getElementById("forecastChart"),
    chartLegend: document.getElementById("chartLegend"),
    forecastRows: document.getElementById("forecastRows")
  };

  let lastAssessment = null;

  function setLoading(isLoading) {
    elements.refreshButton.disabled = isLoading;
    elements.refreshButton.setAttribute("aria-busy", String(isLoading));
  }

  function setWindowLabel(windowRange) {
    elements.nightWindow.textContent = `${windowRange.label} / Asia/Tokyo`;
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

  function renderNightSummary(assessment) {
    const scoreText = Number.isFinite(assessment.overallScore) ? assessment.overallScore : "--";
    const modelCount = assessment.models.length;
    const validHours = assessment.hourlyConsensus.filter((row) => Number.isFinite(row.score)).length;

    elements.nightSummary.hidden = false;
    elements.nightSummary.innerHTML = `
      <div class="score-panel">
        <span class="eyebrow">総合スコア</span>
        <strong class="score-value">${scoreText}</strong>
        <span class="muted">0 - 100</span>
      </div>
      <div class="score-copy">
        <span class="score-badge" data-tone="${assessment.overallAssessment.tone}">
          ${assessment.overallAssessment.label}
        </span>
        <strong>${assessment.overallAssessment.note}</strong>
        <p class="muted">${modelCount} 系列、${validHours} 時間の比較平均です。降水は強めに減点しています。</p>
      </div>
    `;
  }

  function renderModelCards(assessment) {
    elements.modelCards.innerHTML = assessment.models
      .map((model) => {
        const scoreText = Number.isFinite(model.averageScore) ? model.averageScore : "--";
        const bestHour = model.bestRow ? formatHour(model.bestRow.time) : "--";

        return `
          <article class="model-card" style="--model-color:${model.source.color}">
            <div>
              <h3>${model.source.label}</h3>
              <p class="muted">${model.source.detail}</p>
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
  }

  function renderLegend(assessment) {
    const cloudItems = assessment.models.map((model) => ({
      label: `${model.source.label} 総雲量`,
      color: model.source.color
    }));
    const items = [
      ...cloudItems,
      {
        label: "平均スコア",
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
    const rows = assessment.models
      .flatMap((model) => model.rows.map((row) => ({ ...row, source: model.source })))
      .sort((left, right) => left.time.localeCompare(right.time) || left.source.label.localeCompare(right.source.label));

    elements.forecastRows.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${formatHour(row.time)}</td>
            <td>${row.source.label}</td>
            <td>${formatValue(row.cloud_cover)}</td>
            <td>${formatValue(row.cloud_cover_low)}</td>
            <td>${formatValue(row.cloud_cover_mid)}</td>
            <td>${formatValue(row.cloud_cover_high)}</td>
            <td>${formatValue(row.relative_humidity_2m)}</td>
            <td>${formatValue(row.dew_point_2m, 1)}</td>
            <td>${formatValue(row.precipitation, 1)}</td>
            <td class="row-score">${formatValue(row.score)}</td>
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

    times.forEach((time, index) => {
      const showLabel = index === 0 || index === times.length - 1 || index % 2 === 0;
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

  function renderForecast(assessment) {
    lastAssessment = assessment;
    renderNightSummary(assessment);
    renderModelCards(assessment);
    renderLegend(assessment);
    renderRows(assessment);
    drawChart(assessment);
  }

  function redrawChart() {
    if (lastAssessment) {
      drawChart(lastAssessment);
    }
  }

  window.CloudAppUi = {
    setLoading,
    setWindowLabel,
    setStatus,
    renderForecast,
    redrawChart
  };
})();
