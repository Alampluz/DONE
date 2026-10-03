/* Creative Queue assign order.
   Brand routes, then Brand + Livestreaming Frame overrides, then Em ← B2B Shopee.
   A Livestreaming Frame rule with no brand list cannot replace a brand-specific assignee.
   Interpharma has no designer and stays unassigned. */
const fs = require('fs');
const path = require('path');
const {resolveCreativeAssignee} = require('../tools/creative_routing/assign.js');
const mapping = JSON.parse(fs.readFileSync(path.join(__dirname, '../tools/creative_routing/monday_mapping.json'), 'utf8'));
const rules = mapping.rules;

const noBrandFrame = {
  designer: 'No-brand livestream',
  email: null,
  brands: [],
  only_if_artwork_type: 'Livestreaming Frame',
};
const withHostile = rules.concat([noBrandFrame]);

let ok = true;
const check = (name, cond, extra) => {
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (cond || !extra ? '' : ' -> ' + extra));
  if (!cond) ok = false;
};

const who = (list, brand, artwork) => resolveCreativeAssignee(list, {brand, artwork}).assignee;

check('mapping has the 20 Monday routes and no empty-brand rule',
  rules.length === 20 && rules.every(r => Array.isArray(r.brands) && r.brands.length > 0 && r.designer));

const uncovered = (mapping.uncovered || []).find(u => u.brand === 'Interpharma');
check('Interpharma is flagged uncovered with no designer',
  !!uncovered && uncovered.designer == null && !rules.some(r => (r.brands || []).includes('Interpharma')));

check('Interpharma stays unassigned, including Livestreaming Frame',
  who(rules, 'Interpharma', null) == null && who(rules, 'Interpharma', 'Livestreaming Frame') == null);

const brandCases = [
  ['CREA', null, 'Vee'],
  ['Hasbro', 'Static KV', 'Vee'],
  ['Jungsaemmool (JSM)', null, 'Tysha'],
  ['MLB', null, 'Peach'],
  ['Nescafe Dolce Gusto (NDG)', null, 'Peach'],
  ['Mars', null, 'Nattanon'],
  ['Aestura', null, 'Aiw'],
  ['Decathlon', null, 'Mark'],
  ['Kiko Milano', 'Static KV', 'Mark'],
  ['Nestle', null, 'Best'],
  ['SharkNinja', null, 'Best'],
  ['Laneige', null, 'Yanee'],
  ['Casio', null, 'Ittikom'],
  ['Tommy Hilfiger', null, 'Ittikom'],
  ['Hills\' Pet', null, 'Unchaya'],
  ['Guess', null, 'Weerapat'],
  ['111Skin', null, 'Munliga'],
  ['Hera', null, 'Kultida'],
  ['Banila Co', null, 'Piumprom'],
  ['Bose', null, 'Sun'],
  ['Lacoste', null, 'Sun'],
  ['B2B Shopee', null, 'Areelak'],
  ['B2B Shopee', 'Static KV', 'Areelak'],
];
for (const [brand, artwork, designer] of brandCases) {
  const got = who(rules, brand, artwork);
  check(`brand route ${brand} → ${designer}`, got === designer, got);
}

const frameCases = [
  ['Casio', 'Sorrakrai', 'Ittikom'],
  ['Decathlon', 'Sorrakrai', 'Mark'],
  ['Nestle', 'Alisa', 'Best'],
  ['Nestle Pet Care', 'Alisa', 'Peach'],
  ['Mars', 'Pongsathon', 'Nattanon'],
  ['Nespresso', 'Pongsathon', 'Weerapat'],
  ['Jungsaemmool (JSM)', 'Areelak', 'Tysha'],
  ['Banila Co', 'Areelak', 'Piumprom'],
  ['B2S', 'Areelak', null],
  ['Organic ground', 'Alisa', 'Munliga'],
  ['Bose', 'Sorrakrai', 'Sun'],
];
for (const [brand, frameDesigner, brandDesigner] of frameCases) {
  const got = who(rules, brand, 'Livestreaming Frame');
  check(`livestream override ${brand} → ${frameDesigner} (brand route was ${brandDesigner || 'none'})`,
    got === frameDesigner, got);
}

check('B2B Shopee livestream still lands on the last-resort rule (Areelak / Em)',
  who(rules, 'B2B Shopee', 'Livestreaming Frame') === 'Areelak');

check('a later no-brand Livestreaming Frame rule cannot replace Nestle\'s Alisa',
  who(withHostile, 'Nestle', 'Livestreaming Frame') === 'Alisa');
check('a later no-brand Livestreaming Frame rule cannot replace Casio\'s Sorrakrai',
  who(withHostile, 'Casio', 'Livestreaming Frame') === 'Sorrakrai');
check('a later no-brand Livestreaming Frame rule cannot replace Em on B2B Shopee',
  who(withHostile, 'B2B Shopee', 'Livestreaming Frame') === 'Areelak');
check('a no-brand Livestreaming Frame rule does not fire for a non-frame brief',
  who(withHostile, 'Nestle', 'Static KV') === 'Best');

const nestle = resolveCreativeAssignee(withHostile, {brand: 'Nestle', artwork: 'Livestreaming Frame'});
check('Nestle frame applies Best, then Alisa, and skips the no-brand rule',
  nestle.applied.map(s => `${s.designer}${s.skipped ? '*' : ''}`).join(',') === 'Best,Alisa,No-brand livestream*');

if (!ok) process.exit(1);
