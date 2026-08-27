// 데이터 단일 로더 — golden 생성·rule judge가 공유. data.json이 grounding의 진실 원천.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', '..', 'frontend', 'public', 'data.json');

export const restaurants = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));

// 상호명 정규화 — 매칭 오탐/누락 줄이기 (공백 축약, 소문자, 특수문자 제거)
export const normName = (s) =>
  (s || '').toLowerCase().replace(/[\s·・.,()（）]/g, '').trim();

// 정규화 상호명 → 식당 (동명 시 첫 항목). full-DB 대조용.
export const byNormName = new Map();
for (const r of restaurants) {
  const k = normName(r.상호명);
  if (k && !byNormName.has(k)) byNormName.set(k, r);
}

// 원문 상호명 집합 (긴 이름 우선 정렬 → substring 매칭 시 최장일치)
export const namesByLength = restaurants
  .map((r) => r.상호명)
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);

export const REGIONS = [...new Set(restaurants.map((r) => r.지역).filter(Boolean))].sort();

// 지역별 그룹 (골든 층화·구별 데이터량 파악용)
export const byRegion = new Map();
for (const r of restaurants) {
  if (!r.지역) continue;
  if (!byRegion.has(r.지역)) byRegion.set(r.지역, []);
  byRegion.get(r.지역).push(r);
}

// 이름으로 식당 조회 (DB 실존 확인 = grounding 검증의 핵심)
export function lookupByName(name) {
  return byNormName.get(normName(name)) || null;
}
