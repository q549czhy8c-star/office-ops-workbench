const APP_VERSION = "2.6.0";
const HRC_DISPLAY_LIMIT = 500;
const DASHBOARD_PAGE_SIZE = 10;

const state = {
  dashboard: null,
  edd: [],
  hrc: [],
  actSummary: [],
  actList: [],
  actOverdueAlertCount: 0
};

const columns = {
  dashboard: [
    "Submission Date", "Policy Number", "Plan Name", "Status", "Broker Name", "Issue Date",
    "Policy Currency", "Sum Assured", "Payment Mode", "Modal Premium", "Risk Commencement Date", "Missing Fields"
  ],
  edd: ["Policy Number", "Policyholder", "Nationality", "Broker", "High Risk Ind", "Risk Level", "Comment", "Reason", "In Table 3"],
  hrc: [
    "Policy No", "Issue Date", "Broker",
    "Policyholder", "Policyholder Nationality", "Policyholder High Risk Ind", "Policyholder Risk Level", "Policyholder Comment", "Policyholder Reason",
    "Insured", "Insured High Risk Ind", "Insured Risk Level", "Insured Comment", "Insured Reason"
  ],
  actSummary: ["Date", "Ready Count", "Investigation Count", "Total"],
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
  renderDashboardPieFieldOptions();
  renderDashboardFilters();

  document.getElementById("processDashboard").addEventListener("click", () => {
    const dailyRows = getDashboardRows("dashDailyInput", [0, 1, 3, 8, 12, 14], 15);
    const monthlyRows = getDashboardRows("dashMonthlyInput", [0, 2, 3, 5, 6, 8], 9);

    if (!dailyRows.length) {
      setStatus("dashStatus", "Paste Daily report data first.");
      return;
    }

    const monthlyMap = new Map(monthlyRows.map((row) => [clean(row[0]), extractMonthlyRow(row)]).filter(([policyNo]) => policyNo));
    const joinedRows = dailyRows.map((row) => buildDashboardPolicyRow(row, monthlyMap));
    const filters = getDashboardFilters();
    const filteredRows = applyDashboardFilters(joinedRows, filters);
    const totalSum = filteredRows.reduce((sum, row) => sum + (Number.isFinite(row.sumAssuredNumber) ? row.sumAssuredNumber : 0), 0);
    const missingCount = filteredRows.filter((row) => row.missingFields.length).length;

    state.dashboard = {
      rows: filteredRows,
      page: 1,
      sourceCount: joinedRows.length,
      filters,
      shownCount: filteredRows.length,
      totalSum,
      missingCount,
      pieFields: getDashboardPieFields()
    };

    renderDashboard();
    document.getElementById("copyDashboard").disabled = false;
    document.getElementById("exportDashboard").disabled = false;
    setStatus("dashStatus", `${filteredRows.length} of ${joinedRows.length} policy record(s) shown.`);
  });

  document.getElementById("addDashFilter").addEventListener("click", () => {
    addDashboardFilter();
  });

  document.getElementById("dashFilters").addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-filter]");
    if (!removeButton) return;
    removeButton.closest(".filter-row").remove();
  });

  document.getElementById("dashResult").addEventListener("click", (event) => {
    const button = event.target.closest("[data-dash-page]");
    if (!button || !state.dashboard) return;
    state.dashboard.page = Number(button.dataset.dashPage);
    renderDashboardTable(state.dashboard.rows);
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
  const { rows, sourceCount, shownCount, totalSum, missingCount, pieFields } = state.dashboard;
  document.getElementById("dashMetrics").innerHTML = `
    <article class="stat-card compact-stat">
      <span class="stat-value">${formatInteger(shownCount)}</span>
      <span class="stat-label">Policies shown</span>
    </article>
    <article class="stat-card compact-stat">
      <span class="stat-value">${formatAmount(totalSum)}</span>
      <span class="stat-label">Total Sum Assured</span>
    </article>
    <article class="stat-card compact-stat">
      <span class="stat-value">${formatInteger(missingCount)}</span>
      <span class="stat-label">Missing lookup / values</span>
    </article>
  `;

  renderDashboardTable(rows);
  renderPieChart(summarizeDashboardPie(rows, pieFields), pieFields);
  if (!rows.length && sourceCount) {
    document.getElementById("dashResult").innerHTML = `<div class="empty-state">No rows matched the selected filters.</div>`;
  }
}

function getDashboardSummary(separator) {
  return [
    columns.dashboard.join(separator),
    ...state.dashboard.rows.map((row) => dashboardRowToArray(row).join(separator))
  ].join("\n");
}

function getDashboardRows(inputId, headerIndexes, maxColumns) {
  const rows = excelToArray(document.getElementById(inputId).value)
    .map((row) => row.slice(0, maxColumns))
    .filter((row) => row.some((cell) => clean(cell)));
  if (!rows.length) return [];
  return detectHeaderRow(rows, headerIndexes.filter((index) => index >= 0)) ? rows.slice(1) : rows;
}

function getDashboardPieFields() {
  const selected = Array.from(document.querySelectorAll(".dash-pie-field:checked")).map((input) => input.value);
  return selected.length ? selected : ["status"];
}

function renderDashboardPieFieldOptions() {
  document.getElementById("dashPieFields").innerHTML = dashboardFilterFields().map((item) => `
    <label>
      <input class="dash-pie-field" type="checkbox" value="${item.key}" ${item.key === "status" ? "checked" : ""}>
      ${item.label}
    </label>
  `).join("");
}

function renderDashboardFilters() {
  const container = document.getElementById("dashFilters");
  container.innerHTML = "";
  addDashboardFilter("status", "not-empty", "");
}

function addDashboardFilter(field = "status", operator = "contains", value = "", valueTo = "") {
  const container = document.getElementById("dashFilters");
  const row = document.createElement("div");
  row.className = "filter-row";
  row.innerHTML = `
    <select class="filter-field">
      ${dashboardFilterFields().map((item) => `<option value="${item.key}">${item.label}</option>`).join("")}
    </select>
    <select class="filter-operator">
      <option value="contains">Contains</option>
      <option value="equals">Equals</option>
      <option value="not-equals">Not equals</option>
      <option value="between">Between</option>
      <option value="not-between">Not between</option>
      <option value="empty">Missing / empty</option>
      <option value="not-empty">Not empty</option>
    </select>
    <input class="filter-value" type="text" placeholder="Value / from">
    <input class="filter-value-to" type="text" placeholder="To">
    <button class="ghost-button" data-remove-filter type="button">Delete</button>
  `;
  row.querySelector(".filter-field").value = field;
  row.querySelector(".filter-operator").value = operator;
  row.querySelector(".filter-value").value = value;
  row.querySelector(".filter-value-to").value = valueTo;
  container.appendChild(row);
}

function dashboardFilterFields() {
  return [
    { key: "submissionDate", label: "Submission date" },
    { key: "policyNo", label: "Policy number" },
    { key: "planName", label: "Plan name" },
    { key: "status", label: "Status" },
    { key: "brokerName", label: "Broker name" },
    { key: "issueDate", label: "Issue date" },
    { key: "currency", label: "Policy currency" },
    { key: "sumAssured", label: "Sum Assured" },
    { key: "paymentMode", label: "Payment mode" },
    { key: "modalPremium", label: "Modal premium" },
    { key: "riskCommencementDate", label: "Risk Commencement date" },
    { key: "missingFieldsText", label: "Missing fields" }
  ];
}

function getDashboardFilters() {
  return Array.from(document.querySelectorAll("#dashFilters .filter-row")).map((row) => ({
    field: row.querySelector(".filter-field").value,
    operator: row.querySelector(".filter-operator").value,
    value: clean(row.querySelector(".filter-value").value),
    valueTo: clean(row.querySelector(".filter-value-to").value)
  })).filter((filter) => {
    if (filter.operator === "empty" || filter.operator === "not-empty") return true;
    if (filter.operator === "between" || filter.operator === "not-between") return filter.value || filter.valueTo;
    return filter.value;
  });
}

function applyDashboardFilters(rows, filters) {
  if (!filters.length) return rows;
  return rows.filter((row) => filters.every((filter) => matchesDashboardFilter(row, filter)));
}

function matchesDashboardFilter(row, filter) {
  const rawValue = String(row[filter.field] ?? "");
  const value = rawValue.toLowerCase();
  const target = filter.value.toLowerCase();
  if (filter.operator === "contains") return value.includes(target);
  if (filter.operator === "equals") return value === target;
  if (filter.operator === "not-equals") return value !== target;
  if (filter.operator === "between" || filter.operator === "not-between") {
    const inRange = isDashboardValueInRange(filter.field, rawValue, filter.value, filter.valueTo);
    return filter.operator === "between" ? inRange : !inRange;
  }
  if (filter.operator === "empty") return !clean(rawValue);
  if (filter.operator === "not-empty") return !!clean(rawValue);
  return true;
}

function isDashboardValueInRange(field, value, from, to) {
  const comparable = getDashboardComparable(field, value);
  const lower = getDashboardComparable(field, from);
  const upper = getDashboardComparable(field, to);
  if (comparable === null) return false;
  if (lower !== null && comparable < lower) return false;
  if (upper !== null && comparable > upper) return false;
  return true;
}

function getDashboardComparable(field, value) {
  const cleaned = clean(value);
  if (!cleaned) return null;
  if (field === "sumAssured" || field === "modalPremium") {
    const amount = parseAmount(cleaned);
    return Number.isFinite(amount) ? amount : null;
  }
  if (field === "submissionDate" || field === "issueDate" || field === "riskCommencementDate") {
    const date = parseLooseDate(cleaned);
    return date ? date.getTime() : cleaned.toLowerCase();
  }
  return cleaned.toLowerCase();
}

function extractMonthlyRow(row) {
  return {
    policyNo: clean(row[0]),
    currency: clean(row[2]),
    sumAssured: clean(row[3]),
    sumAssuredNumber: parseAmount(row[3]),
    paymentMode: clean(row[5]),
    modalPremium: clean(row[6]),
    riskCommencementDate: clean(row[8])
  };
}

function buildDashboardPolicyRow(dailyRow, monthlyMap) {
  const policyNo = clean(dailyRow[1]);
  const monthly = monthlyMap.get(policyNo);
  const row = {
    submissionDate: clean(dailyRow[0]),
    policyNo,
    planName: clean(dailyRow[3]),
    status: clean(dailyRow[12]),
    brokerName: clean(dailyRow[8]),
    issueDate: clean(dailyRow[14]),
    currency: monthly?.currency || "",
    sumAssured: monthly?.sumAssured || "",
    sumAssuredNumber: monthly?.sumAssuredNumber ?? Number.NaN,
    paymentMode: monthly?.paymentMode || "",
    modalPremium: monthly?.modalPremium || "",
    riskCommencementDate: monthly?.riskCommencementDate || "",
    missingFields: []
  };
  const requiredFields = ["submissionDate", "policyNo", "planName", "status", "brokerName", "issueDate"];
  requiredFields.forEach((field) => {
    if (!row[field]) row.missingFields.push(field);
  });
  if (!monthly) {
    row.missingFields.push("monthly lookup");
  } else {
    ["currency", "sumAssured", "paymentMode", "modalPremium", "riskCommencementDate"].forEach((field) => {
      if (!row[field]) row.missingFields.push(field);
    });
  }
  row.missingFieldsText = row.missingFields.join(", ");
  return row;
}

function renderDashboardTable(rows) {
  const pageCount = Math.max(1, Math.ceil(rows.length / DASHBOARD_PAGE_SIZE));
  const currentPage = Math.min(Math.max(state.dashboard?.page || 1, 1), pageCount);
  if (state.dashboard) state.dashboard.page = currentPage;
  const start = (currentPage - 1) * DASHBOARD_PAGE_SIZE;
  const pageRows = rows.slice(start, start + DASHBOARD_PAGE_SIZE);
  const body = pageRows.length ? pageRows.map((row) => {
    const cells = dashboardRowToArray(row).map((value, index) => {
      const key = columns.dashboard[index];
      const field = dashboardColumnField(key);
      const missing = field && row.missingFields.includes(field);
      const className = missing || (key === "Missing Fields" && row.missingFields.length) ? "missing-cell" : "";
      return `<td class="${className}">${escapeHTML(value)}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("") : `<tr><td colspan="${columns.dashboard.length}">No records yet.</td></tr>`;
  const rangeStart = rows.length ? start + 1 : 0;
  const rangeEnd = Math.min(start + DASHBOARD_PAGE_SIZE, rows.length);
  document.getElementById("dashResult").innerHTML = `
    <table>
      <thead><tr>${columns.dashboard.map((header) => `<th>${escapeHTML(header)}</th>`).join("")}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    <div class="pagination-bar">
      <span>Showing ${formatInteger(rangeStart)}-${formatInteger(rangeEnd)} of ${formatInteger(rows.length)}</span>
      <div class="pagination-actions">
        <button class="ghost-button" data-dash-page="${currentPage - 1}" type="button" ${currentPage <= 1 ? "disabled" : ""}>Prev</button>
        <span>Page ${formatInteger(currentPage)} / ${formatInteger(pageCount)}</span>
        <button class="ghost-button" data-dash-page="${currentPage + 1}" type="button" ${currentPage >= pageCount ? "disabled" : ""}>Next</button>
      </div>
    </div>
  `;
}

function dashboardRowToArray(row) {
  return [
    row.submissionDate,
    row.policyNo,
    row.planName,
    row.status,
    row.brokerName,
    row.issueDate,
    row.currency,
    row.sumAssured,
    row.paymentMode,
    row.modalPremium,
    row.riskCommencementDate,
    row.missingFieldsText
  ];
}

function dashboardColumnField(label) {
  return {
    "Submission Date": "submissionDate",
    "Policy Number": "policyNo",
    "Plan Name": "planName",
    "Status": "status",
    "Broker Name": "brokerName",
    "Issue Date": "issueDate",
    "Policy Currency": "currency",
    "Sum Assured": "sumAssured",
    "Payment Mode": "paymentMode",
    "Modal Premium": "modalPremium",
    "Risk Commencement Date": "riskCommencementDate"
  }[label];
}

function summarizeDashboardPie(rows, fields) {
  const map = new Map();
  rows.forEach((row) => {
    const key = fields.map((field) => clean(row[field]) || "(blank)").join(" / ");
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function renderPieChart(slicesInput, pieFields) {
  const canvas = document.getElementById("dashPieChart");
  const legend = document.getElementById("dashChartLegend");
  const status = document.getElementById("dashChartStatus");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const slices = slicesInput.filter((item) => item.value > 0);
  if (!slices.length) {
    legend.innerHTML = "";
    status.textContent = "Build dashboard to show chart.";
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
  ctx.fillText("Policies", 140, 136);
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.fillText(formatInteger(total), 140, 154);
  legend.innerHTML = slices.map((slice, index) => `
    <div class="legend-item">
      <span class="legend-swatch" style="background:${colors[index % colors.length]}"></span>
      <span>${escapeHTML(slice.label)}</span>
      <strong>${formatInteger(slice.value)}</strong>
    </div>
  `).join("");
  const fieldLabels = pieFields.map((field) => dashboardFilterFields().find((item) => item.key === field)?.label || field).join(" + ");
  status.textContent = `Grouped by ${fieldLabels}.`;
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
      if (cols.length < 13) return [];
      const item = {
        policyNo: getCell(cols, 1),
        issueDateRaw: getCell(cols, 12),
        issueDateNum: parseInt(getCell(cols, 12), 10),
        broker: getCell(cols, 26),
        policyholder: getCell(cols, 5),
        policyholderNationality: getCell(cols, 21),
        policyholderHighRiskInd: getCell(cols, 36),
        policyholderRiskLevel: parseRiskLevel(getCell(cols, 37)),
        policyholderComment: getCell(cols, 38),
        policyholderReason: getCell(cols, 39),
        insured: getCell(cols, 22),
        insuredHighRiskInd: getCell(cols, 42),
        insuredRiskLevel: parseRiskLevel(getCell(cols, 44)),
        insuredComment: getCell(cols, 45),
        insuredReason: getCell(cols, 46)
      };
      const inDateRange = item.issueDateNum >= start && item.issueDateNum <= end;
      const isTargetRisk = item.policyholderRiskLevel <= 2 || item.insuredRiskLevel <= 2;
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
          item.broker,
          item.policyholder,
          item.policyholderNationality,
          item.policyholderHighRiskInd,
          formatRiskLevel(item.policyholderRiskLevel),
          item.policyholderComment,
          item.policyholderReason,
          item.insured,
          item.insuredHighRiskInd,
          formatRiskLevel(item.insuredRiskLevel),
          item.insuredComment,
          item.insuredReason
        ]
      };
    }));
    document.getElementById("exportHrc").disabled = state.hrc.length === 0;
    const shown = Math.min(state.hrc.length, HRC_DISPLAY_LIMIT);
    setStatus("hrcStatus", `${state.hrc.length} filtered record(s). Showing ${shown}. CSV export includes all records.`);
  });

  document.getElementById("exportHrc").addEventListener("click", () => {
    exportCSV("Sorted_Policy_Report_2026", columns.hrc, state.hrc.map((row) => [
      row.policyNo, row.issueDateRaw, row.broker,
      row.policyholder, row.policyholderNationality, row.policyholderHighRiskInd, formatRiskLevel(row.policyholderRiskLevel), row.policyholderComment, row.policyholderReason,
      row.insured, row.insuredHighRiskInd, formatRiskLevel(row.insuredRiskLevel), row.insuredComment, row.insuredReason
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
    const actItems = [];

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
      actItems.push({
        policyNo: extractPolicyNumber(cols[idxPolicy]),
        daysDiff: diffDays,
        remark: isOver21 ? "Over 21 Days" : "",
        isOver21
      });
    });

    state.actSummary = Object.values(summaryMap).sort((a, b) => parseSummaryDate(b.date) - parseSummaryDate(a.date));
    state.actOverdueAlertCount = actItems.filter((item) => item.isOver21).length;
    state.actList = dedupeOverduePolicies(actItems);
    renderActimize();
    const hasData = state.actSummary.length > 0 || state.actList.length > 0;
    document.getElementById("copyActimize").disabled = !hasData;
    document.getElementById("exportActimize").disabled = !hasData;
    document.getElementById("copyActSummaryEmail").disabled = !hasData;
    document.getElementById("copyActBrokerEmail").disabled = !hasData;
    setStatus("actStatus", hasData ? `${state.actOverdueAlertCount} overdue alert(s), ${state.actList.length} unique policy item(s).` : "No Ready or Investigation rows found.");
  });

  document.getElementById("copyActimize").addEventListener("click", async () => {
    await copyText(getActimizeCombined("\t"), "Actimize report copied.");
    setStatus("actStatus", "Copied.");
  });

  document.getElementById("exportActimize").addEventListener("click", () => {
    downloadText(`Full_Report_${timestamp()}.csv`, "\uFEFF" + getActimizeCombined(","));
  });

  document.getElementById("actResult").addEventListener("click", async (event) => {
    if (event.target.closest("#copyActSummaryEmail")) {
      await copyRichHTML(getActimizeSummaryEmailHTML(), getActimizeSummaryEmailText(), "Summary email copied.");
    }
    if (event.target.closest("#copyActBrokerEmail")) {
      await copyRichHTML(getActimizeBrokerEmailHTML(), getActimizeBrokerEmailText(), "Broker memo email copied.");
    }
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
    <div class="report-card email-template-card">
      <h4>Email Templates</h4>
      <div class="action-row">
        <button class="secondary-button" id="copyActSummaryEmail" type="button">Copy Summary Email</button>
        <button class="secondary-button" id="copyActBrokerEmail" type="button">Copy Broker Memo Email</button>
      </div>
      <div class="email-preview" id="actEmailPreview">${getActimizeSummaryEmailHTML()}</div>
    </div>
  `;
  renderTable("actSummaryTable", columns.actSummary, state.actSummary.map((row) => [
    row.date, row.ready, row.investigation, row.ready + row.investigation
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
  state.actSummary.forEach((row, index) => {
    const excelRow = index + 3;
    text += [row.date, row.ready, row.investigation, `=B${excelRow}+C${excelRow}`].join(separator) + "\n";
  });
  const totalRow = state.actSummary.length + 3;
  const lastDataRow = Math.max(3, totalRow - 1);
  text += ["Total", `=SUM(B3:B${lastDataRow})`, `=SUM(C3:C${lastDataRow})`, `=SUM(D3:D${lastDataRow})`].join(separator) + "\n";
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

function dedupeOverduePolicies(items) {
  const map = new Map();
  items.filter((item) => item.isOver21).forEach((item, index) => {
    const key = item.policyNo || `missing-policy-${index}`;
    const existing = map.get(key);
    if (!existing || Number(item.daysDiff) > Number(existing.daysDiff)) {
      map.set(key, { policyNo: item.policyNo, daysDiff: item.daysDiff, remark: "Over 21 Days" });
    }
  });
  return Array.from(map.values()).sort((a, b) => Number(b.daysDiff) - Number(a.daysDiff));
}

function parseSummaryDate(value) {
  const date = parseLooseDate(value);
  return date ? date.getTime() : 0;
}

function formatMonthDay(date = new Date()) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function formatMonthDayYear(date = new Date()) {
  return `${formatMonthDay(date)} ${date.getFullYear()}`;
}

function getActimizeSummaryEmailText() {
  return [
    "Hi all,",
    "",
    `Please find NBUW status as of ${formatMonthDay()} fyi:`,
    "",
    "Summary",
    getActimizeSummaryTableText(),
    "",
    `${state.actOverdueAlertCount} alerts (involves ${state.actList.length} pols) pending for broker memo`,
    getActimizeListTableText()
  ].join("\n");
}

function getActimizeBrokerEmailText() {
  return [
    "Dear Eva,",
    "",
    `Please note that as of ${formatMonthDayYear()}, NBUW have ${state.actOverdueAlertCount} unclosed overdue alerts (involves ${state.actList.length} pols) still pending for broker memo.`,
    "",
    getActimizeListTableText(),
    "",
    "Thanks.",
    "Keith"
  ].join("\n");
}

function getActimizeSummaryTableText() {
  const rows = [["Date", "Ready Count", "Investigation Count"]];
  state.actSummary.forEach((row) => rows.push([row.date, row.ready, row.investigation]));
  rows.push(["Total", sumActReady(), sumActInvestigation()]);
  return rows.map((row) => row.join("\t")).join("\n");
}

function getActimizeListTableText() {
  const rows = [["Policy No.", "Days Diff", "Remark"]];
  state.actList.forEach((row) => rows.push([row.policyNo, row.daysDiff, row.remark]));
  return rows.map((row) => row.join("\t")).join("\n");
}

function getActimizeSummaryEmailHTML() {
  return `
    <div style="color:#18231f;font-family:Arial,sans-serif;font-size:14px;">
      <p>Hi all,</p>
      <p>Please find NBUW status as of <mark style="background:#50ff43;color:#18231f;padding:0 2px;">${formatMonthDay()}</mark> fyi:</p>
      <p>Summary</p>
      ${getActimizeSummaryTableHTML()}
      <p>${state.actOverdueAlertCount} alerts (involves ${state.actList.length} pols) pending for broker memo</p>
      ${getActimizeListTableHTML()}
    </div>
  `;
}

function getActimizeBrokerEmailHTML() {
  return `
    <div style="color:#18231f;font-family:Arial,sans-serif;font-size:14px;">
      <p>Dear Eva,</p>
      <p>Please note that as of <mark style="background:#50ff43;color:#18231f;padding:0 2px;">${formatMonthDayYear()}</mark>, NBUW have ${state.actOverdueAlertCount} unclosed overdue alerts (involves ${state.actList.length} pols) still pending for broker memo.</p>
      ${getActimizeListTableHTML()}
      <p>Thanks.<br>Keith</p>
    </div>
  `;
}

function getActimizeSummaryTableHTML() {
  const body = state.actSummary.map((row) => `<tr><td style="${emailCellStyle()}">${escapeHTML(row.date)}</td><td style="${emailCellStyle("right")}">${row.ready}</td><td style="${emailCellStyle("right")}">${row.investigation}</td></tr>`).join("");
  return `
    <table class="email-table" style="${emailTableStyle()}">
      <thead><tr><th style="${emailHeaderStyle()}">Date</th><th style="${emailHeaderStyle()}">Ready Count</th><th style="${emailHeaderStyle()}">Investigation Count</th></tr></thead>
      <tbody>${body}<tr><td style="${emailCellStyle()}">Total</td><td style="${emailCellStyle("right")};background:#ffff00;">${sumActReady()}</td><td style="${emailCellStyle("right")};background:#ffff00;">${sumActInvestigation()}</td></tr></tbody>
    </table>
  `;
}

function getActimizeListTableHTML() {
  const body = state.actList.map((row) => `<tr><td style="${emailCellStyle()}">${escapeHTML(row.policyNo)}</td><td style="${emailCellStyle("right")}">${escapeHTML(row.daysDiff)}</td><td style="${emailCellStyle()}">${escapeHTML(row.remark)}</td></tr>`).join("");
  return `
    <table class="email-table" style="${emailTableStyle()}">
      <thead><tr><th style="${emailHeaderStyle()}">Policy No.</th><th style="${emailHeaderStyle()}">Days Diff</th><th style="${emailHeaderStyle()}">Remark</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function emailTableStyle() {
  return "width:auto;min-width:360px;margin:4px 0 18px;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;";
}

function emailHeaderStyle() {
  return `${emailCellStyle()};background:#c9eef7;color:#17211f;font-weight:700;`;
}

function emailCellStyle(align = "left") {
  return `padding:4px 8px;border:1px solid #17211f;text-align:${align};`;
}

function sumActReady() {
  return state.actSummary.reduce((sum, row) => sum + row.ready, 0);
}

function sumActInvestigation() {
  return state.actSummary.reduce((sum, row) => sum + row.investigation, 0);
}

function getHrcRowClass(item) {
  const comments = `${item.policyholderComment} ${item.insuredComment}`;
  const reasons = `${item.policyholderReason} ${item.insuredReason}`;
  const lowestRiskLevel = Math.min(item.policyholderRiskLevel, item.insuredRiskLevel);
  const hasTrust = comments.includes("Trust");
  const hasG05 = reasons.includes("G05");
  const hasG07 = reasons.includes("G07");
  const isEverest = item.broker.includes("Everest");
  if (isEverest && lowestRiskLevel > 2) return "row-red";
  if (hasTrust && !hasG05) return "row-yellow";
  if (isEverest && !hasG07) return "row-green";
  return "";
}

function parseRiskLevel(value) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function formatRiskLevel(value) {
  return Number.isFinite(value) ? value : "";
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

async function copyRichHTML(html, text, message) {
  if (copyRenderedHTML(html, message)) return;

  try {
    if (navigator.clipboard.write && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" })
        })
      ]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    showToast(message);
  } catch {
    await copyText(text, message);
  }
}

function copyRenderedHTML(html, message) {
  const container = document.createElement("div");
  container.className = "clipboard-email-fragment";
  container.setAttribute("contenteditable", "true");
  container.innerHTML = html;
  document.body.appendChild(container);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(container);
  selection.removeAllRanges();
  selection.addRange(range);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  selection.removeAllRanges();
  container.remove();

  if (copied) showToast(message);
  return copied;
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
      <article class="stat-card compact-stat"><span class="stat-value">0</span><span class="stat-label">Policies shown</span></article>
      <article class="stat-card compact-stat"><span class="stat-value">0</span><span class="stat-label">Total Sum Assured</span></article>
      <article class="stat-card compact-stat"><span class="stat-value">0</span><span class="stat-label">Missing lookup / values</span></article>
    `;
    renderDashboardFilters();
    renderPieChart([], ["status"]);
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
    state.actOverdueAlertCount = 0;
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

function getCell(cols, index) {
  return cols[index] || "";
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
