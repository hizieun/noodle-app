import { useState, useMemo, useEffect } from 'react';
import './index.css';

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

// --- Modal Component ---
const RestaurantModal = ({ restaurant, onClose }) => {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!restaurant) return null;

  const { emoji, cleanName } = formatRestaurantName(restaurant.상호명);
  const menus = restaurant.대표메뉴 ? restaurant.대표메뉴.split(',').map(m => m.trim()).filter(Boolean) : [];

  const kakaoLink = restaurant.카카오맵_링크 || `https://map.kakao.com/?q=${encodeURIComponent(cleanName + ' ' + restaurant.주소)}`;
  const naverBlogLink = restaurant.네이버블로그_링크 || `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(cleanName + ' 후기')}`;
  const naverMapLink = restaurant.네이버지도_링크 || `https://map.naver.com/v5/search/${encodeURIComponent(cleanName + ' ' + restaurant.주소)}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">
              <span className="modal-emoji">{emoji}</span>
              {cleanName}
            </div>
            <span className="card-region" style={{ marginTop: '0.5rem', display: 'inline-block' }}>{restaurant.지역}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
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
        </div>
      </div>
    </div>
  );
};

// --- Card Component ---
const RestaurantCard = ({ data, index, onClick, isFavorited, onToggleFavorite }) => {
  const { emoji, cleanName } = formatRestaurantName(data.상호명);

  return (
    <div
      className="card animate-fade-in"
      style={{ animationDelay: `${index * 40}ms`, cursor: 'pointer' }}
      onClick={() => onClick(data)}
    >
      <div className="card-header">
        <h3 className="card-title">{emoji} {cleanName}</h3>
        <div className="card-header-right">
          <span className="card-region">{data.지역}</span>
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
        <span className="card-detail-hint">자세히 보기 →</span>
      </div>
    </div>
  );
};

const ITEMS_PER_PAGE = 30;

// --- App Main ---
function App() {
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRegion, setActiveRegion] = useState('전체');
  const [activeCategory, setActiveCategory] = useState('노포');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [sortBy, setSortBy] = useState('평점순');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('nopo-favorites');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/restaurants`);
        const data = await response.json();

        const processed = data.map(item => {
          const mappedItem = {
            상호명: item.name || item.상호명 || "이름 없음",
            지역: item.region || item.지역 || "기타",
            카테고리: item.category || item.카테고리 || '노포',
            주소: item.address || item.주소 || "",
            평점: item.rating || item.평점 || "정보 없음",
            전화번호: item.phone || item.전화번호 || "",
            대표메뉴: item.menus || item.대표메뉴 || "",
            카카오맵_링크: item.kakao_link || item.카카오맵_링크 || "",
            네이버블로그_링크: item.naver_blog_link || item.네이버블로그_링크 || "",
            네이버지도_링크: item.naver_map_link || item.네이버지도_링크 || ""
          };
          const { emoji, cleanName } = formatRestaurantName(mappedItem.상호명);
          return { ...mappedItem, emoji, cleanName };
        });

        setRestaurants(processed);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // 필터 변경 시 더 보기 초기화
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [activeCategory, activeRegion, searchQuery, sortBy, showFavoritesOnly]);

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
      } catch {}
      return next;
    });
  };

  const regions = useMemo(() => {
    const categoryData = restaurants.filter(item => item.카테고리 === activeCategory);
    const unique = Array.from(new Set(categoryData.map(item => item.지역)));
    return ['전체', ...unique.sort()];
  }, [activeCategory, restaurants]);

  const filteredData = useMemo(() => {
    let data = restaurants.filter(item => item.카테고리 === activeCategory);

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

    const sorted = [...data];
    if (sortBy === '이름순') {
      sorted.sort((a, b) => a.cleanName.localeCompare(b.cleanName, 'ko'));
    } else {
      sorted.sort((a, b) => parseFloat(b.평점) - parseFloat(a.평점));
    }

    return sorted;
  }, [activeCategory, activeRegion, restaurants, searchQuery, showFavoritesOnly, sortBy, favorites]);

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    setActiveRegion('전체');
    setShowFavoritesOnly(false);
  };

  const visibleData = filteredData.slice(0, visibleCount);

  return (
    <div className={`app-container ${activeCategory === '야장' ? 'yajang-theme' : ''}`}>
      <header className="header glass">
        <div className="header-content">
          <h1 className="title">
            <span className="title-icon">{activeCategory === '야장' ? '🌃' : '🍜'}</span>
            노포지도
            <span className="title-suffix"> - 서울의 숨은 맛</span>
          </h1>

          <div className="controls-group">
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

            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder="가게명, 메뉴 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-container">
              <select
                className="filter-select"
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
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="평점순">⭐ 평점순</option>
                <option value="이름순">가나다순</option>
              </select>
            </div>

            <button
              className={`favorites-toggle-btn ${showFavoritesOnly ? 'active' : ''}`}
              onClick={() => setShowFavoritesOnly(prev => !prev)}
            >
              {showFavoritesOnly ? '♥' : '♡'}
              {favorites.size > 0 && <span className="favorites-count">{favorites.size}</span>}
            </button>
          </div>
        </div>
      </header>

      <main>
        {isLoading ? (
          <div className="loading">
            <div className="spinner"></div>
            <span>맛집 정보를 불러오는 중...</span>
          </div>
        ) : filteredData.length > 0 ? (
          <>
            <div className="restaurant-grid">
              {visibleData.map((restaurant, index) => (
                <RestaurantCard
                  key={`${restaurant.상호명}-${index}`}
                  data={restaurant}
                  index={index}
                  onClick={setSelectedRestaurant}
                  isFavorited={favorites.has(favKey(restaurant))}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
            {visibleCount < filteredData.length && (
              <div className="load-more-container">
                <button
                  className="load-more-btn"
                  onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                >
                  더 보기 ({visibleCount} / {filteredData.length})
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            {showFavoritesOnly ? (
              <>
                <div className="empty-icon">🤍</div>
                <h2>즐겨찾기한 맛집이 없습니다.</h2>
                <p>카드의 ♡ 버튼을 눌러 저장하세요.</p>
              </>
            ) : (
              <>
                <div className="empty-icon">🍽️</div>
                <h2>검색 결과가 없습니다.</h2>
                <p>선택한 지역의 맛집 정보를 찾을 수 없습니다.</p>
              </>
            )}
          </div>
        )}
      </main>

      {selectedRestaurant && (
        <RestaurantModal
          restaurant={selectedRestaurant}
          onClose={() => setSelectedRestaurant(null)}
        />
      )}
    </div>
  );
}

export default App;
