// 홈 발견 피드의 테마 레일을 data.json 규칙으로 생성 (편집자 불필요).
// 각 레일: { key, title, subtitle?, items: restaurant[] }
import { isOpenNow } from '../businessHours.js';
import { favKey } from './format.js';

const RAIL_MAX = 12;
const rating = (r) => parseFloat(r.평점) || 0;
const byRating = (a, b) => rating(b) - rating(a);
const hasKw = (r, kws) =>
  kws.some((k) => (r.대표메뉴 || '').includes(k) || (r.상호명 || '').includes(k));

export function buildCollections(restaurants, opts = {}) {
  const { category, userLocation, communityRatings } = opts;
  const inCat = restaurants.filter((r) => r.카테고리 === category);
  const rails = [];

  // 내 근처 (위치 ON) — featured/거리 계산은 App에서 distance 부여됨
  if (userLocation) {
    const near = inCat
      .filter((r) => r.distance != null)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, RAIL_MAX);
    if (near.length >= 4) rails.push({ key: 'near', title: '내 근처', subtitle: '가까운 순', items: near });
  }

  // 지금 영업중
  const openNow = inCat.filter((r) => isOpenNow(r) === 'open').sort(byRating).slice(0, RAIL_MAX);
  if (openNow.length >= 4) rails.push({ key: 'open', title: '지금 영업중', items: openNow });

  // 국밥·곰탕 명가
  const gukbap = inCat
    .filter((r) => hasKw(r, ['국밥', '곰탕', '설렁탕', '해장국', '추어탕', '순대국']))
    .sort(byRating)
    .slice(0, RAIL_MAX);
  if (gukbap.length >= 4) rails.push({ key: 'gukbap', title: '국밥·곰탕 명가', items: gukbap });

  // 한잔하기 좋은 곳 (야장 또는 술 안주)
  const drink = inCat
    .filter((r) => r.카테고리 === '야장' || hasKw(r, ['안주', '전', '파전', '곱창', '골뱅이', '노가리', '호프', '포차']))
    .sort(byRating)
    .slice(0, RAIL_MAX);
  if (drink.length >= 4) rails.push({ key: 'drink', title: '한잔하기 좋은 곳', items: drink });

  // 혼밥하기 좋은 곳 (1인 메뉴 + 고평점)
  const solo = inCat
    .filter((r) => hasKw(r, ['국밥', '백반', '국수', '냉면', '칼국수', '덮밥', '분식']) && rating(r) >= 4.0)
    .sort(byRating)
    .slice(0, RAIL_MAX);
  if (solo.length >= 4) rails.push({ key: 'solo', title: '혼밥하기 좋은 곳', items: solo });

  // 리뷰 많은 집 (커뮤니티 리뷰수)
  if (communityRatings && communityRatings.size) {
    const reviewed = inCat
      .filter((r) => communityRatings.get(favKey(r)))
      .sort((a, b) => communityRatings.get(favKey(b)).count - communityRatings.get(favKey(a)).count)
      .slice(0, RAIL_MAX);
    if (reviewed.length >= 3) rails.push({ key: 'reviewed', title: '리뷰 많은 집', items: reviewed });
  }

  return rails;
}
