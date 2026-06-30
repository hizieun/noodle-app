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

    const history = messages.map(({ role, text }) => ({ role, text }));
    setMessages(prev => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'model',
        text: data.text || '죄송합니다, 응답을 받지 못했습니다.',
        restaurants: data.restaurants || [],
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'model',
        text: '연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
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
            <span id="chat-panel-title" className="chat-panel-title">🤖 AI 맛집 추천</span>
            <span className="chat-panel-subtitle">Gemini 2.5 Flash · 노포지도 데이터 기반</span>
          </div>
          <button className="chat-close-btn" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <div className="chat-welcome-icon">🍜</div>
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
                {m.role === 'model' && <span className="chat-avatar">🤖</span>}
                <div className="chat-bubble-group">
                  <div className="chat-bubble">{m.text}</div>
                  {m.role === 'model' && m.restaurants && m.restaurants.length > 0 && (
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
              <span className="chat-avatar">🤖</span>
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
