/* GitHub WebP image storage helper (replaces Firebase Storage for $0 hosting).
   Uploads admin catalog images as WebP files into the GitHub repository via the
   GitHub Contents API (using an admin-only Fine-grained PAT stored strictly in
   the admin's local browser — never synced to Firestore or committed to git).

   When GitHub PAT is not configured (e.g. vendors, or offline admin), uploads
   automatically fall back to compact WebP data-URIs stored inline in Firestore
   / IndexedDB — zero Firebase Storage usage or billing.

   window.bffUploadImage(file, maxPx, quality, storagePath, capBytes)
     -> Promise<string>  (raw.githubusercontent.com URL or WebP data-URI)
   window.bffUploadDataUri(dataUri, storagePath)
     -> Promise<string>  (raw.githubusercontent.com URL or original data-URI)
   window.bffStorageAvailable() -> bool
   window.bffDeleteStorage(url|path) -> Promise (best-effort)
   window.GH_STORAGE = { DEFAULT, getConfig, setConfig, clearToken, isReady, testConnection, isFirebaseStorageUrl } */
(function () {
  const KEY = "bff:ghmedia";
  const DEFAULT = {
    owner: "pc007ya",
    repo: "GIANTbike",
    branch: "main",
    dir: "media",
  };

  function getConfig() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { saved = {}; }
    return {
      owner: String(saved.owner || DEFAULT.owner).trim(),
      repo: String(saved.repo || DEFAULT.repo).trim(),
      branch: String(saved.branch || DEFAULT.branch).trim(),
      dir: String(saved.dir != null ? saved.dir : DEFAULT.dir).replace(/^\/+|\/+$/g, ""),
      token: String(saved.token || "").trim(),
    };
  }
  function emitChange() {
    try { window.dispatchEvent(new CustomEvent("bff:ghstoragechange")); } catch (e) {}
  }
  function setConfig(patch) {
    const next = Object.assign({}, getConfig(), patch || {});
    next.owner = String(next.owner || DEFAULT.owner).trim();
    next.repo = String(next.repo || DEFAULT.repo).trim();
    next.branch = String(next.branch || DEFAULT.branch).trim();
    next.dir = String(next.dir != null ? next.dir : DEFAULT.dir).replace(/^\/+|\/+$/g, "");
    next.token = String(next.token || "").trim();
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) {}
    emitChange();
    return next;
  }
  function clearToken() {
    return setConfig({ token: "" });
  }
  function isReady() {
    const c = getConfig();
    return !!(c.owner && c.repo && c.branch && c.token);
  }
  function isFirebaseStorageUrl(url) {
    return typeof url === "string" && /firebasestorage\.(googleapis\.com|app)/i.test(url);
  }

  function encodePath(p) {
    return String(p || "").split("/").filter(Boolean).map(encodeURIComponent).join("/");
  }
  function normalizeRepoPath(storagePath, dir) {
    let clean = String(storagePath || "")
      .replace(/\\/g, "/")
      .replace(/^\/+|\/+$/g, "")
      .replace(/\.\.+/g, "_")
      .replace(/\s+/g, "_");
    if (!clean) return "";
    // Normalize image extension to .webp
    if (/\.(jpe?g|png|gif|bmp|avif)$/i.test(clean)) clean = clean.replace(/\.(jpe?g|png|gif|bmp|avif)$/i, ".webp");
    else if (!/\.webp$/i.test(clean)) clean += ".webp";
    const prefix = String(dir || "").replace(/^\/+|\/+$/g, "");
    if (prefix && clean.indexOf(prefix + "/") !== 0) clean = prefix + "/" + clean;
    return clean;
  }
  function extractBase64(dataUri) {
    if (typeof dataUri !== "string" || dataUri.slice(0, 5) !== "data:") return null;
    const comma = dataUri.indexOf(",");
    if (comma < 0) return null;
    const meta = dataUri.slice(0, comma);
    const body = dataUri.slice(comma + 1);
    if (/;base64/i.test(meta)) return body.replace(/\s+/g, "");
    try { return btoa(decodeURIComponent(body)); } catch (e) { return null; }
  }
  function headers(token) {
    return {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
    };
  }

  // Serialize GitHub Contents API writes so back-to-back uploads never collide (HTTP 409).
  let _queue = Promise.resolve();
  function enqueue(fn) {
    const run = _queue.then(fn, fn);
    _queue = run.catch(function () {});
    return run;
  }

  async function fetchSha(cfg, fullPath) {
    const url = "https://api.github.com/repos/" + encodeURIComponent(cfg.owner) + "/" + encodeURIComponent(cfg.repo) +
      "/contents/" + encodePath(fullPath) + "?ref=" + encodeURIComponent(cfg.branch);
    const resp = await fetch(url, { headers: headers(cfg.token), cache: "no-store" });
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error("GitHub GET " + resp.status);
    const data = await resp.json();
    return data && data.sha ? data.sha : null;
  }

  async function putBase64(cfg, fullPath, b64, retried) {
    const sha = await fetchSha(cfg, fullPath);
    const url = "https://api.github.com/repos/" + encodeURIComponent(cfg.owner) + "/" + encodeURIComponent(cfg.repo) +
      "/contents/" + encodePath(fullPath);
    const payload = {
      message: "Upload WebP media: " + fullPath,
      content: b64,
      branch: cfg.branch,
    };
    if (sha) payload.sha = sha;
    const resp = await fetch(url, {
      method: "PUT",
      headers: headers(cfg.token),
      body: JSON.stringify(payload),
    });
    if (resp.status === 409 && !retried) {
      return putBase64(cfg, fullPath, b64, true);
    }
    if (!resp.ok) {
      let detail = "";
      try { const j = await resp.json(); detail = j && j.message ? " (" + j.message + ")" : ""; } catch (e) {}
      throw new Error("GitHub PUT " + resp.status + detail);
    }
    const data = await resp.json();
    const refSha = (data && data.commit && data.commit.sha) ? data.commit.sha : cfg.branch;
    return "https://raw.githubusercontent.com/" + encodeURIComponent(cfg.owner) + "/" + encodeURIComponent(cfg.repo) +
      "/" + encodeURIComponent(refSha) + "/" + encodePath(fullPath);
  }

  async function deleteRepoPath(cfg, fullPath) {
    const sha = await fetchSha(cfg, fullPath);
    if (!sha) return;
    const url = "https://api.github.com/repos/" + encodeURIComponent(cfg.owner) + "/" + encodeURIComponent(cfg.repo) +
      "/contents/" + encodePath(fullPath);
    await fetch(url, {
      method: "DELETE",
      headers: headers(cfg.token),
      body: JSON.stringify({ message: "Remove media: " + fullPath, sha: sha, branch: cfg.branch }),
    });
  }

  async function testConnection() {
    const cfg = getConfig();
    if (!cfg.owner || !cfg.repo || !cfg.token) {
      throw new Error("請填寫 GitHub 帳號、倉庫名稱與 Token / Missing owner, repo, or token");
    }
    const url = "https://api.github.com/repos/" + encodeURIComponent(cfg.owner) + "/" + encodeURIComponent(cfg.repo);
    const resp = await fetch(url, { headers: headers(cfg.token), cache: "no-store" });
    if (!resp.ok) {
      let msg = "";
      try { const j = await resp.json(); msg = j && j.message ? j.message : ""; } catch (e) {}
      throw new Error("HTTP " + resp.status + (msg ? " — " + msg : ""));
    }
    const data = await resp.json();
    if (data && data.permissions && data.permissions.push === false) {
      throw new Error("此 Token 沒有寫入權限（需 Contents: Read and write）");
    }
    return { fullName: data.full_name, defaultBranch: data.default_branch, isPrivate: !!data.private };
  }

  function extractOwnedRepoPath(urlOrPath, cfg) {
    if (!urlOrPath || typeof urlOrPath !== "string") return null;
    if (isFirebaseStorageUrl(urlOrPath) || urlOrPath.slice(0, 5) === "data:") return null;
    if (/^https?:\/\/raw\.githubusercontent\.com\//i.test(urlOrPath)) {
      const m = urlOrPath.match(/^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/[^/]+\/(.+?)(?:\?.*)?$/i);
      if (!m) return null;
      if (decodeURIComponent(m[1]).toLowerCase() !== cfg.owner.toLowerCase()) return null;
      if (decodeURIComponent(m[2]).toLowerCase() !== cfg.repo.toLowerCase()) return null;
      return decodeURIComponent(m[3]);
    }
    if (!/^https?:/i.test(urlOrPath)) {
      return urlOrPath.replace(/^\/+/, "");
    }
    return null;
  }

  window.GH_STORAGE = {
    DEFAULT,
    getConfig,
    setConfig,
    clearToken,
    isReady,
    testConnection,
    isFirebaseStorageUrl,
  };

  window.bffStorageAvailable = function () { return isReady(); };

  window.bffUploadImage = function (file, maxPx, quality, storagePath, capBytes) {
    // Always compress and convert to WebP first.
    return window.bffResizeImage(file, maxPx, quality, capBytes).then(function (dataUri) {
      if (!isReady() || !storagePath) return dataUri;
      // Keep vendor-side uploads inline (WebP data-URI) unless actively signed in as admin.
      const isVendorPath = String(storagePath).indexOf("vendors/") === 0;
      const u = window.AUTH && window.AUTH.get && window.AUTH.get();
      const adminNow = !!(u && u.role === "admin");
      if (isVendorPath && !adminNow) return dataUri;
      return window.bffUploadDataUri(dataUri, storagePath);
    });
  };

  window.bffUploadDataUri = function (dataUri, storagePath) {
    if (typeof dataUri !== "string" || dataUri.slice(0, 5) !== "data:") return Promise.resolve(dataUri);
    if (!isReady() || !storagePath) return Promise.resolve(dataUri);
    const cfg = getConfig();
    const fullPath = normalizeRepoPath(storagePath, cfg.dir);
    if (!fullPath) return Promise.resolve(dataUri);
    const b64 = extractBase64(dataUri);
    if (!b64) return Promise.resolve(dataUri);
    return enqueue(function () {
      return putBase64(cfg, fullPath, b64, false);
    }).catch(function () {
      return dataUri; // upload failed -> keep inline WebP so the app still works
    });
  };

  window.bffDeleteStorage = function (urlOrPath) {
    if (!isReady() || !urlOrPath) return Promise.resolve();
    const cfg = getConfig();
    const repoPath = extractOwnedRepoPath(urlOrPath, cfg);
    if (!repoPath) return Promise.resolve();
    // Safety guard: only delete files inside the configured media directory.
    const prefix = cfg.dir ? cfg.dir + "/" : "";
    if (prefix && repoPath.indexOf(prefix) !== 0) return Promise.resolve();
    return enqueue(function () {
      return deleteRepoPath(cfg, repoPath);
    }).catch(function () {});
  };
})();
