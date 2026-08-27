// 응답 생성 — 두 타깃.
//   prod : 배포된 /api/chat 호출(로컬 키 불필요, 배포 프롬프트 테스트)
//   local: frontend/api/chat.js 핸들러 직접 호출(GEMINI_API_KEY 필요, 프롬프트 A/B 테스트)
// A/B·CI의 정식 타깃은 local(프롬프트 변경 반영). prod는 키 없는 로컬 스모크용.
const PROD_URL = process.env.EVAL_PROD_URL || 'https://frontend-kappa-six-36.vercel.app/api/chat';

let localHandler = null;
async function getLocalHandler() {
  if (!localHandler) {
    const mod = await import('../../frontend/api/chat.js');
    localHandler = mod.default;
  }
  return localHandler;
}

export async function generate(message, { target = 'prod', history = [] } = {}) {
  const t0 = Date.now();
  if (target === 'local') {
    const handler = await getLocalHandler();
    const out = await new Promise((resolve) => {
      const req = { method: 'POST', body: { message, history } };
      const res = { status() { return this; }, json(o) { resolve(o); }, end() { resolve({}); } };
      handler(req, res);
    });
    return { text: out.text || '', mentioned: out.restaurants || [], latency_ms: Date.now() - t0, error: out.error || null };
  }
  // prod — 일시적 오류(쓰로틀/콜드스타트) 재시도 2회 백오프
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 800 * attempt));
    try {
      const r = await fetch(PROD_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      const data = await r.json().catch(() => ({}));
      const err = data.error || (r.ok ? null : `HTTP ${r.status}`);
      if (!err && data.text) return { text: data.text, mentioned: data.restaurants || [], latency_ms: Date.now() - t0, error: null };
      lastErr = err || '빈 응답';
    } catch (e) { lastErr = e.message; }
  }
  return { text: '', mentioned: [], latency_ms: Date.now() - t0, error: lastErr };
}
