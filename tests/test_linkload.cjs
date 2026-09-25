// Link columns: only task ids are looked up, in chunks — a board with URLs in a link column
// (Price & TB import, 24 Sep) built a ~500 KB request and hung on "Loading…" (25 Sep).
// Also pins the board's request-form button (request_types.default_project_id).
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
let fail = 0;
const check = (n, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) fail++; };
const fn = html.slice(html.indexOf('async function loadLinkedData'), html.indexOf('async function loadLinkedData') + 2500);
check('link lookup filters to uuids', /LINK_ID_RE\.test\(v\)/.test(fn));
check('link lookup is chunked', /i\+=150/.test(fn) && /\.in\('id',c\)/.test(fn));
check('no single unbounded .in over every link value', !/\.in\('id',\[\.\.\.ids\]\)/.test(fn));
check('URL in a link column is shown as a link', /imported URL in a link column/.test(html));
check('board topbar offers linked request forms', /function boardForms\(pid\)/.test(html) && /boardFormsMenu\(this,/.test(html));
console.log(fail ? `linkload: ${fail} FAILED` : 'linkload: all checks passed');
process.exit(fail ? 1 : 0);
