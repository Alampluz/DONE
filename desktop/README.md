# DONE for Windows

A small desktop shell around the hosted DONE app (https://alampluz.github.io/DONE/).
The app still deploys through the existing CI; this folder only builds the Windows
installer.

- Its own window and taskbar icon, remembers size and position, one window per user.
- Sign-in stays after closing (same Supabase session as the browser).
- Always loads the latest DONE on launch. Shipping a change to `src/` updates every install; no new installer.
- Offline page with a retry when DONE can't be reached.
- Links to other sites open in the default browser; DONE stays inside the app.
- The shell itself auto-updates from GitHub Releases and installs the update when the user next quits.
- Per-user install: no admin rights, no IT ticket for a normal install.

## Ship a version

1. Put this folder in the repo as `desktop/` and the workflow as `.github/workflows/desktop-release.yml`.
2. In GitHub Desktop: commit, **Push origin**.
3. Create a tag `desktop-v1.0.0` (GitHub web: Releases > Draft a new release > new tag, publish; or `git tag desktop-v1.0.0 && git push origin desktop-v1.0.0`).
4. Actions builds on Windows (~4 min) and attaches `DONE-Setup-1.0.0.exe` to the release.
5. Staff download the .exe from the Releases page and double-click.

Next version: bump the tag (`desktop-v1.0.1`). The tag sets the version; no file edit needed.

## Rolling out to all CREA staff

- **SmartScreen.** Unsigned installers show "Windows protected your PC > More info > Run anyway". For a company-wide
  rollout either have IT allow the installer, or buy a code-signing certificate and add repo secrets `CSC_LINK`
  (base64 .pfx) and `CSC_KEY_PASSWORD`; the workflow signs automatically when they exist.
- **Silent install** (Intune / GPO / script): `DONE-Setup-1.0.0.exe /S`
- **Uninstall:** Settings > Apps > DONE.
- The repo is public, so the Releases page is public too. The installer holds no secrets (the Supabase anon key
  is already in the public web bundle).

## Run it locally

Needs Node 20+.

```
cd desktop
npm install
npm start          # opens DONE in the desktop shell
npm run dist       # builds dist/DONE-Setup-<version>.exe locally
```

## Files

| File | Purpose |
| --- | --- |
| `main.js` | Window, navigation rules, permissions, auto-update |
| `offline.html` | Shown when DONE can't be reached |
| `build/icon.ico`, `icon.png` | App icon (upscaled from `brand/icon180`; swap in a 512 px original when you have one) |
| `package.json` | Electron + installer config (NSIS, per-user) |
| `.github-workflow-desktop-release.yml` | Copy to `.github/workflows/desktop-release.yml` |
