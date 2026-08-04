import { formatRestaurantName } from '../utils/format.js';
import { isOpenNow } from '../businessHours.js';
import { HeartIcon, CheckIcon, MessageIcon, MapPinIcon } from './icons.jsx';

// --- Card Component ---
const RestaurantCard = ({ data, index, onClick, isFavorited, onToggleFavorite, isVisited, onToggleVisited, distance, myVisit, community }) => {
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
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(data); } }}
      aria-label={`${cleanName} 상세 보기`}
    >
      {community?.photo && (
        <div className="card-cover">
          <img src={community.photo} alt="" loading="lazy" />
        </div>
      )}
      <div className="card-topbar">
        <span className="card-region">{data.지역}</span>
        <div className="card-controls">
          <button
            className={`visit-btn ${isVisited ? 'active' : ''}`}
            onClick={(e) => onToggleVisited(data, e)}
            aria-label={isVisited ? '방문 취소' : '방문했어요'}
            title={isVisited ? '방문 취소' : '가봤어요'}
          >
            {isVisited ? <><CheckIcon size={14} /> 방문</> : '방문'}
          </button>
          <button
            className={`favorite-btn ${isFavorited ? 'active' : ''}`}
            onClick={(e) => onToggleFavorite(data, e)}
            aria-label={isFavorited ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          >
            <HeartIcon size={18} filled={isFavorited} />
          </button>
        </div>
      </div>

      <h3 className="card-title"><span className="card-emoji" aria-hidden="true">{emoji}</span>{cleanName}</h3>

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
        {community && (
          <span className="community-badge" title="커뮤니티 리뷰 평점"><MessageIcon size={12} /> {community.avg.toFixed(1)} ({community.count})</span>
        )}
        {openStatus === 'open' && <span className="open-badge open">🟢 영업중</span>}
        {openStatus === 'closed' && <span className="open-badge closed">🔴 영업종료</span>}
        {myRating > 0 && !distanceLabel && (
          <span className="my-rating-badge" title="내가 매긴 평점">내 ★ {myRating}</span>
        )}
        {distanceLabel ? (
          <span className="distance-badge"><MapPinIcon size={12} /> {distanceLabel}</span>
        ) : (
          <span className="card-detail-hint">자세히 보기 →</span>
        )}
      </div>
    </div>
  );
};

export default RestaurantCard;
