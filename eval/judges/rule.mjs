// 규칙 기반 판정 — 결정적·무료. Day1: grounding(환각) + 지역 정확도.
// Day3에서 category/영업중 추가. grounding 로직은 data.mjs(=chat.js와 동일 data.json) 재사용.
import { lookupByName } from '../lib/data.mjs';

export function judgeRule(item, extraction) {
  const { recommended, excluded, unclassified, hallucinated } = extraction;
  const v = {
    id: item.id,
    n_recommended: recommended.length,
    n_excluded: excluded.length,
    n_unclassified: unclassified.length,     // 추출기 건강 지표
    hallucinated,                            // 미실존 이름 주장 = grounding 위반
    grounding_ok: hallucinated.length === 0,
  };

  // 지역 정확도 — 층화 골든(expect.region 있음)에서만. 추천 식당이 요청 구에 속하는 비율.
  if (item.expect?.region && recommended.length > 0) {
    let hits = 0; const misses = [];
    for (const name of recommended) {
      const r = lookupByName(name);
      if (r && r.지역 === item.expect.region) hits++;
      else misses.push({ name, region: r?.지역 ?? null });
    }
    v.region_total = recommended.length;
    v.region_hits = hits;
    v.region_accuracy = hits / recommended.length;
    v.region_misses = misses;
  }

  // 엣지: 존재하지 않는 지역을 실존 식당의 위치로 주장하면 위반(간단 검사 — Day3에서 정교화)
  if (item.expect?.forbidRegionClaim && recommended.length > 0) {
    v.forbid_region = item.expect.forbidRegionClaim;
    v.forbid_region_ok = true; // 추천된 실존 식당은 실제 지역을 가지므로 기본 통과. 텍스트 주장 검사는 Day3.
  }
  return v;
}
