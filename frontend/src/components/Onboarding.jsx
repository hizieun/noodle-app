// 첫 방문 1회 웰컴 카드 (docs/10 §10.2) — 노포/야장 뜻 + 사용법 안내.
// 코치마크 대신 단일 카드: 레이아웃 변화에 안 깨지고 구현 단순.
const STEPS = [
  { icon: '🏮🌙', title: '노포와 야장', desc: '오래된 노포 맛집(🏮)과 밤거리 포장마차 야장(🌙) — 상단 토글로 전환해요.' },
  { icon: '🧭', title: '둘러보고 발견', desc: '하단 탭으로 발견·지도·AI 추천·내 리스트를 오가요.' },
  { icon: '✨', title: 'AI에게 물어보기', desc: '“혼밥”, “회식”, “해장”처럼 상황만 말하면 골라드려요.' },
];

export default function Onboarding({ onClose }) {
  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-label="시작 안내">
      <div className="onboarding-card">
        <div className="onboarding-brand" aria-hidden="true">🍜</div>
        <h2 className="onboarding-title">서울의 숨은 맛,<br />노포지도</h2>
        <p className="onboarding-lead">오래된 노포와 밤거리 야장을 둘러보고 발견하세요.</p>
        <ul className="onboarding-steps">
          {STEPS.map((s) => (
            <li key={s.title} className="onboarding-step">
              <span className="onboarding-step-icon" aria-hidden="true">{s.icon}</span>
              <span className="onboarding-step-text">
                <strong>{s.title}</strong>
                <span>{s.desc}</span>
              </span>
            </li>
          ))}
        </ul>
        <button className="onboarding-cta" onClick={onClose}>시작하기</button>
      </div>
    </div>
  );
}
