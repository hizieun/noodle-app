import { useState, useMemo, useEffect } from 'react';
import restaurantData from './data.json';
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

// --- Modal Component ---
const RestaurantModal = ({ restaurant, onClose }) => {
  // ESC 키로 닫기
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!restaurant) return null;

  const { emoji, cleanName } = formatRestaurantName(restaurant.상호명);
  const menus = restaurant.대표메뉴 ? restaurant.대표메뉴.split(',').map(m => m.trim()).filter(Boolean) : [];

  // 링크가 없으면 주소로 자동 생성
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
          {/* 기본 정보 */}
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

          {/* 대표 메뉴 */}
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

          {/* 외부 링크 */}
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
const RestaurantCard = ({ data, index, onClick }) => {
  const { emoji, cleanName } = formatRestaurantName(data.상호명);

  return (
    <div
      className="card animate-fade-in"
      style={{ animationDelay: `${index * 40}ms`, cursor: 'pointer' }}
      onClick={() => onClick(data)}
    >
      <div className="card-header">
        <h3 className="card-title">{emoji} {cleanName}</h3>
        <span className="card-region">{data.지역}</span>
      </div>

      <div className="card-address">
        <svg xmlns="http://www.w3.org/w/svg/2000" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        {data.주소}
      </div>

      <div className="card-footer">
        <div className="card-rating">
          <svg xmlns="http://www.w3.org/w/svg/2000" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          {data.평점 !== "정보 없음" ? data.평점 : "-"}
        </div>
        <span className="card-detail-hint">자세히 보기 →</span>
      </div>
    </div>
  );
};

// --- App Main ---
function App() {
  const [activeRegion, setActiveRegion] = useState('전체');
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  const regions = useMemo(() => {
    const rawRegions = restaurantData.map((item) => item.지역);
    const unique = Array.from(new Set(rawRegions));
    return ['전체', ...unique.sort()];
  }, []);

  const filteredData = useMemo(() => {
    if (activeRegion === '전체') return restaurantData;
    return restaurantData.filter((item) => item.지역 === activeRegion);
  }, [activeRegion]);

  return (
    <div className="app-container">
      <header className="header glass">
        <div className="header-content">
          <h1 className="title">
            <span className="title-icon">🍜</span>
            Noodle 노포 맛집
          </h1>

          <div className="filter-container">
            <select
              className="filter-select"
              value={activeRegion}
              onChange={(e) => setActiveRegion(e.target.value)}
            >
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main>
        {filteredData.length > 0 ? (
          <div className="restaurant-grid">
            {filteredData.map((restaurant, index) => (
              <RestaurantCard
                key={`${restaurant.상호명}-${index}`}
                data={restaurant}
                index={index}
                onClick={setSelectedRestaurant}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🍽️</div>
            <h2>검색 결과가 없습니다.</h2>
            <p>선택한 지역의 맛집 정보를 찾을 수 없습니다.</p>
          </div>
        )}
      </main>

      {/* Modal */}
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
