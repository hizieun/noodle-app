import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { favKey } from '../utils/format.js';

// 카카오 프로필에서 표시용 닉네임 추출 (매핑 필드가 버전마다 달라 폴백 체인)
const nameOf = (user) => {
  const m = user?.user_metadata || {};
  return m.name || m.full_name || m.user_name || m.nickname || '익명';
};

const fmtDate = (iso) => (iso ? iso.slice(0, 10) : '');

export default function ReviewSection({ restaurant }) {
  const [session, setSession] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const key = favKey(restaurant);
  const userId = session?.user?.id || null;
  const myReview = reviews.find((r) => r.user_id === userId) || null;
  const others = reviews.filter((r) => r.user_id !== userId);
  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const loadReviews = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: e } = await supabase
      .from('reviews')
      .select('*')
      .eq('restaurant_key', key)
      .order('created_at', { ascending: false });
    if (e) setError('리뷰를 불러오지 못했습니다.');
    else setReviews(data || []);
    setLoading(false);
  }, [key]);

  // 세션 구독
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // 식당 바뀌면 리뷰 재로드
  useEffect(() => { loadReviews(); }, [loadReviews]);

  // 내 리뷰가 바뀌면 폼 draft 동기화 (derived-state 리셋 — 의도)
  useEffect(() => {
    setRating(myReview?.rating || 0);
    setBody(myReview?.body || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReview?.id]);

  const login = () => {
    supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: window.location.href },
    });
  };
  const logout = () => supabase.auth.signOut();

  const submit = async () => {
    setError('');
    if (!rating) { setError('별점을 선택해주세요.'); return; }
    if (!body.trim()) { setError('리뷰 내용을 입력해주세요.'); return; }
    setSaving(true);
    const row = {
      restaurant_key: key,
      restaurant_name: restaurant.상호명,
      restaurant_addr: restaurant.주소 || null,
      user_id: userId,
      user_name: nameOf(session.user),
      rating,
      body: body.trim(),
      updated_at: new Date().toISOString(),
    };
    const { error: e } = await supabase
      .from('reviews')
      .upsert(row, { onConflict: 'restaurant_key,user_id' });
    setSaving(false);
    if (e) { setError('저장 실패: ' + e.message); return; }
    loadReviews();
  };

  const remove = async () => {
    if (!myReview) return;
    if (!window.confirm('내 리뷰를 삭제할까요?')) return;
    const { error: e } = await supabase.from('reviews').delete().eq('id', myReview.id);
    if (e) { setError('삭제 실패'); return; }
    setRating(0); setBody('');
    loadReviews();
  };

  // Supabase 미설정 환경(로컬 키 없음 등)에선 섹션 자체를 숨김
  if (!supabase) return null;

  return (
    <div className="modal-section review-section">
      <h4 className="modal-section-title">
        💬 커뮤니티 리뷰
        {avg && <span className="review-avg">★ {avg} · {reviews.length}개</span>}
      </h4>

      {/* 작성 영역 */}
      {session ? (
        <div className="review-editor">
          <div className="review-editor-head">
            <span className="review-me">{nameOf(session.user)}님</span>
            <button className="review-logout" onClick={logout}>로그아웃</button>
          </div>
          <div className="my-rating-stars" role="radiogroup" aria-label="별점">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating >= n}
                className={`my-rating-star ${rating >= n ? 'filled' : ''}`}
                onClick={() => setRating(rating === n ? 0 : n)}
              >★</button>
            ))}
          </div>
          <textarea
            className="my-memo"
            placeholder="이 집 어땠나요? 다른 사람에게 공개되는 리뷰예요."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={1000}
          />
          <div className="review-editor-actions">
            <button className="review-submit" onClick={submit} disabled={saving}>
              {saving ? '저장 중…' : myReview ? '리뷰 수정' : '리뷰 등록'}
            </button>
            {myReview && (
              <button className="review-delete" onClick={remove}>삭제</button>
            )}
          </div>
          {error && <p className="hours-note warning">{error}</p>}
        </div>
      ) : (
        <button className="review-login-btn" onClick={login}>
          🗨 카카오로 로그인하고 리뷰 남기기
        </button>
      )}

      {/* 목록 */}
      {loading ? (
        <p className="hours-note muted">불러오는 중…</p>
      ) : others.length === 0 && !myReview ? (
        <p className="hours-note muted">아직 리뷰가 없어요. 첫 리뷰를 남겨보세요!</p>
      ) : (
        <ul className="review-list">
          {myReview && (
            <li className="review-item mine">
              <div className="review-item-head">
                <span className="review-stars">{'★'.repeat(myReview.rating)}</span>
                <span className="review-author">{myReview.user_name} · 나</span>
                <span className="review-date">{fmtDate(myReview.updated_at)}</span>
              </div>
              <p className="review-body">{myReview.body}</p>
            </li>
          )}
          {others.map((r) => (
            <li key={r.id} className="review-item">
              <div className="review-item-head">
                <span className="review-stars">{'★'.repeat(r.rating)}</span>
                <span className="review-author">{r.user_name}</span>
                <span className="review-date">{fmtDate(r.created_at)}</span>
              </div>
              <p className="review-body">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
