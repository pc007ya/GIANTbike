/* Anomaly / Issue request submission (異常申請) for vendors + Admin overview.
   Persisted inside bff_report/<vendorId>.__anomalies (synced via Firestore with
   zero rule changes) and automatically appended to Google Sheet tab「異常申請」
   when Google Sheets sync is enabled. */
const { useState: anState, useEffect: anEffect, useMemo: anMemo } = React;

const ANOMALY_CATS = [
  { zh: "制具損壞", en: "Fixture damaged" },
  { zh: "制具缺件", en: "Fixture missing / short" },
  { zh: "設備故障", en: "Equipment malfunction" },
  { zh: "測試異常", en: "Test anomaly" },
  { zh: "圖面／規格疑問", en: "Spec / drawing issue" },
  { zh: "其他", en: "Other" },
];
const ANOMALY_URG = [
  { zh: "一般", en: "Normal", cls: "ok" },
  { zh: "急件", en: "Urgent", cls: "warn" },
  { zh: "停線", en: "Line stop", cls: "bad" },
];

function fmtAnStamp(ts, lang) {
  if (!ts) return "—";
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function AnomalyPage({ lang, vendor, admin }) {
  const zh = lang === "zh";
  const L = (o) => (o && o[lang] != null ? o[lang] : (o && o.en) || o);
  const [, bump] = anState(0);
  anEffect(() => { window.scrollTo(0, 0); }, []);
  anEffect(() => {
    const h = () => bump((n) => n + 1);
    window.addEventListener("bff:reportchange", h);
    window.addEventListener("bff:datachange", h);
    return () => {
      window.removeEventListener("bff:reportchange", h);
      window.removeEventListener("bff:datachange", h);
    };
  }, []);

  if (admin) return <AdminAnomalyView lang={lang} />;

  const vid = vendor ? vendor.id : "anon";
  const [category, setCategory] = anState(ANOMALY_CATS[0].zh);
  const [urgency, setUrgency] = anState(ANOMALY_URG[0].zh);
  const [target, setTarget] = anState("");
  const [desc, setDesc] = anState("");
  const [reporter, setReporter] = anState(() => (vendor && vendor.name ? (vendor.name.zh || vendor.name.en || "") : ""));
  const [busy, setBusy] = anState(false);
  const [msg, setMsg] = anState(null);

  const suggestions = anMemo(() => {
    const out = [];
    (window.DATA.ITEMS || []).forEach((it) => {
      out.push(`[${it.code || it.id}] ${L(it.name)}`);
    });
    Object.entries(window.DATA.PARTS || {}).forEach(([k, p]) => {
      out.push(`[制具 ${p.code || k}] ${L(p.name)}`);
    });
    Object.entries(window.DATA.EQUIPMENT || {}).forEach(([k, e]) => {
      out.push(`[設備 ${e.code || k}] ${L(e.name)}`);
    });
    return out;
  }, [lang]);

  const mine = (window.SHEETS && window.SHEETS.anomalies_forVendor) ? window.SHEETS.anomalies_forVendor(vid) : [];
  const formOn = !!(window.SHEETS && window.SHEETS.ANOMALY_FORM && window.SHEETS.ANOMALY_FORM.actionUrl);
  const sheetsOn = !!(window.SHEETS && window.SHEETS.isEnabled && window.SHEETS.isEnabled());

  async function submit(e) {
    if (e) e.preventDefault();
    if (!desc.trim()) {
      setMsg({ ok: false, t: zh ? "請填寫異常說明內容" : "Please describe the anomaly" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await window.SHEETS.anomalies_submit(vendor, {
        category, urgency, target, desc, reporter,
      });
      setDesc("");
      setTarget("");
      setMsg({
        ok: true,
        t: zh
          ? `已送出異常申請（單號 ${r.record.ticketId}）${r.formSynced ? "，已於背景自動寫入 Google 表單與試算表。" : r.sheetSynced ? "，已同步至 Google 試算表。" : "，已同步至品管後台。"}`
          : `Submitted anomaly ${r.record.ticketId}${r.formSynced ? " & silently synced to Google Form / Sheet." : " & synced to QC."}`,
      });
    } catch (err) {
      setMsg({ ok: false, t: (zh ? "送出失敗：" : "Submit failed: ") + (err && err.message || err) });
    }
    setBusy(false);
  }

  return (
    <div className="home">
      <section className="hero hero-sm">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-kicker"><span className="kick-dot" />{zh ? "供應商回報 · 即時連動品管" : "Supplier report · live to QC"}</div>
          <h1 className="hero-title">{zh ? "異常申請" : "Anomaly request"}</h1>
          <p className="hero-hint">{zh
            ? "制具損壞、缺件、設備故障或測試過程異常時，請由此填報；送出後不跳頁，背景自動寫入 Google 表單與試算表並通知品管。"
            : "Report damaged/missing fixtures, equipment failures, or test anomalies here — submits silently to Google Form & QC without leaving this page."}</p>
        </div>
      </section>

      <section className="list-section">
        <form className="an-card" onSubmit={submit}>
          <div className="ed-grid">
            <label className="field">
              <span className="field-k">{zh ? "異常類型" : "Category"}</span>
              <select className="inp" value={category} onChange={(e) => setCategory(e.target.value)}>
                {ANOMALY_CATS.map((c) => <option key={c.zh} value={c.zh}>{zh ? c.zh : c.en}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-k">{zh ? "緊急程度" : "Urgency"}</span>
              <select className="inp" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                {ANOMALY_URG.map((u) => <option key={u.zh} value={u.zh}>{zh ? u.zh : u.en}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-k">{zh ? "關聯項目（測試／制具／設備，選填）" : "Related test / fixture / equipment (optional)"}</span>
              <input className="inp" list="an-targets" value={target} onChange={(e) => setTarget(e.target.value)}
                placeholder={zh ? "輸入或從清單選取…" : "Type or pick from list…"} />
              <datalist id="an-targets">
                {suggestions.map((s, i) => <option key={i} value={s} />)}
              </datalist>
            </label>
            <label className="field">
              <span className="field-k">{zh ? "申請人 / 聯絡窗口" : "Reporter / contact"}</span>
              <input className="inp" value={reporter} onChange={(e) => setReporter(e.target.value)}
                placeholder={zh ? "姓名或分機" : "Name or ext."} />
            </label>
          </div>
          <label className="field" style={{ marginTop: 14 }}>
            <span className="field-k">{zh ? "異常說明（必填）" : "Description (required)"}</span>
            <textarea className="inp" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder={zh ? "請描述異常現象、發生步驟、需要補件數量或協助事項…" : "Describe what went wrong, step affected, quantity needed, etc.…"} />
          </label>
          {msg && <div className={"bk-msg" + (msg.ok ? " ok" : " bad")} style={{ marginTop: 12 }}><Icon name={msg.ok ? "check" : "x"} size={15} />{msg.t}</div>}
          <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn" type="submit" disabled={busy}>
              <Icon name="upload" size={16} />{busy ? (zh ? "送出中…" : "Submitting…") : (zh ? "送出異常申請" : "Submit anomaly request")}
            </button>
            <span className="an-sync-tag mono">
              {formOn
                ? (zh ? "● 已連動 Google 表單（背景送出，不跳頁）" : "● Google Form silent sync active")
                : sheetsOn
                  ? (zh ? "● 已開啟 Google 試算表自動同步" : "● Google Sheets sync active")
                  : (zh ? "● 同步至品管後台" : "● Syncing to QC")}
            </span>
          </div>
        </form>

        <h2 className="admin-h" style={{ marginTop: 32 }}>
          {zh ? "本廠已提交紀錄" : "Your submitted requests"}
          <span className="admin-h-aside mono">{mine.length}</span>
        </h2>
        {mine.length === 0 ? (
          <div className="empty">
            <Icon name="clipboard" size={28} />
            <p className="empty-title">{zh ? "尚無異常申請紀錄" : "No anomaly requests yet"}</p>
          </div>
        ) : (
          <div className="an-list">
            {mine.map((r) => (
              <div className="an-row" key={r.ticketId || r.at}>
                <div className="an-row-top">
                  <span className="mono an-tid">{r.ticketId}</span>
                  <span className={"an-urg an-urg-" + (r.urgency === "停線" ? "bad" : r.urgency === "急件" ? "warn" : "ok")}>{r.urgency}</span>
                  <span className="an-cat">{r.category}</span>
                  <span className="an-time mono">{fmtAnStamp(r.at, lang)}</span>
                </div>
                {r.target && r.target !== "—" && <div className="an-target">{zh ? "關聯項目：" : "Target: "}{r.target}</div>}
                <p className="an-desc">{r.desc}</p>
                <div className="an-meta">{zh ? "申請人：" : "By: "}{r.reporter} · {zh ? "狀態：" : "Status: "}{r.status || "待處理"}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AdminAnomalyView({ lang }) {
  const zh = lang === "zh";
  const [urgFilter, setUrgFilter] = anState("all");
  const all = (window.SHEETS && window.SHEETS.anomalies_all) ? window.SHEETS.anomalies_all() : [];
  const list = urgFilter === "all" ? all : all.filter((r) => r.urgency === urgFilter);
  const cfg = (window.SHEETS && window.SHEETS.getConfig) ? window.SHEETS.getConfig() : {};

  function exportCsv() {
    const head = ["申請時間", "供應商", "異常類型", "緊急程度", "關聯項目", "異常說明", "申請人", "處理狀態", "單號"];
    const rows = [head].concat(list.map((r) => [
      fmtAnStamp(r.at, lang), r.vendor, r.category, r.urgency, r.target, r.desc, r.reporter, r.status || "待處理", r.ticketId,
    ]));
    const csv = rows.map((row) => row.map((c) => {
      let s = String(c == null ? "" : c);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "anomalies-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  return (
    <div className="home admin">
      <section className="hero hero-sm">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-kicker"><span className="kick-dot" />{zh ? "管理員 · 異常申請總覽" : "Admin · anomaly requests"}</div>
          <h1 className="hero-title">{zh ? "異常申請紀錄" : "Anomaly requests"}</h1>
          <p className="hero-hint">{zh ? "彙整各供應商提交的制具、設備與測試異常申請，同步紀錄於 Google 試算表。" : "All supplier anomaly requests, synced to Google Sheets."}</p>
          <div className="admin-stats">
            <div className="astat"><span className="astat-v">{all.length}</span><span className="astat-k">{zh ? "總申請件數" : "Total"}</span></div>
            <div className="astat astat-warn"><span className="astat-v">{all.filter((r) => r.urgency === "停線" || r.urgency === "急件").length}</span><span className="astat-k">{zh ? "急件 / 停線" : "Urgent / Stop"}</span></div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {cfg.sheetUrl && (
                <a className="btn ghost" href={cfg.sheetUrl} target="_blank" rel="noopener" style={{ textDecoration: "none" }}>
                  <Icon name="file" size={16} />{zh ? "開啟 Google 試算表" : "Open Google Sheet"}
                </a>
              )}
              <button className="btn" onClick={exportCsv}><Icon name="download" size={16} />{zh ? "匯出 CSV" : "Export CSV"}</button>
            </div>
          </div>
        </div>
      </section>

      <section className="list-section">
        <div className="list-toolbar">
          <div className="chips" role="tablist">
            {[{ k: "all", l: zh ? "全部" : "All" }, { k: "停線", l: zh ? "停線" : "Line stop" }, { k: "急件", l: zh ? "急件" : "Urgent" }, { k: "一般", l: zh ? "一般" : "Normal" }].map((c) => (
              <button key={c.k} className={"chip" + (urgFilter === c.k ? " is-active" : "")} onClick={() => setUrgFilter(c.k)}>{c.l}</button>
            ))}
          </div>
          <span className="result-count"><strong>{list.length}</strong> {zh ? "筆申請" : "requests"}</span>
        </div>

        {list.length === 0 ? (
          <div className="empty">
            <Icon name="clipboard" size={28} />
            <p className="empty-title">{zh ? "目前沒有符合條件的異常申請" : "No anomaly requests"}</p>
          </div>
        ) : (
          <div className="an-list">
            {list.map((r) => (
              <div className="an-row" key={(r.vendorId || "") + "-" + (r.ticketId || r.at)}>
                <div className="an-row-top">
                  <span className="mono an-tid">{r.ticketId}</span>
                  <span className="an-vendor">{r.vendor}</span>
                  <span className={"an-urg an-urg-" + (r.urgency === "停線" ? "bad" : r.urgency === "急件" ? "warn" : "ok")}>{r.urgency}</span>
                  <span className="an-cat">{r.category}</span>
                  <span className="an-time mono">{fmtAnStamp(r.at, lang)}</span>
                </div>
                {r.target && r.target !== "—" && <div className="an-target">{zh ? "關聯項目：" : "Target: "}{r.target}</div>}
                <p className="an-desc">{r.desc}</p>
                <div className="an-meta">{zh ? "申請人：" : "By: "}{r.reporter} · {zh ? "狀態：" : "Status: "}{r.status || "待處理"}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

window.AnomalyPage = AnomalyPage;
