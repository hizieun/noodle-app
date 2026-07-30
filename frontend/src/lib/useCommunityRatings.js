import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';

// 전체 리뷰의 (restaurant_key, rating)을 1회 조회해 key별 {avg, count} Map으로 집계.
// 카드·모달에서 커뮤니티 평점 배지 노출용. 리뷰가 아주 많아지면 Postgres view/rpc로 전환.
export function useCommunityRatings() {
  const [ratings, setRatings] = useState(() => new Map());

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase
      .from('reviews')
      .select('restaurant_key, rating')
      .then(({ data, error }) => {
        if (!alive || error || !data) return;
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
      });
    return () => { alive = false; };
  }, []);

  return ratings;
}
