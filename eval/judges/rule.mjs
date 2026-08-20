// 규칙 기반 판정 — 결정적·무료. Day1: grounding(환각) + 지역 정확도.
// Day3에서 category/영업중 추가. grounding 로직은 data.mjs(=chat.js와 동일 data.json) 재사용.
import { lookupByName } from '../lib/data.mjs';
import { isOpenAtServer } from '../../frontend/api/chat.js';

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

  // 카테고리 일치 — 질문이 노포/야장 명시 시. 추천 식당의 카테고리가 요청과 같은 비율.
  if (item.expect?.category && recommended.length > 0) {
    let hits = 0; const misses = [];
    for (const name of recommended) {
      const r = lookupByName(name);
      if (r && r.카테고리 === item.expect.category) hits++;
      else misses.push({ name, category: r?.카테고리 ?? null });
    }
    v.category_total = recommended.length;
    v.category_hits = hits;
    v.category_accuracy = hits / recommended.length;
    v.category_misses = misses;
  }

  // 영업중 일치 — 질문이 "지금 영업중" 류일 때. 판정 시점(now)에 추천 식당이 실제 영업중인 비율.
  // chat.js와 동일한 isOpenAtServer 재사용(로직 드리프트 없음). null(정보없음)은 분모에서 제외.
  if (item.expect?.openNow && recommended.length > 0) {
    const now = new Date();
    let open = 0, decided = 0; const closedNames = [];
    for (const name of recommended) {
      const r = lookupByName(name);
      const st = r ? isOpenAtServer(r.영업시간, now) : null;
      if (st === true) { open++; decided++; }
      else if (st === false) { decided++; closedNames.push(name); }
    }
    v.opennow_decided = decided;
    v.opennow_open = open;
    v.opennow_accuracy = decided > 0 ? open / decided : null; // 판정 가능한 것 중 영업중 비율
    v.opennow_closed = closedNames;
  }

  // 엣지: 존재하지 않는 지역을 실존 식당의 위치로 주장하면 위반(간단 검사 — Day3에서 정교화)
  if (item.expect?.forbidRegionClaim && recommended.length > 0) {
    v.forbid_region = item.expect.forbidRegionClaim;
    v.forbid_region_ok = true; // 추천된 실존 식당은 실제 지역을 가지므로 기본 통과. 텍스트 주장 검사는 Day3.
  }
  return v;
}
