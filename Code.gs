// ============================================================
//  💰 Money Tracker — Google Apps Script (Code.gs)
//  วางโค้ดนี้ใน Extensions > Apps Script ของ Google Sheets
// ============================================================

const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const TX_SHEET  = "Transactions";
const CAT_SHEET = "Categories";

// ──────────────────────────────────────────────────────────────
// GET: ดึงข้อมูล transactions + categories ส่งกลับเป็น JSON
// ──────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const ss   = SpreadsheetApp.getActiveSpreadsheet();
    const txSheet  = ss.getSheetByName(TX_SHEET);
    const catSheet = ss.getSheetByName(CAT_SHEET);

    // ── Transactions ──
    const txData = txSheet.getDataRange().getValues();
    const headers = txData[0];
    const transactions = txData.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    }).filter(t => t.ID); // กรองแถวว่าง

    // ── Categories ──
    const catData = catSheet.getDataRange().getValues();
    const categories = catData.slice(1).map(row => ({
      type:     row[0],
      category: row[1]
    })).filter(c => c.category);

    const payload = JSON.stringify({ transactions, categories });
    return ContentService
      .createTextOutput(payload)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ──────────────────────────────────────────────────────────────
// POST: รับข้อมูลใหม่จากเว็บ แล้วต่อท้ายใน Transactions
// ──────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const ss      = SpreadsheetApp.getActiveSpreadsheet();
    const txSheet = ss.getSheetByName(TX_SHEET);
    const data    = JSON.parse(e.postData.contents);

    const action = data.action || "add";

    if (action === "add") {
      const id        = "TX-" + new Date().getTime();
      const timestamp = new Date();
      const date      = data.date      || Utilities.formatDate(timestamp, "Asia/Bangkok", "yyyy-MM-dd");
      const type      = data.type      || "";
      const category  = data.category  || "";
      const amount    = parseFloat(data.amount) || 0;
      const note      = data.note      || "";

      txSheet.appendRow([id, timestamp, date, type, category, amount, note]);

      return ContentService
        .createTextOutput(JSON.stringify({ success: true, id }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "delete") {
      const id = data.id;
      const rows = txSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id) {
          txSheet.deleteRow(i + 1);
          return ContentService
            .createTextOutput(JSON.stringify({ success: true }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: "ID not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ──────────────────────────────────────────────────────────────
// SETUP: รันฟังก์ชันนี้ครั้งเดียวเพื่อสร้าง Header + ข้อมูลตัวอย่าง
// ──────────────────────────────────────────────────────────────
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── Transactions Tab ──
  let txSheet = ss.getSheetByName(TX_SHEET);
  if (!txSheet) txSheet = ss.insertSheet(TX_SHEET);
  txSheet.clearContents();
  txSheet.appendRow(["ID", "Timestamp", "Date", "Type", "Category", "Amount", "Note"]);
  txSheet.setFrozenRows(1);

  // ── Categories Tab ──
  let catSheet = ss.getSheetByName(CAT_SHEET);
  if (!catSheet) catSheet = ss.insertSheet(CAT_SHEET);
  catSheet.clearContents();
  catSheet.appendRow(["Type", "Category_Name"]);
  const defaultCats = [
    ["expense", "🍔 อาหาร"],
    ["expense", "🚗 เดินทาง"],
    ["expense", "🏠 ที่พัก"],
    ["expense", "💊 สุขภาพ"],
    ["expense", "🛍️ ช็อปปิ้ง"],
    ["expense", "🎮 บันเทิง"],
    ["expense", "📱 โทรศัพท์/อินเทอร์เน็ต"],
    ["expense", "📚 การศึกษา"],
    ["expense", "💡 ค่าน้ำค่าไฟ"],
    ["expense", "🔧 ซ่อมบำรุง"],
    ["expense", "🎁 ของขวัญ"],
    ["expense", "💰 อื่นๆ"],
    ["income",  "💼 เงินเดือน"],
    ["income",  "🎯 โบนัส"],
    ["income",  "💸 Freelance"],
    ["income",  "📈 การลงทุน"],
    ["income",  "🏦 ดอกเบี้ย"],
    ["income",  "🎁 รับเงินจากผู้อื่น"],
    ["income",  "💰 รายได้อื่นๆ"],
  ];
  catSheet.getRange(2, 1, defaultCats.length, 2).setValues(defaultCats);

  SpreadsheetApp.getUi().alert("✅ ตั้งค่า Sheets เสร็จแล้ว!");
}
