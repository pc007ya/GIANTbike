/* GIANTbike Auth + Firestore only. Public catalog pages never contact Firebase
   for facility data; private data starts on a verified, provisioned session. */
const access = window.GIANTBIKE_ACCESS;
const CLOUD = {
  enabled: false, configured: false, status: "local", message: "", user: null,
  readyForWrites: false, setConfig, disableCloud, signIn: signInAdmin, signInAdmin,
  signInVendor, requestReset, verifyEmail, confirmLinkPassword, linkGoogle,
  googleLinked, googleLinkStatus, signOutCloud, appendAnomaly, publishSupplierViews,
  registerSupplier, lookupSupplier, disableSupplier,
  writeReport:(vendorId,key,value)=>writeCell("report",vendorId,key,value),
};
window.CLOUD = CLOUD;
let api = null, releaseReady, generation = 0, sessionKey = "", firstData = false, writeTimer = null, listeners = [];
let linkPermit = null, signOutPending = false, manualAuth = false, tokenEvent = 0;
const ready = new Promise(r => { releaseReady = r; });
const emit = () => window.dispatchEvent(new CustomEvent("bff:cloudstatus"));
function status(value, message = "") { CLOUD.status = value; CLOUD.message = message; emit(); }
function fail(code) { return Object.assign(new Error(code), {code}); }
const same = (g) => g === generation;
const resetURL = () => new URL(location.pathname, location.origin).href + "#/login";
const vendorCollections = {stock:"bff_stock", report:"bff_report", stepphoto:"bff_stepphoto"};
const readConfig = () => {
  // When deployed, site config is pinned. A local dev sandbox may override only
  // when no site config is shipped, never switching real users' live project.
  if (window.FIREBASE_CONFIG?.projectId && window.FIREBASE_CONFIG?.apiKey) return window.FIREBASE_CONFIG;
  try { return JSON.parse(localStorage.getItem("bff:fbconfig") || "null"); } catch { return null; }
};
function setConfig(text) {
  if (window.FIREBASE_CONFIG?.projectId) throw fail("bff/fixed-config");
  const cfg = typeof text === "string" ? JSON.parse(text) : text;
  if (!cfg?.apiKey || !cfg?.projectId) throw fail("bff/bad-config");
  localStorage.setItem("bff:fbconfig", JSON.stringify(cfg));
  location.reload();
}
function disableCloud() {
  if (window.FIREBASE_CONFIG?.projectId) throw fail("bff/fixed-config");
  localStorage.removeItem("bff:fbconfig"); location.reload();
}
async function requireAPI() { await ready; if (!api) throw fail("bff/cloud-unavailable"); return api; }
async function identity(user, refresh = false) {
  if (!user || user.isAnonymous) return null;
  const token=await api.a.getIdTokenResult(user,refresh);
  const login=access.verifiedLogin(user,token);
  if(!login) return null;
  const admin=access.session(user,token,window.AUTH.isAdminEmail);
  if(admin?.role==="admin") return {...window.AUTH.ADMIN,...admin};
  let member;
  try {
    const snap=await api.f.getDocFromServer(membershipRecord(login.uid));
    if(!snap.exists()) return null;
    member=snap.data();
  } catch(e) {
    if(e.code==="permission-denied") return null;
    throw e;
  }
  // Firestore also enforces the same-UID, enabled exact company identity
  // plus Google signed subject, independently of these UI checks.
  const session=access.session(user,token,window.AUTH.isAdminEmail,member);
  if(!session) return null;
  const def = window.AUTH.VENDORS.find(v => v.id === session.id);
  return {...session, name: def?.name || {zh:session.id,en:session.id}};
}
function tokenKey(s) { return s && [s.uid,s.role,s.id,s.email].join(":"); }
function applySession(s) {
  const next = tokenKey(s);
  if (next && next === sessionKey) { emit(); return; }
  generation++;
  sessionKey = next || "";
  linkPermit = null;
  firstData = false;
  CLOUD.readyForWrites = false;
  listeners.forEach(unsub => unsub());
  listeners = [];
  clearTimeout(writeTimer);
  CLOUD.user = s;
  window.AUTH.set(s);
  window.STORE.resetAccessScope();
  status(s ? "connecting" : "signedout");
  if (s) startSync(s, generation);
}
async function completeLogin(perform, role) {
  await requireAPI();
  manualAuth = true; tokenEvent++;
  try {
    const {user} = await perform();
    const s = await identity(user, true);
    if (api.auth.currentUser?.uid !== user.uid || signOutPending) throw fail("bff/session-changed");
    if (!s || s.role !== role) {
      // Keep unverified email/password users signed in *only* long enough to
      // request the verification email; no UI access or Firestore reads.
      if (role === "vendor" && !user.isAnonymous && !user.emailVerified && user.providerData.some(p => p.providerId === "password")) {
        applySession(null); throw fail("bff/email-unverified");
      }
      await api.a.signOut(api.auth);
      applySession(null);
      throw fail(role === "admin" ? "bff/not-admin" : "bff/not-provisioned");
    }
    applySession(s); return s;
  } finally { manualAuth = false; }
}
const google = () => {
  const provider = new api.a.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
};
function signInAdmin() { return completeLogin(() => api.a.signInWithPopup(api.auth, google()), "admin"); }
function signInVendor(email, password, viaGoogle = false) {
  return completeLogin(() => viaGoogle
    ? api.a.signInWithPopup(api.auth, google())
    : api.a.signInWithEmailAndPassword(api.auth, String(email || "").trim(), password), "vendor");
}
async function requestReset(email) {
  const {a,auth} = await requireAPI();
  try { await a.sendPasswordResetEmail(auth, String(email || "").trim(), {url: resetURL()}); }
  catch (e) { if (e.code !== "auth/user-not-found") throw e; } // account-neutral response
}
async function verifyEmail() {
  const {a,auth} = await requireAPI();
  if (!auth.currentUser || auth.currentUser.isAnonymous) throw fail("bff/signed-out");
  await a.sendEmailVerification(auth.currentUser, {url:resetURL()});
}
function scopedVendor() {
  const me = window.AUTH.get();
  const user = api?.auth.currentUser;
  if (!me || me.role !== "vendor" || user?.uid !== me.uid || user.isAnonymous || signOutPending) throw fail("bff/not-provisioned");
  return {me,user,g:generation};
}
function googleSubject(token) {
  const x=token.claims?.firebase?.identities?.["google.com"];
  return Array.isArray(x) && x.length===1 && typeof x[0]==="string" ? x[0] : "";
}
function membershipRecord(uid) {
  return api.f.doc(api.db,"bff_supplierAccounts",uid);
}
function requireManager() {
  const u=window.AUTH.get();
  if(!api || u?.role!=="admin" || api.auth.currentUser?.uid!==u.uid || !CLOUD.readyForWrites) throw fail("bff/admin-not-ready");
}
function verifiedUID(v) {
  const s=String(v||"").trim();
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(s)) throw fail("bff/invalid-uid");
  return s;
}
async function registerSupplier(uid,email,vendorId) {
  requireManager();
  const ref=membershipRecord(verifiedUID(uid));
  const normalized=String(email||"").trim().toLowerCase();
  if(!/^[^@\s]{1,128}@[^@\s]+\.[^@\s]+$/.test(normalized) || normalized.length>320) throw fail("bff/invalid-email");
  if(!access.validVendor(vendorId) || !window.AUTH.VENDORS.some(v=>v.id===vendorId)) throw fail("bff/invalid-vendor");
  await api.f.runTransaction(api.db,async tx=>{
    if((await tx.get(ref)).exists()) throw fail("bff/registry-exists");
    tx.set(ref,{email:normalized,vendorId,enabled:true});
  });
}
async function lookupSupplier(uid) {
  requireManager();
  const s=await api.f.getDocFromServer(membershipRecord(verifiedUID(uid)));
  return s.exists()?s.data():null;
}
async function disableSupplier(uid) {
  requireManager();
  await api.f.updateDoc(membershipRecord(verifiedUID(uid)),{enabled:false});
}
const googleRef=uid=>api.f.doc(api.db,"bff_googleLinks",uid);
async function hasGoogleGrant(uid,sub) {
  const snap=await api.f.getDocFromServer(googleRef(uid));
  return snap.exists() && snap.data().googleSub===sub;
}
function linkedProvider(user) {
  return user.providerData.find(p=>p.providerId==="google.com");
}
function googleLinked() {
  try{return !!linkedProvider(scopedVendor().user);}catch{return false;}
}
async function googleLinkStatus() {
  const {user,g}=scopedVendor();
  const p=linkedProvider(user);
  if(!p) return "none";
  const active=await hasGoogleGrant(user.uid,p.uid);
  if(!same(g)) throw fail("bff/session-changed");
  return active?"active":"pending";
}
async function linkGoogle() {
  const {me,user,g}=scopedVendor();
  const attached=linkedProvider(user);
  manualAuth=true; tokenEvent++;
  // The temporary Google-authenticated phase has no grant yet; never let
  // it consume or accidentally terminate active private listeners.
  listeners.forEach(unsub=>unsub()); listeners=[];
  CLOUD.readyForWrites=false;status("connecting");
  try {
    const result=attached
      ? await api.a.reauthenticateWithPopup(user,google())
      : await api.a.linkWithPopup(user,google());
    const subject=linkedProvider(result.user)?.uid;
    if (!same(g) || api.auth.currentUser?.uid !== me.uid || result.user.uid!==me.uid || !subject) throw fail("bff/session-changed");
    linkPermit={uid:me.uid,g,subject,until:Date.now()+5*60*1000};
  } catch(e) {
    if(same(g)) {
      const s=await identity(api.auth.currentUser).catch(()=>null);
      if(s?.uid===me.uid) startSync(me,g);
    }
    throw e;
  } finally {manualAuth=false;}
}
async function confirmLinkPassword(password) {
  const {me,user,g}=scopedVendor();
  if(!linkPermit || linkPermit.uid!==me.uid || linkPermit.g!==g || Date.now()>linkPermit.until) throw fail("bff/reauth-required");
  const permit=linkPermit;
  manualAuth=true;tokenEvent++;
  try {
    await api.a.reauthenticateWithCredential(user,api.a.EmailAuthProvider.credential(me.email,password));
    const token=await api.a.getIdTokenResult(user,true);
    if(!same(g) || api.auth.currentUser?.uid!==me.uid || token.signInProvider!=="password" || googleSubject(token)!==permit.subject) throw fail("bff/session-changed");
    const ref=googleRef(me.uid);
    if(!await hasGoogleGrant(me.uid,permit.subject)) await api.f.setDoc(ref,{googleSub:permit.subject});
    if(!same(g) || api.auth.currentUser?.uid!==me.uid) throw fail("bff/session-changed");
    linkPermit=null;
    startSync(me,g);
  } finally {manualAuth=false;}
}
async function signOutCloud() {
  signOutPending = true;
  tokenEvent++;
  applySession(null);
  try { if (api?.auth.currentUser) await api.a.signOut(api.auth); }
  finally { signOutPending = false; }
}

const ids = n => n > 0 && n < 445 && Number.isSafeInteger(n);
const textBytes = s => new TextEncoder().encode(s).length;
function chunk(data) {
  const json = JSON.stringify(data);
  const parts = [];
  let i=0;
  while (i < json.length) {
    // Any UTF-16 code unit is at most 3 bytes; avoid cutting a surrogate pair.
    let end = Math.min(i+260000,json.length);
    if (end < json.length && /^[\uD800-\uDBFF]$/.test(json[end-1])) end--;
    parts.push(json.slice(i,end)); i=end;
  }
  return {json,parts};
}
function masterRef() { return api.f.doc(api.db,"bff","data"); }
function catalogRef() { return api.f.doc(api.db,"bff_catalog","data"); }
function projectsRef(vid) { return api.f.doc(api.db,"bff_vendorProjects",vid); }
function documentPart(ref,i) {
  const {db,f}=api;
  if (ref.path === "bff/data") return f.doc(db,"bff","data_"+i); // existing legacy shape
  if (ref.path === "bff_catalog/data") return f.doc(db,"bff_catalog","data_"+i);
  return f.doc(ref,"chunks","data_"+i);
}
function stageView(batch,ref,data) {
  const {json,parts} = chunk(data);
  if (textBytes(json) > 9_000_000) throw fail("bff/data-too-large");
  if (textBytes(json) < 800_000) { batch.set(ref,data); return 1; }
  if (!ids(parts.length)) throw fail("bff/data-too-large");
  batch.set(ref,{_rev:data._rev,chunked:true,chunks:parts.length});
  parts.forEach((s,i)=>batch.set(documentPart(ref,i),{_rev:data._rev,i,s}));
  return parts.length + 1;
}
async function readView(ref, meta) {
  if (!meta.chunked) return meta;
  if (!ids(meta.chunks)) throw fail("bff/bad-project-data");
  const parts = await Promise.all(Array.from({length:meta.chunks},(_,i)=>api.f.getDocFromServer(documentPart(ref,i))));
  return JSON.parse(parts.map((snap,i)=>{
    const d=snap.exists() && snap.data();
    if (!d || d.i !== i || d._rev !== meta._rev || typeof d.s !== "string") throw fail("bff/snapshot-mismatch");
    return d.s;
  }).join(""));
}
let lastMasterRev=0;
let priorProjections=null;
function safeMaster(data) {
  const {adminCode,sheetsConfig,...clean} = data;
  return {...clean,vendors:(clean.vendors || []).map(v=>({id:v.id,name:v.name}))};
}
async function saveAdmin(g, force = false) {
  if (!same(g) || window.AUTH.get()?.role !== "admin" || !firstData) throw fail("bff/admin-not-ready");
  const raw = safeMaster(window.STORE.snapshotData());
  const rev = Math.max(lastMasterRev+1,Date.now());
  if(!force) lastMasterRev=rev;
  raw._rev=rev;
  const batch = api.f.writeBatch(api.db);
  let count=force ? 0 : stageView(batch,masterRef(),raw);
  const next = {catalog:access.catalogSnapshot(raw), projects:new Map()};
  const prev = priorProjections;
  const prevProjects = prev?.projects || new Map();
  if (force || !prev || JSON.stringify(prev.catalog)!==JSON.stringify(next.catalog)) count+=stageView(batch,catalogRef(),{...next.catalog,_rev:rev});
  const active = new Set(raw.vendors.map(v=>v.id).filter(access.validVendor));
  for (const id of new Set([...active,...prevProjects.keys()])) {
    const data = access.vendorProjectSnapshot(raw,id);
    if (active.has(id)) next.projects.set(id,data);
    if (force || JSON.stringify(prevProjects.get(id))!==JSON.stringify(data)) count+=stageView(batch,projectsRef(id),{...data,_rev:rev});
  }
  if (count > 440) throw fail("bff/too-many-projections");
  await batch.commit();
  if (same(g)) priorProjections=next;
}
async function publishSupplierViews() { return saveAdmin(generation,true); }
function syncFailure(e,g) {
  if(!same(g)) return;
  if(e.code==="permission-denied" && window.AUTH.get()?.role==="vendor") {
    signOutCloud().catch(()=>{});
    status("error","供應商權限停止或尚未開通 / Supplier access is not available.");
    return;
  }
  status("error",e.message);
}
function subscribeView(ref,g,onView,onAbsent) {
  let serial=0;
  listeners.push(api.f.onSnapshot(ref, {includeMetadataChanges:true},async snap=>{
    if (!same(g) || snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
    const seq=++serial;
    if (!snap.exists()) { onAbsent?.(); return; }
    try {
      const meta=snap.data();
      if (ref.path==="bff/data" && (meta._rev || 0) < lastMasterRev) return;
      const d=await readView(ref,meta);
      if (same(g) && seq===serial) onView(d);
    } catch(e) { if (seq===serial) syncFailure(e,g); }
  },e=>syncFailure(e,g)));
}
function startSync(me,g) {
  const f=api.f, db=api.db;
  const isAdmin=me.role==="admin";
  priorProjections=null; lastMasterRev=0;
  const pending=new Set(isAdmin ? ["master"] : ["catalog","projects","stock","report","stepphoto"]);
  const mark=key=>{
    pending.delete(key);
    if (!pending.size && same(g)) { CLOUD.readyForWrites=true; status("online"); }
  };
  if (isAdmin) {
    subscribeView(masterRef(),g,data=>{
      if ((data._rev || 0) < lastMasterRev) return;
      lastMasterRev=data._rev || 0;
      firstData=true;
      window.STORE.hydrate(safeMaster(data));
      mark("master");
    },()=>{firstData=true;mark("master");}); // never seed/overwrite production implicitly
  } else {
    subscribeView(membershipRecord(me.uid),g,d=>{
      if(d.enabled!==true || d.vendorId!==me.id || d.email!==me.email) {
        syncFailure({code:"permission-denied",message:"Supplier access disabled"},g);
      }
    },()=>syncFailure({code:"permission-denied",message:"Supplier access disabled"},g));
    subscribeView(catalogRef(),g,d=>{
      window.STORE.hydrate(access.catalogSnapshot(d)); mark("catalog");
    },()=>mark("catalog"));
    subscribeView(projectsRef(me.id),g,d=>{
      const view={vendors:d.vendor ? [d.vendor] : [],testcodes:Array.isArray(d.testcodes)?d.testcodes:[]};
      window.STORE.hydrate(view); mark("projects");
    },()=>{ window.STORE.hydrate({vendors:[], testcodes:[]}); mark("projects"); });
  }
  const all = {...vendorCollections, ...(isAdmin ? {loginlog:"bff_loginlog"} : {})};
  for (const [kind,collection] of Object.entries(all)) {
    const ref = isAdmin ? f.collection(db,collection) : f.doc(db,collection,me.id);
    let gotServer=false;
    listeners.push(f.onSnapshot(ref,{includeMetadataChanges:true},snap=>{
      if (!same(g) || snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
      if (isAdmin && !gotServer) snap.docs.forEach(c=>window.AUTH.cache.write(kind,c.id,c.data()));
      else if (isAdmin) snap.docChanges().forEach(c=>window.AUTH.cache.write(kind,c.doc.id,c.type==="removed"?{}:c.doc.data()));
      else window.AUTH.cache.write(kind,me.id,snap.exists()?snap.data():{});
      gotServer=true;
      window.dispatchEvent(new CustomEvent("bff:"+kind+"change"));
      if (!isAdmin) mark(kind);
    },e=>syncFailure(e,g)));
  }
}
function vendorRef(kind,vid) {
  const {me}=scopedVendor();
  if (me.id !== vid || !CLOUD.readyForWrites || !vendorCollections[kind]) throw fail("bff/vendor-not-ready");
  return api.f.doc(api.db,vendorCollections[kind],vid);
}
async function writeCell(kind,vid,key,value) {
  const ref=vendorRef(kind,vid);
  if (!key || [ "__proto__", "constructor", "prototype" ].includes(key)) throw fail("bff/bad-field");
  const f=api.f;
  await f.setDoc(ref,{[key]:value === undefined ? f.deleteField() : value},{mergeFields:[new f.FieldPath(key)]});
}
async function appendAnomaly(vid,record) {
  const ref=vendorRef("report",vid);
  const f=api.f;
  await f.setDoc(ref,{__anomalies:f.arrayUnion(record)},{merge:true});
}
for (const kind of Object.keys(vendorCollections)) {
  window.addEventListener("bff:"+kind+"write",e=>{
    const g=generation;
    const {vendorId,key,value}=e.detail || {};
    writeCell(kind,vendorId,key,value).catch(ex=>{if(same(g)) status("error",ex.message);});
  });
}
window.addEventListener("bff:datachange",()=>{
  if (window.STORE.isApplyingRemote() || window.AUTH.get()?.role!=="admin" || !firstData) return;
  const g=generation;
  clearTimeout(writeTimer);
  writeTimer=setTimeout(()=>saveAdmin(g).catch(e=>syncFailure(e,g)),800);
});

(async()=>{
  const config=readConfig();
  CLOUD.configured=!!config;
  if (!config) { releaseReady(); return; }
  CLOUD.enabled=true;
  try {
    const [appMod,a,f]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
    ]);
    const app=appMod.initializeApp(config);
    const auth=a.getAuth(app);
    await a.setPersistence(auth,a.browserSessionPersistence);
    const db=f.initializeFirestore(app,{localCache:f.memoryLocalCache()});
    api={a,f,auth,db};
    let first=true;
    a.onIdTokenChanged(auth,async user=>{
      if (first) { first=false; releaseReady(); }
      if (manualAuth || signOutPending) return;
      const event=++tokenEvent;
      try {
        const s=await identity(user);
        if (event!==tokenEvent || manualAuth || signOutPending || api.auth.currentUser?.uid!==user?.uid) return;
        applySession(s);
      } catch(e) { if (event===tokenEvent) { applySession(null); status("error",e.message); } }
    },e=>{if(first){first=false;releaseReady();} status("error",e.message);});
  } catch(e) { api=null; releaseReady(); status("error",e.message); }
})();
