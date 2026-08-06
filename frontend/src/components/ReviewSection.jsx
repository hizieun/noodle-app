import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { favKey } from '../utils/format.js';
import { MessageIcon, XIcon } from './icons.jsx';
import { uploadReviewPhoto, deleteReviewPhotos, MAX_PHOTOS } from '../lib/uploadPhoto.js';

// 카카오 프로필에서 표시용 닉네임 추출 (매핑 필드가 버전마다 달라 폴백 체인)
const nameOf = (user) => {
  const m = user?.user_metadata || {};
  return m.name || m.full_name || m.user_name || m.nickname || '익명';
};

const fmtDate = (iso) => (iso ? iso.slice(0, 10) : '');

// 세션 1회만 반응 테이블 지원 여부 판단 — 미설정 시 매 리뷰 로드마다 404 재요청 방지
let reactionsSupported = true;

export default function ReviewSection({ restaurant, onReviewChange }) {
  const [session, setSession] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('recent'); // 'recent' | 'rating'
  // 사진: 기존 URL과 새 File을 순서대로 담는다 {kind:'url'|'file', url?, file?, preview?}
  const [photoItems, setPhotoItems] = useState([]);
  const [lightbox, setLightbox] = useState(null); // 확대해서 볼 사진 URL
  const fileInput = useRef(null);
  // 리뷰 반응(도움돼요/신고). review_id → {helpful, mineHelpful, mineReported}
  const [reactions, setReactions] = useState(() => new Map());
  const [reactionsOn, setReactionsOn] = useState(() => reactionsSupported); // 테이블 미설정 시 자동 off

  const key = favKey(restaurant);
  const userId = session?.user?.id || null;
  const myReview = reviews.find((r) => r.user_id === userId) || null;
  const byRecent = (a, b) => (b.created_at > a.created_at ? 1 : -1);
  const others = reviews
    .filter((r) => r.user_id !== userId)
    .sort((a, b) => {
      if (sort === 'rating') return b.rating - a.rating || byRecent(a, b);
      if (sort === 'photo') return (b.photos?.length ? 1 : 0) - (a.photos?.length ? 1 : 0) || byRecent(a, b);
      return byRecent(a, b);
    });
  const anyPhotos = reviews.some((r) => r.photos?.length);
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

  // 리뷰 반응 집계 (테이블 없으면 자동 비활성)
  const loadReactions = useCallback(async (rows, uid) => {
    if (!supabase || !reactionsSupported || !rows.length) { setReactions(new Map()); return; }
    const ids = rows.map((r) => r.id);
    const { data, error: e } = await supabase
      .from('review_reactions')
      .select('review_id, user_id, type')
      .in('review_id', ids);
    if (e) { reactionsSupported = false; setReactionsOn(false); return; } // 테이블 미설정 → 세션 내 재요청 중단
    const m = new Map();
    for (const id of ids) m.set(id, { helpful: 0, mineHelpful: false, mineReported: false });
    for (const row of data || []) {
      const cur = m.get(row.review_id);
      if (!cur) continue;
      if (row.type === 'helpful') { cur.helpful += 1; if (row.user_id === uid) cur.mineHelpful = true; }
      if (row.type === 'report' && row.user_id === uid) cur.mineReported = true;
    }
    setReactions(m);
  }, []);
  useEffect(() => { loadReactions(reviews, userId); }, [reviews, userId, loadReactions]);

  const toggleHelpful = async (reviewId) => {
    if (!session) { login(); return; }
    const cur = reactions.get(reviewId) || { helpful: 0, mineHelpful: false, mineReported: false };
    // 낙관적 업데이트
    setReactions((m) => new Map(m).set(reviewId, {
      ...cur, helpful: cur.helpful + (cur.mineHelpful ? -1 : 1), mineHelpful: !cur.mineHelpful,
    }));
    const { error: e } = cur.mineHelpful
      ? await supabase.from('review_reactions').delete()
          .match({ review_id: reviewId, user_id: userId, type: 'helpful' })
      : await supabase.from('review_reactions')
          .insert({ review_id: reviewId, user_id: userId, type: 'helpful' });
    if (e) {
      setReactions((m) => new Map(m).set(reviewId, cur)); // 롤백
      setError('도움돼요 처리 실패: ' + e.message);
    }
  };

  const reportReview = async (reviewId) => {
    if (!session) { login(); return; }
    if (!window.confirm('이 리뷰를 신고할까요? 관리자가 검토합니다.')) return;
    const { error: e } = await supabase.from('review_reactions')
      .insert({ review_id: reviewId, user_id: userId, type: 'report' });
    if (e && e.code !== '23505') { setError('신고 실패'); return; } // 23505=이미 신고함
    const cur = reactions.get(reviewId) || { helpful: 0, mineHelpful: false, mineReported: false };
    setReactions(new Map(reactions).set(reviewId, { ...cur, mineReported: true }));
  };

  // 내 리뷰가 바뀌면 폼 draft 동기화 (derived-state 리셋 — 의도)
  useEffect(() => {
    setRating(myReview?.rating || 0);
    setBody(myReview?.body || '');
    setPhotoItems((myReview?.photos || []).map((url) => ({ kind: 'url', url })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReview?.id]);

  const addPhotos = (e) => {
    setError('');
    const files = Array.from(e.target.files || []);
    setPhotoItems((prev) => {
      const room = MAX_PHOTOS - prev.length;
      const next = files.slice(0, room).map((file) => ({ kind: 'file', file, preview: URL.createObjectURL(file) }));
      return [...prev, ...next];
    });
    e.target.value = ''; // 같은 파일 다시 선택 가능하게
  };

  const removePhoto = (i) => {
    setPhotoItems((prev) => {
      const item = prev[i];
      if (item?.kind === 'file' && item.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const login = () => {
    // 닉네임만 요청 — 이메일 등은 카카오 검수 필요, 요청 시 KOE205
    supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: window.location.href, scopes: 'profile_nickname' },
    });
  };
  const logout = () => supabase.auth.signOut();

  const submit = async () => {
    setError('');
    if (!rating) { setError('별점을 선택해주세요.'); return; }
    if (!body.trim()) { setError('리뷰 내용을 입력해주세요.'); return; }
    setSaving(true);
    // 새로 추가한 파일만 업로드, 기존 URL은 그대로 순서 유지
    let photos;
    try {
      photos = [];
      for (let i = 0; i < photoItems.length; i++) {
        const item = photoItems[i];
        photos.push(item.kind === 'url' ? item.url : await uploadReviewPhoto(item.file, userId, i));
      }
    } catch (err) {
      setSaving(false);
      setError(err.message || '사진 업로드 실패');
      return;
    }
    const row = {
      restaurant_key: key,
      restaurant_name: restaurant.상호명,
      restaurant_addr: restaurant.주소 || null,
      user_id: userId,
      user_name: nameOf(session.user),
      rating,
      body: body.trim(),
      // 사진 있을 때만 컬럼 포함 — photos 컬럼 셋업 전이라도 텍스트 리뷰는 그대로 동작
      ...(photos.length ? { photos } : {}),
      updated_at: new Date().toISOString(),
    };
    const { error: e } = await supabase
      .from('reviews')
      .upsert(row, { onConflict: 'restaurant_key,user_id' });
    setSaving(false);
    if (e) { setError('저장 실패: ' + e.message); return; }
    loadReviews();
    onReviewChange?.(); // 카드 배지 즉시 갱신
  };

  const remove = async () => {
    if (!myReview) return;
    if (!window.confirm('내 리뷰를 삭제할까요?')) return;
    const { error: e } = await supabase.from('reviews').delete().eq('id', myReview.id);
    if (e) { setError('삭제 실패'); return; }
    deleteReviewPhotos(myReview.photos).catch(() => {}); // best-effort 스토리지 정리
    setRating(0); setBody(''); setPhotoItems([]);
    loadReviews();
    onReviewChange?.(); // 카드 배지 즉시 갱신
  };

  // Supabase 미설정 환경(로컬 키 없음 등)에선 섹션 자체를 숨김
  if (!supabase) return null;

  return (
    <div className="modal-section review-section">
      <h4 className="modal-section-title">
        💬 커뮤니티 리뷰
        {avg && <span className="review-avg">★ {avg} · {reviews.length}개</span>}
      </h4>
      <p className="review-subtitle">모두에게 공개돼요 · 위 '내 방문 후기'는 나만 봅니다</p>

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
          <div className="review-charcount">{body.length} / 1000</div>

          {/* 사진 첨부 */}
          <div className="review-photos-edit">
            {photoItems.map((item, i) => (
              <div className="review-photo-chip" key={item.url || item.preview}>
                <img src={item.kind === 'url' ? item.url : item.preview} alt="" />
                <button type="button" className="review-photo-remove" onClick={() => removePhoto(i)} aria-label="사진 제거">
                  <XIcon size={12} />
                </button>
              </div>
            ))}
            {photoItems.length < MAX_PHOTOS && (
              <button type="button" className="review-photo-add" onClick={() => fileInput.current?.click()}>
                <span aria-hidden="true">＋</span>
                <span className="review-photo-add-label">사진</span>
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={addPhotos}
            />
          </div>

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
          <MessageIcon size={16} /> 카카오로 로그인하고 리뷰 남기기
        </button>
      )}

      {/* 목록 */}
      {loading ? (
        <p className="hours-note muted">불러오는 중…</p>
      ) : others.length === 0 && !myReview ? (
        <p className="hours-note muted">아직 리뷰가 없어요. 첫 리뷰를 남겨보세요!</p>
      ) : (
        <>
        {others.length >= 2 && (
          <div className="review-sort">
            <button className={sort === 'recent' ? 'active' : ''} onClick={() => setSort('recent')}>최신순</button>
            <button className={sort === 'rating' ? 'active' : ''} onClick={() => setSort('rating')}>별점순</button>
            {anyPhotos && <button className={sort === 'photo' ? 'active' : ''} onClick={() => setSort('photo')}>사진순</button>}
          </div>
        )}
        <ul className="review-list">
          {myReview && (
            <li className="review-item mine">
              <div className="review-item-head">
                <span className="review-stars">{'★'.repeat(myReview.rating)}</span>
                <span className="review-author">{myReview.user_name} · 나</span>
                <span className="review-date">{fmtDate(myReview.updated_at)}</span>
              </div>
              <p className="review-body">{myReview.body}</p>
              {myReview.photos?.length > 0 && (
                <div className="review-photos">
                  {myReview.photos.map((url) => (
                    <button type="button" className="review-photo-thumb" key={url} onClick={() => setLightbox(url)}>
                      <img src={url} alt="리뷰 사진" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
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
              {r.photos?.length > 0 && (
                <div className="review-photos">
                  {r.photos.map((url) => (
                    <button type="button" className="review-photo-thumb" key={url} onClick={() => setLightbox(url)}>
                      <img src={url} alt="리뷰 사진" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
              {reactionsOn && (
                <div className="review-actions">
                  <button
                    className={`review-helpful ${reactions.get(r.id)?.mineHelpful ? 'active' : ''}`}
                    onClick={() => toggleHelpful(r.id)}
                  >
                    👍 도움돼요{reactions.get(r.id)?.helpful ? ` ${reactions.get(r.id).helpful}` : ''}
                  </button>
                  <button
                    className="review-report"
                    onClick={() => reportReview(r.id)}
                    disabled={reactions.get(r.id)?.mineReported}
                  >
                    {reactions.get(r.id)?.mineReported ? '신고됨' : '신고'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        </>
      )}

      {lightbox && (
        <div className="review-lightbox" onClick={() => setLightbox(null)} role="dialog" aria-label="사진 확대">
          <button className="review-lightbox-close" onClick={() => setLightbox(null)} aria-label="닫기">
            <XIcon size={22} />
          </button>
          <img src={lightbox} alt="리뷰 사진 확대" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
