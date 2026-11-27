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
    return !!(c.enabled && c.url && /^https:\/\//i.test(c.url));
  }

  async function postPayload(payload, overrideCfg) {
    const c = overrideCfg ? Object.assign({}, getConfig(), overrideCfg) : getConfig();
    if (!c.url || !/^https:\/\//i.test(c.url)) return { ok: false, skipped: true };
    const body = Object.assign({}, payload);
    if (c.secret) body.secret = c.secret;
    const jsonStr = JSON.stringify(body);
    try {
      // text/plain avoids CORS preflight (OPTIONS) which Apps Script Web Apps do not handle.
      const resp = await fetch(c.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: jsonStr,
        redirect: "follow",
      });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      try {
        const data = await resp.json();
        return data && typeof data === "object" ? data : { ok: true };
      } catch (e) {
        return { ok: true };
      }
    } catch (e) {
      // Fallback: no-cors fire-and-forget (useful if a corporate proxy strips CORS headers)
      if (payload && payload.type !== "ping") {
        try {
          await fetch(c.url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: jsonStr });
          return { ok: true, opaque: true };
        } catch (e2) {}
      }
      throw e;
    }
  }

  async function testConnection(overrideCfg) {
    const res = await postPayload({ type: "ping" }, overrideCfg);
    if (!res || res.ok === false) {
      throw new Error((res && res.error) ? res.error : "connection_failed");
    }
    return res;
  }

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

  /* ---- 3) Anomaly request storage (synced via existing bff_report/<vendorId>.__anomalies)
     + silent background Google Form submission (no page redirect, no Apps Script required) ---- */
  const ANOMALY_FORM = {
    actionUrl: "https://docs.google.com/forms/d/e/1FAIpQLSc8Ud9aA_-wKfBwMtWRtEelT93IhM0J2fuGjphCiv7pvd7GeA/formResponse",
    fields: {
      vendor: "entry.1613477929",
      category: "entry.212094114",
      urgency: "entry.1269033899",
      target: "entry.250056431",
      desc: "entry.644312681",
      reporter: "entry.1922749733",
      ticketId: "entry.1934026452",
    },
  };
  async function postAnomalyGoogleForm(rec) {
    if (!ANOMALY_FORM.actionUrl || typeof fetch !== "function") return false;
    const params = new URLSearchParams();
    params.append(ANOMALY_FORM.fields.vendor, rec.vendor || "");
    params.append(ANOMALY_FORM.fields.category, rec.category || "");
    params.append(ANOMALY_FORM.fields.urgency, rec.urgency || "");
    params.append(ANOMALY_FORM.fields.target, rec.target || "");
    params.append(ANOMALY_FORM.fields.desc, rec.desc || "");
    params.append(ANOMALY_FORM.fields.reporter, rec.reporter || "");
    params.append(ANOMALY_FORM.fields.ticketId, rec.ticketId || "");
    await fetch(ANOMALY_FORM.actionUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: params.toString(),
    });
    return true;
  }

  function anomalies_forVendor(vendorId) {
    if (!vendorId || !window.bffReportGet) return [];
    const map = window.bffReportGet(vendorId) || {};
    return Array.isArray(map.__anomalies) ? map.__anomalies : [];
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
      reporter: String(input.reporter || "").trim() || vendorLabel(vendor),
      status: "待處理",
    };
    // Persist inside existing bff_report/<vendorId> doc so Firestore sync works with zero rule changes.
    if (window.bffReportGet && window.bffReportPut) {
      const map = Object.assign({}, window.bffReportGet(vid) || {});
      const list = Array.isArray(map.__anomalies) ? map.__anomalies.slice() : [];
      list.unshift(rec);
      map.__anomalies = list.slice(0, 100);
      window.bffReportPut(vid, map);
      window.dispatchEvent(new CustomEvent("bff:reportchange"));
    }
    let formSynced = false;
    try { formSynced = await postAnomalyGoogleForm(rec); } catch (e) { formSynced = false; }
    let sheetSynced = false;
    if (isEnabled()) {
      try {
        const r = await postPayload({ type: "anomaly", data: rec });
        sheetSynced = !!(r && r.ok);
      } catch (e) { sheetSynced = false; }
    }
    return { record: rec, formSynced, sheetSynced };
  }

  window.SHEETS = {
    DEFAULT_SHEET_URL,
    ANOMALY_FORM,
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
