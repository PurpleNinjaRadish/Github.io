// Builds data.json: every public repo for the hub owner, plus the newest APK in its releases.
// Runs in GitHub Actions so visitors never hit the GitHub API rate limit.
import { readFile, writeFile } from "node:fs/promises";

const cfg = JSON.parse(await readFile("config.json", "utf8"));
const user = cfg.username;
const headers = { Accept: "application/vnd.github+json", "User-Agent": "tools-hub" };
if (process.env.GITHUB_TOKEN) headers.Authorization = "Bearer " + process.env.GITHUB_TOKEN;

async function gh(path) {
  const res = await fetch("https://api.github.com" + path, { headers });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

const repos = [];
for (let page = 1; page <= 10; page++) {
  const batch = await gh(`/users/${user}/repos?per_page=100&type=owner&sort=pushed&page=${page}`);
  repos.push(...batch.filter((r) => !r.private));
  if (batch.length < 100) break;
}

const out = [];
for (const r of repos) {
  let apk = null;
  try {
    const releases = await gh(`/repos/${user}/${encodeURIComponent(r.name)}/releases?per_page=10`);
    for (const rel of releases) {
      if (rel.draft) continue;
      const asset = rel.assets.find((a) => a.name.toLowerCase().endsWith(".apk"));
      if (asset) { apk = { name: asset.name, url: asset.browser_download_url, tag: rel.tag_name, size: asset.size }; break; }
    }
  } catch (e) { console.warn("releases failed for", r.name, e.message); }
  out.push({
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
    apk,
  });
}

const json = JSON.stringify({ generated_at: new Date().toISOString(), repos: out }, null, 2) + "\n";
let old = "";
try { old = await readFile("data.json", "utf8"); } catch {}
const strip = (s) => s.replace(/"generated_at": "[^"]*",?/, "");
if (strip(old) === strip(json)) { console.log("No changes."); }
else { await writeFile("data.json", json); console.log(`Wrote ${out.length} repos.`); }
