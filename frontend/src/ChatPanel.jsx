import { useState, useRef, useEffect } from 'react';
import { favKey } from './utils/format.js';

const EXAMPLES = [
  '비 오는 날 종로구 노포 술집 추천해줘',
  '부모님 모시고 가기 좋은 깔끔한 식당 어디야?',
  '강남구 평점 높은 냉면 맛집 알려줘',
  '혼자 가기 좋은 야장 추천해줘',
];

export default function ChatPanel({ isOpen, onClose, onOpenRestaurant, restaurants = [] }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // 실패한 턴은 질문까지 빼고 보냄 — 에러 문구가 모델 답으로 맥락에 섞이지 않게
    const history = [];
    for (const m of messages) {
      if (m.failed) { history.pop(); continue; }
      history.push({ role: m.role, text: m.text });
    }
    setMessages(prev => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const data = await res.json().catch(() => ({}));
      setMessages(prev => [...prev, data.text
        ? { role: 'model', text: data.text, intro: data.intro, caveat: data.caveat, picks: data.picks, restaurants: data.restaurants || [] }
        : {
            role: 'model',
            failed: true,
            text: res.status === 429
              ? 'AI 추천 사용량 한도에 걸렸어요. 나중에 다시 물어봐 주세요.'
              : '답변을 만들지 못했어요. 다시 물어봐 주세요.',
          }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'model',
        failed: true,
        text: '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 물어봐 주세요.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      {isOpen && <div className="chat-overlay" onClick={onClose} />}
      <div
        className={`chat-panel ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-panel-title"
      >
        <div className="chat-panel-header">
          <div className="chat-panel-title-group">
            <span id="chat-panel-title" className="chat-panel-title">AI 맛집 추천</span>
            <span className="chat-panel-subtitle">노포지도 데이터로 골라드려요</span>
          </div>
          <button className="chat-close-btn" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <p className="chat-welcome-text">노포·야장 맛집을 AI에게 물어보세요</p>
              <div className="chat-examples">
                {EXAMPLES.map((ex, i) => (
                  <button key={i} type="button" className="chat-example-chip" onClick={() => send(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`chat-message ${m.role}`}>
                {m.role === 'model' && <span className="chat-avatar" aria-hidden="true">AI</span>}
                <div className="chat-bubble-group">
                  {m.picks ? (
                    // 구조화 답: 도입 + (확인 불가 안내) + 메뉴판 줄 — 식당은 서버가 후보 ID로 매핑한 실존 데이터만
                    <>
                      <div className="chat-bubble">{m.intro}</div>
                      {m.caveat && <p className="chat-caveat">{m.caveat}</p>}
                      {m.picks.length > 0 && (
                        <ol className="chat-picks">
                          {m.picks.map((p, pi) => {
                            const full = restaurants.find(r => favKey(r) === favKey(p));
                            return (
                              <li key={pi}>
                                <button
                                  type="button"
                                  className="chat-pick"
                                  onClick={() => full && onOpenRestaurant && onOpenRestaurant(full)}
                                  disabled={!full}
                                  aria-label={`${p.상호명} 상세 보기`}
                                >
                                  <span className="menu-row-line">
                                    <span className="menu-row-name">{p.상호명}</span>
                                    <span className="menu-row-leader" aria-hidden="true" />
                                    <span className="menu-row-rating"><span className="star" aria-hidden="true">★</span>{p.평점 !== '정보 없음' ? p.평점 : '-'}</span>
                                  </span>
                                  <span className="chat-pick-meta">
                                    <span>{p.지역}</span>
                                    {p.open === true && <span className="open-badge open">영업중</span>}
                                    {p.hours && <span>{p.hours}</span>}
                                  </span>
                                  <span className="chat-pick-reason">{p.reason}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </>
                  ) : (
                    <div className="chat-bubble">{m.text}</div>
                  )}
                  {m.role === 'model' && !m.picks && m.restaurants && m.restaurants.length > 0 && (
                    <div className="chat-result-links">
                      {m.restaurants.map((chip, ci) => {
                        const full = restaurants.find(r => favKey(r) === favKey(chip));
                        return (
                          <button
                            key={ci}
                            type="button"
                            className="chat-result-chip"
                            onClick={() => full && onOpenRestaurant && onOpenRestaurant(full)}
                            disabled={!full}
                            title={full ? `${chip.상호명} 상세 보기` : '식당 정보를 찾을 수 없습니다'}
                          >
                            {chip.상호명}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="chat-message model">
              <span className="chat-avatar" aria-hidden="true">AI</span>
              <div className="chat-bubble chat-typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-area">
          <label htmlFor="chat-input" className="sr-only">맛집 추천 질문</label>
          <input
            ref={inputRef}
            id="chat-input"
            className="chat-input"
            placeholder="맛집 추천 질문을 입력하세요..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
          />
          <button
            className="chat-send-btn"
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            aria-label="전송"
          >
            ↑
          </button>
        </div>
      </div>
    </>
  );
}
