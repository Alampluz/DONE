/* Creative Queue assignee resolution.
   monday_mapping.json is the catalog. DONE inserts it as custom_automations in this order
   (migration creative_assign_guard keeps the trigger on created_at, with one guard):
     1. brand routes
     2. Brand + Livestreaming Frame overrides (they replace the brand route)
     3. brand routes that sit after the last override in the file (Em / Areelak ← B2B Shopee)
     4. a rule with no brand list, which may not replace a brand-specific assignee
   Interpharma is mapping.uncovered, not a rule. A rule with no designer assigns nobody. */
function hasBrandFilter(rule){
  return Array.isArray(rule.brands) && rule.brands.length > 0;
}
/* Catalog order → the order the engine walks. Brand routes first, overrides next,
   a trailing brand route (the last resort) after those, and no-brand rules last so
   the guard can refuse them. */
function routeOrder(rules){
  const list = rules || [];
  let lastFrame = -1;
  list.forEach((r, i) => {
    if(r && r.only_if_artwork_type && hasBrandFilter(r)) lastFrame = i;
  });
  const brandRoutes = [], frames = [], lastResort = [], bare = [];
  list.forEach((r, i) => {
    if(!hasBrandFilter(r)) bare.push(r);
    else if(r.only_if_artwork_type) frames.push(r);
    else if(lastFrame >= 0 && i > lastFrame) lastResort.push(r);
    else brandRoutes.push(r);
  });
  return brandRoutes.concat(frames, lastResort, bare);
}
function ruleMatches(rule, brand, artwork){
  if(!rule || !rule.designer) return false;
  if(hasBrandFilter(rule)){
    if(!rule.brands.includes(brand)) return false;
  } else if(!rule.only_if_artwork_type){
    // Empty brand list and no artwork constraint is not a route.
    return false;
  }
  if(rule.only_if_artwork_type && rule.only_if_artwork_type !== artwork) return false;
  return true;
}
/* rules: mapping entries in created_at order. task: {brand, artwork}.
   Returns {assignee, applied:[{designer, skipped}]} */
function resolveCreativeAssignee(rules, task){
  const brand = task && task.brand;
  const artwork = task && task.artwork;
  let assignee = null;
  let brandRouted = false;
  const applied = [];
  for(const rule of routeOrder(rules)){
    if(!ruleMatches(rule, brand, artwork)) continue;
    const branded = hasBrandFilter(rule);
    if(!branded && brandRouted){
      applied.push({designer: rule.designer, skipped: true});
      continue;
    }
    assignee = rule.designer;
    applied.push({designer: rule.designer, skipped: false});
    if(branded) brandRouted = true;
  }
  return {assignee, applied};
}

module.exports = {hasBrandFilter, ruleMatches, routeOrder, resolveCreativeAssignee};
