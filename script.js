/* ═══════════════════════════════════════════════════════
   💰 Money Tracker — script.js
   ───────────────────────────────────────────────────────
   ⚠️  ตั้งค่า URL ของ Google Apps Script Web App ที่นี่
═══════════════════════════════════════════════════════ */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYaorvypKnY5WlQW8Ixu9oMYBcWsR0X9GRJQXqXvtaZN5NdhuPj5KqG4im7KBIg9s3/exec";


/* ─── State ─── */
let allTransactions = [];
let allCategories = [];
let selectedType = "income";
let donutChart = null;
let barChartInstance = null;
let pendingDeleteId = null;

const now = new Date();
let dashboardYear = now.getFullYear();
let dashboardMonth = now.getMonth(); // 0-indexed

const MONTH_NAMES = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const CHART_COLORS = ["#FB7185", "#F472B6", "#8b98fa", "#818CF8", "#34D399", "#6EE7B7", "#FBBF24", "#F97316", "#EC4899", "#8B5CF6", "#06B6D4", "#14B8A6"];

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
  fetchData();
  if (window.lucide) lucide.createIcons();
});

function initDateDefaults() {
  document.getElementById("inputDate").value = formatDate(new Date());
  const timeEl = document.getElementById("inputTime");
  if (timeEl) timeEl.value = formatTime(new Date());
  document.getElementById("filterMonth").value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/* ══════════════════════════════════════════════
   DATA FETCHING (Apps Script + cache + demo fallback)
══════════════════════════════════════════════ */
async function fetchData() {
  if (!APPS_SCRIPT_URL) {
    loadDemoData();
    populateCategoryDropdown();
    renderAll();
    return;
  }

  // โหลด cache ก่อน → UI ไม่ว่างเปล่าตอนรีเฟรช
  let cached = null;
  try { cached = localStorage.getItem("moneytracker_cache"); } catch { cached = null; }
  if (cached) {
    try {
      const c = JSON.parse(cached);
      allTransactions = (c.transactions || []).map(normalizeTx);
      allCategories = c.categories || [];
      populateCategoryDropdown();
      renderAll();
    } catch { /* cache เสีย ข้ามไป */ }
  }

  // fetch จริงจาก Apps Script แล้วอัปเดต
  try {
    const res = await fetch(APPS_SCRIPT_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allTransactions = (data.transactions || []).map(normalizeTx);
    allCategories = data.categories || [];
    try { localStorage.setItem("moneytracker_cache", JSON.stringify(data)); } catch { }
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

/* ── Demo data สำหรับกรณียังไม่ตั้งค่า URL หรือเชื่อมต่อไม่ได้ ── */
function loadDemoData() {
  const base = new Date();
  allCategories = [
    { type: "expense", category: "🍔 อาหาร" }, { type: "expense", category: "🚗 เดินทาง" },
    { type: "expense", category: "🛍️ ช็อปปิ้ง" }, { type: "expense", category: "💡 ค่าน้ำค่าไฟ" },
    { type: "expense", category: "🎮 บันเทิง" }, { type: "income", category: "💼 เงินเดือน" },
    { type: "income", category: "💸 Freelance" }, { type: "income", category: "🎯 โบนัส" },
  ];
  allTransactions = [
    makeDemoTx("income", "💼 เงินเดือน", 35000, "เงินเดือนประจำ", base, -2),
    makeDemoTx("income", "💸 Freelance", 8000, "โปรเจกต์ website", base, -5),
    makeDemoTx("income", "🎯 โบนัส", 5000, "โบนัสกลางปี", base, -8),
    makeDemoTx("expense", "🍔 อาหาร", 450, "ข้าวมันไก่+กาแฟ", base, -1),
    makeDemoTx("expense", "🍔 อาหาร", 320, "ส้มตำ+ข้าวเหนียว", base, -3),
    makeDemoTx("expense", "🚗 เดินทาง", 280, "Grab ไปบริษัท", base, -2),
    makeDemoTx("expense", "🛍️ ช็อปปิ้ง", 1200, "เสื้อผ้า", base, -4),
    makeDemoTx("expense", "💡 ค่าน้ำค่าไฟ", 890, "ค่าไฟเดือนนี้", base, -6),
    makeDemoTx("expense", "🎮 บันเทิง", 600, "Netflix+Spotify", base, -7),
    makeDemoTx("expense", "🍔 อาหาร", 180, "ชานมไข่มุก 🧋", base, -1),
  ];
}

function makeDemoTx(type, category, amount, note, base, offset) {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return { ID: "D-" + Math.random().toString(36).slice(2), Date: `${formatDate(d)}T${formatTime(d)}`, Type: type, Category: category, Amount: amount, Note: note };
}

function normalizeTx(t) {
  return {
    ID: t.ID || t.id || "",
    Date: t.Date || t.date || "",
    Type: (t.Type || t.type || "").toLowerCase(),
    Category: t.Category || t.category || "",
    Amount: parseFloat(t.Amount ?? t.amount) || 0,
    Note: t.Note || t.note || "",
  };
}

/* ══════════════════════════════════════════════
   RENDER ALL
══════════════════════════════════════════════ */
function renderAll() {
  renderDashboard();
  renderHistoryList();
}

function renderDashboard() {
  const monthTx = filterByMonth(allTransactions, dashboardYear, dashboardMonth);
  const income = monthTx.filter(t => t.Type === "income").reduce((s, t) => s + t.Amount, 0);
  const expense = monthTx.filter(t => t.Type === "expense").reduce((s, t) => s + t.Amount, 0);

  document.getElementById("totalBalance").textContent = formatMoney(income - expense);
  document.getElementById("totalIncome").textContent = formatMoney(income);
  document.getElementById("totalExpense").textContent = formatMoney(expense);
  document.getElementById("incomeSub").textContent = `${monthTx.filter(t => t.Type === "income").length} รายการ`;
  document.getElementById("expenseSub").textContent = `${monthTx.filter(t => t.Type === "expense").length} รายการ`;
  document.getElementById("balanceSub").textContent = income > expense ? "กำไร 🎉" : income < expense ? "ขาดทุน ⚠️" : "เท่ากัน";
  document.getElementById("currentMonthLabel").textContent = `${MONTH_NAMES[dashboardMonth]} ${dashboardYear + 543}`;

  renderDonut(monthTx);
  renderBar();
  renderRecent(monthTx);
}

function renderDonut(monthTx) {
  const exp = monthTx.filter(t => t.Type === "expense");
  const grouped = {};
  exp.forEach(t => { grouped[t.Category] = (grouped[t.Category] || 0) + t.Amount; });

  const labels = Object.keys(grouped);
  const values = Object.values(grouped);
  const total = values.reduce((a, b) => a + b, 0);
  const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

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
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${formatMoney(c.raw)}` } }
      },
      animation: { duration: 600 }
    }
  });

  document.getElementById("expenseLegend").innerHTML = labels.slice(0, 6).map((l, i) =>
    `<div class="legend-item">
          <div class="legend-dot" style="background:${colors[i]}"></div>
          <span class="legend-item__label">${l}</span>
          <span class="legend-item__amount">${formatMoney(values[i])}</span>
        </div>`
  ).join("");
}

function renderBar() {
  const months = [], incD = [], expD = [];
  for (let i = 5; i >= 0; i--) {
    let m = dashboardMonth - i, y = dashboardYear;
    while (m < 0) { m += 12; y--; }
    const tx = filterByMonth(allTransactions, y, m);
    months.push(MONTH_NAMES[m]);
    incD.push(tx.filter(t => t.Type === "income").reduce((s, t) => s + t.Amount, 0));
    expD.push(tx.filter(t => t.Type === "expense").reduce((s, t) => s + t.Amount, 0));
  }

  const ctx = document.getElementById("barChart").getContext("2d");
  if (barChartInstance) barChartInstance.destroy();
  barChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: months,
      datasets: [
        { label: "รายรับ", data: incD, backgroundColor: "rgba(52,211,153,.7)", borderRadius: 6 },
        { label: "รายจ่าย", data: expD, backgroundColor: "rgba(251,113,133,.7)", borderRadius: 6 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#4c629d", font: { size: 11 }, boxWidth: 10 } } },
      scales: {
        x: { ticks: { color: "#656ba8", font: { size: 11 } }, grid: { color: "rgba(236,72,153,.06)" } },
        y: { ticks: { color: "#ada0d4", font: { size: 11 }, callback: v => "฿" + numShort(v) }, grid: { color: "rgba(236,72,153,.06)" } }
      },
      animation: { duration: 500 }
    }
  });
}

function renderRecent(monthTx) {
  const sorted = [...monthTx].sort((a, b) => b.Date.localeCompare(a.Date)).slice(0, 8);
  document.getElementById("recentList").innerHTML = txHTML(sorted);
}

/* ══════════════════════════════════════════════
   HISTORY LIST
══════════════════════════════════════════════ */
function renderHistoryList() {
  let f = [...allTransactions];

  const fm = document.getElementById("filterMonth").value;
  if (fm) {
    const [fy, fmo] = fm.split("-").map(Number);
    f = filterByMonth(f, fy, fmo - 1);
  }

  const ft = document.getElementById("filterType").value;
  if (ft !== "all") f = f.filter(t => t.Type === ft);

  const fc = document.getElementById("filterCategory").value;
  if (fc !== "all") f = f.filter(t => t.Category === fc);

  f.sort((a, b) => b.Date.localeCompare(a.Date));

  const inc = f.filter(t => t.Type === "income").reduce((s, t) => s + t.Amount, 0);
  const exp = f.filter(t => t.Type === "expense").reduce((s, t) => s + t.Amount, 0);
  document.getElementById("historyCount").textContent = `${f.length} รายการ`;
  document.getElementById("historyIncome").textContent = `รายรับ ${formatMoney(inc)}`;
  document.getElementById("historyExpense").textContent = `รายจ่าย ${formatMoney(exp)}`;

  document.getElementById("historyList").innerHTML = txHTML(f, true);
  bindDeleteButtons();
}

function txHTML(txs, showDelete = false) {
  if (!txs.length) return `<div class="empty-state"><span>🗿</span><p>ไม่พบรายการ</p></div>`;
  return txs.map(t => `
        <div class="tx-item ${t.Type}">
          <div class="tx-icon">${categoryIcon(t.Category)}</div>
          <div class="tx-info">
            <div class="tx-category">${t.Category || "ไม่ระบุหมวดหมู่"}</div>
            ${t.Note ? `<div class="tx-note">${escHtml(t.Note)}</div>` : ""}
          </div>
          <div class="tx-date">${thaiDate(t.Date)}</div>
          <div class="tx-amount">${t.Type === "income" ? "+" : "-"}${formatMoney(t.Amount)}</div>
          ${showDelete ? `<button class="tx-delete delete-btn" data-id="${t.ID}" title="ลบรายการ">✕</button>` : ""}
        </div>
      `).join("");
}

/* ══════════════════════════════════════════════
   FORM SUBMIT
══════════════════════════════════════════════ */
function bindFormSubmit() {
  document.getElementById("submitBtn").addEventListener("click", e => {
    e.preventDefault();
    submitForm();
  });
}

async function submitForm() {
  const date = document.getElementById("inputDate").value;
  const timeEl = document.getElementById("inputTime");
  const time = timeEl ? timeEl.value : "";
  const fullDate = time ? `${date}T${time}` : date;
  const category = document.getElementById("inputCategory").value;
  const amount = parseFloat(document.getElementById("inputAmount").value);
  const note = document.getElementById("inputNote").value.trim();

  if (!date) return showFeedback("กรุณาเลือกวันที่", "error");
  if (!category) return showFeedback("กรุณาเลือกหมวดหมู่", "error");
  if (!amount || amount <= 0) return showFeedback("กรุณากรอกจำนวนเงินที่ถูกต้อง", "error");

  setLoading(true);

  if (!APPS_SCRIPT_URL) {
    // Demo mode: เพิ่มข้อมูลในหน่วยความจำเท่านั้น
    await delay(600);
    allTransactions.unshift({ ID: "L-" + Date.now(), Date: fullDate, Type: selectedType, Category: category, Amount: amount, Note: note });
    onSubmitSuccess();
    setLoading(false);
    return;
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "add", date: fullDate, type: selectedType, category, amount, note }),
    });
    const data = await res.json();
    if (data.success) {
      try { localStorage.removeItem("moneytracker_cache"); } catch { }
      onSubmitSuccess();
      await fetchData(); // รีเฟรชข้อมูลจาก Sheets
    } else {
      showFeedback("บันทึกไม่สำเร็จ: " + (data.error || "unknown"), "error");
    }
  } catch (err) {
    showFeedback("เชื่อมต่อไม่ได้: " + err.message, "error");
  } finally {
    setLoading(false);
  }
}

function onSubmitSuccess() {
  showFeedback("✅ บันทึกสำเร็จ!", "success");
  document.getElementById("inputAmount").value = "";
  document.getElementById("inputNote").value = "";
  renderAll();
  setTimeout(() => { document.getElementById("formFeedback").hidden = true; }, 2500);
}

function setLoading(loading) {
  const btn = document.getElementById("submitBtn");
  btn.disabled = loading;
  btn.querySelector(".submit-btn__text").hidden = loading;
  document.getElementById("submitSpinner").hidden = !loading;
}

function showFeedback(msg, type) {
  const el = document.getElementById("formFeedback");
  el.textContent = msg;
  el.className = `form-feedback ${type}`;
  el.hidden = false;
}

/* ══════════════════════════════════════════════
   DELETE
══════════════════════════════════════════════ */
function bindDeleteButtons() {
  document.querySelectorAll(".delete-btn").forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      pendingDeleteId = b.dataset.id;
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

    // รายการ demo หรือรายการที่เพิ่มไว้ในเครื่อง (ยังไม่ได้ sync) ลบในหน่วยความจำได้เลย
    if (!APPS_SCRIPT_URL || pendingDeleteId.startsWith("D-") || pendingDeleteId.startsWith("L-")) {
      allTransactions = allTransactions.filter(t => t.ID !== pendingDeleteId);
      showToast("ลบรายการแล้ว", "success");
      renderAll();
      pendingDeleteId = null;
      return;
    }

    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "delete", id: pendingDeleteId }),
      });
      const data = await res.json();
      if (data.success) {
        try { localStorage.removeItem("moneytracker_cache"); } catch { }
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
  const sel = document.getElementById("inputCategory");
  const filtered = allCategories.filter(c => c.type === selectedType);
  sel.innerHTML = `<option value="">— เลือกหมวดหมู่ —</option>` +
    filtered.map(c => `<option value="${c.category}">${c.category}</option>`).join("");

  const all = [...new Set(allTransactions.map(t => t.Category))].filter(Boolean);
  document.getElementById("filterCategory").innerHTML = `<option value="all">ทั้งหมด</option>` +
    all.map(c => `<option value="${c}">${c}</option>`).join("");
}

/* ══════════════════════════════════════════════
   TABS
══════════════════════════════════════════════ */
function bindTabs() {
  document.querySelectorAll(".tab-btn, .link-btn[data-tab]").forEach(b => {
    b.addEventListener("click", () => switchTab(b.dataset.tab));
  });
}

function switchTab(t) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === t));
  document.querySelectorAll(".tab-content").forEach(s => s.classList.toggle("active", s.id === `tab-${t}`));
  if (t === "history") populateCategoryDropdown();
}

/* ══════════════════════════════════════════════
   TYPE TOGGLE
══════════════════════════════════════════════ */
function bindTypeToggle() {
  document.querySelectorAll(".type-btn").forEach(b => {
    b.addEventListener("click", () => {
      selectedType = b.dataset.type;
      document.getElementById("typeIncome").classList.toggle("active", selectedType === "income");
      document.getElementById("typeExpense").classList.toggle("active", selectedType === "expense");
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
  ["filterMonth", "filterType", "filterCategory"].forEach(id => {
    document.getElementById(id).addEventListener("change", renderHistoryList);
  });
  document.getElementById("clearFilterBtn").addEventListener("click", () => {
    document.getElementById("filterMonth").value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    document.getElementById("filterType").value = "all";
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
function filterByMonth(txs, y, m) {
  return txs.filter(t => {
    if (!t.Date) return false;
    const d = new Date(t.Date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

function formatMoney(n) {
  if (!n && n !== 0) return "฿0";
  return "฿" + Math.abs(n).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(d) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function thaiDate(s) {
  if (!s) return "";
  const hasTime = s.includes("T");
  const d = new Date(hasTime ? s : s + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear() + 543).slice(-2);
  let out = `${dd}/${mm}/${yy}`;
  if (hasTime) {
    out += ` ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return out;
}

function numShort(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "K";
  return n;
}

function categoryIcon(cat) {
  const m = (cat || "").match(/\p{Emoji}/u);
  return m ? m[0] : "💳";
}

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.hidden = false;
  setTimeout(() => { t.hidden = true; }, 2500);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }