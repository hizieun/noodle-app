import { useState, useMemo } from 'react';
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
  // 카카오맵에서 붙는 알파벳 + 공백(예: "A ") 제거
  const cleanName = name.replace(/^[a-zA-Z]\s+/, '');
  const emoji = getRestaurantEmoji(cleanName);
  return `${emoji} ${cleanName}`;
};

const RestaurantCard = ({ data, index }) => {
  const formattedName = formatRestaurantName(data.상호명);

  return (
    <div
      className="card animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="card-header">
        <h3 className="card-title">{formattedName}</h3>
        <span className="card-region">{data.지역}</span>
      </div>

      <div className="card-address">
        <svg xmlns="http://www.w3.org/w/svg/2000" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        {data.주소}
      </div>

      <div className="card-rating">
        <svg xmlns="http://www.w3.org/w/svg/2000" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        {data.평점 !== "정보 없음" ? data.평점 : "-"}
      </div>
    </div>
  );
};

function App() {
  const [activeRegion, setActiveRegion] = useState('전체');

  // Extract unique regions for the filter
  const regions = useMemo(() => {
    const rawRegions = restaurantData.map((item) => item.지역);
    const unique = Array.from(new Set(rawRegions));
    return ['전체', ...unique.sort()];
  }, []);

  // Filter the data based on active region
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
    </div>
  );
}

export default App;
