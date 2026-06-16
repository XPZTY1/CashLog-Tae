/* ═══════════════════════════════════════════════════════
   💰 Money Tracker — script.js
   ───────────────────────────────────────────────────────
   ⚠️  ตั้งค่า URL ของ Google Apps Script Web App ที่นี่
═══════════════════════════════════════════════════════ */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYaorvypKnY5WlQW8Ixu9oMYBcWsR0X9GRJQXqXvtaZN5NdhuPj5KqG4im7KBIg9s3/exec";

/* ─── State ─── */
let allTransactions = [];
let allCategories   = [];
let selectedType    = "income";
let donutChart      = null;
let barChart        = null;
let pendingDeleteId = null;

const now = new Date();
let dashboardYear  = now.getFullYear();
let dashboardMonth = now.getMonth(); // 0-indexed

/* ─── Chart color palette ─── */
const CHART_COLORS = [
  "#F43F5E","#F97316","#F59E0B","#10B981",
  "#3B82F6","#8B5CF6","#EC4899","#06B6D4",
  "#14B8A6","#84CC16","#EF4444","#A78BFA"
];

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  initDateDefaults();
  bindTabs();
  bindTypeToggle();
  bindFormSubmit();
  bindMonthNav();
  bindFilters();
  bindDeleteModal();
  bindRefreshBtn();
  checkConfig();
  fetchData();
});

/* ── ตรวจว่าใส่ URL แล้วหรือยัง ── */
function checkConfig() {
  const banner = document.getElementById("configBanner");
  if (APPS_SCRIPT_URL && APPS_SCRIPT_URL !== "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE") {
    banner.hidden = true;
  }
}

/* ── ตั้งค่าวันที่ default ── */
function initDateDefaults() {
  const today = formatDate(new Date());
  document.getElementById("inputDate").value = today;

  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  document.getElementById("filterMonth").value = ym;
}

/* ══════════════════════════════════════════════
   DATA FETCHING
══════════════════════════════════════════════ */
async function fetchData() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE") {
    loadDemoData();
    populateCategoryDropdown();
    renderAll();
    return;
  }

  // โหลด cache ก่อน → UI ไม่ว่างเปล่าตอนรีเฟรช
  const cached = localStorage.getItem("moneytracker_cache");
  if (cached) {
    try {
      const c = JSON.parse(cached);
      allTransactions = (c.transactions || []).map(normalizeTx);
      allCategories   = c.categories || [];
      populateCategoryDropdown();
      renderAll();
    } catch {}
  }

  // fetch จริงพื้นหลัง แล้วอัปเดต
  try {
    const res  = await fetch(APPS_SCRIPT_URL);
    const data = await res.json();
    allTransactions = (data.transactions || []).map(normalizeTx);
    allCategories   = data.categories || [];
    localStorage.setItem("moneytracker_cache", JSON.stringify(data));
  } catch (err) {
    console.error("fetchData error:", err);
    if (!cached) {
      showToast("โหลดข้อมูลไม่สำเร็จ", "error");
      loadDemoData();
    }
  }
  populateCategoryDropdown();
  renderAll();
}

/* ── Demo data เมื่อยังไม่มี URL ── */
function loadDemoData() {
  const base = new Date();
  allCategories = [
    {type:"expense",category:"🍔 อาหาร"},{type:"expense",category:"🚗 เดินทาง"},
    {type:"expense",category:"🛍️ ช็อปปิ้ง"},{type:"expense",category:"💡 ค่าน้ำค่าไฟ"},
    {type:"expense",category:"🎮 บันเทิง"},{type:"income",category:"💼 เงินเดือน"},
    {type:"income",category:"💸 Freelance"},{type:"income",category:"🎯 โบนัส"},
  ];
  allTransactions = [
    makeDemoTx("income","💼 เงินเดือน",35000,"เงินเดือนประจำ",base,-2),
    makeDemoTx("income","💸 Freelance",8000,"โปรเจกต์ website",base,-5),
    makeDemoTx("income","🎯 โบนัส",5000,"โบนัสกลางปี",base,-8),
    makeDemoTx("expense","🍔 อาหาร",450,"ข้าวมันไก่+กาแฟ",base,-1),
    makeDemoTx("expense","🍔 อาหาร",320,"ส้มตำ+ข้าวเหนียว",base,-3),
    makeDemoTx("expense","🚗 เดินทาง",280,"Grab ไปบริษัท",base,-2),
    makeDemoTx("expense","🛍️ ช็อปปิ้ง",1200,"เสื้อผ้า",base,-4),
    makeDemoTx("expense","💡 ค่าน้ำค่าไฟ",890,"ค่าไฟเดือนนี้",base,-6),
    makeDemoTx("expense","🎮 บันเทิง",600,"Netflix+Spotify",base,-7),
    makeDemoTx("expense","🍔 อาหาร",180,"กาแฟ",base,-1),
    makeDemoTx("expense","🚗 เดินทาง",120,"BTS",base,-3),
    makeDemoTx("income","💸 Freelance",3500,"แก้งานเพิ่มเติม",base,-14),
  ];
}

function makeDemoTx(type, category, amount, note, base, daysOffset) {
  const d = new Date(base);
  d.setDate(d.getDate() + daysOffset);
  return {
    ID: "DEMO-" + Math.random().toString(36).slice(2),
    Date: formatDate(d),
    Type: type,
    Category: category,
    Amount: amount,
    Note: note,
  };
}

function normalizeTx(t) {
  return {
    ID:       t.ID || t.id || "",
    Date:     t.Date || t.date || "",
    Type:     (t.Type || t.type || "").toLowerCase(),
    Category: t.Category || t.category || "",
    Amount:   parseFloat(t.Amount || t.amount) || 0,
    Note:     t.Note || t.note || "",
  };
}

/* ══════════════════════════════════════════════
   RENDER ALL
══════════════════════════════════════════════ */
function renderAll() {
  renderDashboard();
  renderHistoryList();
}

/* ══════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════ */
function renderDashboard() {
  // current month transactions
  const monthTx = filterByMonth(allTransactions, dashboardYear, dashboardMonth);
  const income   = monthTx.filter(t => t.Type === "income").reduce((s,t) => s + t.Amount, 0);
  const expense  = monthTx.filter(t => t.Type === "expense").reduce((s,t) => s + t.Amount, 0);
  const balance  = income - expense;

  const incomeTx  = monthTx.filter(t => t.Type === "income").length;
  const expenseTx = monthTx.filter(t => t.Type === "expense").length;

  document.getElementById("totalBalance").textContent = formatMoney(balance);
  document.getElementById("totalIncome").textContent  = formatMoney(income);
  document.getElementById("totalExpense").textContent = formatMoney(expense);
  document.getElementById("incomeSub").textContent    = `${incomeTx} รายการ`;
  document.getElementById("expenseSub").textContent   = `${expenseTx} รายการ`;
  document.getElementById("balanceSub").textContent   = income > expense ? "กำไร 🎉" : income < expense ? "ขาดทุน ⚠️" : "เท่ากัน";

  // Month label
  const monthNames = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
                      "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  document.getElementById("currentMonthLabel").textContent =
    `${monthNames[dashboardMonth]} ${dashboardYear + 543}`;

  renderDonutChart(monthTx);
  renderBarChart();
  renderRecentList(monthTx);
}

function renderDonutChart(monthTx) {
  const expenseTx = monthTx.filter(t => t.Type === "expense");
  const grouped = {};
  expenseTx.forEach(t => {
    grouped[t.Category] = (grouped[t.Category] || 0) + t.Amount;
  });

  const labels  = Object.keys(grouped);
  const values  = Object.values(grouped);
  const total   = values.reduce((a,b) => a+b, 0);
  const colors  = labels.map((_,i) => CHART_COLORS[i % CHART_COLORS.length]);

  document.getElementById("chartCenterAmount").textContent = formatMoney(total);

  const ctx = document.getElementById("expenseChart").getContext("2d");
  if (donutChart) donutChart.destroy();

  if (!labels.length) {
    donutChart = null;
    document.getElementById("expenseLegend").innerHTML = `<div style="color:var(--text-3);font-size:.78rem;text-align:center">ยังไม่มีรายจ่าย</div>`;
    return;
  }

  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
    options: {
      cutout: "68%",
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ` ${ctx.label}: ${formatMoney(ctx.raw)} (${((ctx.raw/total)*100).toFixed(1)}%)` }
      }},
      animation: { duration: 600 }
    }
  });

  // Custom legend
  const legend = document.getElementById("expenseLegend");
  legend.innerHTML = labels.slice(0,6).map((l,i) =>
    `<div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      <span class="legend-item__label">${l}</span>
      <span class="legend-item__amount">${formatMoney(values[i])}</span>
    </div>`
  ).join("");
}

function renderBarChart() {
  // 6 months up to current
  const months = [];
  const incomeData  = [];
  const expenseData = [];

  for (let i = 5; i >= 0; i--) {
    let m = dashboardMonth - i;
    let y = dashboardYear;
    while (m < 0) { m += 12; y--; }
    const txs = filterByMonth(allTransactions, y, m);
    months.push(monthShort(m));
    incomeData.push(txs.filter(t=>t.Type==="income").reduce((s,t)=>s+t.Amount,0));
    expenseData.push(txs.filter(t=>t.Type==="expense").reduce((s,t)=>s+t.Amount,0));
  }

  const ctx = document.getElementById("barChart").getContext("2d");
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: months,
      datasets: [
        { label:"รายรับ",  data: incomeData,  backgroundColor: "rgba(16,185,129,.7)", borderRadius: 4 },
        { label:"รายจ่าย", data: expenseData, backgroundColor: "rgba(244,63,94,.7)",  borderRadius: 4 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color:"#94A3B8", font:{ size:11 }, boxWidth:10 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatMoney(ctx.raw)}` }}
      },
      scales: {
        x: { ticks:{ color:"#4B5563", font:{size:11} }, grid:{ color:"rgba(255,255,255,.04)" } },
        y: { ticks:{ color:"#4B5563", font:{size:11}, callback: v => "฿"+numShort(v) }, grid:{ color:"rgba(255,255,255,.04)" } }
      },
      animation: { duration: 500 }
    }
  });
}

function renderRecentList(monthTx) {
  const sorted = [...monthTx].sort((a,b) => b.Date.localeCompare(a.Date)).slice(0,8);
  document.getElementById("recentList").innerHTML = txListHTML(sorted);
}

/* ══════════════════════════════════════════════
   HISTORY LIST
══════════════════════════════════════════════ */
function renderHistoryList() {
  let filtered = [...allTransactions];

  const filterMonth = document.getElementById("filterMonth").value;
  if (filterMonth) {
    const [fy, fm] = filterMonth.split("-").map(Number);
    filtered = filterByMonth(filtered, fy, fm-1);
  }

  const filterType = document.getElementById("filterType").value;
  if (filterType !== "all") filtered = filtered.filter(t => t.Type === filterType);

  const filterCat = document.getElementById("filterCategory").value;
  if (filterCat !== "all") filtered = filtered.filter(t => t.Category === filterCat);

  // Sort newest first
  filtered.sort((a,b) => b.Date.localeCompare(a.Date));

  // Summary
  const inc = filtered.filter(t=>t.Type==="income").reduce((s,t)=>s+t.Amount,0);
  const exp = filtered.filter(t=>t.Type==="expense").reduce((s,t)=>s+t.Amount,0);
  document.getElementById("historyCount").textContent   = `${filtered.length} รายการ`;
  document.getElementById("historyIncome").textContent  = `รายรับ ${formatMoney(inc)}`;
  document.getElementById("historyExpense").textContent = `รายจ่าย ${formatMoney(exp)}`;

  document.getElementById("historyList").innerHTML = txListHTML(filtered, true);
  bindDeleteButtons();
}

/* ── Build TX list HTML ── */
function txListHTML(txs, showDelete = false) {
  if (!txs.length) return `<div class="empty-state"><span>📭</span><p>ไม่พบรายการ</p></div>`;
  return txs.map(t => `
    <div class="tx-item ${t.Type}" data-id="${t.ID}">
      <div class="tx-icon">${categoryIcon(t.Category)}</div>
      <div class="tx-info">
        <div class="tx-category">${t.Category || "ไม่ระบุหมวดหมู่"}</div>
        ${t.Note ? `<div class="tx-note">${escHtml(t.Note)}</div>` : ""}
      </div>
      <div class="tx-date">${thaiDate(t.Date)}</div>
      <div class="tx-amount">${t.Type==="income" ? "+" : "-"}${formatMoney(t.Amount)}</div>
      ${showDelete ? `<button class="tx-delete delete-btn" data-id="${t.ID}" title="ลบรายการ">🗑</button>` : ""}
    </div>
  `).join("");
}

/* ══════════════════════════════════════════════
   FORM SUBMIT
══════════════════════════════════════════════ */
function bindFormSubmit() {
  document.getElementById("submitBtn").addEventListener("click", submitForm);
}

async function submitForm() {
  const date     = document.getElementById("inputDate").value;
  const category = document.getElementById("inputCategory").value;
  const amount   = parseFloat(document.getElementById("inputAmount").value);
  const note     = document.getElementById("inputNote").value.trim();
  const feedback = document.getElementById("formFeedback");

  // Validate
  if (!date) return showFeedback("กรุณาเลือกวันที่", "error");
  if (!category) return showFeedback("กรุณาเลือกหมวดหมู่", "error");
  if (!amount || amount <= 0) return showFeedback("กรุณากรอกจำนวนเงินที่ถูกต้อง", "error");

  const payload = { action:"add", date, type:selectedType, category, amount, note };

  setSubmitLoading(true);

  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE") {
    // Demo mode: เพิ่มข้อมูลในหน่วยความจำ
    await delay(800);
    const newTx = { ID:"LOCAL-"+Date.now(), Date:date, Type:selectedType, Category:category, Amount:amount, Note:note };
    allTransactions.unshift(newTx);
    onSubmitSuccess();
    setSubmitLoading(false);
    return;
  }

  try {
    const res  = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      localStorage.removeItem("moneytracker_cache");
      onSubmitSuccess();
      await fetchData(); // รีเฟรชข้อมูลจาก Sheets
    } else {
      showFeedback("บันทึกไม่สำเร็จ: " + (data.error || "unknown"), "error");
    }
  } catch (err) {
    showFeedback("เชื่อมต่อไม่ได้: " + err.message, "error");
  } finally {
    setSubmitLoading(false);
  }
}

function onSubmitSuccess() {
  showFeedback("✅ บันทึกสำเร็จ!", "success");
  document.getElementById("inputAmount").value = "";
  document.getElementById("inputNote").value   = "";
  renderAll();
  setTimeout(() => {
    document.getElementById("formFeedback").hidden = true;
  }, 2500);
}

function setSubmitLoading(loading) {
  const btn     = document.getElementById("submitBtn");
  const text    = document.querySelector(".submit-btn__text");
  const spinner = document.getElementById("submitSpinner");
  btn.disabled      = loading;
  text.hidden       = loading;
  spinner.hidden    = !loading;
}

function showFeedback(msg, type) {
  const el = document.getElementById("formFeedback");
  el.textContent = msg;
  el.className   = `form-feedback ${type}`;
  el.hidden      = false;
}

/* ══════════════════════════════════════════════
   DELETE
══════════════════════════════════════════════ */
function bindDeleteButtons() {
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      pendingDeleteId = btn.dataset.id;
      document.getElementById("deleteModal").hidden = false;
    });
  });
}

function bindDeleteModal() {
  document.getElementById("modalCancel").addEventListener("click", () => {
    document.getElementById("deleteModal").hidden = true;
    pendingDeleteId = null;
  });
  document.getElementById("modalConfirm").addEventListener("click", async () => {
    document.getElementById("deleteModal").hidden = true;
    if (!pendingDeleteId) return;

    if (pendingDeleteId.startsWith("DEMO-") || pendingDeleteId.startsWith("LOCAL-")) {
      allTransactions = allTransactions.filter(t => t.ID !== pendingDeleteId);
      showToast("ลบรายการแล้ว", "success");
      renderAll();
      pendingDeleteId = null;
      return;
    }

    try {
      const res  = await fetch(APPS_SCRIPT_URL, {
        method:"POST",
        body: JSON.stringify({ action:"delete", id: pendingDeleteId })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem("moneytracker_cache");
        showToast("ลบรายการแล้ว", "success");
        await fetchData();
      } else {
        showToast("ลบไม่สำเร็จ", "error");
      }
    } catch {
      showToast("เชื่อมต่อไม่ได้", "error");
    }
    pendingDeleteId = null;
  });
}

/* ══════════════════════════════════════════════
   CATEGORY DROPDOWN
══════════════════════════════════════════════ */
function populateCategoryDropdown() {
  const sel      = document.getElementById("inputCategory");
  const filtered = allCategories.filter(c => c.type === selectedType);
  sel.innerHTML  = `<option value="">— เลือกหมวดหมู่ —</option>` +
    filtered.map(c => `<option value="${c.category}">${c.category}</option>`).join("");

  // Populate filter category dropdown
  const all = [...new Set(allTransactions.map(t => t.Category))].filter(Boolean);
  const filterSel = document.getElementById("filterCategory");
  filterSel.innerHTML = `<option value="all">ทั้งหมด</option>` +
    all.map(c => `<option value="${c}">${c}</option>`).join("");
}

/* ══════════════════════════════════════════════
   TABS
══════════════════════════════════════════════ */
function bindTabs() {
  document.querySelectorAll(".tab-btn, .link-btn[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-content").forEach(s => s.classList.toggle("active", s.id === `tab-${tab}`));
  if (tab === "history") populateCategoryDropdown();
}

/* ══════════════════════════════════════════════
   TYPE TOGGLE
══════════════════════════════════════════════ */
function bindTypeToggle() {
  document.querySelectorAll(".type-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedType = btn.dataset.type;
      document.getElementById("typeIncome").classList.toggle("active",  selectedType==="income");
      document.getElementById("typeExpense").classList.toggle("active", selectedType==="expense");
      populateCategoryDropdown();
    });
  });
}

/* ══════════════════════════════════════════════
   MONTH NAV
══════════════════════════════════════════════ */
function bindMonthNav() {
  document.getElementById("prevMonth").addEventListener("click", () => {
    dashboardMonth--;
    if (dashboardMonth < 0) { dashboardMonth = 11; dashboardYear--; }
    renderDashboard();
  });
  document.getElementById("nextMonth").addEventListener("click", () => {
    dashboardMonth++;
    if (dashboardMonth > 11) { dashboardMonth = 0; dashboardYear++; }
    renderDashboard();
  });
}

/* ══════════════════════════════════════════════
   FILTERS (History)
══════════════════════════════════════════════ */
function bindFilters() {
  ["filterMonth","filterType","filterCategory"].forEach(id => {
    document.getElementById(id).addEventListener("change", renderHistoryList);
  });
  document.getElementById("clearFilterBtn").addEventListener("click", () => {
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    document.getElementById("filterMonth").value    = ym;
    document.getElementById("filterType").value     = "all";
    document.getElementById("filterCategory").value = "all";
    renderHistoryList();
  });
}

/* ══════════════════════════════════════════════
   REFRESH
══════════════════════════════════════════════ */
function bindRefreshBtn() {
  const btn = document.getElementById("refreshBtn");
  btn.addEventListener("click", async () => {
    btn.classList.add("spinning");
    await fetchData();
    btn.classList.remove("spinning");
    showToast("อัปเดตข้อมูลแล้ว ✓", "success");
  });
}

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function filterByMonth(txs, year, month) {
  return txs.filter(t => {
    if (!t.Date) return false;
    const d = new Date(t.Date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

function formatMoney(n) {
  if (!n && n !== 0) return "฿0";
  return "฿" + Math.abs(n).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function thaiDate(str) {
  if (!str) return "";
  const d = new Date(str + "T00:00:00");
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
                  "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function monthShort(m) {
  return ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
          "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."][m];
}

function numShort(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1)+"M";
  if (n >= 1000)    return (n/1000).toFixed(0)+"K";
  return n;
}

function categoryIcon(cat) {
  const first = (cat || "").match(/\p{Emoji}/u);
  return first ? first[0] : "💳";
}

function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function showToast(msg, type="") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className   = `toast ${type}`;
  t.hidden      = false;
  setTimeout(() => { t.hidden = true; }, 2500);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }