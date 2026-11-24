/**
 * GIANTbike — Google 試算表自動同步接收腳本（Google Apps Script）
 * 對應試算表：GIANTbike 測試與盤點彙整總表
 *
 * 部署步驟：
 * 1. 開啟試算表 → 上方選單「擴充功能」→「Apps Script」
 * 2. 將此檔案全部內容貼入 Code.gs 並按 Ctrl+S 儲存
 * 3. 右上角「部署」→「新增部署作業」→ 選取類型「網頁應用程式」
 *    - 執行身分：我
 *    - 誰可以存取：所有人（Anyone）
 * 4. 按「部署」並授權，複製產生的「網頁應用程式網址」（https://script.google.com/macros/s/.../exec）
 * 5. 回到 GIANTbike 管理中心 → 備份 →「Google 試算表自動連動」貼上網址並儲存即可！
 */

// 選填：若想加一層簡易驗證，請填入自訂密鑰（須與 GIANTbike 後台設定一致）；留空則不檢查
const SHARED_SECRET = "";

const SHEETS = {
  stock: {
    name: "盤點總表",
    headers: ["時間", "供應商", "類型", "項目代號", "名稱", "需求量", "回報庫存", "短缺數", "狀態", "盤點人"],
  },
  report: {
    name: "測試報告彙整",
    headers: ["提交時間", "供應商", "測試代號", "測試項目", "測試結果", "量測數據", "備註", "附件照片數", "提交者", "測試ID"],
  },
  anomaly: {
    name: "異常申請",
    headers: ["申請時間", "供應商", "異常類型", "緊急程度", "關聯項目", "異常說明", "申請人", "處理狀態", "單號"],
  },
};

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 防止 CSV/試算表公式注入
function safeCell(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "number" || typeof val === "boolean") return val;
  const s = String(val);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function fmtNow(ts) {
  const d = ts ? new Date(Number(ts)) : new Date();
  return Utilities.formatDate(isNaN(d.getTime()) ? new Date() : d, "Asia/Taipei", "yyyy/MM/dd HH:mm:ss");
}

function getOrCreateSheet(ss, spec) {
  let sh = ss.getSheetByName(spec.name);
  if (!sh) {
    sh = ss.insertSheet(spec.name);
    sh.appendRow(spec.headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, spec.headers.length)
      .setFontWeight("bold")
      .setBackground("#152232")
      .setFontColor("#FFFFFF");
  }
  return sh;
}

function doGet() {
  return jsonOut({ ok: true, service: "GIANTbike Sheets Sync", version: 1 });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    const body = JSON.parse(raw);

    if (SHARED_SECRET && String(body.secret || "") !== SHARED_SECRET) {
      return jsonOut({ ok: false, error: "invalid_secret" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const type = String(body.type || "");

    if (type === "ping") {
      return jsonOut({
        ok: true,
        spreadsheet: ss.getName(),
        sheets: ss.getSheets().map(function (s) { return s.getName(); }),
      });
    }

    if (type === "stock") {
      const sh = getOrCreateSheet(ss, SHEETS.stock);
      const list = Array.isArray(body.rows) ? body.rows : [body.data || body];
      list.forEach(function (r) {
        sh.appendRow([
          fmtNow(r.at),
          safeCell(r.vendor),
          safeCell(r.kind),
          safeCell(r.code),
          safeCell(r.name),
          Number(r.required || 0),
          Number(r.qty || 0),
          Number(r.shortage || 0),
          safeCell(r.status),
          safeCell(r.by),
        ]);
      });
      return jsonOut({ ok: true, appended: list.length, sheet: SHEETS.stock.name });
    }

    if (type === "report") {
      const sh = getOrCreateSheet(ss, SHEETS.report);
      const r = body.data || body;
      sh.appendRow([
        fmtNow(r.at),
        safeCell(r.vendor),
        safeCell(r.testCode),
        safeCell(r.testName),
        safeCell(r.result),
        safeCell(r.values),
        safeCell(r.note),
        Number(r.photoCount || 0),
        safeCell(r.by),
        safeCell(r.testId),
      ]);
      return jsonOut({ ok: true, appended: 1, sheet: SHEETS.report.name });
    }

    if (type === "anomaly") {
      const sh = getOrCreateSheet(ss, SHEETS.anomaly);
      const r = body.data || body;
      sh.appendRow([
        fmtNow(r.at),
        safeCell(r.vendor),
        safeCell(r.category),
        safeCell(r.urgency),
        safeCell(r.target),
        safeCell(r.desc),
        safeCell(r.reporter),
        safeCell(r.status || "待處理"),
        safeCell(r.ticketId),
      ]);
      return jsonOut({ ok: true, appended: 1, sheet: SHEETS.anomaly.name });
    }

    return jsonOut({ ok: false, error: "unknown_type" });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}
