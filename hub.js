// Shared logic for the public hub (index.html) and the editor (admin.html).
const Hub = (() => {
  const CACHE_KEY = "hub-repos-cache";
  const CACHE_MS = 10 * 60 * 1000; // 10 minutes

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  function safeUrl(u) {
    try {
      const url = new URL(u);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch { return ""; }
  }

  async function loadConfig() {
    const res = await fetch("config.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load config.json");
    return normalizeConfig(await res.json());
  }

  function normalizeConfig(c) {
    return {
      username: c.username || "",
      hubRepo: c.hubRepo || "",
      title: c.title || "Mr. T Tools Hub",
      tagline: c.tagline || "",
      autoShowNew: c.autoShowNew !== false,
      showOnlyWithPages: !!c.showOnlyWithPages,
      includeForks: !!c.includeForks,
      hidden: Array.isArray(c.hidden) ? c.hidden : [],
      shown: Array.isArray(c.shown) ? c.shown : [],
      pinned: Array.isArray(c.pinned) ? c.pinned : [],
      overrides: c.overrides && typeof c.overrides === "object" ? c.overrides : {},
    };
  }

  // Fetch every public repo for the user (pages through 100 at a time).
  // Prefer data.json (built hourly by the GitHub Action) so visitors never hit API limits.
  async function loadSnapshot() {
    try {
      const res = await fetch("data.json?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return null;
      const d = await res.json();
      return Array.isArray(d.repos) ? d : null;
    } catch { return null; }
  }

  async function loadRepos(username, { useCache = true, token = "", live = false } = {}) {
    if (!live) {
      const snap = await loadSnapshot();
      if (snap) return snap.repos;
    }
    if (useCache) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        if (cached && cached.user === username && Date.now() - cached.at < CACHE_MS) return cached.repos;
      } catch {}
    }
    const headers = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = "Bearer " + token;
    const all = [];
    try {
      for (let page = 1; page <= 10; page++) {
        const res = await fetch(
          `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=pushed&page=${page}`,
          { headers }
        );
        if (!res.ok) throw new Error(res.status === 403 ? "GitHub rate limit reached — try again in a few minutes." : "GitHub returned " + res.status);
        const batch = await res.json();
        all.push(...batch);
        if (batch.length < 100) break;
      }
    } catch (err) {
      // Fall back to a stale cache rather than an empty page.
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        if (cached && cached.user === username) return cached.repos;
      } catch {}
      throw err;
    }
    const slim = all.map((r) => ({
      name: r.name,
      description: r.description || "",
      html_url: r.html_url,
      homepage: r.homepage || "",
      has_pages: !!r.has_pages,
      fork: !!r.fork,
      archived: !!r.archived,
      language: r.language || "",
      topics: r.topics || [],
      stars: r.stargazers_count || 0,
      pushed_at: r.pushed_at,
      created_at: r.created_at,
      apk: null,
    }));
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ user: username, at: Date.now(), repos: slim })); } catch {}
    return slim;
  }

  function liveUrl(repo, username) {
    const home = safeUrl(repo.homepage);
    if (home) return home;
    if (!repo.has_pages) return "";
    const host = `https://${username.toLowerCase()}.github.io/`;
    return repo.name.toLowerCase() === `${username.toLowerCase()}.github.io` ? host : host + encodeURIComponent(repo.name) + "/";
  }

  function prettyName(name) {
    return name.replace(/\.+$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Merge GitHub data with config overrides into display-ready items.
  function buildItems(repos, cfg) {
    const hub = (cfg.hubRepo || "").toLowerCase();
    return repos
      .filter((r) => r.name.toLowerCase() !== hub)
      .map((r) => {
        const o = cfg.overrides[r.name] || {};
        const url = safeUrl(o.url) || liveUrl(r, cfg.username);
        const apk = safeUrl(o.apk) || (r.apk && safeUrl(r.apk.url)) || "";
        return {
          repo: r,
          name: r.name,
          title: o.title || prettyName(r.name),
          description: o.description || r.description || "",
          category: o.category || "",
          url,
          apk,
          logo: safeUrl(o.logo) || `logos/${encodeURIComponent(r.name)}.svg`,
          code: r.html_url,
          pinned: cfg.pinned.includes(r.name),
          isNew: !cfg.hidden.includes(r.name) && !cfg.shown.includes(r.name) && !cfg.pinned.includes(r.name) && !cfg.overrides[r.name],
        };
      });
  }

  function isVisible(item, cfg) {
    const n = item.name;
    if (cfg.hidden.includes(n)) return false;
    const approved = cfg.shown.includes(n) || cfg.pinned.includes(n);
    if (approved) return true;
    if (!cfg.autoShowNew) return false;
    if (item.repo.fork && !cfg.includeForks) return false;
    if (cfg.showOnlyWithPages && !item.url && !item.apk) return false;
    return true;
  }

  function sortItems(items, cfg) {
    return items.slice().sort((a, b) => {
      const pa = cfg.pinned.indexOf(a.name), pb = cfg.pinned.indexOf(b.name);
      if (pa !== -1 || pb !== -1) return (pa === -1 ? 1e9 : pa) - (pb === -1 ? 1e9 : pb);
      return new Date(b.repo.pushed_at) - new Date(a.repo.pushed_at);
    });
  }

  function timeAgo(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (const [u, sec] of units) {
      const v = Math.floor(s / sec);
      if (v >= 1) return `${v} ${u}${v > 1 ? "s" : ""} ago`;
    }
    return "just now";
  }

  // Coloured letter tile used when a repo has no logo file yet.
  function letterTile(title) {
    let h = 0; for (const c of title) h = (h * 31 + c.charCodeAt(0)) % 360;
    const ch = (title.trim()[0] || "?").toUpperCase().replace(/[<&>"']/g, "");
    return "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="hsl(${h},55%,45%)"/><text x="32" y="43" font-family="system-ui,sans-serif" font-size="30" font-weight="700" fill="#fff" text-anchor="middle">${ch}</text></svg>`);
  }

  return { letterTile, esc, safeUrl, loadConfig, loadSnapshot, normalizeConfig, loadRepos, buildItems, isVisible, sortItems, timeAgo, CACHE_KEY };
})();
