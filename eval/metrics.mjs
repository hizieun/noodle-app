// 지표 집계 — run/variance/report가 공유(단일 정의).
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (x, n = 4) => (x == null ? null : +x.toFixed(n));

export function aggregate(rows, meta = {}) {
  const ok = rows.filter((r) => !r.error);
  const errors = rows.length - ok.length;

  const groundingViol = ok.filter((r) => !r.rule.grounding_ok);
  const regionAcc = ok.filter((r) => r.rule.region_accuracy != null).map((r) => r.rule.region_accuracy);
  const catAcc = ok.filter((r) => r.rule.category_accuracy != null).map((r) => r.rule.category_accuracy);
  const openAcc = ok.filter((r) => r.rule.opennow_accuracy != null).map((r) => r.rule.opennow_accuracy);

  const totalRec = ok.reduce((s, r) => s + r.rule.n_recommended, 0);
  const totalUnc = ok.reduce((s, r) => s + r.rule.n_unclassified, 0);

  const lat = ok.map((r) => r.latency_ms).sort((a, b) => a - b);
  const pct = (q) => (lat.length ? lat[Math.floor((lat.length - 1) * q)] : null);

  return {
    ...meta,
    n: rows.length,
    errors,
    grounding_violation_rate: round(groundingViol.length / (ok.length || 1)),
    grounding_violations: groundingViol.map((r) => ({ id: r.id, q: r.question, names: r.rule.hallucinated })),
    region_accuracy_mean: round(mean(regionAcc)),
    region_scored: regionAcc.length,
    category_accuracy_mean: round(mean(catAcc)),
    category_scored: catAcc.length,
    opennow_accuracy_mean: round(mean(openAcc)),
    opennow_scored: openAcc.length,
    unclassified_rate: round(totalRec + totalUnc ? totalUnc / (totalRec + totalUnc) : 0),
    latency_ms: { p50: pct(0.5), p90: pct(0.9), max: lat.at(-1) ?? null },
  };
}

// 회귀 판정 — 지표별 방향(높을수록 좋음/낮을수록 좋음)과 임계값으로 baseline 대비 비교.
// threshold는 variance에서 데이터로 정함(감 아님).
export const METRIC_DIRS = {
  grounding_violation_rate: 'lower',
  region_accuracy_mean: 'higher',
  category_accuracy_mean: 'higher',
  opennow_accuracy_mean: 'higher',
  unclassified_rate: 'lower',
};

export function compareToBaseline(cur, base, thresholds = {}) {
  const out = [];
  for (const [m, dir] of Object.entries(METRIC_DIRS)) {
    if (cur[m] == null || base?.[m] == null) continue;
    const thr = thresholds[m] ?? 0.05;
    const delta = +(cur[m] - base[m]).toFixed(4);
    const worse = dir === 'higher' ? delta < -thr : delta > thr;
    out.push({ metric: m, dir, base: base[m], cur: cur[m], delta, threshold: thr, regressed: worse });
  }
  return out;
}
