import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase.js';

// 전체 리뷰의 (restaurant_key, rating)을 조회해 key별 {avg, count} Map으로 집계.
// 카드·모달 배지용. refresh()로 리뷰 등록/삭제 직후 재집계(수동 새로고침 불필요).
export function useCommunityRatings() {
  const [ratings, setRatings] = useState(() => new Map());

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('reviews').select('restaurant_key, rating');
    if (error || !data) return;
    const acc = new Map();
    for (const r of data) {
      const cur = acc.get(r.restaurant_key) || { sum: 0, count: 0 };
      cur.sum += r.rating;
      cur.count += 1;
      acc.set(r.restaurant_key, cur);
    }
    const out = new Map();
    for (const [k, v] of acc) out.set(k, { avg: v.sum / v.count, count: v.count });
    setRatings(out);
  }, []);

  // 마운트 시 초기 집계 (async 데이터 로드)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  return { ratings, refresh };
}
