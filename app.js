const APP_VERSION = "1.1.0";
const HRC_DISPLAY_LIMIT = 500;

const state = {
  dashboard: null,
  edd: [],
  hrc: [],
  actSummary: [],
  actList: []
};

const columns = {
  dashboard: ["Metric", "Value"],
  edd: ["Policy Number", "Policyholder", "Nationality", "Broker", "High Risk Ind", "Risk Level", "Comment", "Reason", "In Table 3"],
  hrc: ["Policy No", "Issue Date", "Reason", "Comment", "Risk Level", "Broker", "Policyholder", "Nationality", "High Risk Ind"],
  actSummary: ["Date", "Ready Count", "Investigation Count"],
  actList: ["Policy No.", "Days Diff", "Remark"]
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("appVersion").textContent = APP_VERSION;
  bindNavigation();
  bindDashboardTool();
  bindCommentTool();
  bindEddTool();
  bindHrcTool();
  bindActimizeTool();
  document.getElementById("resetActiveTool").addEventListener("click", resetActiveTool);
});

function bindNavigation() {
  document.querySelectorAll("[data-tool], [data-tool-jump]").forEach((element) => {
    element.addEventListener("click", () => {
      const tool = element.dataset.tool || element.dataset.toolJump;
      showTool(tool);
    });
  });
}

function showTool(tool) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.tool === tool);
  });
  document.querySelectorAll(".tool-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tool-${tool}`);
  });
  const activePanel = document.getElementById(`tool-${tool}`);
  document.getElementById("pageTitle").textContent = activePanel?.dataset.title || "Dashboard";
}

function bindDashboardTool() {
  document.getElementById("processDashboard").addEventListener("click", () => {
    const caseIndex = excelColToIndex(document.getElementById("dashCaseCol").value);
    const sumIndex = excelColToIndex(document.getElementById("dashSumCol").value);
    const groupValue = clean(document.getElementById("dashGroupCol").value);
    const groupIndex = groupValue ? excelColToIndex(groupValue) : -1;
    const extraIndexes = parseColumnList(document.getElementById("dashExtraCols").value);
    const chartBasis = document.getElementById("dashChartBasis").value;
    const datasets = [
      { source: "Primary", rows: getDashboardRows("dashInput", [caseIndex, sumIndex, groupIndex, ...extraIndexes]) },
      { source: "Secondary", rows: getDashboardRows("dashInputSecondary", [caseIndex, sumIndex, groupIndex, ...extraIndexes]) }
    ].filter((dataset) => dataset.rows.length);
    const rows = datasets.flatMap((dataset) => dataset.rows.map((row) => ({ source: dataset.source, row })));

    if (!rows.length) {
      setStatus("dashStatus", "Paste Excel data first.");
      return;
    }

    const items = rows.map(({ source, row }) => ({
      source,
      caseNo: clean(row[caseIndex]),
      sumAssured: parseAmount(row[sumIndex]),
      group: groupIndex >= 0 ? clean(row[groupIndex]) : "",
      extras: extraIndexes.map((index) => clean(row[index]))
    })).filter((item) => item.caseNo || item.sumAssured > 0 || item.group);

    const validSums = items.map((item) => item.sumAssured).filter((value) => Number.isFinite(value));
    const caseCount = items.filter((item) => item.caseNo).length || items.length;
    const uniqueCaseCount = new Set(items.map((item) => item.caseNo).filter(Boolean)).size;
    const totalSum = validSums.reduce((sum, value) => sum + value, 0);
    const largestSum = validSums.length ? Math.max(...validSums) : 0;
    const largestCase = items.find((item) => item.sumAssured === largestSum)?.caseNo || "";
    const groupSummary = groupIndex >= 0 ? summarizeByGroup(items) : [];
    const sourceSummary = summarizeBySource(items);
    const extraSummary = summarizeExtras(items, extraIndexes);

    state.dashboard = {
      caseCount,
      uniqueCaseCount,
      totalSum,
      largestSum,
      largestCase,
      groupSummary,
      sourceSummary,
      extraSummary,
      chartBasis
    };

    renderDashboard();
    document.getElementById("copyDashboard").disabled = false;
    document.getElementById("exportDashboard").disabled = false;
    setStatus("dashStatus", `${items.length} row(s) analyzed.`);
  });

  document.getElementById("copyDashboard").addEventListener("click", async () => {
    if (!state.dashboard) return;
    await copyText(getDashboardSummary("\t"), "Dashboard summary copied.");
    setStatus("dashStatus", "Copied.");
  });

  document.getElementById("exportDashboard").addEventListener("click", () => {
    if (!state.dashboard) return;
    downloadText(`Dashboard_Summary_${timestamp()}.csv`, "\uFEFF" + getDashboardSummary(","));
  });

  document.querySelectorAll(".link-copy-item").forEach((button) => {
    button.addEventListener("click", async () => {
      await copyText(button.dataset.copyValue, "Link copied.");
    });
  });
}

function renderDashboard() {
  const { caseCount, uniqueCaseCount, totalSum, largestSum, largestCase, groupSummary, sourceSummary, extraSummary, chartBasis } = state.dashboard;
  document.getElementById("dashMetrics").innerHTML = `
    <article class="stat-card compact-stat">
      <span class="stat-value">${formatInteger(caseCount)}</span>
      <span class="stat-label">No. of cases</span>
    </article>
    <article class="stat-card compact-stat">
      <span class="stat-value">${formatAmount(totalSum)}</span>
      <span class="stat-label">Total Sum Assured</span>
    </article>
    <article class="stat-card compact-stat">
      <span class="stat-value">${formatAmount(largestSum)}</span>
      <span class="stat-label">Largest Sum Assured</span>
    </article>
  `;

  const rows = [
    ["No. of cases", formatInteger(caseCount)],
    ["Unique case no.", formatInteger(uniqueCaseCount)],
    ["Total Sum Assured", formatAmount(totalSum)],
    ["Largest Sum Assured", formatAmount(largestSum)],
    ["Largest case", largestCase || "-"]
  ];
  if (sourceSummary.length > 1) {
    rows.push(["", ""]);
    rows.push(["Source", "Cases / Total Sum Assured"]);
    sourceSummary.forEach((item) => rows.push([item.source, `${formatInteger(item.count)} / ${formatAmount(item.total)}`]));
  }
  if (extraSummary.length) {
    rows.push(["", ""]);
    rows.push(["Extra column", "Distinct non-empty values"]);
    extraSummary.forEach((item) => rows.push([item.column, formatInteger(item.distinctCount)]));
  }
  if (groupSummary.length) {
    rows.push(["", ""]);
    rows.push(["Group", "Cases / Total Sum Assured"]);
    groupSummary.forEach((item) => rows.push([item.group || "(blank)", `${formatInteger(item.count)} / ${formatAmount(item.total)}`]));
  }
  renderTable("dashResult", columns.dashboard, rows);
  renderPieChart(groupSummary, chartBasis);
}

function getDashboardSummary(separator) {
  const rows = Array.from(document.querySelectorAll("#dashResult tbody tr")).map((tr) => (
    Array.from(tr.children).map((td) => td.innerText)
  ));
  return [columns.dashboard.join(separator), ...rows.map((row) => row.join(separator))].join("\n");
}

function getDashboardRows(inputId, headerIndexes) {
  const rows = excelToArray(document.getElementById(inputId).value).filter((row) => row.some((cell) => clean(cell)));
  if (!rows.length) return [];
  return detectHeaderRow(rows, headerIndexes.filter((index) => index >= 0)) ? rows.slice(1) : rows;
}

function renderPieChart(groupSummary, chartBasis) {
  const canvas = document.getElementById("dashPieChart");
  const legend = document.getElementById("dashChartLegend");
  const status = document.getElementById("dashChartStatus");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const slices = groupSummary
    .map((item) => ({ label: item.group || "(blank)", value: chartBasis === "sum" ? item.total : item.count }))
    .filter((item) => item.value > 0);
  if (!slices.length) {
    legend.innerHTML = "";
    status.textContent = "Set a Group column and analyze data to show chart.";
    return;
  }
  const total = slices.reduce((sum, item) => sum + item.value, 0);
  const colors = ["#176b5d", "#c1842d", "#465e90", "#7f5b43", "#5e8c61", "#b75d69", "#65737e", "#9b7b35"];
  let startAngle = -Math.PI / 2;
  slices.forEach((slice, index) => {
    const angle = (slice.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(140, 140);
    ctx.arc(140, 140, 112, startAngle, startAngle + angle);
    ctx.closePath();
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();
    startAngle += angle;
  });
  ctx.beginPath();
  ctx.arc(140, 140, 54, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = "#17211f";
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(chartBasis === "sum" ? "Sum" : "Cases", 140, 136);
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.fillText(formatInteger(total), 140, 154);
  legend.innerHTML = slices.map((slice, index) => `
    <div class="legend-item">
      <span class="legend-swatch" style="background:${colors[index % colors.length]}"></span>
      <span>${escapeHTML(slice.label)}</span>
      <strong>${chartBasis === "sum" ? formatAmount(slice.value) : formatInteger(slice.value)}</strong>
    </div>
  `).join("");
  status.textContent = chartBasis === "sum" ? "Grouped by Sum Assured." : "Grouped by case count.";
}

function bindCommentTool() {
  document.getElementById("convertComment").addEventListener("click", () => {
    const input = document.getElementById("commentInput").value;
    const converted = input.split("\n").map((line) => (
      line.trim() === "Reply" ? "___________________________" : line
    )).join("\n");
    document.getElementById("commentOutput").value = converted;
    setStatus("commentStatus", converted ? "Converted." : "No input yet.");
  });

  document.getElementById("copyComment").addEventListener("click", async () => {
    const value = document.getElementById("commentOutput").value;
    if (!value) return setStatus("commentStatus", "Nothing to copy.");
    await copyText(value, "Converted comment copied.");
    setStatus("commentStatus", "Copied.");
  });
}

function bindEddTool() {
  document.getElementById("processEdd").addEventListener("click", () => {
    const start = parseDMY(document.getElementById("eddStart").value);
    const end = parseDMY(document.getElementById("eddEnd").value);
    if (!start || !end) return setStatus("eddStatus", "Enter valid DD/MM/YYYY date range.");

    const table1 = excelToArray(document.getElementById("eddTable1").value);
    const table2 = excelToArray(document.getElementById("eddTable2").value);
    const table3 = excelToArray(document.getElementById("eddTable3").value);
    const table3Set = new Set(table3.map((row) => clean(row[2])));
    const validPolicies = table1
      .filter((row) => {
        const date = parseDMY(row[0]);
        return date && date >= start && date <= end;
      })
      .map((row) => clean(row[1]))
      .filter(Boolean);

    state.edd = validPolicies.flatMap((policyNum) => {
      const detail = table2.find((row) => clean(row[1]) === policyNum);
      if (!detail) return [];
      return [{
        policyNum,
        policyholder: detail[5] || "",
        nationality: detail[22] || "",
        broker: detail[26] || "",
        highRiskInd: detail[36] || "",
        riskLevel: detail[37] || "",
        comment: detail[38] || "",
        reason: detail[39] || "",
        inTable3: table3Set.has(policyNum) ? "YES" : "NO"
      }];
    });

    renderTable("eddResult", columns.edd, state.edd.map((row) => [
      row.policyNum,
      row.policyholder,
      row.nationality,
      row.broker,
      row.highRiskInd,
      row.riskLevel,
      row.comment,
      row.reason,
      pill(row.inTable3, row.inTable3 === "YES" ? "yes" : "no")
    ]));
    document.getElementById("exportEdd").disabled = state.edd.length === 0;
    setStatus("eddStatus", `${state.edd.length} matched record(s).`);
  });

  document.getElementById("exportEdd").addEventListener("click", () => {
    exportCSV("EDD_Checking_Report", columns.edd, state.edd.map((row) => [
      row.policyNum, row.policyholder, row.nationality, row.broker, row.highRiskInd,
      row.riskLevel, row.comment, row.reason, row.inTable3
    ]));
  });
}

function bindHrcTool() {
  document.getElementById("copyHrcPath").addEventListener("click", async () => {
    await copyText(document.getElementById("hrcPath").innerText.trim(), "Report path copied.");
  });

  document.getElementById("processHrc").addEventListener("click", () => {
    const rawData = document.getElementById("hrcInput").value;
    const start = parseInt(document.getElementById("hrcStart").value, 10) || 0;
    const end = parseInt(document.getElementById("hrcEnd").value, 10) || 99999999;

    state.hrc = excelToArray(rawData).flatMap((cols) => {
      if (cols.length < 41) return [];
      const item = {
        policyNo: cols[1] || "",
        issueDateRaw: cols[12] || "",
        issueDateNum: parseInt(cols[12], 10),
        reason: cols[39] || "",
        comment: cols[38] || "",
        riskLevel: parseInt(cols[37], 10) || 0,
        broker: cols[26] || "",
        policyholder: cols[5] || "",
        nationality: cols[22] || "",
        highRiskInd: cols[36] || ""
      };
      const inDateRange = item.issueDateNum >= start && item.issueDateNum <= end;
      const isTargetRisk = item.riskLevel <= 2;
      const isEverest = item.broker.includes("Everest");
      return inDateRange && (isTargetRisk || isEverest) ? [item] : [];
    }).sort((a, b) => a.issueDateNum - b.issueDateNum);

    renderTable("hrcResult", columns.hrc, state.hrc.slice(0, HRC_DISPLAY_LIMIT).map((item) => {
      const rowClass = getHrcRowClass(item);
      return {
        className: rowClass,
        cells: [
          item.policyNo,
          item.issueDateRaw,
          item.reason,
          item.comment,
          item.riskLevel,
          item.broker,
          item.policyholder,
          item.nationality,
          item.highRiskInd
        ]
      };
    }));
    document.getElementById("exportHrc").disabled = state.hrc.length === 0;
    const shown = Math.min(state.hrc.length, HRC_DISPLAY_LIMIT);
    setStatus("hrcStatus", `${state.hrc.length} filtered record(s). Showing ${shown}. CSV export includes all records.`);
  });

  document.getElementById("exportHrc").addEventListener("click", () => {
    exportCSV("Sorted_Policy_Report_2026", columns.hrc, state.hrc.map((row) => [
      row.policyNo, row.issueDateRaw, row.reason, row.comment, row.riskLevel,
      row.broker, row.policyholder, row.nationality, row.highRiskInd
    ]));
  });
}

function bindActimizeTool() {
  document.getElementById("processActimize").addEventListener("click", () => {
    const idxDate = excelColToIndex(document.getElementById("actDateCol").value);
    const idxStatus = excelColToIndex(document.getElementById("actStatusCol").value);
    const idxPolicy = excelColToIndex(document.getElementById("actPolicyCol").value);
    const maxIdx = Math.max(idxDate, idxStatus, idxPolicy);
    const summaryMap = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    state.actList = [];

    document.getElementById("actInput").value.split("\n").forEach((row) => {
      if (!row.trim()) return;
      const cols = row.split("\t");
      if (cols.length <= maxIdx) return;
      const statusLower = clean(cols[idxStatus]).toLowerCase();
      if (statusLower !== "ready" && statusLower !== "investigation") return;

      const dateObj = parseLooseDate(cols[idxDate]);
      const dateKey = dateObj ? formatDMY(dateObj) : "Unknown Date";
      const diffDays = dateObj ? Math.ceil((today - dateObj) / 86400000) : "-";
      const isOver21 = typeof diffDays === "number" && diffDays > 21;

      summaryMap[dateKey] ||= { date: dateKey, ready: 0, investigation: 0 };
      summaryMap[dateKey][statusLower]++;
      state.actList.push({
        policyNo: extractPolicyNumber(cols[idxPolicy]),
        daysDiff: diffDays,
        remark: isOver21 ? "Over 21 Days" : ""
      });
    });

    state.actSummary = Object.values(summaryMap);
    renderActimize();
    const hasData = state.actSummary.length > 0 || state.actList.length > 0;
    document.getElementById("copyActimize").disabled = !hasData;
    document.getElementById("exportActimize").disabled = !hasData;
    setStatus("actStatus", hasData ? `${state.actList.length} policy item(s).` : "No Ready or Investigation rows found.");
  });

  document.getElementById("copyActimize").addEventListener("click", async () => {
    await copyText(getActimizeCombined("\t"), "Actimize report copied.");
    setStatus("actStatus", "Copied.");
  });

  document.getElementById("exportActimize").addEventListener("click", () => {
    downloadText(`Full_Report_${timestamp()}.csv`, "\uFEFF" + getActimizeCombined(","));
  });
}

function renderActimize() {
  const result = document.getElementById("actResult");
  result.innerHTML = `
    <div class="report-card">
      <h4>Part A: Daily Summary</h4>
      <div class="table-wrap" id="actSummaryTable"></div>
    </div>
    <div class="report-card">
      <h4>Part B: Policy List</h4>
      <div class="table-wrap" id="actListTable"></div>
    </div>
  `;
  renderTable("actSummaryTable", columns.actSummary, state.actSummary.map((row) => [
    row.date, row.ready, row.investigation
  ]));
  renderTable("actListTable", columns.actList, state.actList.map((row) => [
    row.policyNo,
    row.daysDiff,
    row.remark ? `<span class="warning-text">${escapeHTML(row.remark)}</span>` : ""
  ]));
}

function getActimizeCombined(separator) {
  let text = `Part A: Daily Summary${separator}${separator}\n`;
  text += `${columns.actSummary.join(separator)}\n`;
  state.actSummary.forEach((row) => {
    text += [row.date, row.ready, row.investigation].join(separator) + "\n";
  });
  text += "\n";
  text += `Part B: Policy List${separator}${separator}\n`;
  text += `${columns.actList.join(separator)}\n`;
  state.actList.forEach((row) => {
    text += [row.policyNo, row.daysDiff, row.remark].join(separator) + "\n";
  });
  return text;
}

function extractPolicyNumber(text) {
  return clean(text).substring(9, 17);
}

function getHrcRowClass(item) {
  const hasTrust = item.comment.includes("Trust");
  const hasG05 = item.reason.includes("G05");
  const hasG07 = item.reason.includes("G07");
  const isEverest = item.broker.includes("Everest");
  if (isEverest && item.riskLevel > 2) return "row-red";
  if (hasTrust && !hasG05) return "row-yellow";
  if (isEverest && !hasG07) return "row-green";
  return "";
}

function renderTable(targetId, headers, rows) {
  const normalizedRows = rows.map((row) => Array.isArray(row) ? { cells: row, className: "" } : row);
  const headerHTML = headers.map((header) => `<th>${escapeHTML(header)}</th>`).join("");
  const bodyHTML = normalizedRows.length
    ? normalizedRows.map((row) => {
      const cells = row.cells.map((cell) => `<td>${isSafeHTML(cell) ? cell : escapeHTML(cell)}</td>`).join("");
      return `<tr class="${row.className || ""}">${cells}</tr>`;
    }).join("")
    : `<tr><td colspan="${headers.length}">No records yet.</td></tr>`;
  document.getElementById(targetId).innerHTML = `<table><thead><tr>${headerHTML}</tr></thead><tbody>${bodyHTML}</tbody></table>`;
}

function exportCSV(name, headers, rows) {
  if (!rows.length) return;
  const csvRows = [headers, ...rows].map((row) => row.map(csvEscape).join(","));
  downloadText(`${name}_${timestamp()}.csv`, "\uFEFF" + csvRows.join("\n"));
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);
  } catch {
    showToast("Copy failed. Select the text manually.");
  }
}

function resetActiveTool() {
  const active = document.querySelector(".tool-panel.active");
  active?.querySelectorAll("textarea").forEach((item) => { item.value = ""; });
  active?.querySelectorAll(".status-text").forEach((item) => { item.textContent = ""; });
  if (active?.id === "tool-dashboard") {
    state.dashboard = null;
    document.getElementById("dashResult").innerHTML = "";
    document.getElementById("copyDashboard").disabled = true;
    document.getElementById("exportDashboard").disabled = true;
    document.getElementById("dashMetrics").innerHTML = `
      <article class="stat-card compact-stat"><span class="stat-value">0</span><span class="stat-label">No. of cases</span></article>
      <article class="stat-card compact-stat"><span class="stat-value">0</span><span class="stat-label">Total Sum Assured</span></article>
      <article class="stat-card compact-stat"><span class="stat-value">0</span><span class="stat-label">Largest Sum Assured</span></article>
    `;
    renderPieChart([], "count");
  }
  if (active?.id === "tool-edd") {
    state.edd = [];
    document.getElementById("eddResult").innerHTML = "";
    document.getElementById("exportEdd").disabled = true;
  }
  if (active?.id === "tool-hrc") {
    state.hrc = [];
    document.getElementById("hrcResult").innerHTML = "";
    document.getElementById("exportHrc").disabled = true;
  }
  if (active?.id === "tool-actimize") {
    state.actSummary = [];
    state.actList = [];
    document.getElementById("actResult").innerHTML = "";
    document.getElementById("copyActimize").disabled = true;
    document.getElementById("exportActimize").disabled = true;
  }
}

function parseDMY(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.trim().split("/");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseLooseDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  const match = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (match) {
    const date = new Date(parseInt(match[3], 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const fallback = new Date(cleaned);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function excelToArray(text) {
  if (!text.trim()) return [];
  return text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((row) => row.split("\t"));
}

function excelColToIndex(colName) {
  const col = clean(colName).toUpperCase();
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    const code = col.charCodeAt(i) - 64;
    if (code < 1 || code > 26) return 0;
    result = result * 26 + code;
  }
  return result - 1;
}

function parseColumnList(value) {
  return clean(value).split(",").map((item) => clean(item)).filter(Boolean).map(excelColToIndex);
}

function detectHeaderRow(rows, indexes) {
  const first = rows[0] || [];
  if (rows.length <= 1) return false;
  return indexes.some((index) => {
    const value = clean(first[index]);
    return value && Number.isNaN(parseAmount(value));
  });
}

function parseAmount(value) {
  const normalized = String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!normalized || normalized === "-" || normalized === ".") return Number.NaN;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function summarizeBySource(items) {
  const map = new Map();
  items.forEach((item) => {
    const current = map.get(item.source) || { source: item.source, count: 0, total: 0 };
    current.count++;
    current.total += Number.isFinite(item.sumAssured) ? item.sumAssured : 0;
    map.set(item.source, current);
  });
  return Array.from(map.values());
}

function summarizeByGroup(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = item.group || "";
    const current = map.get(key) || { group: key, count: 0, total: 0 };
    current.count++;
    current.total += Number.isFinite(item.sumAssured) ? item.sumAssured : 0;
    map.set(key, current);
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function summarizeExtras(items, extraIndexes) {
  return extraIndexes.map((index, position) => {
    const values = new Set(items.map((item) => item.extras[position]).filter(Boolean));
    return { column: indexToExcelCol(index), distinctCount: values.size };
  }).filter((item) => item.distinctCount > 0);
}

function indexToExcelCol(index) {
  let value = index + 1;
  let col = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    col = String.fromCharCode(65 + remainder) + col;
    value = Math.floor((value - 1) / 26);
  }
  return col;
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatDMY(date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function clean(value) {
  return String(value ?? "").trim();
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isSafeHTML(value) {
  return typeof value === "string" && /^<span class="(pill yes|pill no|warning-text)">/.test(value);
}

function pill(text, tone) {
  return `<span class="pill ${tone}">${escapeHTML(text)}</span>`;
}

function timestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[-T:]/g, "");
}

function setStatus(id, message) {
  document.getElementById(id).textContent = message;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}
