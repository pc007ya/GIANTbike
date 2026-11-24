/* Google Sheets auto-sync helper (via Google Apps Script Web App) + Anomaly storage.
   Sends vendor stock-takes, test reports, and anomaly requests automatically to
   the linked Google Spreadsheet (tabs: 盤點總表 / 測試報告彙整 / 異常申請).
   Config is stored in STORE.sheets_get()/sheets_set() so admin sets the Web App
   URL once and every vendor browser syncs automatically via Firestore bff/data. */
(function () {
  const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/1MzjstQ8_jfskmr0fs1IKYLgF-XK4OiAAVwY495exiek/edit";

  function getConfig() {
    const raw = (window.STORE && window.STORE.sheets_get) ? window.STORE.sheets_get() : null;
    const c = raw && typeof raw === "object" ? raw : {};
    return {
      enabled: !!c.enabled,
      url: String(c.url || "").trim(),
      secret: String(c.secret || "").trim(),
      sheetUrl: String(c.sheetUrl || DEFAULT_SHEET_URL).trim() || DEFAULT_SHEET_URL,
    };
  }
  function setConfig(patch) {
    const next = Object.assign({}, getConfig(), patch || {});
    next.enabled = !!next.enabled;
    next.url = String(next.url || "").trim();
    next.secret = String(next.secret || "").trim();
    next.sheetUrl = String(next.sheetUrl || DEFAULT_SHEET_URL).trim() || DEFAULT_SHEET_URL;
    if (window.STORE && window.STORE.sheets_set) window.STORE.sheets_set(next);
    return next;
  }
  function isEnabled() {
    const c = getConfig();
    return false; // Do not send private supplier data from a public browser to an owner-executed webhook.
  }

  async function postPayload() {
    throw new Error("Google Sheets direct browser sync is paused; use a verified server-side route.");
  }
  const testConnection = postPayload;

  function vendorLabel(v) {
    if (!v) return "—";
    if (typeof v === "string") return v;
    if (v.name) return (v.name.zh || v.name.en || v.id || "—");
    return v.zh || v.en || "—";
  }

  /* ---- 1) Stock-take auto-sync (debounced per key so typing multi-digit numbers sends 1 row) ---- */
  const _stockTimers = {};
  function pushStockDebounced(key, entry) {
    if (!isEnabled() || !key || !entry || entry.qty == null) return;
    const u = window.AUTH && window.AUTH.get && window.AUTH.get();
    if (!u || u.role === "admin") return; // suppliers only
    clearTimeout(_stockTimers[key]);
    _stockTimers[key] = setTimeout(function () {
      delete _stockTimers[key];
      const part = window.DATA && window.DATA.PARTS && window.DATA.PARTS[key];
      const equip = window.DATA && window.DATA.EQUIPMENT && window.DATA.EQUIPMENT[key];
      let kind = "制具", code = key, name = key, required = 0;
      if (part) {
        kind = "制具";
        code = part.code || key;
        name = (part.name && (part.name.zh || part.name.en)) || key;
        if (window.buildFixtureUsage) {
          const hit = window.buildFixtureUsage().find((r) => r.key === key);
          if (hit) required = hit.required || 0;
        }
      } else if (equip) {
        kind = "設備";
        code = equip.code || key;
        name = (equip.name && (equip.name.zh || equip.name.en)) || key;
        if (window.buildEquipUsage) {
          const hit = window.buildEquipUsage().find((r) => r.key === key);
          if (hit) required = hit.required || 0;
        }
      }
      const qty = Number(entry.qty || 0);
      const shortage = Math.max(0, required - qty);
      const status = qty <= 0 && required > 0 ? "欠缺" : shortage > 0 ? "不足" : "充足";
      postPayload({
        type: "stock",
        data: {
          at: entry.at || Date.now(),
          vendor: vendorLabel(u),
          kind,
          code,
          name,
          required,
          qty,
          shortage,
          status,
          by: vendorLabel(entry.by || u),
        },
      }).catch(function () {});
    }, 1800);
  }

  /* ---- 2) Test report auto-sync ---- */
  function pushReport(vendor, item, report) {
    if (!isEnabled() || !item || !report) return Promise.resolve({ ok: false, skipped: true });
    const resultLabel = report.result === "pass" ? "通過" : report.result === "fail" ? "不通過" : (report.result || "—");
    return postPayload({
      type: "report",
      data: {
        at: report.at || Date.now(),
        vendor: vendorLabel(vendor),
        testCode: item.code || item.id,
        testName: (item.name && (item.name.zh || item.name.en)) || item.id,
        result: resultLabel,
        values: report.values || "",
        note: report.note || "",
        photoCount: Array.isArray(report.photos) ? report.photos.length : 0,
        by: vendorLabel(report.by || vendor),
        testId: item.id,
      },
    }).catch(function () { return { ok: false }; });
  }

  /* ---- 3) Anomaly request storage (synced via existing bff_report/<vendorId>.__anomalies) + Sheets sync ---- */
  function anomalies_forVendor(vendorId) {
    if (!vendorId || !window.bffReportGet) return [];
    const map = window.bffReportGet(vendorId) || {};
    return Array.isArray(map.__anomalies) ? [...map.__anomalies].sort((a,b)=>b.at-a.at) : [];
  }
  function anomalies_all() {
    const vendors = (window.STORE && window.STORE.vendors_list && window.STORE.vendors_list())
      || (window.AUTH && window.AUTH.VENDORS) || [];
    const out = [];
    vendors.forEach(function (v) {
      anomalies_forVendor(v.id).forEach(function (a) {
        out.push(Object.assign({ vendorId: v.id, vendorName: v.name }, a));
      });
    });
    out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    return out;
  }
  function makeTicketId(ts) {
    const d = new Date(ts || Date.now());
    const p = (n) => String(n).padStart(2, "0");
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `AN-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${rand}`;
  }
  async function anomalies_submit(vendor, input) {
    const vid = (vendor && vendor.id) || "anon";
    const now = Date.now();
    const rec = {
      ticketId: makeTicketId(now),
      at: now,
      vendor: vendorLabel(vendor),
      category: String(input.category || "測試異常"),
      urgency: String(input.urgency || "一般"),
      target: String(input.target || "").trim() || "—",
      desc: String(input.desc || "").trim(),
      reporter: window.AUTH.get()?.email || "",
      status: "待處理",
    };
    // Preserve the existing collection; acknowledge only after a server write.
    await window.CLOUD.appendAnomaly(vid,rec);
    return {record:rec,sheetSynced:false};

  }

  window.SHEETS = {
    DEFAULT_SHEET_URL,
    getConfig,
    setConfig,
    isEnabled,
    testConnection,
    pushStockDebounced,
    pushReport,
    anomalies_forVendor,
    anomalies_all,
    anomalies_submit,
  };
})();
