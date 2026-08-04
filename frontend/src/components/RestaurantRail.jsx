import { formatRestaurantName } from '../utils/format.js';

// 가로 스크롤 발견 레일. 레일 카드는 경량(이름·지역·평점) — 탭하면 상세 모달.
function RailCard({ data, onOpen, community }) {
  const { emoji, cleanName } = formatRestaurantName(data.상호명);
  return (
    <button className="rail-card" onClick={() => onOpen(data)} aria-label={`${cleanName} 상세 보기`}>
      {community?.photo ? (
        <span className="rail-photo"><img src={community.photo} alt="" loading="lazy" /></span>
      ) : (
        <span className="rail-emoji" aria-hidden="true">{emoji}</span>
      )}
      <span className="rail-name">{cleanName}</span>
      <span className="rail-meta">
        <span className="rail-region">{data.지역}</span>
        <span className="rail-rating">★ {data.평점 !== '정보 없음' ? data.평점 : '-'}</span>
      </span>
      {community && <span className="rail-community">💬 {community.avg.toFixed(1)}</span>}
    </button>
  );
}

export default function RestaurantRail({ title, subtitle, items, onOpen, communityRatings, favKeyOf }) {
  if (!items || items.length === 0) return null;
  return (
    <section className="rail-section">
      <div className="rail-head">
        <h3 className="rail-title">{title}</h3>
        {subtitle && <span className="rail-subtitle">{subtitle}</span>}
      </div>
      <div className="rail-scroll">
        {items.map((r, i) => (
          <RailCard
            key={`${r.상호명}-${i}`}
            data={r}
            onOpen={onOpen}
            community={communityRatings?.get(favKeyOf(r))}
          />
        ))}
      </div>
    </section>
  );
}
