import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import './index.css';
import ChatPanel from './ChatPanel.jsx';
import { isOpenNow, getBusinessHours } from './businessHours.js';
import { buildShareUrl, readShareListFromLocation, copyToClipboard, PARAM_KEY as SHARE_PARAM_KEY } from './shareList.js';
import { loadVisits, saveVisits, updateVisit } from './myVisits.js';
import { favKey, visitKey, formatRestaurantName, dateHashIndex, ITEMS_PER_PAGE } from './utils/format.js';
import { haversine } from './utils/geo.js';
import { useCommunityRatings } from './lib/useCommunityRatings.js';
import RestaurantModal from './components/RestaurantModal.jsx';
import RestaurantCard from './components/RestaurantCard.jsx';
import FeaturedCard from './components/FeaturedCard.jsx';
import { SkeletonGrid } from './components/Skeleton.jsx';

const MapView = lazy(() => import('./MapView.jsx'));

// 설치 배너 억제: 7일 이내 닫은 적 있으면 숨김
const INSTALL_DISMISSED_KEY = 'nopo-install-dismissed';
const INSTALL_SUPPRESS_MS = 7 * 24 * 60 * 60 * 1000;
const isInstallBannerSuppressed = () => {
  try {
    const ts = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < INSTALL_SUPPRESS_MS;
  } catch {
    return false;
  }
};

// --- App Main ---
function App() {
  const [restaurants, setRestaurants] = useState([]);
  const communityRatings = useCommunityRatings(); // key → {avg, count}
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

  // PWA 설치 프롬프트 — 7일 이내 닫은 이력 있으면 표시 안 함
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      if (!isInstallBannerSuppressed()) {
        setShowInstallBanner(true);
      }
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

  const handleDismissInstallBanner = () => {
    setShowInstallBanner(false);
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    } catch { /* localStorage unavailable */ }
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

  // 지도뷰일 때 body 여백 제거 (map-mode class)
  useEffect(() => {
    if (viewMode === 'map') {
      document.body.classList.add('map-mode');
    } else {
      document.body.classList.remove('map-mode');
    }
    return () => document.body.classList.remove('map-mode');
  }, [viewMode]);

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
    return <SkeletonGrid />;
  }

  return (
    <>
      {/* 설치 배너: app-container 밖 full-width 블록, 공유 배너와 동시엔 숨김 */}
      {showInstallBanner && !isSharedMode && (
        <div className="install-banner">
          <span>📱 홈화면에 추가하면 앱처럼 사용할 수 있어요</span>
          <div className="install-banner-actions">
            <button className="install-banner-btn primary" onClick={handleInstall}>추가하기</button>
            <button className="install-banner-btn" onClick={handleDismissInstallBanner}>✕</button>
          </div>
        </div>
      )}
      <div className={`app-container ${activeCategory === '야장' ? 'yajang-theme' : ''} ${viewMode === 'map' ? 'map-mode' : ''}`}>
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
                community={communityRatings.get(featuredKey)}
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
                  community={communityRatings.get(favKey(restaurant))}
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

      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        onOpenRestaurant={handleOpenRestaurant}
        restaurants={restaurants}
      />
    </div>
    </>
  );
}

export default App;
