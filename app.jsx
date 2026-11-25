/* App: routing, search, i18n, theme. Mounts #root. */
const { useState: uState, useMemo, useEffect: uEffect } = React;

/* ---------- i18n ---------- */
const STR = {
  appTitle: { zh: "測試制具查詢系統", en: "Test Fixture Finder" },
  appSub: { zh: "供應商專用 · 腳踏車品管部門", en: "Supplier portal · Bicycle QC" },
  searchPlaceholder: { zh: "搜尋測試項目、制具或標準條文…", en: "Search test items, fixtures or clauses…" },
  searchHint: { zh: "可依「測試項目」、「分類」、「制具名稱」或「標準條文編號」即時篩選", en: "Filter live by test item, category, fixture name or standard clause" },
  all: { zh: "全部", en: "All" },
  resultsOne: { zh: "項測試", en: "test" },
  resultsMany: { zh: "項測試", en: "tests" },
  noResults: { zh: "找不到符合條件的測試項目", en: "No matching test items" },
  noResultsHint: { zh: "請嘗試其他關鍵字，或清除搜尋條件", en: "Try another keyword or clear the search" },
  clear: { zh: "清除", en: "Clear" },
  statusReady: { zh: "可測", en: "Ready" },
  statusDraft: { zh: "草稿", en: "Draft" },
  fixturesUnit: { zh: "件制具", en: "fixtures" },
  back: { zh: "返回列表", en: "All tests" },
  overview: { zh: "概述", en: "Overview" },
  testParams: { zh: "測試參數", en: "Test parameters" },
  setupSchematic: { zh: "設定示意圖", en: "Setup schematic" },
  fixtureList: { zh: "所需制具清單", en: "Required fixtures" },
  colFixture: { zh: "制具", en: "Fixture" },
  colPart: { zh: "編號", en: "Part no." },
  colQty: { zh: "數量", en: "Qty" },
  colTorque: { zh: "鎖固扭矩", en: "Torque" },
  installSteps: { zh: "安裝步驟", en: "Installation steps" },
  step: { zh: "步驟", en: "Step" },
  uploadPhoto: { zh: "上傳實拍", en: "Upload photo" },
  replace: { zh: "更換", en: "Replace" },
  revert: { zh: "移除", en: "Remove" },
  yourPhoto: { zh: "您的實拍對比", en: "Your comparison photo" },
  officialPhoto: { zh: "官方示意", en: "Official reference" },
  addYourPhoto: { zh: "新增實拍對比（僅自己可見）", en: "Add your photo (visible only to you)" },
  uploadFailed: { zh: "上傳失敗（檔案不是圖片，或超過 20MB）", en: "Upload failed (not an image, or over 20MB)" },
  dropHere: { zh: "放開以上傳", en: "Drop to upload" },
  print: { zh: "列印 / 匯出", en: "Print / export" },
  standard: { zh: "對應標準", en: "Standard" },
  totalParts: { zh: "制具件數", en: "Total parts" },
  jumpFixtures: { zh: "制具清單", en: "Fixtures" },
  jumpSteps: { zh: "安裝步驟", en: "Steps" },
  // pass criteria (04)
  passCriteria: { zh: "通過標準", en: "Pass criteria" },
  passCriteriaNone: { zh: "尚未設定通過標準", en: "No pass criteria defined yet" },
  passCriteriaHint: { zh: "由品管部設定；測試結果需符合下列條件才算通過。", en: "Defined by QC; results must meet the following to pass." },
  // report upload (05)
  reportTitle: { zh: "上傳報告", en: "Submit report" },
  reportHint: { zh: "填寫測試結果與量測數據，並上傳實拍照片。資料自動儲存並同步。", en: "Record results & measured data and attach photos. Saved and synced automatically." },
  reportResult: { zh: "測試結果", en: "Result" },
  reportPass: { zh: "通過", en: "Pass" },
  reportFail: { zh: "不通過", en: "Fail" },
  reportValues: { zh: "量測數據", en: "Measured data" },
  reportValuesPh: { zh: "例：最大變形 1.8 mm、循環 50,000 次未裂…", en: "e.g. max deflection 1.8 mm, 50,000 cycles no crack…" },
  reportNote: { zh: "備註", en: "Notes" },
  reportNotePh: { zh: "其他說明或異常狀況…", en: "Any remarks or anomalies…" },
  reportPhotos: { zh: "報告照片", en: "Report photos" },
  reportAddPhoto: { zh: "加入照片", en: "Add photo" },
  reportSubmit: { zh: "儲存報告", en: "Save report" },
  reportNeedResult: { zh: "請先選擇「通過」或「不通過」才能送出，否則管理中心將無法顯示燈號。", en: "Choose Pass or Fail before submitting — otherwise the admin matrix can't show a light." },
  reportSaved: { zh: "報告已儲存並同步", en: "Report saved & synced" },
  reportEmpty: { zh: "尚未提交報告", en: "No report submitted yet" },
  reportBy: { zh: "提交者", en: "By" },
  reportAt: { zh: "提交時間", en: "Submitted" },
  reportSubmissions: { zh: "供應商報告", en: "Supplier reports" },
  reportPhotoLimit: { zh: "最多 6 張照片", en: "Up to 6 photos" },
  reportClear: { zh: "清除報告", en: "Clear report" },
  // results matrix
  resultsTitle: { zh: "測試結果矩陣", en: "Test results matrix" },
  resultsHint: { zh: "各供應商在每項測試的最新結果。綠燈＝通過、紅燈＝不通過、灰＝未回報；格內為更新日期。", en: "Latest result per vendor per test. Green = pass, red = fail, grey = no report; date shown in cell." },
  resultsTest: { zh: "測試項目", en: "Test item" },
  resultsNoVendors: { zh: "尚無供應商", en: "No vendors yet" },
  resultsPass: { zh: "通過", en: "Pass" },
  resultsFail: { zh: "不通過", en: "Fail" },
  resultsPending: { zh: "未回報", en: "No report" },
  resultsSubmitted: { zh: "已回報（未判定）", en: "Submitted (no verdict)" },
  resultsLegend: { zh: "圖例", en: "Legend" },
  resultsSummary: { zh: "已回報 / 總數", en: "Reported / total" },
  resultsFilterStatus: { zh: "狀態", en: "Status" },
  resultsFilterVendor: { zh: "供應商", en: "Vendor" },
  resultsExport: { zh: "匯出 CSV", en: "Export CSV" },
  resultsAll: { zh: "全部", en: "All" },
  resultsOnlyFail: { zh: "含不通過", en: "Has fail" },
  resultsOnlyPass: { zh: "全部通過", en: "All pass" },
  resultsOnlyPending: { zh: "有未回報", en: "Has pending" },
  resultsNoMatch: { zh: "沒有符合篩選條件的測試", en: "No tests match the filters" }
};

function makeT(lang) {
  return (key) => {
    const o = STR[key];
    return o ? o[lang] != null ? o[lang] : o.en : key;
  };
}

/* ---------- Theme application ---------- */
function applyTheme(name) {
  const th = window.THEMES[name] || window.THEMES.blueprint;
  const root = document.documentElement;
  Object.entries(th.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.style.setProperty("--body-font", th.vars["--body-font"] || th.vars["--font"]);
  root.setAttribute("data-theme", name);
}

/* ================= HOME ================= */
function Home({ lang, t, theme, onOpen, vendor, admin }) {
  const [q, setQ] = uState("");
  const [cat, setCat] = uState("all");
  // vendors only see tests covered by their assigned product codes;
  // a vendor with NO assignment sees nothing (empty), NOT everything.
  const allowed = (!admin && vendor) ? (window.STORE.testcodes_itemIdsForVendor(vendor.id) || {}) : null;
  const unassigned = (!admin && vendor) && window.STORE.testcodes_forVendor(vendor.id).length === 0;
  const items = allowed ? window.DATA.ITEMS.filter((it) => allowed[it.id]) : window.DATA.ITEMS;
  const L = (o) => o && o[lang] != null ? o[lang] : o;

  const cats = useMemo(() => {
    const m = new Map();
    items.forEach((it) => {
      const k = it.category.en;
      if (!m.has(k)) m.set(k, { key: k, label: L(it.category), count: 0 });
      m.get(k).count++;
    });
    return [{ key: "all", label: t("all"), count: items.length }, ...m.values()];
  }, [lang, items]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (cat !== "all" && it.category.en !== cat) return false;
      if (!needle) return true;
      const hay = [
      it.code, it.standard, it.clause, it.category.zh, it.category.en,
      it.name.zh, it.name.en,
      ...it.fixtures.map((f) => f.name.zh + " " + f.name.en + " " + f.code)].
      join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [q, cat, lang, items]);

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-kicker">
            <span className="kick-dot" />ISO 4210 · {lang === "zh" ? "制具與設定資料庫" : "Fixtures & setup library"}
          </div>
          <h1 className="hero-title">{lang === "zh" ? "查詢任一測試項目所需的制具與安裝步驟" : "Find the fixtures and setup for any test."}</h1>
          <div className="searchbar">
            <Icon name="search" size={20} />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} autoFocus />
            
            {q && <button className="search-clear" onClick={() => setQ("")} aria-label={t("clear")}><Icon name="x" size={16} /></button>}
          </div>
          <p className="hero-hint">{t("searchHint")}</p>
          {!admin && vendor && <VendorCodeBanner vendorId={vendor.id} lang={lang} />}
        </div>
      </section>

      <section className="list-section">
        <div className="list-toolbar">
          <FilterChips cats={cats} active={cat} onPick={setCat} t={t} />
          <span className="result-count">
            <strong>{results.length}</strong> {results.length === 1 ? t("resultsOne") : t("resultsMany")}
          </span>
        </div>

        {unassigned ?
        <div className="empty">
            <Icon name="grid" size={30} />
            <p className="empty-title">{lang === "zh" ? "尚未被指派專案" : "No project assigned yet"}</p>
            <p className="empty-hint">{lang === "zh" ? "您目前沒有被指派任何產品代號，因此無需任何制具與設備。請聯絡管理員分派專案。" : "You have no assigned product codes, so there are no fixtures or equipment to prepare. Please contact the administrator."}</p>
          </div> :
        results.length === 0 ?
        <div className="empty">
            <Icon name="search" size={30} />
            <p className="empty-title">{t("noResults")}</p>
            <p className="empty-hint">{t("noResultsHint")}</p>
            <button className="btn" onClick={() => {setQ("");setCat("all");}}>{t("clear")}</button>
          </div> :

        <div className="grid">
            {results.map((it) => <ItemCard key={it.id} item={it} lang={lang} t={t} onOpen={onOpen} />)}
          </div>
        }
      </section>
    </div>);

}

/* ---------- Admin-only: read-only strip of vendor comparison-photo submissions ---------- */
function AdminStepSubmissions({ itemId, stepIndex, lang, t, onZoom }) {
  const L = (o) => (o && o[lang] != null ? o[lang] : o);
  const [, force] = uState(0);
  uEffect(() => {
    const h = () => force((n) => n + 1);
    window.addEventListener("bff:stepphotochange", h);
    return () => window.removeEventListener("bff:stepphotochange", h);
  }, []);
  const subs = window.STORE.stepphoto_allSubmissions(itemId, stepIndex);
  if (!subs.length) return null;
  const vendorsById = {};
  (window.AUTH.VENDORS || []).forEach((v) => { vendorsById[v.id] = v; });
  return (
    <div className="stepsubs">
      <div className="stepsubs-h">{lang === "zh" ? "供應商實拍對比" : "Vendor comparison photos"}<span className="mono">{subs.length}</span></div>
      <div className="stepsubs-strip">
        {subs.map((s) => {
          const v = vendorsById[s.vendorId];
          return (
            <button className="stepsubs-item" key={s.vendorId} onClick={() => onZoom(s.dataUri, v ? L(v.name) : s.vendorId)}>
              <img src={s.dataUri} alt="" />
              <span>{v ? L(v.name) : s.vendorId}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================= DETAIL ================= */
function Detail({ item, lang, t, onBack, onZoom, vendor, admin }) {
  const L = (o) => o && o[lang] != null ? o[lang] : o;
  const totalParts = item.fixtures.reduce((s, f) => s + f.qty, 0);
  uEffect(() => {window.scrollTo(0, 0);}, [item.id]);
  const pc = item.passCriteria;
  const pcText = pc ? L(pc) : "";

  return (
    <div className="detail">
      <div className="detail-bar">
        <button className="back" onClick={onBack}><Icon name="arrowLeft" size={18} />{t("back")}</button>
        <button className="btn ghost no-print" onClick={() => window.print()}><Icon name="print" size={16} />{t("print")}</button>
      </div>

      <header className="detail-head">
        <div className="dh-left">
          <div className="dh-codes">
            <span className="dh-code">{item.code}</span>
            <span className="dh-cat">{L(item.category)}</span>
            <StatusBadge status={item.status} t={t} />
          </div>
          <h1 className="dh-title">{L(item.name)}</h1>
          <p className="dh-summary">{L(item.summary)}</p>
          <div className="dh-meta">
            <span className="meta-pill"><span className="mp-k">{t("standard")}</span><span className="mp-v mono">{item.standard} {item.clause}</span></span>
            <span className="meta-pill"><span className="mp-k">{t("totalParts")}</span><span className="mp-v mono">{totalParts}</span></span>
            <span className="meta-pill"><span className="mp-k">{t("installSteps")}</span><span className="mp-v mono">{item.steps.length}</span></span>
          </div>
        </div>
        <figure className="dh-figure">
          <button className="dh-img" onClick={() => onZoom(item.schematic, L(item.name))}>
            <img src={item.schematic} alt={L(item.name)} />
          </button>
          <figcaption><Icon name="ruler" size={13} />{t("setupSchematic")}</figcaption>
        </figure>
      </header>

      <section className="block">
        <h2 className="block-h"><span className="bh-num">01</span><span className="bh-title">{t("testParams")}</span></h2>
        <ParamGrid params={item.params} lang={lang} />
      </section>

      <section className="block">
        <h2 className="block-h"><span className="bh-num">02</span><span className="bh-title">{t("fixtureList")}</span>
          <span className="block-aside mono">{item.fixtures.length} {t("fixturesUnit")} · {totalParts} pcs</span>
        </h2>
        <FixtureTable fixtures={item.fixtures} lang={lang} t={t} onZoom={onZoom} />
      </section>

      <section className="block">
        <h2 className="block-h"><span className="bh-num">03</span><span className="bh-title">{lang === "zh" ? "所需設備" : "Required equipment"}</span>
          <span className="block-aside mono">{(item.equipment || []).length} {lang === "zh" ? "項 · 可共用不累加" : "items · shared"}</span>
        </h2>
        <EquipmentTable equipment={item.equipment} lang={lang} />
      </section>

      <section className="block">
        <h2 className="block-h"><span className="bh-num">04</span><span className="bh-title">{t("installSteps")}</span></h2>
        <ol className="steps">
          {item.steps.map((s, i) =>
          <li className="step" key={i}>
              <div className="step-text">
                <div className="step-n">{t("step")} {String(i + 1).padStart(2, "0")}</div>
                <h3 className="step-title">{L(s.title)}</h3>
                <p className="step-desc">{L(s.desc)}</p>
              </div>
              <StepImage
              itemId={item.id} stepIndex={i} official={s.image}
              vendor={vendor} isAdmin={admin} t={t} alt={L(s.title)} onZoom={onZoom} />
              {admin && <AdminStepSubmissions itemId={item.id} stepIndex={i} lang={lang} t={t} onZoom={onZoom} />}
            
            </li>
          )}
        </ol>
      </section>

      <section className="block">
        <h2 className="block-h"><span className="bh-num">05</span><span className="bh-title">{t("passCriteria")}</span></h2>
        {pcText ?
        <div className="passcrit">
            <p className="passcrit-hint"><Icon name="check" size={14} />{t("passCriteriaHint")}</p>
            <ul className="passcrit-list">
              {pcText.split(/\n+/).filter((x) => x.trim()).map((line, i) =>
            <li key={i}>{line.replace(/^[-•\s]+/, "")}</li>
            )}
            </ul>
          </div> :

        <div className="passcrit empty"><Icon name="clipboard" size={20} />{t("passCriteriaNone")}</div>
        }
      </section>

      {vendor && <section className="block">
        <h2 className="block-h"><span className="bh-num">06</span><span className="bh-title">{t("reportTitle")}</span></h2>
        <ReportPanel key={vendor.uid+":"+item.id} item={item} lang={lang} t={t} vendor={vendor} admin={admin} onZoom={onZoom} />
      </section>}
    </div>);

}

/* ================= LOGIN ================= */
function authMessage(error, zh) {
  const messages = {
    "bff/email-unverified": ["請先驗證開戶信箱，驗證後再登入。", "Verify your company email before signing in."],
    "bff/not-provisioned": ["此帳號未開通供應商權限。請先用管理員開通的信箱和密碼登入。", "No vendor access. Sign in first with your provisioned email/password."],
    "bff/new-password-required": ["請輸入至少 12 字元、且和舊密碼不同的新密碼。", "Use a new password of at least 12 characters, different from the current password."],
    "bff/not-admin": ["此 Google 帳號沒有管理員權限。", "This Google account is not an authorized administrator."],
    "bff/cloud-unavailable": ["登入服務目前無法使用，請稍後再試。", "Sign-in is unavailable. Try again later."],
    "bff/reauth-required": ["密碼確認已逾時，請重新確認。", "Password confirmation expired; please repeat it."],
    "auth/credential-already-in-use": ["這個 Google 帳號已綁定另一個帳號。請聯絡管理員，不會自動合併。", "This Google account is already linked elsewhere. Contact the administrator; nothing was merged."],
    "auth/account-exists-with-different-credential": ["請先用信箱和密碼登入，再從「我的帳號」綁定 Google。", "Sign in with your email/password and link Google in My account."],
    "auth/email-already-in-use": ["此 Google 信箱有其他帳號，請聯絡管理員核對。", "This Google email belongs to another account. Contact the administrator."],
    "auth/provider-already-linked": ["已綁定 Google。", "Google is already linked."],
    "auth/popup-blocked": ["請允許瀏覽器的登入彈出視窗。", "Allow sign-in pop-ups and try again."],
    "auth/unauthorized-domain": ["目前網域未啟用 Google 登入，請聯絡管理員。", "Google sign-in is not enabled on this domain."],
    "auth/popup-closed-by-user": ["未完成 Google 驗證。", "Google verification was not completed."],
    "auth/too-many-requests": ["目前嘗試次數過多，請稍後再試。", "Too many attempts. Try again later."],
  };
  return (messages[error?.code] || ["操作未成功，請檢查信箱、密碼或連線後再試。", "Could not finish. Check your credentials or connection."])[zh ? 0 : 1];
}
function Login({lang,setLang,t}) {
  const zh=lang==="zh";
  const [mode,setMode]=uState("vendor"), [email,setEmail]=uState(""), [password,setPassword]=uState("");
  const [busy,setBusy]=uState(false), [message,setMessage]=uState(""), [error,setError]=uState(null);
  async function run(fn, success) {
    if (busy) return;
    setBusy(true); setError(null); setMessage("");
    try { if(!window.CLOUD) throw {code:"bff/cloud-unavailable"}; await fn(window.CLOUD); if (success) setMessage(success); }
    catch(e) { setError(e); }
    finally { setBusy(false); setPassword(""); }
  }
  const sw=m=>{setMode(m);setError(null);setMessage("");setPassword("");};
  return <div className="login">
    <div className="login-bg" aria-hidden="true"/>
    <header className="login-top">
      <div className="brand"><span className="brand-mark"><span/></span><span className="brand-txt"><span className="brand-title">{t("appTitle")}</span><span className="brand-sub">{t("appSub")}</span></span></div>
      <div className="langtoggle" role="group" aria-label="language"><button className={zh?"on":""} onClick={()=>setLang("zh")}>中文</button><button className={!zh?"on":""} onClick={()=>setLang("en")}>EN</button></div>
    </header>
    <form className="login-card" onSubmit={e=>{e.preventDefault();if(mode==="vendor")run(c=>c.signInVendor(email,password));}}>
      <div className="login-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode==="vendor"} className={"login-tab"+(mode==="vendor"?" on":"")} disabled={busy} onClick={()=>sw("vendor")}>{zh?"供應商":"Vendor"}</button>
        <button type="button" role="tab" aria-selected={mode==="admin"} className={"login-tab"+(mode==="admin"?" on":"")} disabled={busy} onClick={()=>sw("admin")}>{zh?"管理員":"Admin"}</button>
      </div>
      <h1 className="login-title">{mode==="vendor"?(zh?"供應商登入":"Vendor sign-in"):(zh?"管理員登入":"Admin sign-in")}</h1>
      {mode==="vendor" ? <>
        <p className="login-sub">{zh?"第一次請直接用管理員提供的帳號與初始密碼登入。驗證公司信箱後，可在「我的帳號」改密碼、綁定 Google。":"For your first sign-in, use the account and initial password from your administrator. Verify your company email, then use My account to change your password and link Google."}</p>
        <label className="login-label" htmlFor="login-email">{zh?"公司信箱":"Company email"}</label>
        <input id="login-email" className="login-input" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/>
        <label className="login-label" htmlFor="login-password">{zh?"密碼":"Password"}</label>
        <input id="login-password" className="login-input" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/>
        <button className="btn login-btn" type="submit" disabled={busy}>{zh?"以信箱登入":"Sign in with email"}</button>
        <button type="button" className="login-google" disabled={busy} onClick={()=>run(c=>c.signInVendor("", "",true))}>{zh?"以已綁定的 Google 帳號登入":"Sign in with linked Google account"}</button>
        <button type="button" className="btn ghost" disabled={busy||!email.trim()} onClick={()=>run(c=>c.requestReset(email),zh?"若此帳號已開通，將收到重設密碼的信。":"If this account exists, a password reset email will be sent.")}>{zh?"忘記密碼":"Forgot password"}</button>
        {error?.code==="bff/email-unverified"&&<button type="button" className="btn ghost" disabled={busy} onClick={()=>run(c=>c.verifyEmail(),zh?"已寄出驗證信，完成後請再登入。":"Verification email sent. Sign in again after verification.")}>{zh?"重寄驗證信":"Resend verification email"}</button>}
      </>:<>
        <p className="login-sub">{zh?"使用已核准的管理員 Google 帳號。":"Use an authorized administrator Google account."}</p>
        <button type="button" className="login-google" onClick={()=>run(c=>c.signInAdmin())} disabled={busy}>{zh?"以 Google 登入管理中心":"Sign in to admin with Google"}</button>
      </>}
      {error && <p className="login-err" role="alert">{authMessage(error,zh)}</p>}
      {message && <p role="status">{message}</p>}
    </form>
  </div>;
}
function VendorAccount({lang,vendor}) {
  const zh=lang==="zh";
  const [password,setPassword]=uState(""),[verified,setVerified]=uState(false),[busy,setBusy]=uState(false),[error,setError]=uState(null);
  const [linked,setLinked]=uState(false), [statusReady,setStatusReady]=uState(false);
  const [oldPassword,setOldPassword]=uState(""), [newPassword,setNewPassword]=uState(""), [passwordChanged,setPasswordChanged]=uState(false);
  uEffect(()=>{
    let alive=true;
    window.CLOUD.googleLinkStatus().then(v=>{if(alive){setLinked(v==="active");setStatusReady(true);}}).catch(e=>{if(alive)setError(e);});
    return ()=>{alive=false;};
  },[vendor.uid]);
  async function run(fn,onSuccess) {
    if(busy)return; setBusy(true); setError(null);
    try {await fn();onSuccess();}
    catch(e){setError(e);if(e?.code==="bff/reauth-required")setVerified(false);}
    finally {setBusy(false);setPassword("");}
  }
  return <section className="block">
    <h1>{zh?"我的帳號":"My account"}</h1><p>{vendor.email} · {L2(vendor.name,lang)}</p>
    <p>{linked?(zh?"Google 已綁定；仍可用信箱和密碼登入。":"Google is linked. Email/password sign-in still works."):(zh?"綁定公司管理的 Google 帳號，不會新增帳號或改變資料權限。":"Link a company-managed Google account without changing your data access.")}</p>
    {statusReady&&!linked&&!verified&&<button className="btn" type="button" disabled={busy} onClick={()=>run(()=>window.CLOUD.linkGoogle(),()=>setVerified(true))}>{zh?"綁定 Google":"Link Google"}</button>}
    {statusReady&&!linked&&verified&&<form onSubmit={e=>{e.preventDefault();run(()=>window.CLOUD.confirmLinkPassword(password),()=>{setVerified(false);setLinked(true);});}}>
      <p>{zh?"再輸入公司帳號密碼，確認後才會啟用 Google 登入。":"Confirm your company-account password to activate Google sign-in."}</p>
      <label htmlFor="link-password">{zh?"確認密碼":"Confirm password"}</label>
      <input id="link-password" className="login-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/>
      <button className="btn" disabled={busy} type="submit">{zh?"確認並啟用":"Confirm and activate"}</button>
    </form>}
    <form onSubmit={e=>{e.preventDefault();setPasswordChanged(false);
      const old=oldPassword,next=newPassword;
      setOldPassword("");setNewPassword("");
      run(()=>window.CLOUD.changeVendorPassword(old,next),()=>setPasswordChanged(true));
    }}>
      <h2>{zh?"更改登入密碼":"Change sign-in password"}</h2>
      <label htmlFor="account-old-password">{zh?"目前密碼":"Current password"}</label>
      <input id="account-old-password" type="password" autoComplete="current-password" value={oldPassword} onChange={e=>setOldPassword(e.target.value)} disabled={busy} required/>
      <label htmlFor="account-new-password">{zh?"新密碼（至少 12 字元）":"New password (at least 12 characters)"}</label>
      <input id="account-new-password" type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} disabled={busy} minLength={12} required/>
      <button className="btn" disabled={busy||verified} type="submit">{zh?"更新密碼":"Update password"}</button>
    </form>
    {passwordChanged&&<p role="status">{zh?"密碼已更新。原專案權限與 Google 綁定不變。":"Password updated. Your project access and Google link are unchanged."}</p>}
    {error&&<p className="login-err" role="alert">{authMessage(error,zh)}</p>}
  </section>;
}
/* ================= APP ================= */
/* Compact cloud-sync status light for the top bar (mirrors the fuller status
   inside Manage → Backup → CloudPanel). Only shown once cloud is configured;
   in pure local mode there is nothing to report. Admin can click it to jump to
   the backup panel where the full status + sign-in lives. */
function CloudStatusLight({ lang, admin, onOpen }) {
  const [, bump] = uState(0);
  uEffect(() => {
    const h = () => bump((n) => n + 1);
    window.addEventListener("bff:cloudstatus", h);
    return () => window.removeEventListener("bff:cloudstatus", h);
  }, []);
  const cloud = window.CLOUD || { configured: false, status: "local" };
  // Always render — never hide. Vendors and admin both see the light; when the
  // browser hasn't connected to the cloud it shows a neutral grey "本機" state
  // rather than disappearing (a hidden light reads as "broken" to the user).
  const ST = {
    connecting: { zh: "連線中", en: "Connecting", cls: "warn" },
    online: { zh: "已同步", en: "Synced", cls: "ok" },
    signedout: { zh: "待登入", en: "Sign in", cls: "warn" },
    error: { zh: "連線錯誤", en: "Error", cls: "bad" },
    local: { zh: "本機", en: "Local", cls: "local" },
  };
  const s = ST[cloud.status] || ST.local;
  const title = (lang === "zh" ? "雲端同步：" : "Cloud sync: ") + (lang === "zh" ? s.zh : s.en) + (cloud.message ? "\n" + cloud.message : "");
  return (
    <button className={"cloudlight cl-" + s.cls} title={title} onClick={admin && onOpen ? onOpen : undefined} aria-label={title}>
      <span className="cloudlight-dot" />
      <span className="cloudlight-txt">{lang === "zh" ? s.zh : s.en}</span>
    </button>);

}

function App() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "direction": "blueprint",
    "density": "regular",
    "showSchematic": true
  } /*EDITMODE-END*/;
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [lang, setLang] = uState(() => {try {return localStorage.getItem("bff:lang") || "zh";} catch (e) {return "zh";}});
  const [vendor, setVendor] = uState(() => window.AUTH.get());
  const [route, setRoute] = uState(() => parseRoute());
  const [zoom, setZoom] = uState(null);
  const [saveErr, setSaveErr] = uState(false);
  const [twOpen, setTwOpen] = uState(false);
  const t = makeT(lang);

  /* Standalone Tweaks toggle: the panel itself only opens on an
     __activate_edit_mode postMessage from this workspace's host, so outside
     that host (e.g. a plain GitHub Pages / Netlify deploy) it can never be
     reached. This button posts the same message to the window itself, which
     works with or without a host, and stays in sync if the panel is
     opened/closed by the real host too. */
  uEffect(() => {
    const onMsg = (e) => {
      const ty = e && e.data && e.data.type;
      if (ty === "__activate_edit_mode") setTwOpen(true);else
      if (ty === "__deactivate_edit_mode" || ty === "__edit_mode_dismissed") setTwOpen(false);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  function toggleTweaks() {
    const next = !twOpen;
    setTwOpen(next);
    window.postMessage({ type: next ? "__activate_edit_mode" : "__deactivate_edit_mode" }, "*");
  }

  uEffect(() => {
    let timer;
    const h = () => {setSaveErr(true);clearTimeout(timer);timer = setTimeout(() => setSaveErr(false), 8000);};
    window.addEventListener("bff:saveerror", h);
    return () => {window.removeEventListener("bff:saveerror", h);clearTimeout(timer);};
  }, []);

  uEffect(() => {
    const h = () => {setZoom(null);setVendor(window.AUTH.get());};
    window.addEventListener("bff:authchange", h);
    return () => window.removeEventListener("bff:authchange", h);
  }, []);

  uEffect(() => {applyTheme(tw.direction);}, [tw.direction]);
  uEffect(() => {
    document.documentElement.setAttribute("data-density", tw.density);
  }, [tw.density]);
  uEffect(() => {
    document.documentElement.setAttribute("data-schematic", tw.showSchematic ? "on" : "off");
  }, [tw.showSchematic]);
  uEffect(() => {try {localStorage.setItem("bff:lang", lang);} catch (e) {}}, [lang]);
  uEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const [, bump] = uState(0);
  uEffect(() => {
    const h = () => bump((n) => n + 1);
    window.addEventListener("bff:stockchange", h);
    window.addEventListener("bff:datachange", h);
    window.addEventListener("bff:reportchange", h);
    window.addEventListener("bff:cloudstatus", h);
    return () => {window.removeEventListener("bff:stockchange", h);window.removeEventListener("bff:datachange", h);window.removeEventListener("bff:reportchange", h);window.removeEventListener("bff:cloudstatus", h);};
  }, []);

  const open = (id) => {location.hash = "#/item/" + id;};
  const openFixture = (key) => {location.hash = "#/fixture/" + key;};
  const goTests = () => {location.hash = "";};
  const goFixtures = () => {location.hash = "#/fixtures";};
  const goStock = () => {location.hash = "#/stock";};
  const goEquipStock = () => {location.hash = "#/equip-stock";};
  const goEquipAdmin = () => {location.hash = "#/equip-admin";};
  const goTestcodes = () => {location.hash = "#/testcodes";};
  const goProjects = () => {location.hash = "#/projects";};
  const goNotices = () => {location.hash = "#/notices";};
  const goAdmin = () => {location.hash = "#/admin";};
  const goManage = () => {location.hash = "#/manage";};
  const goHistory = () => {location.hash = "#/history";};
  const goResults = () => {location.hash = "#/results";};
  const goAnomaly = () => {location.hash = "#/anomaly";};
  const editItem = (id) => {location.hash = "#/edit/" + id;};
  const back = () => {location.hash = route.name === "fixtureDetail" ? "#/fixtures" : "";};
  const item = route.name === "detail" ? window.DATA.ITEMS.find((i) => i.id === route.id) : null;
  const onFixturesArea = route.name === "fixtures" || route.name === "fixtureDetail";
  const dir = window.THEMES[tw.direction];
  const admin = window.AUTH.isAdmin(vendor);

  if (!vendor) return <Login lang={lang} setLang={setLang} t={t} />;
  const canWrite = !!window.CLOUD?.readyForWrites;

  return (
    <div className="app">
      <header className="topbar no-print">
        <button className="brand" onClick={goTests}>
          <span className="brand-mark"><span /></span>
          <span className="brand-txt">
            <span className="brand-title">{t("appTitle")}</span>
            <span className="brand-sub">{t("appSub")}</span>
          </span>
        </button>
        <nav className="topnav" aria-label="sections">
          {vendor && !admin && window.STORE.testcodes_forVendor(vendor.id).length > 0 &&
          <button className={"topnav-btn" + (route.name === "projects" ? " on" : "")} onClick={goProjects}>
              <Icon name="grid" size={15} />{lang === "zh" ? "目前專案" : "Current projects"}
            </button>
          }
          {admin &&
          <button className={"topnav-btn" + (route.name === "testcodes" ? " on" : "")} onClick={goTestcodes}>
            <Icon name="grid" size={15} />{lang === "zh" ? "產品代號" : "Product codes"}
          </button>
          }
          <button className={"topnav-btn" + (route.name === "list" || route.name === "detail" ? " on" : "")} onClick={goTests}>
            <Icon name="grid" size={15} />{lang === "zh" ? "測試項目" : "Tests"}
          </button>
          <button className={"topnav-btn" + (onFixturesArea ? " on" : "")} onClick={goFixtures}>
            <Icon name="cube" size={15} />{lang === "zh" ? "制具總覽" : "Fixtures"}
          </button>
          {admin ?
          <React.Fragment>
              <button className={"topnav-btn" + (route.name === "admin" ? " on" : "")} onClick={goAdmin}>
                <Icon name="shield" size={15} />{lang === "zh" ? "供應商盤點" : "Vendor stock"}
              </button>
              <button className={"topnav-btn" + (route.name === "equipAdmin" ? " on" : "")} onClick={goEquipAdmin}>
                <Icon name="bolt" size={15} />{lang === "zh" ? "設備盤點" : "Equipment"}
              </button>
              <button className={"topnav-btn" + (route.name === "manage" || route.name === "edit" ? " on" : "")} onClick={goManage}>
                <Icon name="pencil" size={15} />{lang === "zh" ? "管理中心" : "Manage"}
              </button>
              <button className={"topnav-btn" + (route.name === "results" ? " on" : "")} onClick={goResults}>
                <Icon name="grid" size={15} />{lang === "zh" ? "測試結果" : "Results"}
              </button>
              <button className={"topnav-btn" + (route.name === "anomaly" ? " on" : "")} onClick={goAnomaly}>
                <Icon name="file" size={15} />{lang === "zh" ? "異常申請" : "Anomalies"}
              </button>
              <button className={"topnav-btn" + (route.name === "history" ? " on" : "")} onClick={goHistory}>
                <Icon name="clock" size={15} />{lang === "zh" ? "變更歷史" : "History"}
              </button>
            </React.Fragment> :

          vendor && <button className={"topnav-btn" + (route.name === "stock" ? " on" : "")} onClick={goStock}>
              <Icon name="clipboard" size={15} />{lang === "zh" ? "庫存盤點" : "Stock-take"}
            </button>
          }
          {vendor && !admin &&
          <button className={"topnav-btn" + (route.name === "equipStock" ? " on" : "")} onClick={goEquipStock}>
              <Icon name="bolt" size={15} />{lang === "zh" ? "設備盤點" : "Equipment"}
            </button>
          }
          {vendor && !admin &&
          <button className={"topnav-btn" + (route.name === "anomaly" ? " on" : "")} onClick={goAnomaly}>
              <Icon name="file" size={15} />{lang === "zh" ? "異常申請" : "Anomaly"}
            </button>
          }
          {vendor && !admin &&
          <button className={"topnav-btn" + (route.name === "notices" ? " on" : "")} onClick={goNotices}>
              <Icon name="bell" size={15} />{lang === "zh" ? "變更通知" : "Change notices"}
            </button>
          }
        </nav>
        <div className="topbar-right">
          <CloudStatusLight lang={lang} admin={admin} onOpen={admin ? goManage : undefined} />
          {admin && <NotificationCenter lang={lang} onOpenStock={goAdmin} />}
          {vendor && !admin && <VendorAlertBell lang={lang} onGoStock={goStock} onGoEquip={goEquipStock} />}
          {!vendor && <a href="#/login" className="btn">{lang==="zh"?"登入":"Sign in"}</a>}
          {vendor && !admin && <a href="#/account" className="btn ghost">{lang==="zh"?"我的帳號":"My account"}</a>}
          {vendor && <div className={"vendor-chip" + (admin ? " is-admin" : "")} title={L2(vendor.name, lang)}>
            <span className="vendor-ava">{admin ? <Icon name="shield" size={15} /> : (L2(vendor.name, lang) || "?").trim().charAt(0)}</span>
            <span className="vendor-txt">
              <span className="vendor-k">{admin ? lang === "zh" ? "管理員" : "Admin" : lang === "zh" ? "供應商" : "Vendor"}</span>
              <span className="vendor-n">{L2(vendor.name, lang)}</span>
            </span>
            <button className="vendor-out" onClick={() => window.AUTH.logout()} title={lang === "zh" ? "登出" : "Sign out"}>
              <Icon name="logout" size={15} />
            </button>
          </div>}
          <div className="langtoggle" role="group" aria-label="language">
            <button className={lang === "zh" ? "on" : ""} onClick={() => setLang("zh")}>中文</button>
            <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
          <button className="icobtn tw-toggle" onClick={toggleTweaks}
          aria-label={lang === "zh" ? "設計調整" : "Design tweaks"} title={lang === "zh" ? "設計調整" : "Design tweaks"}>
            <Icon name="settings" size={16} />
          </button>
        </div>
      </header>

      <main className="main" key={vendor?.uid || "public"}>
        {!canWrite && route.name !== "account" ?
        <p role="status" className="block">{lang==="zh"?"正在連線驗證資料，暫時無法編輯。":"Verifying your data connection; editing is unavailable."}</p> :
        route.name === "account" && vendor && !admin ?
        <VendorAccount key={vendor.uid} lang={lang} vendor={vendor}/> :
        !admin && route.name === "detail" && !item ?
        <p role="status" className="block">{lang==="zh"?"這個測試未分配給你的公司。":"This test is not assigned to your company."}</p> :
        !admin && route.name === "fixtureDetail" && !Object.hasOwn(window.DATA.PARTS || {},route.key) ?
        <p role="status" className="block">{lang==="zh"?"這個治具不在你的專案內。":"This fixture is not part of your assigned projects."}</p> :
        route.name === "detail" && item ?
        <Detail item={item} lang={lang} t={t} onBack={goTests} vendor={canWrite ? vendor : null} admin={canWrite && admin} onZoom={(src, cap) => setZoom({ src, cap })} /> :
        route.name === "fixtureDetail" ?
        <FixtureDetail fxKey={route.key} lang={lang} t={t} onBack={goFixtures} onOpenTest={open} onZoom={(src, cap) => setZoom({ src, cap })} /> :
        route.name === "fixtures" ?
        <FixturesOverview lang={lang} t={t} onOpenFixture={openFixture} onOpenTest={open} /> :
        route.name === "admin" ?
        admin ? <AdminDashboard lang={lang} t={t} onOpenFixture={openFixture} /> : <Home lang={lang} t={t} theme={tw.direction} onOpen={open} vendor={vendor} admin={admin} /> :
        route.name === "stock" ?
        admin ? <AdminDashboard lang={lang} t={t} onOpenFixture={openFixture} /> : <StockEntry lang={lang} t={t} goFixtures={goFixtures} /> :
        route.name === "equipStock" ?
        admin ? <EquipmentAdminDashboard lang={lang} t={t} /> : <EquipmentStockEntry lang={lang} t={t} /> :
        route.name === "equipAdmin" ?
        admin ? <EquipmentAdminDashboard lang={lang} t={t} /> : <EquipmentStockEntry lang={lang} t={t} /> :
        route.name === "notices" ?
        <VendorNoticesPage lang={lang} t={t} goStock={goStock} goEquip={goEquipStock} /> :
        route.name === "anomaly" ?
        <AnomalyPage lang={lang} vendor={vendor} admin={admin} /> :
        route.name === "manage" ?
        admin ? <AdminManage lang={lang} t={t} onEdit={editItem} /> : <Home lang={lang} t={t} theme={tw.direction} onOpen={open} vendor={vendor} admin={admin} /> :
        route.name === "edit" ?
        admin ? <TestEditor id={route.id} lang={lang} t={t} onDone={goManage} /> : <Home lang={lang} t={t} theme={tw.direction} onOpen={open} vendor={vendor} admin={admin} /> :
        route.name === "history" ?
        admin ? <HistoryPage lang={lang} t={t} /> : <Home lang={lang} t={t} theme={tw.direction} onOpen={open} vendor={vendor} admin={admin} /> :
        route.name === "testcodes" ?
        admin ? <TestcodesPage lang={lang} t={t} onOpenTest={open} /> : <Home lang={lang} t={t} theme={tw.direction} onOpen={open} vendor={vendor} admin={admin} /> :
        route.name === "projects" ?
        !admin ? <VendorProjectsPage lang={lang} vendorId={vendor.id} onOpenTest={open} /> : <TestcodesPage lang={lang} t={t} onOpenTest={open} /> :
        route.name === "results" ?
        admin ? <ResultsMatrix lang={lang} t={t} onOpenTest={open} onZoom={(src, cap) => setZoom({ src, cap })} /> : <Home lang={lang} t={t} theme={tw.direction} onOpen={open} vendor={vendor} admin={admin} /> :
        <Home lang={lang} t={t} theme={tw.direction} onOpen={open} vendor={vendor} admin={admin} />}
      </main>

      <footer className="footer no-print">
        <span>{lang === "zh" ? "腳踏車品管部門 · 測試制具查詢系統 · " + (admin ? "管理員版" : vendor ? "供應商版" : "公開目錄") : "Bicycle QC · Test Fixture Finder · " + (admin ? "Admin" : vendor ? "Supplier" : "Public") + " edition"}</span>
        <span className="mono foot-dir">{dir && L2(dir.label, lang)}</span>
      </footer>

      <Lightbox img={zoom} onClose={() => setZoom(null)} />

      {saveErr &&
      <div className="save-toast no-print">
          <Icon name="x" size={16} />
          <span>{lang === "zh" ?
          "儲存失敗：本機儲存空間不足（照片過大）。請減少圖片或改用伺服器/雲端版本。" :
          "Save failed: local storage is full (image too large). Use fewer/smaller images or the served/cloud version."}</span>
          <button onClick={() => setSaveErr(false)} aria-label="dismiss"><Icon name="x" size={14} /></button>
        </div>
      }

      <TweaksPanel>
        <TweakSection label={lang === "zh" ? "設計方向" : "Design direction"} />
        <div className="dir-cards">
          {Object.entries(window.THEMES).map(([key, th]) =>
          <button key={key}
          className={"dir-card" + (tw.direction === key ? " on" : "")}
          data-dir={key}
          onClick={() => setTweak("direction", key)}>
              <span className="dir-sw"><i /><i /><i /></span>
              <span className="dir-name">{L2(th.label, lang)}</span>
              <span className="dir-blurb">{L2(th.blurb, lang)}</span>
            </button>
          )}
        </div>
        <TweakSection label={lang === "zh" ? "版面" : "Layout"} />
        <TweakRadio label={lang === "zh" ? "密度" : "Density"} value={tw.density}
        options={["compact", "regular", "comfy"]}
        onChange={(v) => setTweak("density", v)} />
        <TweakToggle label={lang === "zh" ? "顯示示意圖" : "Show schematics"} value={tw.showSchematic}
        onChange={(v) => setTweak("showSchematic", v)} />
      </TweaksPanel>
    </div>);

}

function L2(o, lang) {return o && o[lang] != null ? o[lang] : o && o.en || o;}

function parseRoute() {
  const h = location.hash;
  if (h === "#/login") return {name:"login"};
  if (h === "#/account") return {name:"account"};
  if (h.startsWith("#/item/")) return { name: "detail", id: h.replace("#/item/", "") };
  if (h.startsWith("#/fixture/")) return { name: "fixtureDetail", key: h.replace("#/fixture/", "") };
  if (h.startsWith("#/fixtures")) return { name: "fixtures" };
  if (h.startsWith("#/equip-stock")) return { name: "equipStock" };
  if (h.startsWith("#/equip-admin")) return { name: "equipAdmin" };
  if (h.startsWith("#/testcodes")) return { name: "testcodes" };
  if (h.startsWith("#/projects")) return { name: "projects" };
  if (h.startsWith("#/stock")) return { name: "stock" };
  if (h.startsWith("#/admin")) return { name: "admin" };
  if (h.startsWith("#/manage")) return { name: "manage" };
  if (h.startsWith("#/edit/")) return { name: "edit", id: h.replace("#/edit/", "") };
  if (h.startsWith("#/history")) return { name: "history" };
  if (h.startsWith("#/notices")) return { name: "notices" };
  if (h.startsWith("#/anomaly")) return { name: "anomaly" };
  if (h.startsWith("#/results")) return { name: "results" };
  return { name: "list" };
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);