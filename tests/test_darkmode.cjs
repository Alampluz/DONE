/* Dark mode: token parity, contrast, and no colour literals creeping back.
 *
 * B is the one that matters long-term. Adding a colour token to :root and forgetting the dark
 * counterpart is silent — the light value just leaks through and you get a white chip on a dark
 * card. This fails the build instead.
 *
 * C re-checks contrast in BOTH themes. The 11 Sep a11y pass tuned --ink3 for 4.83:1 on white;
 * that logic inverts on a dark surface, so dark needs its own proof, not a flipped value.
 */
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

let fail = 0;
const check = (name, ok, extra) => { if (!ok) { fail++; console.log('FAIL', name, extra !== undefined ? '-> ' + JSON.stringify(extra) : ''); } };

// ---- parse both token blocks -------------------------------------------------------------
function block(re) {
  const m = re.exec(html);
  if (!m) return null;
  const out = {};
  for (const d of m[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
  return out;
}
// the app's own :root (the first one, in part1) and its dark counterpart
const light = block(/:root\s*\{([\s\S]*?)\}/);
const dark  = block(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\}/);

check('A. light :root parsed', !!light && Object.keys(light).length > 20, light && Object.keys(light).length);
check('A. dark :root parsed',  !!dark  && Object.keys(dark).length  > 20, dark  && Object.keys(dark).length);

// ---- B. every colour token in light must be redefined in dark -----------------------------
if (light && dark) {
  const missing = Object.keys(light).filter(k => /^#[0-9a-fA-F]{3,8}$/.test(light[k]) && !(k in dark));
  check('B. every light colour token has a dark counterpart', missing.length === 0, missing);
}

// ---- C. contrast, in both themes ----------------------------------------------------------
const hex = h => { h = h.replace('#',''); if (h.length===3) h = [...h].map(c=>c+c).join('');
  return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)); };
const lum = c => { const f = v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  const [r,g,b] = c.map(f); return 0.2126*r + 0.7152*g + 0.0722*b; };
const ratio = (a,b) => { const L1 = lum(hex(a)), L2 = lum(hex(b));
  return (Math.max(L1,L2) + 0.05) / (Math.min(L1,L2) + 0.05); };

// text token -> the surface it actually sits on
const PAIRS = [
  ['--ink','--panel'], ['--ink','--bg'],
  ['--ink2','--panel'], ['--ink3','--panel'], ['--ink3','--bg'],
  ['--accent-ink','--panel'],
  ['--red','--red-soft'], ['--green','--green-soft'],
  ['--amber','--amber-soft'], ['--blue','--blue-soft'], ['--purple','--purple-soft'],
  ['--sidebar-ink','--sidebar'],
];
for (const [themeName, tokens, base] of [['light', light, light], ['dark', dark, light]]) {
  if (!tokens) continue;
  for (const [fg, bg] of PAIRS) {
    const f = tokens[fg] || base[fg], b = tokens[bg] || base[bg];
    if (!f || !b || !f.startsWith('#') || !b.startsWith('#')) continue;
    const r = ratio(f, b);
    check(`C. ${themeName}: ${fg} on ${bg} >= 4.5:1`, r >= 4.5, Math.round(r * 100) / 100);
  }
}

// ---- D. no greyscale literals anywhere — stylesheet INCLUDED ------------------------------
// The first version of this check sliced the file at </style> and only scanned markup. part1's
// CSS held 81 literals (.tv-wrap, .tv td, .modal all nailed to #fff) and the check passed while
// the board rendered white-on-dark. Now the whole document is scanned, minus the two token blocks
// and comments. The allowlist is the exact intentional residue: the login screen and the public
// request form (dark by design, own palettes), white text on saturated fills, the Appearance
// swatch previews, and one var() fallback.
const ALLOW = new Set(['#0B0F0E','#101114','#161613','#16181D','#222220','#2A3532','#6F7A77','#8A9591',
                       '#9DA1A7','#AEB7B4','#B7C0BD','#E6EAE8','#F1F1EC','#F2F1EC','#F2F5F4','#F7F7F4',
                       '#FFFFFF','#fff']);
let scan = html.replace(/:root(\[data-theme="dark"\])?\s*\{[\s\S]*?\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const strays = [];
for (const m of scan.matchAll(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g)) {
  const raw = '#' + m[1];
  if (ALLOW.has(raw)) continue;
  const [r,g,b] = hex(raw);
  if (Math.max(r,g,b) - Math.min(r,g,b) <= 18) strays.push(raw);
}
check('D. no new greyscale literals in CSS or markup', strays.length === 0, [...new Set(strays)].slice(0, 12));

// ---- E. the theme is applied before first paint, and defaults to light --------------------
const head = html.slice(0, html.indexOf('</head>'));
check('E. pre-paint theme script is in <head>', /data-theme/.test(head) && /done-theme/.test(head));
check('E. defaults to light, not the OS', /localStorage\.getItem\('done-theme'\)\s*\|\|\s*'light'/.test(html));
check('E. system option resolves against prefers-color-scheme',
      /t === 'system'[\s\S]{0,120}prefers-color-scheme/.test(html));

// ---- F. the preference is stored per person, not just locally -----------------------------
check('F. theme lives in nav_prefs', /theme:\s*\(p\.theme==='dark'\|\|p\.theme==='system'\)/.test(html));
check('F. applied at boot from the profile row', /applyTheme\(navPrefs\(\)\.theme\)/.test(html));
check('F. Appearance tab wires the picker', /onclick="setThemePref\('\$\{k\}'\)"/.test(html));
check('F. Appearance tab offers all three', /opt\('light',/.test(html)
      && /opt\('dark',/.test(html) && /opt\('system',/.test(html));

console.log(fail ? `darkmode: ${fail} FAILED` : 'darkmode: all checks passed');
process.exit(fail ? 1 : 0);
