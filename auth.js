/* UI session is derived from verified Firebase identity; never restored from localStorage. */
(function () {
  const VENDORS = [
    { id: "giant", name: { zh: "巨大機械", en: "Giant Mfg." } },
    { id: "merida", name: { zh: "美利達工業", en: "Merida Industry" } },
    { id: "maxxis", name: { zh: "正新瑪吉斯", en: "Maxxis / Cheng Shin" } },
    { id: "kmc", name: { zh: "桂盟企業 KMC", en: "KMC Chain" } },
    { id: "sram", name: { zh: "速聯 SRAM", en: "SRAM Taiwan" } },
    { id: "tektro", name: { zh: "彥豪金屬 Tektro", en: "Tektro Technology" } },
  ];
  const ADMIN = { id: "admin", role: "admin", name: { zh: "品管部 管理員", en: "QC Administrator" } };
  // Keep in sync with the verified Google email list in deployed rules.
  const ADMIN_EMAILS = ["pc007ya@gmail.com"];
  const isAdminEmail = (email) => typeof email === "string" && ADMIN_EMAILS.includes(email.trim().toLowerCase());
  let current = null;
  const cache = window.GIANTBIKE_ACCESS.memory();
  function get() { return current; }
  function set(user) {
    cache.setScope(user);
    current = user;
    window.dispatchEvent(new CustomEvent("bff:authchange"));
  }
  async function logout() {
    if (window.CLOUD) return window.CLOUD.signOutCloud();
    set(null);
  }
  const isAdmin = (u) => !!(u && u.role === "admin");
  function stockOf(id) { return cache.read("stock", id); }
  function allLoginLogs() {
    if (!isAdmin(current)) return [];
    return window.AUTH.VENDORS.flatMap(v => {
      const d = cache.read("loginlog", v.id);
      return (Array.isArray(d.entries) ? d.entries : []).map(e => ({ ...e, vendorId: v.id, vendor: v.name }));
    }).sort((a,b) => b.at - a.at);
  }
  window.AUTH = { VENDORS, ADMIN, ADMIN_EMAILS, isAdminEmail, get, set, logout, isAdmin, stockOf, allLoginLogs, cache };
})();
