import { HomeIcon, MapIcon, SparklesIcon, HeartIcon } from './icons.jsx';

// 하단 탭 내비 — 목적별 공간 (발견/지도/AI/내 리스트)
const TABS = [
  { key: 'home', label: '발견', Icon: HomeIcon },
  { key: 'map', label: '지도', Icon: MapIcon },
  { key: 'ai', label: 'AI 추천', Icon: SparklesIcon },
  { key: 'list', label: '내 리스트', Icon: HeartIcon },
];

export default function BottomNav({ active, onChange, savedCount = 0 }) {
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {TABS.map((tab) => {
        const Icon = tab.Icon;
        return (
          <button
            key={tab.key}
            className={`bottom-nav-item ${active === tab.key ? 'active' : ''}`}
            onClick={() => onChange(tab.key)}
            aria-current={active === tab.key ? 'page' : undefined}
          >
            <span className="bottom-nav-icon">
              <Icon size={22} filled={tab.key === 'list' && savedCount > 0} />
              {tab.key === 'list' && savedCount > 0 && <span className="bottom-nav-badge">{savedCount}</span>}
            </span>
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
