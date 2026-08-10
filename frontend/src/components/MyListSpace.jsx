import { useState } from 'react';
import { HeartIcon, CheckIcon, MessageIcon, LinkIcon } from './icons.jsx';

// 내 리스트 통합 공간 (docs/09 Phase 3): 즐겨찾기 / 가본 곳 / 내 평가 세그먼트 + 공유.
const SEGMENTS = [
  { key: 'fav', label: '즐겨찾기', Icon: HeartIcon, empty: '하트를 눌러 저장한 곳이 여기 모여요.' },
  { key: 'visited', label: '가본 곳', Icon: CheckIcon, empty: '방문 체크한 곳이 아직 없어요.' },
  { key: 'rated', label: '내 평가', Icon: MessageIcon, empty: '별점·메모를 남긴 곳이 아직 없어요.' },
];

export default function MyListSpace({ favList, visitedList, ratedList, renderCard, onShare, shareCopied, onBrowse }) {
  const [seg, setSeg] = useState('fav');
  const lists = { fav: favList, visited: visitedList, rated: ratedList };
  const current = SEGMENTS.find(s => s.key === seg);
  const items = lists[seg];

  return (
    <div className="mylist">
      <div className="mylist-head">
        <h2 className="mylist-title">내 리스트</h2>
        {favList.length > 0 && (
          <button className={`mylist-share ${shareCopied ? 'copied' : ''}`} onClick={onShare}>
            {shareCopied ? <><CheckIcon size={15} /> 링크 복사됨</> : <><LinkIcon size={15} /> 공유</>}
          </button>
        )}
      </div>

      <div className="mylist-segs" role="tablist">
        {SEGMENTS.map((s) => {
          const Icon = s.Icon;
          return (
            <button
              key={s.key}
              role="tab"
              aria-selected={seg === s.key}
              className={`mylist-seg ${seg === s.key ? 'active' : ''}`}
              onClick={() => setSeg(s.key)}
            >
              <Icon size={15} filled={s.key === 'fav' && seg === s.key} />
              <span>{s.label}</span>
              <span className="mylist-seg-count">{lists[s.key].length}</span>
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="empty-state mylist-empty">
          <div className="empty-icon"><current.Icon size={52} /></div>
          <p>{current.empty}</p>
          {onBrowse && (
            <button className="empty-browse-btn" onClick={onBrowse}>맛집 둘러보기 →</button>
          )}
        </div>
      ) : (
        <div className="restaurant-grid">
          {items.map((r, i) => renderCard(r, i))}
        </div>
      )}
    </div>
  );
}
