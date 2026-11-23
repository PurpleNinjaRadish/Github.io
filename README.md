# Mr. T Tools Hub

A public GitHub Pages site that lists all of my tools, with a description of each, a link to its web version, and an APK download for Android apps. New public repos appear on their own. `admin.html` controls which projects are shown.

- **Public page:** https://purpleninjaradish.github.io/Github.io/
- **Editor:** https://purpleninjaradish.github.io/Github.io/admin.html

## Setup (one time)

1. This repo (`Github.io`) must be **public**. (Rename it to `PurpleNinjaRadish.github.io` to serve the hub at the root URL, then update `hubRepo` in `config.json`.)
2. The site files live in the root of this repo.
3. Open **Settings → Pages**, set **Source** to “Deploy from a branch”, and choose `main` / `(root)`. The site goes live in a minute or two.
4. Make a token for the editor at https://github.com/settings/personal-access-tokens/new
   - **Repository access:** Only select repositories → `Github.io`
   - **Permissions:** Contents → **Read and write**
   - Store it somewhere safe, like your password manager. The editor asks for it each time you open it.

## How it works

- `index.html` gets your public repos from the GitHub API each time someone visits (the result is cached in the browser for 10 minutes). It then applies `config.json` to them.
- **Live link:** this is the repo's *Website* field if it has one. Otherwise, if the repo has GitHub Pages turned on, the link is `https://purpleninjaradish.github.io/<repo>/`.
- **Description:** this is the description you write in the editor. If you haven't written one, the page uses the repo's GitHub “About” description.
- Private repos never appear on the page.
- `admin.html` saves your changes by committing `config.json` straight to this repo. There's no server to run.

## Editor options

| Option | Effect |
|---|---|
| Show | Shows or hides a repo on the public page |
| Feature | Pins a repo to the top. Use ↑/↓ to set the order |
| Display name / Category / Link / What it does | Override what's shown. Categories become filter buttons on the page |
| Auto-show new repos | When off, new repos stay hidden until you tick **Show** |
| Only auto-show repos with a live page | Skips repos that have no Pages site or website |
| Auto-show forks | Includes repos you forked |

To give a project a live page, open that repo's **Settings → Pages** and turn Pages on. It will get an **Open** button automatically.

## Web versions and APK downloads

- **🌐 Web version:** appears automatically when a repo has GitHub Pages turned on or a *Website* set. You can also paste any link in the editor.
- **📱 Download APK:** appears automatically when a repo's newest release that has an APK contains a file ending in `.apk`. You can also paste any link in the editor.
- The **Refresh project list** GitHub Action rebuilds `data.json` every hour, so visitors don't hit GitHub's API limits. To refresh right away, open **Actions → Refresh project list → Run workflow**.
