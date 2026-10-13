import { formatRestaurantName } from '../utils/format.js';
import { isOpenNow, isClosedToday } from '../businessHours.js';
import { HeartIcon, CheckIcon, MessageIcon, MapPinIcon } from './icons.jsx';

// --- Card Component ---
const RestaurantCard = ({ data, onClick, isFavorited, onToggleFavorite, isVisited, onToggleVisited, distance, myVisit, community }) => {
  const { cleanName } = formatRestaurantName(data.상호명);

  const distanceLabel = distance !== null && distance !== undefined
    ? distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`
    : null;

  const openStatus = isOpenNow(data);
  const closedToday = isClosedToday(data);
  const myRating = myVisit?.rating || 0;
  // 지역을 바로 앞에 쓰므로 주소의 '서울 OO구 '는 같은 구일 때만 생략 (다른 구면 그대로 둬서 정보 보존)
  const shortAddress = (data.주소 || '').replace(new RegExp(`^서울(특별시)?\\s+${data.지역}\\s+`), '');

  return (
    <div
      className={`card ${isVisited ? 'visited' : ''}`}
      onClick={() => onClick(data)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(data); } }}
      aria-label={`${cleanName} 상세 보기`}
    >
      <div className="card-line">
        <h3 className="card-title">{cleanName}</h3>
        <span className="menu-row-leader" aria-hidden="true" />
        <span className="card-rating"><span className="star" aria-hidden="true">★</span>{data.평점 !== '정보 없음' ? data.평점 : '-'}</span>
        <div className="card-controls">
          <button
            className={`visit-btn ${isVisited ? 'active' : ''}`}
            onClick={(e) => onToggleVisited(data, e)}
            aria-label={isVisited ? '방문 취소' : '방문했어요'}
            title={isVisited ? '방문 취소' : '가봤어요'}
          >
            {isVisited ? <><CheckIcon size={13} /> 방문</> : '방문'}
          </button>
          <button
            className={`favorite-btn ${isFavorited ? 'active' : ''}`}
            onClick={(e) => onToggleFavorite(data, e)}
            aria-label={isFavorited ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          >
            <HeartIcon size={17} filled={isFavorited} />
          </button>
        </div>
      </div>

      <div className="card-meta">
        <span className="card-region">{data.지역}</span>
        <span className="card-address">{shortAddress}</span>
        {openStatus === 'open' && <span className="open-badge open">영업중</span>}
        {openStatus === 'closed' && (closedToday
          ? <span className="open-badge rest">오늘 휴무</span>
          : <span className="open-badge closed">영업종료</span>)}
        {distanceLabel && <span className="distance-badge"><MapPinIcon size={12} /> {distanceLabel}</span>}
        {community && (
          <span className="community-badge" title="커뮤니티 리뷰 평점"><MessageIcon size={12} /> {community.avg.toFixed(1)} ({community.count})</span>
        )}
        {myRating > 0 && <span className="my-rating-badge" title="내가 매긴 평점">내 ★{myRating}</span>}
      </div>
    </div>
  );
};

export default RestaurantCard;
