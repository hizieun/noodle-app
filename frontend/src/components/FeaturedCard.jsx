import { formatRestaurantName } from '../utils/format.js';
import { isOpenNow } from '../businessHours.js';
import { MessageIcon, MapPinIcon, ShuffleIcon } from './icons.jsx';

// --- "오늘의 집" — 상호를 간판처럼 내건 히어로 ---
const FeaturedCard = ({ restaurant, onOpen, onReshuffle, community }) => {
  const { cleanName } = formatRestaurantName(restaurant.상호명);
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
      className="featured-card"
      onClick={() => onOpen(restaurant)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(restaurant); }}
      aria-label={`오늘의 집: ${cleanName}`}
    >
      <div className="featured-label-row">
        <span className="featured-label">오늘의 집</span>
        <span className="featured-spacer" />
        {openStatus === 'open' && <span className="open-badge open">영업중</span>}
        {openStatus === 'closed' && <span className="open-badge closed">영업종료</span>}
      </div>

      <div className="signboard">
        <h2 className="featured-name">{cleanName}</h2>
      </div>

      <div className="featured-meta">
        <span className="featured-region">{restaurant.지역}</span>
        <span className="featured-rating">★ {restaurant.평점 !== '정보 없음' ? restaurant.평점 : '-'}</span>
        {community && <span className="community-badge" title="커뮤니티 리뷰 평점"><MessageIcon size={12} /> {community.avg.toFixed(1)} ({community.count})</span>}
        {distanceLabel && <span className="distance-badge"><MapPinIcon size={12} /> {distanceLabel}</span>}
      </div>

      <p className="featured-address">{restaurant.주소}</p>

      {menus.length > 0 && (
        <p className="featured-menus">{menus.slice(0, 5).join(', ')}</p>
      )}

      <div className="featured-footer">
        <span className="featured-hint">자세히 보기</span>
        <button
          className="featured-reshuffle-btn"
          onClick={(e) => { e.stopPropagation(); onReshuffle(); }}
          title="같은 카테고리 내 다른 식당으로 교체"
          aria-label="다른 식당 추천"
        >
          <ShuffleIcon size={15} /> 다른 집
        </button>
      </div>
    </div>
  );
};

export default FeaturedCard;
