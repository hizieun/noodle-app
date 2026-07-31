import { useState, useEffect, useRef } from 'react';
import { formatRestaurantName } from '../utils/format.js';
import { isOpenNow, getBusinessHours, isCashOnly, formatHoursForDisplay } from '../businessHours.js';
import ReviewSection from './ReviewSection.jsx';
import { XIcon, LinkIcon, CheckIcon } from './icons.jsx';

// --- Modal Component ---
const FOCUSABLE_SELECTORS = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const RestaurantModal = ({ restaurant, onClose, isVisited, onToggleVisited, myVisit, onUpdateMyVisit, onReviewChange }) => {
  const [copied, setCopied] = useState(false);
  const [memoDraft, setMemoDraft] = useState(myVisit?.memo || '');
  const containerRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset draft when restaurant prop changes (derived-state pattern)
    setMemoDraft(myVisit?.memo || '');
  }, [restaurant, myVisit]);

  // 마운트 시 이전 포커스 기억 + 초기 포커스 이동; 언마운트 시 포커스 복귀
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const closeBtn = containerRef.current?.querySelector('.modal-close-btn');
    (closeBtn || containerRef.current)?.focus();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  // Escape 핸들러 + Tab/Shift+Tab 포커스 트랩
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && containerRef.current) {
        const focusable = Array.from(containerRef.current.querySelectorAll(FOCUSABLE_SELECTORS)).filter(
          (el) => el.offsetParent !== null
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!restaurant) return null;

  const { emoji, cleanName } = formatRestaurantName(restaurant.상호명);
  const menus = restaurant.대표메뉴 ? restaurant.대표메뉴.split(',').map(m => m.trim()).filter(Boolean) : [];
  const hours = getBusinessHours(restaurant);
  const openStatus = isOpenNow(restaurant);
  const hoursRows = hours ? formatHoursForDisplay(hours) : [];
  const todayKey = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];
  const closedDays = restaurant.휴무일 || restaurant.closed_days;
  const payment = restaurant.결제수단 || restaurant.payment;
  const cashOnly = isCashOnly(restaurant);

  const kakaoLink = restaurant.카카오맵_링크 || `https://map.kakao.com/?q=${encodeURIComponent(cleanName + ' ' + restaurant.주소)}`;
  const naverBlogLink = restaurant.네이버블로그_링크 || `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(cleanName + ' 후기')}`;
  const naverMapLink = restaurant.네이버지도_링크 || `https://map.naver.com/v5/search/${encodeURIComponent(cleanName + ' ' + restaurant.주소)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement('input');
      el.value = window.location.href;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" ref={containerRef} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div>
            <div className="modal-title" id="modal-title">
              <span className="modal-emoji">{emoji}</span>
              {cleanName}
            </div>
            <span className="card-region" style={{ marginTop: '0.5rem', display: 'inline-block' }}>{restaurant.지역}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className={`share-btn ${copied ? 'copied' : ''}`} onClick={handleCopyLink} title="링크 복사">
              {copied ? <><CheckIcon size={14} /> 복사됨</> : <><LinkIcon size={14} /> 공유</>}
            </button>
            <button className="modal-close-btn" onClick={onClose} aria-label="닫기"><XIcon size={18} /></button>
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <h4 className="modal-section-title">📍 기본 정보</h4>
            <div className="modal-info-grid">
              <div className="modal-info-item">
                <span className="modal-info-label">주소</span>
                <span className="modal-info-value">{restaurant.주소 || '정보 없음'}</span>
              </div>
              <div className="modal-info-item">
                <span className="modal-info-label">평점</span>
                <span className="modal-info-value rating-value">⭐ {restaurant.평점 !== '정보 없음' ? restaurant.평점 : '-'}</span>
              </div>
              {restaurant.전화번호 && (
                <div className="modal-info-item">
                  <span className="modal-info-label">전화번호</span>
                  <span className="modal-info-value">{restaurant.전화번호}</span>
                </div>
              )}
            </div>
          </div>

          {(hours || closedDays || (payment && payment.length)) && (
            <div className="modal-section">
              <h4 className="modal-section-title">
                🕒 영업 정보
                {openStatus === 'open' && <span className="open-badge open" style={{ marginLeft: '0.5rem' }}>영업중</span>}
                {openStatus === 'closed' && <span className="open-badge closed" style={{ marginLeft: '0.5rem' }}>영업종료</span>}
              </h4>
              {hoursRows.length > 0 && (
                <table className="hours-table">
                  <tbody>
                    {hoursRows.map(row => (
                      <tr key={row.key} className={row.key === todayKey ? 'today' : ''}>
                        <th>{row.day}</th>
                        <td>{row.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {Array.isArray(closedDays) && closedDays.length > 0 && (
                <p className="hours-note">📅 휴무: {closedDays.join(', ')}</p>
              )}
              {cashOnly && <p className="hours-note warning">💵 현금만 가능</p>}
              {Array.isArray(payment) && payment.length > 1 && (
                <p className="hours-note">💳 결제: {payment.join(', ')}</p>
              )}
              {restaurant.정보검증일 && (
                <p className="hours-note muted">마지막 확인: {restaurant.정보검증일.slice(0, 10)}</p>
              )}
            </div>
          )}

          {menus.length > 0 && (
            <div className="modal-section">
              <h4 className="modal-section-title">🍽️ 대표 메뉴</h4>
              <div className="menu-tags">
                {menus.map((menu, i) => (
                  <span key={i} className="menu-tag">{menu}</span>
                ))}
              </div>
            </div>
          )}

          {restaurant.lat && restaurant.lng && (
            <div className="modal-section">
              <h4 className="modal-section-title">🗺️ 위치</h4>
              <div className="modal-map-wrapper">
                <iframe
                  title="식당 위치"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${restaurant.lng - 0.004}%2C${restaurant.lat - 0.003}%2C${restaurant.lng + 0.004}%2C${restaurant.lat + 0.003}&layer=mapnik&marker=${restaurant.lat}%2C${restaurant.lng}`}
                  className="modal-map-frame"
                  loading="lazy"
                />
              </div>
            </div>
          )}

          <div className="modal-section">
            <h4 className="modal-section-title">🔗 바로가기</h4>
            <div className="action-btns">
              <a href={kakaoLink} target="_blank" rel="noopener noreferrer" className="action-btn kakao-btn">
                <span>🗺️</span> 카카오맵
              </a>
              <a href={naverMapLink} target="_blank" rel="noopener noreferrer" className="action-btn naver-btn">
                <span>📍</span> 네이버 지도
              </a>
              <a href={naverBlogLink} target="_blank" rel="noopener noreferrer" className="action-btn blog-btn">
                <span>📝</span> 블로그 후기
              </a>
            </div>
          </div>

          <div className="modal-section my-visit-section">
            <h4 className="modal-section-title">
              📔 내 방문 후기
              <button
                className={`my-visit-toggle ${isVisited ? 'active' : ''}`}
                onClick={() => onToggleVisited && onToggleVisited(restaurant, { stopPropagation: () => {} })}
              >
                {isVisited ? '✓ 가봤어요' : '○ 가봤어요 표시'}
              </button>
            </h4>
            {isVisited ? (
              <>
                <div className="my-rating-row">
                  <span className="my-rating-label">내 평점</span>
                  <div className="my-rating-stars" role="radiogroup" aria-label="내 평점">
                    {[1, 2, 3, 4, 5].map(n => {
                      const filled = (myVisit?.rating || 0) >= n;
                      return (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={filled}
                          className={`my-rating-star ${filled ? 'filled' : ''}`}
                          onClick={() => {
                            // 같은 별점을 다시 누르면 0으로 초기화
                            const nextRating = myVisit?.rating === n ? 0 : n;
                            onUpdateMyVisit && onUpdateMyVisit(restaurant, { rating: nextRating });
                          }}
                          title={`${n}점`}
                        >
                          ★
                        </button>
                      );
                    })}
                    {myVisit?.rating ? (
                      <span className="my-rating-value">{myVisit.rating}.0</span>
                    ) : (
                      <span className="my-rating-hint">별을 눌러 평가</span>
                    )}
                  </div>
                </div>
                <textarea
                  className="my-memo"
                  placeholder="이 집의 추천 메뉴, 인상 깊었던 점, 다음에 갈 때 기억할 것…"
                  value={memoDraft}
                  onChange={(e) => setMemoDraft(e.target.value)}
                  onBlur={() => {
                    const next = memoDraft.trim();
                    if (next !== (myVisit?.memo || '')) {
                      onUpdateMyVisit && onUpdateMyVisit(restaurant, { memo: next });
                    }
                  }}
                  rows={3}
                  maxLength={500}
                />
                {myVisit?.date && (
                  <p className="hours-note muted">방문 기록: {myVisit.date}</p>
                )}
              </>
            ) : (
              <p className="hours-note">방문하셨다면 위 '가봤어요 표시' 버튼을 눌러주세요. 내 평점과 메모를 남길 수 있어요.</p>
            )}
          </div>

          <ReviewSection restaurant={restaurant} onReviewChange={onReviewChange} />
        </div>
      </div>
    </div>
  );
};

export default RestaurantModal;
