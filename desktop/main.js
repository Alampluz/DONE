'use strict';
/**
 * DONE for Windows - a thin desktop shell around the hosted app.
 *
 * The app itself (index.html, built by CI from src/) keeps being served from GitHub Pages and
 * talks to Supabase exactly as it does in a browser. Shipping a change to DONE therefore updates
 * every desktop install on its next launch - no new installer is needed. This shell only changes
 * when the window, the installer or the auto-updater needs to change.
 */
const { app, BrowserWindow, Menu, shell, session, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_URL = 'https://alampluz.github.io/DONE/'; // path is case-sensitive on GitHub Pages
const APP_ORIGIN = new URL(APP_URL).origin;

// One window per user. A second launch just focuses the first.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win = null;
let pendingDeepLink = null;

// done://reset?token_hash=...&type=recovery  ->  APP_URL#/reset?token_hash=...&type=recovery
// Only the password-reset link is accepted, and the target is rebuilt from the two known
// parameters, so a crafted done:// link can never navigate the window anywhere else.
function deepLinkToAppUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'done:' || u.hostname !== 'reset') return null;
    const token = u.searchParams.get('token_hash');
    if (!token || !/^[A-Za-z0-9_-]{8,256}$/.test(token) || u.searchParams.get('type') !== 'recovery') return null;
    return APP_URL + '#/reset?token_hash=' + encodeURIComponent(token) + '&type=recovery';
  } catch (_) { return null; }
}
function handleDeepLink(raw) {
  const target = deepLinkToAppUrl(raw);
  if (!target) return;
  if (!win || win.isDestroyed()) { pendingDeepLink = target; return; }
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  // The hash alone does not reload the page, so load it as a fresh navigation.
  win.loadURL(target).then(() => win.webContents.reload()).catch(() => {});
}
const linkFromArgv = argv => argv.find(a => typeof a === 'string' && a.startsWith('done://'));

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    // Ignore a saved position that is now off-screen (unplugged monitor, changed resolution).
    const visible = screen.getAllDisplays().some(d => {
      const b = d.workArea;
      return s.x >= b.x - 50 && s.y >= b.y - 50 && s.x < b.x + b.width - 100 && s.y < b.y + b.height - 100;
    });
    return { width: s.width, height: s.height, x: visible ? s.x : undefined, y: visible ? s.y : undefined, max: !!s.max };
  } catch (_) {
    return { width: 1360, height: 860, max: false };
  }
}

function saveState() {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  try {
    const max = win.isMaximized();
    const b = max ? (win._normalBounds || win.getBounds()) : win.getBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, max }));
  } catch (_) { /* best effort */ }
}

const isAppUrl = u => { try { return new URL(u).origin === APP_ORIGIN; } catch (_) { return false; } };
const isOfflinePage = u => u.startsWith('file:') && u.includes('offline.html');

function openExternal(u) {
  // Only hand real web / mail links to the OS. Never file:, javascript:, custom protocols.
  try {
    const p = new URL(u).protocol;
    if (p === 'https:' || p === 'http:' || p === 'mailto:') shell.openExternal(u);
  } catch (_) { /* ignore malformed */ }
}

function showOffline() {
  if (!win || win.isDestroyed()) return;
  win.loadFile(path.join(__dirname, 'offline.html'), { hash: encodeURIComponent(APP_URL) });
}

function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    width: st.width, height: st.height, x: st.x, y: st.y,
    minWidth: 980, minHeight: 640,
    backgroundColor: '#ffffff',
    title: 'DONE',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  if (st.max) win.maximize();
  win.once('ready-to-show', () => win.show());

  // Remember the un-maximised size so restoring after a maximise keeps the user's window.
  win.on('resize', () => { if (!win.isMaximized() && !win.isFullScreen()) win._normalBounds = win.getBounds(); });
  win.on('move', () => { if (!win.isMaximized() && !win.isFullScreen()) win._normalBounds = win.getBounds(); });
  win.on('close', saveState);

  // The page sets its own <title>; keep "DONE" in front when it is empty.
  win.on('page-title-updated', (e, t) => { if (!t) { e.preventDefault(); win.setTitle('DONE'); } });

  // Links that open a new window: DONE's own pages stay in the app, everything else goes to the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) { win.loadURL(url); } else { openExternal(url); }
    return { action: 'deny' };
  });

  // Plain navigations may not leave DONE (sign-in, reset links and the app stay in-app).
  win.webContents.on('will-navigate', (e, url) => {
    if (isAppUrl(url) || isOfflinePage(url)) return;
    e.preventDefault();
    openExternal(url);
  });

  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    // -3 = aborted (a redirect or a newer navigation); not a real failure.
    if (isMainFrame && code !== -3 && !isOfflinePage(url)) showOffline();
  });

  win.loadURL(pendingDeepLink || APP_URL);
  pendingDeepLink = null;
}

function buildMenu() {
  const template = [
    {
      label: 'DONE',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => win && win.webContents.reload() },
        { label: 'Hard reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => win && win.webContents.reloadIgnoringCache() },
        { type: 'separator' },
        { label: 'Open in browser', click: () => shell.openExternal(APP_URL) },
        { type: 'separator' },
        { role: 'quit', label: 'Quit DONE' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function setupAutoUpdate() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true; // new shell version installs when the user next quits
    autoUpdater.on('error', () => { /* offline or rate-limited: try again next launch */ });
    autoUpdater.checkForUpdates().catch(() => {});
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
  } catch (_) { /* updater unavailable: the hosted app still updates itself */ }
}

app.on('second-instance', (_e, argv) => {
  const link = linkFromArgv(argv);
  if (link) { handleDeepLink(link); return; }
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

// Register done:// (the installer does this too; this covers `npm start`).
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient('done', process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient('done');
}
{ const first = linkFromArgv(process.argv); if (first) pendingDeepLink = deepLinkToAppUrl(first); }

app.whenReady().then(async () => {
  app.setAppUserModelId('asia.crea.done'); // needed for Windows notifications and taskbar grouping

  // Only grant what DONE actually uses.
  const allowed = new Set(['notifications', 'clipboard-sanitized-write', 'fullscreen']);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));

  // CI redeploys index.html at the same URL; start from a clean HTTP cache so a launch never
  // shows yesterday's build. Sign-in (localStorage) lives elsewhere and is kept.
  try { await session.defaultSession.clearCache(); } catch (_) { /* ignore */ }

  buildMenu();
  createWindow();
  setupAutoUpdate();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => app.quit());
