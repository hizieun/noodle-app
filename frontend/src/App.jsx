import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import './index.css';
import ChatPanel from './ChatPanel.jsx';
import { isOpenNow, getBusinessHours, isCashOnly, formatHoursForDisplay } from './businessHours.js';
import { buildShareUrl, readShareListFromLocation, copyToClipboard, PARAM_KEY as SHARE_PARAM_KEY } from './shareList.js';
import { loadVisits, saveVisits, updateVisit } from './myVisits.js';

const MapView = lazy(() => import('./MapView.jsx'));

const getRestaurantEmoji = (name) => {
  if (/냉면|국수|면|우동|짬뽕|소바|라면|파스타|칼국수|수제비/.test(name)) return "🍜";
  if (/만두|교자/.test(name)) return "🥟";
  if (/국밥|해장국|탕|찌개|전골|순대|국|설렁탕|곰탕/.test(name)) return "🍲";
  if (/회|세꼬시|참치|초밥|스시|해물|오징어|낙지|쭈꾸미|수산|어시장|횟집/.test(name)) return "🐟";
  if (/치킨|통닭|백숙|닭갈비|닭발|찜닭|닭/.test(name)) return "🍗";
  if (/돼지|소고기|고기|삼겹살|갈비|막창|곱창|육|숯불|한우|식육|정육|보쌈|족발/.test(name)) return "🍖";
  if (/술|포차|호프|주막|비어|바|펍/.test(name)) return "🍻";
  if (/식당|상회|가든|회관|밥|식탁|반점|식구|백반/.test(name)) return "🍚";
  if (/떡볶이|오뎅|김밥|분식|튀김/.test(name)) return "🍢";
  if (/빵|베이커리|과자|제과/.test(name)) return "🥐";
  if (/피자|버거/.test(name)) return "🍕";
  if (/카페|커피|다방|디저트/.test(name)) return "☕";
  return "🍽️";
};

const formatRestaurantName = (name) => {
  const cleanName = name.replace(/^[a-zA-Z]\s+/, '');
  const emoji = getRestaurantEmoji(cleanName);
  return { emoji, cleanName };
};

const favKey = (r) => `${r.상호명}|${r.주소}`;
const visitKey = (r) => `${r.상호명}|${r.주소}`;

// --- Modal Component ---
const FOCUSABLE_SELECTORS = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const RestaurantModal = ({ restaurant, onClose, isVisited, onToggleVisited, myVisit, onUpdateMyVisit }) => {
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
              {copied ? '✓ 복사됨' : '🔗 공유'}
            </button>
            <button className="modal-close-btn" onClick={onClose} aria-label="닫기">✕</button>
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
              <p className="hours-note">방문하셨다면 위 ‘가봤어요 표시’ 버튼을 눌러주세요. 내 평점과 메모를 남길 수 있어요.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Featured "오늘의 발견" Card Component ---
const FeaturedCard = ({ restaurant, onOpen, onReshuffle }) => {
  const { emoji, cleanName } = formatRestaurantName(restaurant.상호명);
  const menus = restaurant.대표메뉴
    ? restaurant.대표메뉴.split(',').map(m => m.trim()).filter(Boolean)
    : [];
  const openStatus = isOpenNow(restaurant);

  const distanceLabel = restaurant.distance !== null && restaurant.distance !== undefined
    ? restaurant.distance < 1
      ? `${Math.round(restaurant.distance * 1000)}m`
      : `${restaurant.distance.toFixed(1)}km`
    : null;

  return (
    <div
      className="featured-card animate-fade-in"
      onClick={() => onOpen(restaurant)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(restaurant); }}
      aria-label={`오늘의 발견: ${cleanName}`}
    >
      <div className="featured-label-row">
        <span className="featured-label">오늘의 발견</span>
        {openStatus === 'open' && <span className="open-badge open">🟢 영업중</span>}
        {openStatus === 'closed' && <span className="open-badge closed">🔴 영업종료</span>}
      </div>

      <div className="featured-title-row">
        <span className="featured-emoji">{emoji}</span>
        <h2 className="featured-name">{cleanName}</h2>
      </div>

      <div className="featured-meta">
        <span className="card-region">{restaurant.지역}</span>
        <span className="featured-rating">⭐ {restaurant.평점 !== '정보 없음' ? restaurant.평점 : '-'}</span>
        {distanceLabel && <span className="distance-badge">📍 {distanceLabel}</span>}
      </div>

      <div className="featured-address">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        {restaurant.주소}
      </div>

      {menus.length > 0 && (
        <div className="featured-menus">
          {menus.slice(0, 5).map((menu, i) => (
            <span key={i} className="menu-tag">{menu}</span>
          ))}
        </div>
      )}

      <div className="featured-footer">
        <span className="featured-hint">자세히 보기 →</span>
        <button
          className="featured-reshuffle-btn"
          onClick={(e) => { e.stopPropagation(); onReshuffle(); }}
          title="같은 카테고리 내 다른 식당으로 교체"
          aria-label="다른 식당 추천"
        >
          🎲 다른 곳
        </button>
      </div>
    </div>
  );
};

// --- Card Component ---
const RestaurantCard = ({ data, index, onClick, isFavorited, onToggleFavorite, isVisited, onToggleVisited, distance, myVisit }) => {
  const { emoji, cleanName } = formatRestaurantName(data.상호명);

  const distanceLabel = distance !== null && distance !== undefined
    ? distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`
    : null;

  const openStatus = isOpenNow(data);
  const myRating = myVisit?.rating || 0;

  return (
    <div
      className={`card animate-fade-in ${isVisited ? 'visited' : ''}`}
      style={{ animationDelay: `${index * 40}ms`, cursor: 'pointer' }}
      onClick={() => onClick(data)}
    >
      <div className="card-header">
        <h3 className="card-title">{emoji} {cleanName}</h3>
        <div className="card-header-right">
          <span className="card-region">{data.지역}</span>
          <button
            className={`visit-btn ${isVisited ? 'active' : ''}`}
            onClick={(e) => onToggleVisited(data, e)}
            aria-label={isVisited ? '방문 취소' : '방문했어요'}
            title={isVisited ? '방문 취소' : '가봤어요'}
          >
            {isVisited ? '✓ 방문' : '방문'}
          </button>
          <button
            className={`favorite-btn ${isFavorited ? 'active' : ''}`}
            onClick={(e) => onToggleFavorite(data, e)}
            aria-label={isFavorited ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          >
            {isFavorited ? '♥' : '♡'}
          </button>
        </div>
      </div>

      <div className="card-address">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        {data.주소}
      </div>

      <div className="card-footer">
        <div className="card-rating">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          {data.평점 !== "정보 없음" ? data.평점 : "-"}
        </div>
        {openStatus === 'open' && <span className="open-badge open">🟢 영업중</span>}
        {openStatus === 'closed' && <span className="open-badge closed">🔴 영업종료</span>}
        {myRating > 0 && !distanceLabel && (
          <span className="my-rating-badge" title="내가 매긴 평점">내 ★ {myRating}</span>
        )}
        {distanceLabel ? (
          <span className="distance-badge">📍 {distanceLabel}</span>
        ) : (
          <span className="card-detail-hint">자세히 보기 →</span>
        )}
      </div>
    </div>
  );
};

// 날짜 문자열(YYYY-MM-DD 등)을 결정적 정수로 해시 → pool 크기 modulo
// Math.random 없이 오늘 하루 고정, 매일 변경되는 인덱스 생성
const dateHashIndex = (poolLength, seed) => {
  if (poolLength === 0) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0xffffff;
  }
  return h % poolLength;
};

const toRad = (d) => (d * Math.PI) / 180;
const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const ITEMS_PER_PAGE = 30;

// --- App Main ---
function App() {
  const [restaurants, setRestaurants] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeRegion, setActiveRegion] = useState('전체');
  const [activeCategory, setActiveCategory] = useState('노포');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [sortBy, setSortBy] = useState('평점순');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [filterOpen, setFilterOpen] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('nopo-favorites');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [visited, setVisited] = useState(() => {
    try {
      const saved = localStorage.getItem('nopo-visited');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [showUnvisitedOnly, setShowUnvisitedOnly] = useState(false);
  const [showOpenNowOnly, setShowOpenNowOnly] = useState(false);
  const [myVisits, setMyVisits] = useState(() => loadVisits());
  const [sharedListNames, setSharedListNames] = useState(() => readShareListFromLocation());
  const [shareCopied, setShareCopied] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [userLocation, setUserLocation] = useState(null); // { lat, lng }
  const [nearbyRadius, setNearbyRadius] = useState(3);    // km
  const [reshuffleIdx, setReshuffleIdx] = useState(null); // null = 날짜픽, 숫자 = 리셔플 인덱스

  // PWA 설치 프롬프트
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstallBanner(false);
    setInstallPrompt(null);
  };

  // data.json fetch + URL ?r= 파라미터 처리
  useEffect(() => {
    fetch('/data.json')
      .then(r => r.json())
      .then(raw => {
        const data = raw.map(item => {
          const { emoji, cleanName } = formatRestaurantName(item.상호명);
          return { ...item, emoji, cleanName };
        });
        setRestaurants(data);
        setDataLoading(false);
        const params = new URLSearchParams(window.location.search);
        const rParam = params.get('r');
        if (rParam) {
          const found = data.find(r => r.상호명 === rParam);
          if (found) setSelectedRestaurant(found);
        }
      });
  }, []);

  // 필터 변경 시 더 보기 초기화
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [activeCategory, activeRegion, searchQuery, sortBy, showFavoritesOnly, showUnvisitedOnly, showOpenNowOnly, userLocation, nearbyRadius]);

  const toggleFavorite = (restaurant, e) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      const key = favKey(restaurant);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      try {
        localStorage.setItem('nopo-favorites', JSON.stringify([...next]));
      } catch { /* intentionally ignored: localStorage unavailable (private mode, quota exceeded) */ }
      return next;
    });
  };

  const toggleVisited = (restaurant, e) => {
    e.stopPropagation();
    const key = visitKey(restaurant);
    setVisited(prev => {
      const next = new Set(prev);
      const willUnvisit = next.has(key);
      if (willUnvisit) {
        next.delete(key);
      } else {
        next.add(key);
      }
      try {
        localStorage.setItem('nopo-visited', JSON.stringify([...next]));
      } catch { /* intentionally ignored: localStorage unavailable (private mode, quota exceeded) */ }
      // 방문 해제 시 평점/메모도 같이 제거 (의도 일관성)
      if (willUnvisit) {
        setMyVisits(prevVisits => {
          if (!(key in prevVisits)) return prevVisits;
          const nv = { ...prevVisits };
          delete nv[key];
          saveVisits(nv);
          return nv;
        });
      }
      return next;
    });
  };

  const handleUpdateMyVisit = (restaurant, patch) => {
    const key = visitKey(restaurant);
    setMyVisits(prev => {
      const next = updateVisit(prev, key, patch);
      saveVisits(next);
      return next;
    });
  };

  const handleShareFavorites = async () => {
    const names = restaurants
      .filter(r => favorites.has(favKey(r)))
      .map(r => r.상호명);
    if (names.length === 0) {
      alert('공유할 즐겨찾기가 없습니다. ♡ 버튼으로 식당을 저장해주세요.');
      return;
    }
    const url = buildShareUrl(names);
    if (!url) return;
    const ok = await copyToClipboard(url);
    if (ok) {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } else {
      prompt('아래 링크를 복사하세요:', url);
    }
  };

  const handleClearSharedMode = () => {
    setSharedListNames([]);
    setImportedCount(0);
    const params = new URLSearchParams(window.location.search);
    params.delete(SHARE_PARAM_KEY);
    const next = params.toString();
    window.history.replaceState({}, '', next ? `${window.location.pathname}?${next}` : window.location.pathname);
  };

  const handleImportShared = () => {
    if (sharedRestaurants.length === 0) return;
    let added = 0;
    setFavorites(prev => {
      const next = new Set(prev);
      sharedRestaurants.forEach(r => {
        const key = favKey(r);
        if (!next.has(key)) {
          next.add(key);
          added += 1;
        }
      });
      try {
        localStorage.setItem('nopo-favorites', JSON.stringify([...next]));
      } catch { /* intentionally ignored: localStorage unavailable (private mode, quota exceeded) */ }
      return next;
    });
    setImportedCount(added);
    setTimeout(() => setImportedCount(0), 3000);
  };

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({ lat: coords.latitude, lng: coords.longitude });
        setSortBy('거리순');
      },
      () => alert('위치 정보를 가져올 수 없습니다.\n브라우저 권한을 확인해주세요.'),
      { timeout: 8000 }
    );
  };

  const regions = useMemo(() => {
    const categoryData = restaurants.filter(item => item.카테고리 === activeCategory);
    const unique = Array.from(new Set(categoryData.map(item => item.지역)));
    return ['전체', ...unique.sort()];
  }, [activeCategory, restaurants]);

  // 영업시간 데이터 커버리지 — 너무 낮으면 "지금 영업중" 필터가 결과를 0에 수렴시켜
  // 사용자를 혼란시킨다. 30% 이상 채워질 때만 노출 (주간 크롤이 채우면 자동 활성화).
  // ponytail: 30% 임계값, 데이터 풍부해지면 상수 조정
  const showOpenNowFeature = useMemo(() => {
    if (restaurants.length === 0) return false;
    const withHours = restaurants.filter(r => getBusinessHours(r)).length;
    return withHours / restaurants.length >= 0.3;
  }, [restaurants]);

  // 베이지안 가중 평점 정렬용 전역 평균 (카테고리 기준, 필터와 무관하게 안정적인 C값 보장)
  // WR = (v/(v+m))*R + (m/(v+m))*C  (m=15: 리뷰 15개 미만은 평균 쪽으로 수렴)
  const BAYESIAN_M = 15;
  const globalAvgRating = useMemo(() => {
    const categoryData = restaurants.filter(r => r.카테고리 === activeCategory);
    const ratings = categoryData.map(r => parseFloat(r.평점)).filter(v => !isNaN(v) && v > 0);
    if (ratings.length === 0) return 0;
    return ratings.reduce((sum, v) => sum + v, 0) / ratings.length;
  }, [restaurants, activeCategory]);

  const isSharedMode = sharedListNames.length > 0;

  // 홈 상태: 의도적 탐색(검색/필터/지도/공유모드) 중 하나라도 active면 false
  const isHomeState =
    !searchQuery &&
    activeRegion === '전체' &&
    sortBy === '평점순' &&
    !showFavoritesOnly &&
    !showUnvisitedOnly &&
    !showOpenNowOnly &&
    !userLocation &&
    viewMode !== 'map' &&
    !isSharedMode;

  // featured 카드 선정 풀: 카테고리만 적용 (필터/정렬 무관하게 전체 카테고리)
  const categoryPool = useMemo(() => {
    const inCategory = restaurants.filter(r => r.카테고리 === activeCategory);
    // "오늘의 발견" 히어로 품질 확보: 평점 4.0 이상만 후보. 후보가 너무 적으면 전체로 폴백.
    const highRated = inCategory.filter(r => (parseFloat(r.평점) || 0) >= 4.0);
    return highRated.length >= 10 ? highRated : inCategory;
  }, [restaurants, activeCategory]);

  // featured 카드: 날짜+카테고리 시드로 결정적 픽, 리셔플 시 인덱스 덮어씀
  const featuredRestaurant = useMemo(() => {
    if (!isHomeState || categoryPool.length === 0) return null;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dateIdx = dateHashIndex(categoryPool.length, activeCategory + today);
    const idx = reshuffleIdx !== null
      ? (reshuffleIdx % categoryPool.length)
      : dateIdx;
    return categoryPool[idx] ?? null;
  }, [isHomeState, categoryPool, activeCategory, reshuffleIdx]);

  const sharedRestaurants = useMemo(() => {
    if (!isSharedMode || restaurants.length === 0) return [];
    const nameToRestaurant = new Map(restaurants.map(r => [r.상호명, r]));
    return sharedListNames
      .map(name => nameToRestaurant.get(name))
      .filter(Boolean)
      .map(item => ({
        ...item,
        distance:
          userLocation && item.lat && item.lng
            ? haversine(userLocation.lat, userLocation.lng, item.lat, item.lng)
            : null,
      }));
  }, [isSharedMode, restaurants, sharedListNames, userLocation]);

  const filteredData = useMemo(() => {
    // 공유 리스트 모드: 카테고리/지역/즐겨찾기 등 무시, 공유받은 순서 유지
    if (isSharedMode) return sharedRestaurants;

    let data = restaurants
      .filter(item => item.카테고리 === activeCategory)
      .map(item => ({
        ...item,
        distance:
          userLocation && item.lat && item.lng
            ? haversine(userLocation.lat, userLocation.lng, item.lat, item.lng)
            : null,
      }));

    if (activeRegion !== '전체') {
      data = data.filter(item => item.지역 === activeRegion);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(item =>
        item.cleanName.toLowerCase().includes(q) ||
        (item.대표메뉴 && item.대표메뉴.toLowerCase().includes(q))
      );
    }

    if (showFavoritesOnly) {
      data = data.filter(item => favorites.has(favKey(item)));
    }

    if (showUnvisitedOnly) {
      data = data.filter(item => !visited.has(visitKey(item)));
    }

    if (showOpenNowOnly) {
      data = data.filter(item => isOpenNow(item) === 'open');
    }

    if (userLocation && nearbyRadius < Infinity) {
      data = data.filter(item => item.distance !== null && item.distance <= nearbyRadius);
    }

    const sorted = [...data];
    if (sortBy === '이름순') {
      sorted.sort((a, b) => a.cleanName.localeCompare(b.cleanName, 'ko'));
    } else if (sortBy === '거리순') {
      sorted.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    } else {
      // 베이지안 가중 평점 정렬: WR = (v/(v+m))*R + (m/(v+m))*C
      // 폴백: 리뷰수(v) 없으면 원래 평점 R로 정렬 — review_count 미수집 상태(데이터 0건)에선
      // 기존 평점순과 동일하게 동작(회귀 없음). 주간 크롤로 리뷰수가 차면 가중치 자동 활성화.
      const C = globalAvgRating;
      const m = BAYESIAN_M;
      const bayesian = (item) => {
        const R = parseFloat(item.평점) || 0;
        const v = item.리뷰수 ?? 0;
        if (R === 0) return 0;
        if (v === 0) return R;
        return (v / (v + m)) * R + (m / (v + m)) * C;
      };
      sorted.sort((a, b) => bayesian(b) - bayesian(a));
    }

    return sorted;
  }, [isSharedMode, sharedRestaurants, activeCategory, activeRegion, restaurants, searchQuery, showFavoritesOnly, showUnvisitedOnly, showOpenNowOnly, sortBy, favorites, visited, userLocation, nearbyRadius, globalAvgRating]);

  const handleRandomPick = () => {
    if (filteredData.length === 0) return;
    // eslint-disable-next-line react-hooks/purity -- Math.random is intentional here; this is an event handler, not a render-time call
    const pick = filteredData[Math.floor(Math.random() * filteredData.length)];
    handleOpenRestaurant(pick);
  };

  const handleOpenRestaurant = (restaurant) => {
    setSelectedRestaurant(restaurant);
    const params = new URLSearchParams(window.location.search);
    params.set('r', restaurant.상호명);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  const handleCloseRestaurant = () => {
    setSelectedRestaurant(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('r');
    const newSearch = params.toString();
    window.history.replaceState({}, '', newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname);
  };

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    setActiveRegion('전체');
    setShowFavoritesOnly(false);
    setShowUnvisitedOnly(false);
    setShowOpenNowOnly(false);
    setFilterOpen(false);
    setReshuffleIdx(null); // 카테고리 변경 시 날짜픽으로 리셋
  };

  const handleResetFilters = () => {
    setActiveRegion('전체');
    setSortBy('평점순');
    setSearchQuery('');
    setShowFavoritesOnly(false);
    setShowUnvisitedOnly(false);
    setShowOpenNowOnly(false);
    setUserLocation(null);
  };

  const handleViewMode = (mode) => {
    setViewMode(mode);
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const activeFilterCount = [
    activeRegion !== '전체',
    sortBy !== '평점순',
    showFavoritesOnly,
    showUnvisitedOnly,
    showOpenNowOnly,
    userLocation !== null,
  ].filter(Boolean).length;

  // featured 카드와 같은 항목은 그리드에서 제외 (홈 상태에서만, 비홈이면 전부 표시)
  const featuredKey = featuredRestaurant ? favKey(featuredRestaurant) : null;
  const gridData = featuredKey
    ? filteredData.filter(r => favKey(r) !== featuredKey)
    : filteredData;
  const visibleData = gridData.slice(0, visibleCount);

  if (dataLoading) {
    return (
      <div className="loading" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
        <span>맛집 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className={`app-container ${activeCategory === '야장' ? 'yajang-theme' : ''}`}>
      {showInstallBanner && (
        <div className="install-banner">
          <span>📱 홈화면에 추가하면 앱처럼 사용할 수 있어요</span>
          <div className="install-banner-actions">
            <button className="install-banner-btn primary" onClick={handleInstall}>추가하기</button>
            <button className="install-banner-btn" onClick={() => setShowInstallBanner(false)}>✕</button>
          </div>
        </div>
      )}
      {isSharedMode && (
        <div className="share-banner">
          <span className="share-banner-title">
            🔗 공유받은 리스트 — {sharedRestaurants.length}곳
            {sharedRestaurants.length < sharedListNames.length && (
              <span className="share-banner-warning"> (찾을 수 없는 {sharedListNames.length - sharedRestaurants.length}곳 제외)</span>
            )}
          </span>
          <div className="share-banner-actions">
            {importedCount > 0 ? (
              <span className="share-banner-toast">✓ {importedCount}곳 즐겨찾기에 추가됨</span>
            ) : (
              <button className="share-banner-btn primary" onClick={handleImportShared}>
                ♥ 내 즐겨찾기에 담기
              </button>
            )}
            <button className="share-banner-btn" onClick={handleClearSharedMode}>
              전체 보기
            </button>
          </div>
        </div>
      )}
      <header className="header glass">
        <div className="header-content">
          {/* 1행: 로고 + 카테고리 탭 + 뷰 전환 */}
          <div className="header-row-1">
            <h1 className="title">
              <span className="title-icon">{activeCategory === '야장' ? '🌃' : '🍜'}</span>
              노포지도
              <span className="title-suffix"> - 서울의 숨은 맛</span>
            </h1>
            <div className="header-actions">
              <div className="category-toggle">
                <button
                  className={`category-btn ${activeCategory === '노포' ? 'active' : ''}`}
                  onClick={() => handleCategoryChange('노포')}
                >
                  🏮 노포
                </button>
                <button
                  className={`category-btn ${activeCategory === '야장' ? 'active' : ''}`}
                  onClick={() => handleCategoryChange('야장')}
                >
                  🌙 야장
                </button>
              </div>
              <div className="view-toggle">
                <button
                  className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => handleViewMode('list')}
                >
                  ☰ <span className="view-btn-text">목록</span>
                </button>
                <button
                  className={`view-btn ${viewMode === 'map' ? 'active' : ''}`}
                  onClick={() => handleViewMode('map')}
                >
                  🗺 <span className="view-btn-text">지도</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2행: 검색 + AI추천 + 내 위치 + 필터 */}
          <div className="header-row-2">
            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder="가게명, 메뉴 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="검색어 지우기"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              className={`chat-open-btn ${chatOpen ? 'active' : ''}`}
              onClick={() => setChatOpen(prev => !prev)}
              title="AI 맛집 추천"
            >
              <span aria-hidden="true">🤖</span><span className="btn-text"> AI 추천</span>
            </button>
            <button
              className={`location-btn ${userLocation ? 'active' : ''}`}
              onClick={handleLocate}
            >
              📍 {userLocation ? '위치 ON' : '내 위치'}
            </button>
            <button
              className={`filter-toggle-btn ${filterOpen ? 'open' : ''}`}
              onClick={() => setFilterOpen(prev => !prev)}
              aria-label="필터 열기"
            >
              필터 {filterOpen ? '▲' : '▼'}
              {activeFilterCount > 0 && (
                <span className="filter-count-badge">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {/* 접이식 필터 패널 */}
          <div className={`filter-panel ${filterOpen ? 'open' : ''}`}>
            <div className="filter-container">
              <select
                className="filter-select"
                aria-label="지역 선택"
                value={activeRegion}
                onChange={(e) => setActiveRegion(e.target.value)}
              >
                {regions.map((region) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
            <div className="filter-container">
              <select
                className="filter-select"
                aria-label="정렬 기준"
                value={sortBy}
                onChange={(e) => {
                  // 거리순은 위치 정보가 있어야 의미가 있음 — 위치 OFF면 먼저 위치 요청
                  if (e.target.value === '거리순' && !userLocation) {
                    handleLocate();
                  } else {
                    setSortBy(e.target.value);
                  }
                }}
              >
                <option value="평점순">⭐ 평점순</option>
                <option value="이름순">가나다순</option>
                <option value="거리순">📍 거리순</option>
              </select>
            </div>
            {userLocation && (
              <div className="filter-container">
                <select
                  className="filter-select"
                  aria-label="반경 선택"
                  value={nearbyRadius}
                  onChange={(e) => setNearbyRadius(Number(e.target.value))}
                >
                  <option value={1}>1km</option>
                  <option value={3}>3km</option>
                  <option value={5}>5km</option>
                  <option value={Infinity}>전체</option>
                </select>
              </div>
            )}
            <button
              className={`filter-toggle-item ${showFavoritesOnly ? 'active' : ''}`}
              onClick={() => setShowFavoritesOnly(prev => !prev)}
              aria-pressed={showFavoritesOnly}
            >
              {showFavoritesOnly ? '♥' : '♡'}
              {favorites.size > 0 && <span className="favorites-count">{favorites.size}</span>}
            </button>
            {favorites.size > 0 && (
              <button
                className={`share-fav-btn ${shareCopied ? 'copied' : ''}`}
                onClick={handleShareFavorites}
                title="즐겨찾기 식당을 친구에게 공유"
              >
                {shareCopied ? '✓ 링크 복사됨' : '🔗 공유'}
              </button>
            )}
            <button
              className={`filter-toggle-item ${showUnvisitedOnly ? 'active' : ''}`}
              onClick={() => setShowUnvisitedOnly(prev => !prev)}
              title="방문하지 않은 곳만 보기"
              aria-pressed={showUnvisitedOnly}
            >
              안 가본 곳
              {visited.size > 0 && <span className="favorites-count">{visited.size}곳 방문</span>}
            </button>
            {showOpenNowFeature && (
              <button
                className={`filter-toggle-item semantic-open ${showOpenNowOnly ? 'active' : ''}`}
                onClick={() => setShowOpenNowOnly(prev => !prev)}
                title="지금 영업 중인 곳만 보기"
                aria-pressed={showOpenNowOnly}
              >
                🟢 지금 영업중
              </button>
            )}
          </div>

          {/* 3행: 결과 수(항상 표시) + 활성 필터 칩 */}
          {!isSharedMode && (
            <div className="header-row-3">
              <span className="result-count">{filteredData.length.toLocaleString()}개 결과</span>
              {searchQuery && (
                <button className="filter-chip" onClick={() => setSearchQuery('')}>
                  "{searchQuery}" ×
                </button>
              )}
              {activeRegion !== '전체' && (
                <button className="filter-chip" onClick={() => setActiveRegion('전체')}>
                  {activeRegion} ×
                </button>
              )}
              {sortBy !== '평점순' && (
                <button className="filter-chip" onClick={() => setSortBy('평점순')}>
                  {sortBy} ×
                </button>
              )}
              {showFavoritesOnly && (
                <button className="filter-chip" onClick={() => setShowFavoritesOnly(false)}>
                  즐겨찾기 ×
                </button>
              )}
              {showUnvisitedOnly && (
                <button className="filter-chip" onClick={() => setShowUnvisitedOnly(false)}>
                  안 가본 곳 ×
                </button>
              )}
              {showOpenNowFeature && showOpenNowOnly && (
                <button className="filter-chip" onClick={() => setShowOpenNowOnly(false)}>
                  영업중 ×
                </button>
              )}
              {userLocation && (
                <button className="filter-chip" onClick={() => { setUserLocation(null); setSortBy('평점순'); }}>
                  내 위치 ×
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className={viewMode === 'map' ? 'main-map' : ''}>
        {filteredData.length === 0 ? (
          <div className="empty-state">
            {isSharedMode ? (
              <>
                <div className="empty-icon">🔗</div>
                <h2>공유받은 리스트의 식당을 찾을 수 없습니다.</h2>
                <p>식당 정보가 변경되었거나 링크가 손상되었을 수 있어요.</p>
              </>
            ) : showFavoritesOnly ? (
              <>
                <div className="empty-icon">🤍</div>
                <h2>즐겨찾기한 맛집이 없습니다.</h2>
                <p>카드의 ♡ 버튼을 눌러 저장하세요.</p>
              </>
            ) : (
              <>
                <div className="empty-icon">🍽️</div>
                <h2>
                  {searchQuery
                    ? `"${searchQuery}" 검색 결과가 없습니다`
                    : showOpenNowOnly
                    ? '지금 영업 중인 곳이 없습니다'
                    : showUnvisitedOnly
                    ? '조건에 맞는 안 가본 곳이 없습니다'
                    : userLocation
                    ? '이 반경 안에 맛집이 없습니다'
                    : '조건에 맞는 맛집이 없습니다'}
                </h2>
                <p>필터를 바꾸거나 초기화해 보세요.</p>
                {(activeFilterCount > 0 || searchQuery) && (
                  <button className="empty-reset-btn" onClick={handleResetFilters}>
                    필터 초기화
                  </button>
                )}
              </>
            )}
          </div>
        ) : viewMode === 'map' ? (
          <Suspense fallback={<div className="loading"><div className="spinner"></div><span>지도 불러오는 중...</span></div>}>
            <MapView
              restaurants={filteredData}
              onCardClick={handleOpenRestaurant}
              userLocation={userLocation}
              nearbyRadius={nearbyRadius}
              category={activeCategory}
            />
          </Suspense>
        ) : (
          <>
            {/* featured "오늘의 발견" 카드: 홈 상태에서만 */}
            {featuredRestaurant && (
              <FeaturedCard
                restaurant={featuredRestaurant}
                onOpen={handleOpenRestaurant}
                onReshuffle={() => {
                  setReshuffleIdx(Math.floor(Math.random() * categoryPool.length));
                }}
              />
            )}

            {/* 섹션 헤더: 그리드 위 항상 */}
            <div className="section-header">
              <span className="section-header-line" />
              <span className="section-header-text">{sortBy} · {filteredData.length}곳</span>
              <span className="section-header-line" />
            </div>

            <div className="restaurant-grid">
              {visibleData.map((restaurant, index) => (
                <RestaurantCard
                  key={`${restaurant.상호명}-${index}`}
                  data={restaurant}
                  index={index}
                  onClick={handleOpenRestaurant}
                  isFavorited={favorites.has(favKey(restaurant))}
                  onToggleFavorite={toggleFavorite}
                  isVisited={visited.has(visitKey(restaurant))}
                  onToggleVisited={toggleVisited}
                  distance={restaurant.distance}
                  myVisit={myVisits[visitKey(restaurant)]}
                />
              ))}
            </div>
            {visibleCount < gridData.length && (
              <div className="load-more-container">
                <button
                  className="load-more-btn"
                  onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                >
                  더 보기 ({visibleCount} / {gridData.length})
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <button className="random-fab" onClick={handleRandomPick} title="랜덤 맛집 뽑기" aria-label="랜덤 맛집 뽑기">
        🎲
      </button>

      {selectedRestaurant && (
        <RestaurantModal
          restaurant={selectedRestaurant}
          onClose={handleCloseRestaurant}
          isVisited={visited.has(visitKey(selectedRestaurant))}
          onToggleVisited={toggleVisited}
          myVisit={myVisits[visitKey(selectedRestaurant)]}
          onUpdateMyVisit={handleUpdateMyVisit}
        />
      )}

      <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

export default App;
