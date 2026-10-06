/* Campaign targets, slice 1.
 * Daily-target import classifies the CUSP sheet (blank rows, "10.10" read as 10.1,
 * country outside the campaign, unknown brand, duplicate brand-line-date) and a
 * second import of the same dates replaces rows. Growth beyond ±30% needs a reason
 * before Propose. The demo record is local only — nothing here talks to Supabase.
 */
const fs = require('fs'), { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html.replace(/<script src=[^>]+><\/script>/g, ''), { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/index.html' });
const w = dom.window;
w.eval(`
window.scrollTo=()=>{};
window.__mkQuery=()=>{const q={
 select(){return q;}, single(){return q;}, insert(){return q;}, update(){return q;}, delete(){return q;},
 eq(){return q;}, is(){return q;}, in(){return q;}, order(){return q;}, limit(){return q;},
 then(res){ return Promise.resolve({data:[], error:{code:'PGRST205', message:'Could not find the table campaigns in the schema cache'}}).then(res); }};
 return q;};
window.supabase={createClient:()=>({from:window.__mkQuery, rpc:()=>Promise.resolve({data:null,error:null}),
 auth:{getSession:async()=>({data:{session:null}}), onAuthStateChange:()=>({data:{subscription:{}}})}})};`);
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
w.eval(scripts.join('\n') + `
window.__api = {S, cpUseDemo, cpById, cpCampaignTags, cpNormTagText, cpGrowth, cpNeedsReason,
  cpBaselineGmv, cpRollup, cpLineState, CP_STATE_RANK, cpBulk, cpSheetRows, cpGuessDailyMapping,
  cpValidateDaily, cpImportCtx, cpApplyImport, renderCampaigns, cpGo, cpVisibleLines};
`);
const {S, cpUseDemo, cpById, cpCampaignTags, cpNormTagText, cpGrowth, cpNeedsReason,
  cpBaselineGmv, cpRollup, cpLineState, CP_STATE_RANK, cpBulk, cpSheetRows, cpGuessDailyMapping,
  cpValidateDaily, cpImportCtx, cpApplyImport, renderCampaigns, cpGo, cpVisibleLines} = w.__api;

const HEAD = ['Date','country','Shop Name','Channel Name','contribution','campaign_name','Target GMV','Target Visitors','Target Buyers','Target Orders','Target AOV','Target CR','Target Ads Spend','Target FB Spending','Target Search Spending','Budget GMV','Target AMS Spending'];
function sheetFrom(rows){
  const read = cpSheetRows([HEAD].concat(rows));
  const mapping = cpGuessDailyMapping(read.headers);
  return {read, mapping};
}

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL: ' + n); } };

S.me = { id: 'me', role: 'admin', full_name: 'April', active: true };
cpUseDemo();
const c = cpById('demo-1010');

ok('10.1 is also offered as 10.10', JSON.stringify(cpCampaignTags(10.1)) === JSON.stringify(['10.10','10.1']));
ok('trailing space and dot collapse', cpNormTagText('Payday ') === 'Payday' && cpNormTagText('10.10.') === '10.10' && cpNormTagText('10.10 Cont.') === '10.10 Cont');
ok('exactly ±30% is not an outlier', cpGrowth(130, 100).hot === false && cpGrowth(70, 100).hot === false);
ok('beyond ±30% is an outlier', cpGrowth(131, 100).hot === true && cpGrowth(69, 100).hot === true);
ok('zero baseline is an em dash', cpGrowth(100, 0).text === '—' && cpGrowth(100, 0).hot === false);
ok('missing baseline is named', cpGrowth(100, null).text === 'No baseline' && cpGrowth(100, null).kind === 'nobase');
ok('missing target is an em dash', cpGrowth(null, 100).text === '—' && cpGrowth(null, 100).kind === 'notarget');

const sul = c.lines.find(l => l.brand === 'Sulwhasoo');
const mars = c.lines.find(l => l.brand === 'Mars');
const casio = c.lines.find(l => l.brand === 'Casio');
ok('Sulwhasoo needs a reason', cpNeedsReason(c, sul) === true);
ok('Mars has no baseline and is not an outlier', cpBaselineGmv(c, mars).kind === 'none' && cpNeedsReason(c, mars) === false);
ok('Casio has a baseline and no target', cpRollup(casio.targets, 'target').gmv == null && cpBaselineGmv(c, casio).kind === 'ok');

const proposed = c.lines.filter(l => (CP_STATE_RANK[cpLineState(l)] || 0) >= 1 && cpRollup(l.targets, 'target').gmv != null).length;
const approved = c.lines.filter(l => (CP_STATE_RANK[cpLineState(l)] || 0) >= 2 && cpRollup(l.targets, 'target').gmv != null).length;
const outliers = c.lines.filter(l => cpNeedsReason(c, l)).length;
ok('progress counts', proposed === 6 && approved === 4 && outliers === 3 && c.lines.length === 12);

S.cpSel = new Set([sul.id]);
S.route = { view: 'campaigns', id: 'demo-1010', tab: 'targets' };
w.location.hash = '#/campaigns/demo-1010/targets';
cpBulk(c.id, 'propose');
ok('Propose is refused without a reason', cpLineState(sul) === 'draft');

const { read, mapping } = sheetFrom([
  [],
  ['2026-10-10', 'TH', 'Clarins', 'Lazada', '', '10.10.', 2100000, 100, 10, 12, 100, 0.1, 1, 2, 3, 4, 5],
  ['2026-10-10', 'TH', 'Clarins', 'Lazada', '', 10.1, 1],
  ['2026-10-10', 'MY', 'Guess', 'Shopee', '', 'Payday ', 600000],
  ['2026-10-11', 'SG', 'Calvin Klein', 'Shopee', '', 'Mid month ', 900000],
  ['2026-10-10', 'TH', 'Nope Shop', 'Shopee', '', 'BAU', 100],
  ['2026-10-12', 'TH', 'Innisfree', 'TikTok Shop', '', '', 4500000],
  []
]);
ok('blank rows are counted, not imported as lines', read.blanks === 2 && read.rows.length === 6);
const rep = cpValidateDaily(read, mapping, cpImportCtx(c, { aliases: {}, phaseMap: {} }));
ok('duplicate brand-line-date blocks', rep.errors.some(e => e.code === 'dup' && /Clarins/.test(e.message)));
ok('unknown brand is one grouped error', rep.errors.filter(e => e.code === 'unknown').length === 1 && rep.errors.find(e => e.code === 'unknown').shop === 'Nope Shop');
ok('MY and SG are a warning, not a block by themselves', rep.warnings.some(e => e.code === 'country' && /MY 1/.test(e.message) && /SG 1/.test(e.message)));
ok('blank campaign tag is a warning', rep.warnings.some(e => e.code === 'tagblank'));
ok('Payday, Mid month and BAU are unmapped', rep.warnings.filter(e => e.code === 'tag').map(e => e.tag).sort().join(',') === 'BAU,Mid month,Payday');
ok('10.10. and numeric 10.1 map onto D-day', rep.parsed.filter(r => r.shop === 'Clarins').every(r => r.phase === 'dday' && r.tags.indexOf('10.10') >= 0));
ok('a numeric tag that is unmapped says it was read as a number', (() => {
  const bare = cpValidateDaily(read, mapping, { campaignId: 'x', countries: ['TH'], aliases: {}, phaseAliases: [] });
  return bare.warnings.some(e => e.code === 'tag' && e.tag === '10.10' && /10\.1/.test(e.message));
})());

const noGmv = HEAD.filter(h => h !== 'Target GMV');
const bareSheet = cpSheetRows([noGmv, ['2026-10-10', 'TH', 'Clarins', 'Lazada', '', '10.10', 1]]);
const bareMap = cpGuessDailyMapping(bareSheet.headers);
const missing = cpValidateDaily(bareSheet, bareMap, cpImportCtx(c, {}));
ok('a missing required column blocks before row errors', missing.blocked && missing.errors.some(e => /Target GMV/.test(e.message)) && missing.parsed.length === 0);

const aliased = cpValidateDaily(read, mapping, cpImportCtx(c, { aliases: { 'Nope Shop': 'b-nestle' }, phaseMap: { 'Payday': 'dday', 'Mid month': 'teasing' } }));
ok('an alias and a phase pick clear those errors', !aliased.errors.some(e => e.code === 'unknown' || e.code === 'tag') && aliased.parsed.find(r => r.shop === 'Nope Shop').brandId === 'b-nestle');
ok('the duplicate still blocks commit', aliased.blocked === true);

let lines = [];
const row = { brandId: 'b-clarins', brand: 'Clarins', platform: 'lazada', country: 'TH', date: '2026-10-10', gmv: 10, phase: 'dday' };
lines = cpApplyImport(lines, [row]);
lines[0].targets.push({ date: '2026-09-01', gmv: 7, state: 'locked' });
lines = cpApplyImport(lines, [Object.assign({}, row, { gmv: 99 }), Object.assign({}, row, { date: '2026-10-11', gmv: 5 })]);
lines = cpApplyImport(lines, [Object.assign({}, row, { gmv: 99 })]);
const oct = lines[0].targets.find(t => t.date === '2026-10-10');
const sep = lines[0].targets.find(t => t.date === '2026-09-01');
ok('re-import replaces the date range and keeps the day outside it', lines.length === 1 && lines[0].targets.length === 3 && oct.gmv === 99 && oct.state === 'draft' && sep.gmv === 7);

w.location.hash = '#/campaigns/demo-1010/targets';
renderCampaigns('demo-1010', 'targets');
let text = w.document.getElementById('content').textContent;
ok('header names the campaign and its phases', /10\.10 Mega 2026/.test(text) && /Teasing/.test(text) && /D-day/.test(text) && /Rerun\/Cont\./.test(text));
ok('progress strip is on the targets tab', /6\s*\/\s*12 lines proposed/.test(text) && /4 approved/.test(text) && /3 outliers need a reason/.test(text));
ok('demo banner says it is not saved', /Demo data/.test(text) && /Nothing you change here is saved/.test(text));
ok('baseline column is labelled with the reference campaign', /Baseline · 8\.8 2026 target/.test(text));
ok('Casio reads No target', /No target/.test(text));
ok('unfiltered total is the campaign total', /Campaign total/.test(text));
w.location.hash = '#/campaigns/demo-1010/targets?vertical=Beauty&platform=shopee';
renderCampaigns('demo-1010', 'targets?vertical=Beauty&platform=shopee');
text = w.document.getElementById('content').textContent;
const shown = cpVisibleLines(c).map(l => l.brand);
ok('Beauty × Shopee filter hides Clarins on Lazada', shown.indexOf('Innisfree') >= 0 && shown.indexOf('Clarins') < 0 && shown.every(b => ['Innisfree','Sulwhasoo','Aestura','Organic Ground'].indexOf(b) >= 0));
ok('filtered total is labelled', /Total shown/.test(text));

cpGo(c.id, 'data');
renderCampaigns(c.id, 'data');
ok('data tab offers the daily upload and holds the later imports', /Upload daily targets/.test(w.document.getElementById('content').textContent) && /Hourly GMV/.test(w.document.getElementById('content').textContent));

console.log('campaigntargets: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
