import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase.js';

// 전체 리뷰를 조회해 key별 {avg, count, photo} Map으로 집계.
// photo = 그 식당 리뷰 중 대표 사진 1장(카드·레일 썸네일용). 배지·평점도 겸용.
// refresh()로 리뷰 등록/삭제 직후 재집계(수동 새로고침 불필요).
export function useCommunityRatings() {
  const [ratings, setRatings] = useState(() => new Map());

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('reviews')
      .select('restaurant_key, rating, photos')
      .order('created_at', { ascending: false });
    if (error || !data) return;
    const acc = new Map();
    for (const r of data) {
      const cur = acc.get(r.restaurant_key) || { sum: 0, count: 0, photo: null };
      cur.sum += r.rating;
      cur.count += 1;
      // 최신순 조회라 먼저 만난(=가장 최근) 사진을 대표로 유지
      if (!cur.photo && r.photos?.length) cur.photo = r.photos[0];
      acc.set(r.restaurant_key, cur);
    }
    const out = new Map();
    for (const [k, v] of acc) out.set(k, { avg: v.sum / v.count, count: v.count, photo: v.photo });
    setRatings(out);
  }, []);

  // 마운트 시 초기 집계 (async 데이터 로드)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  return { ratings, refresh };
}
