// 문항 세트 로더 — run/variance가 공유(사이드이펙트 없는 순수 모듈).
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const readJsonl = (f) => existsSync(f)
  ? readFileSync(f, 'utf-8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];

export function loadSet(set = 'smoke') {
  const golden = readJsonl(join(__dirname, '..', 'golden', 'golden.jsonl'));
  const edge = readJsonl(join(__dirname, '..', 'golden', 'edge-cases.jsonl'));
  if (set === 'golden') return golden;
  if (set === 'edge') return edge;
  if (set === 'all') return [...golden, ...edge];
  // smoke = 고정 시드 서브셋(사과 대 사과): golden 앞 24 + edge 앞 6 = 30
  return [...golden.slice(0, 24), ...edge.slice(0, 6)];
}
