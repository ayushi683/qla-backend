/** Collapse duplicate AI suggestions (same model, or same SKU gathered differently). */
function compactSku(code) {
  return String(code || "").toUpperCase().replace(/[\s\-–—_/]+/g, "");
}

function ocrConfusable(a, b) {
  if (a === b) return true;
  const groups = ["ILT1", "O0Q", "S5", "B8", "Z2"];
  return groups.some((g) => g.includes(a) && g.includes(b));
}

export function sameGatheredSku(a, b) {
  const ca = compactSku(a);
  const cb = compactSku(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  if (ca.length !== cb.length) {
    const longer = ca.length > cb.length ? ca : cb;
    const shorter = ca.length > cb.length ? cb : ca;
    return shorter.length >= 8 && longer.startsWith(shorter);
  }
  const diffs = [];
  for (let i = 0; i < ca.length; i++) {
    if (ca[i] !== cb[i]) diffs.push([ca[i], cb[i]]);
  }
  return diffs.length === 1 && ocrConfusable(diffs[0][0], diffs[0][1]);
}

export function uniqueRecommendations(recs = []) {
  const seen = [];
  const out = [];
  const sorted = [...recs].sort((a, b) => (a.rank_no || 0) - (b.rank_no || 0));
  for (const r of sorted) {
    const code = r.model_code || r.family_code || "";
    if (seen.some((prev) => sameGatheredSku(prev, code))) continue;
    seen.push(code);
    out.push(r);
  }
  return out;
}

export function topRecommendation(item) {
  const recs = uniqueRecommendations(item.recommendations || []);
  if (recs.length === 0) return null;
  const approved = recs.filter((r) => r.is_selected_by_engineer === true);
  if (approved.length > 0) return approved[0];
  return recs[0];
}

export function otherRecommendations(item, topRec) {
  return uniqueRecommendations(item.recommendations || []).filter(
    (r) => !topRec || r.recommendation_id !== topRec.recommendation_id
  );
}
