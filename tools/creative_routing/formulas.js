/* Monday Creative Queue formulas (board 5617471353), rewritten in DONE's formula
   language. Read live on 3 Oct 2026. Blank number inputs count as 0. A blank date
   makes Request to Deadline blank. Brand weight uses Monday's SWITCH list as
   written; a brand that is not in that list, including Interpharma, is 0.
   DONE stores one Brand, so Monday's divide-by-{Brand#Count} is 1 when a brand
   is set and the weight is the listed number. {Priority} is DONE's built-in
   priority, so Monday's Priority status column is added as "Priority status". */
const BRAND_WEIGHTS = [
  ['111Skin', 3],
  ['Acne-Aid and Spectraban (iNova)', 2],
  ['Aestura', 3],
  ['Armani Exchange', 2],
  ['Banila Co', 3],
  ['Calvin Klein', 3],
  ['Casio', 1],
  ['Clarins', 3],
  ['CREA', 2],
  ['Crocs', 2],
  ['Dyson', 1],
  ['Enfagrow', 1],
  ['Fila', 2],
  ['Fit Flop', 2],
  ['G2000', 1],
  ['Goodone', 1],
  ['Guess', 1],
  ['Heydude', 1],
  ["Hills' Pet", 2],
  ['Hush Puppies', 1],
  ['JDE World Of Coffee', 1],
  ['Jockey', 1],
  ['Jungsaemmool (JSM)', 3],
  ['Kiko Milano', 3],
  ['Lee', 1],
  ['Malin + Goetz (MG)', 1],
  ['Mars', 3],
  ['Mille', 1],
  ['Mizumi', 1],
  ['MLB', 2],
  ['Nescafe Dolce Gusto (NDG)', 3],
  ['Nestle', 2],
  ['Paul Smith', 1],
  ['Polo Ralph Lauren', 1],
  ['Ponds', 3],
  ['PVH Calvin Klein', 2],
  ['PVH Tommy Hilfiger', 2],
  ['RB Dettol & Hygiene', 3],
  ['RB Durex', 1],
  ['Sabina', 1],
  ['Smart Travel', 1],
  ['The North Face (TNF)', 1],
  ['Three', 3],
  ['Tommy Hilfiger', 2],
  ['Unilever Beauty HotPro', 3],
  ['Unilever Home Care', 3],
  ['Unilever Profession Solutions', 1],
  ['Wrangler', 1],
  ['doicha', 1],
  ["Oxe'secure", 1],
  ['SOS', 1],
  ['Snail White', 1],
  ['Tinder', 1],
];

const COUNT_LABELS = ['#SIS AW', '#PDP AW', '#Frame PDP AW', '#Visibility AW', '#Live Frame', '#MKT AW', '# non cats'];

function q(label){
  return '{' + label + '}';
}
function zero(label){
  return 'IF(' + q(label) + '="",0,' + q(label) + ')';
}
function switchExpr(valueExpr, pairs, fallback){
  const args = [valueExpr];
  pairs.forEach(([match, result]) => {
    args.push(JSON.stringify(match), String(result));
  });
  args.push(String(fallback));
  return 'SWITCH(' + args.join(', ') + ')';
}

const kvExpr = [
  ['Platform KV', 2],
  ['Brand Image KV', 2],
  ['Adapt from Brief', 2],
  ['New Create', 3],
  ['Regional Asset', 5],
].reduceRight((els, [label, factor]) => {
  return 'IF(' + q('Key Visual Type') + '=' + JSON.stringify(label) + ', ' + zero('#SIS AW') + '*' + factor + ', ' + els + ')';
}, '0');

const pdpExpr = [
  ['White Background', 0.5],
  ['Complicated SKU', 1],
  ['Value Set', 3],
].reduceRight((els, [label, factor]) => {
  return 'IF(' + q('PDP Complexity') + '=' + JSON.stringify(label) + ', ' + zero('#PDP AW') + '*' + factor + ', ' + els + ')';
}, '0');

const awExpr = 'SUM(' + COUNT_LABELS.map(zero).join(', ') + ')';
const brandExpr = switchExpr(q('Brand'), BRAND_WEIGHTS, 0);
const priorityExpr = switchExpr(q('Priority status'), [
  ['P2 Medium', 1],
  ['🔥 🔥 🔥', 3],
  ['P3 Low', 1],
  ['Normal', 1],
  ['P1 High', 2],
], 0);

/* Columns to add on Creative Queue, in position order. Existing columns
   (Key Visual Type, Request Date, Brand, AW Total) are not repeated. */
const CREATIVE_FORMULA_COLUMNS = [
  {label: 'Deadline', ftype: 'date', options: []},
  {label: 'Priority status', ftype: 'select', options: ['P2 Medium', '🔥 🔥 🔥', 'P3 Low', 'Normal', 'P1 High']},
  {label: 'PDP Complexity', ftype: 'select', options: ['White Background', 'Complicated SKU', 'Value Set']},
].concat(COUNT_LABELS.map(label => ({label, ftype: 'number', options: []})))
 .concat([
  {label: 'Request to Deadline', ftype: 'formula', options: {expr: 'WORKDAYS({Deadline}, {Request Date})'}, monday_id: 'formula_mkqm1edc'},
  {label: 'Priority (auto)', ftype: 'formula', options: {expr: priorityExpr}, monday_id: 'formula5'},
  {label: 'KV Complexity Weight', ftype: 'formula', options: {expr: kvExpr}, monday_id: 'formula_mkwg29xs'},
  {label: 'PDP Complexity Weight', ftype: 'formula', options: {expr: pdpExpr}, monday_id: 'formula_mkwhte8y'},
  {label: 'Complexity Effort', ftype: 'formula', options: {expr: '{KV Complexity Weight} + {PDP Complexity Weight}'}, monday_id: 'formula_mkwh4sz0'},
  {label: '#AW Formula', ftype: 'formula', options: {expr: awExpr}, monday_id: 'formula_mkrkkzsn'},
  {label: 'Complexity weight by Brand ( Creativity, Revision)', ftype: 'formula', options: {expr: brandExpr}, monday_id: 'dup__of_effort__vertical_'},
  {label: 'Report', ftype: 'formula', options: {expr: '{AW Total}'}, monday_id: 'formula9'},
 ]);

module.exports = {
  BRAND_WEIGHTS,
  COUNT_LABELS,
  CREATIVE_FORMULA_COLUMNS,
};
