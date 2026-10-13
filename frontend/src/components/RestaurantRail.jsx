import { useState } from 'react';
import { formatRestaurantName } from '../utils/format.js';

// 발견 피드의 한 칸 = 메뉴판 한 칸. "상호 ........ 평점" 줄로 늘어놓고, 탭하면 상세 모달.
const PREVIEW = 6;

function MenuRow({ data, onOpen, community }) {
  const { cleanName } = formatRestaurantName(data.상호명);
  const firstMenu = data.대표메뉴?.split(',')[0]?.trim();
  return (
    <li>
      <button className="menu-row" onClick={() => onOpen(data)} aria-label={`${cleanName} 상세 보기`}>
        <span className="menu-row-line">
          <span className="menu-row-name">{cleanName}</span>
          <span className="menu-row-leader" aria-hidden="true" />
          <span className="menu-row-rating"><span className="star" aria-hidden="true">★</span>{data.평점 !== '정보 없음' ? data.평점 : '-'}</span>
        </span>
        <span className="menu-row-meta">
          <span>{data.지역}</span>
          {firstMenu && <span>{firstMenu}</span>}
          {community && <span>리뷰 {community.avg.toFixed(1)}</span>}
        </span>
      </button>
    </li>
  );
}

export default function RestaurantRail({ title, subtitle, items, onOpen, communityRatings, favKeyOf }) {
  const [expanded, setExpanded] = useState(false);
  if (!items || items.length === 0) return null;
  const shown = expanded ? items : items.slice(0, PREVIEW);
  return (
    <section className="rail-section">
      <div className="rail-head">
        <h3 className="rail-title">{title}</h3>
        {subtitle && <span className="rail-subtitle">{subtitle}</span>}
      </div>
      <ul className="menu-list">
        {shown.map((r, i) => (
          <MenuRow
            key={`${r.상호명}-${i}`}
            data={r}
            onOpen={onOpen}
            community={communityRatings?.get(favKeyOf(r))}
          />
        ))}
      </ul>
      {items.length > PREVIEW && (
        <button className="menu-more" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>
          {expanded ? '접기' : `더 보기 (${items.length - PREVIEW}곳)`}
        </button>
      )}
    </section>
  );
}
