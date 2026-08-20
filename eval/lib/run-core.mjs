// 실행 코어 — 문항 세트를 생성→추출→판정. run.mjs / variance.mjs가 공유.
import { generate } from './generate-response.mjs';
import { extract } from '../extract.mjs';
import { judgeRule } from '../judges/rule.mjs';

async function pool(items, k, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(k, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}

export async function runSet(items, { target = 'prod', concurrency = 2, rpm = 12, onProgress } = {}) {
  // 페이싱 — 무료 티어 RPM 한도 회피(요청 시작 간 최소 간격). rpm=0이면 무제한.
  const minInterval = rpm > 0 ? 60000 / rpm : 0;
  let nextAt = 0;
  const gate = async () => {
    if (!minInterval) return;
    const now = Date.now();
    const wait = Math.max(0, nextAt - now);
    nextAt = Math.max(now, nextAt) + minInterval;
    if (wait) await new Promise((r) => setTimeout(r, wait));
  };
  let done = 0;
  return pool(items, concurrency, async (item) => {
    await gate();
    const g = await generate(item.question, { target });
    const ex = extract(g.text);
    const rule = judgeRule(item, ex);
    onProgress?.(++done, items.length);
    return { ...item, text: g.text, latency_ms: g.latency_ms, error: g.error, extraction: ex, rule };
  });
}
