/* Account scope and vendor-data views shared by the Firebase client and tests. */
(function (root) {
  "use strict";
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const validVendor = (x) => typeof x === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(x) && !["admin", "anon", "anonymous"].includes(x);
  function verifiedLogin(user, token) {
    if(!user || user.isAnonymous || !token?.claims || token.claims.email_verified !== true) return null;
    const email=String(token.claims.email || "").trim().toLowerCase();
    if(!email || !["password","google.com"].includes(token.signInProvider)) return null;
    return {uid:user.uid,provider:token.signInProvider,email};
  }
  function session(user,token,isAdminEmail,membership) {
    const login=verifiedLogin(user,token);
    if(!login) return null;
    if(login.provider==="google.com" && isAdminEmail(login.email)) return {uid:login.uid,role:"admin",id:"admin",email:login.email};
    if(membership?.enabled!==true || membership.email!==login.email || !validVendor(membership.vendorId)) return null;
    return {uid:login.uid,role:"vendor",id:membership.vendorId,email:login.email};
  }
  const projectFields = ["id", "code", "name", "standard", "params", "photoBike", "photoSpec", "itemIds", "updatedAt"];
  function vendorProjectSnapshot(snap, vendorId) {
    if (!validVendor(vendorId)) throw new Error("Invalid vendor ID");
    const vendor = (snap.vendors || []).find(v => v.id === vendorId);
    return {
      vendor: vendor ? { id: vendorId, name: clone(vendor.name) } : null,
      testcodes: (snap.testcodes || []).filter(c => Array.isArray(c.vendorIds) && c.vendorIds.includes(vendorId)).map(c => {
        const copy = { vendorIds: [vendorId] };
        for (const key of projectFields) if (c[key] !== undefined) copy[key] = clone(c[key]);
        return copy;
      }),
    };
  }
  const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o?.[k]!==undefined).map(k=>[k,clone(o[k])]));
  function catalogSnapshot(snap) {
    // Explicit allowlist: no supplier credentials, inventory locations or private projects.
    const items=(snap.items||[]).map(item=>({
      ...pick(item,["id","code","name","summary","category","standard","clause","schematic","params","status","bike","passCriteria","updatedAt","version"]),
      fixtures:(item.fixtures||[]).map(f=>pick(f,["key","code","name","image","kind","qty","torque"])),
      equipment:(item.equipment||[]).map(e=>pick(e,["key","code","name","image","kind","qty"])),
      steps:(item.steps||[]).map(step=>pick(step,["title","desc","image"])),
    }));
    const library=xs=>Object.fromEntries(Object.entries(xs||{}).map(([k,v])=>[k,pick(v,["code","name","image","kind","material","version","updatedAt"])]));
    return {items,parts:library(snap.parts),equipment:library(snap.equipment),bikecats:clone(snap.bikecats||[])};
  }
  // Build one supplier's catalog on the trusted publishing path. This is not
  // a client-side permission check or a replacement for per-supplier rules.
  function scopedVendorCatalog(snap, vendorId) {
    const view = vendorProjectSnapshot(snap, vendorId);
    const allowed = new Set(view.testcodes.flatMap(p => Array.isArray(p.itemIds) ? p.itemIds : [])
      .filter(id => typeof id === "string" && id.length > 0));
    const publicShape = catalogSnapshot(snap);
    const items = publicShape.items.filter(item => allowed.has(item.id));
    const refs = (field) => new Set(items.flatMap(item => item[field] || [])
      .map(entry => entry.key).filter(key => typeof key === "string" && key.length > 0));
    const select = (dict, keys) => Object.fromEntries(
      Object.entries(dict).filter(([key]) => keys.has(key)));
    return {
      vendor: view.vendor,
      testcodes: view.testcodes,
      items,
      parts: select(publicShape.parts, refs("fixtures")),
      equipment: select(publicShape.equipment, refs("equipment")),
    };
  }
  function canRead(scope, id) { return !!scope && (scope.role === "admin" || scope.id === id); }
  function memory() {
    let scope = null;
    let entries = new Map();
    const key = (type, id) => type + ":" + id;
    return {
      setScope(next) {
        if (!next || !scope || next.uid !== scope.uid || next.role !== scope.role || next.id !== scope.id) entries = new Map();
        scope = next;
      },
      read(type, id) { return canRead(scope, id) ? clone(entries.get(key(type, id)) || {}) : {}; },
      write(type, id, val) {
        if (!canRead(scope, id)) return false;
        entries.set(key(type, id), clone(val || {}));
        return true;
      },
    };
  }
  const api = {session, verifiedLogin, validVendor, vendorProjectSnapshot, catalogSnapshot, scopedVendorCatalog, memory};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GIANTBIKE_ACCESS = Object.freeze(api);
})(typeof window === "undefined" ? globalThis : window);
