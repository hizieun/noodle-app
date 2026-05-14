import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const REGIONS = [
  '강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구',
  '노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구','성동구',
  '성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구',
];

let restaurants = [];
try {
  const dataPath = join(__dirname, '..', 'public', 'data.json');
  restaurants = JSON.parse(readFileSync(dataPath, 'utf-8'));
} catch (e) {
  console.error('data.json 로드 실패:', e.message);
}

function findRelevant(query) {
  const q = query.toLowerCase();
  const matchedRegion = REGIONS.find(r => q.includes(r));
  const isYajang = /야장|포차|야외|노천/.test(q);

  const scored = restaurants.map(r => {
    let score = 0;
    const name = (r.상호명 || '').toLowerCase();
    const menus = (r.대표메뉴 || '').toLowerCase();
    const region = r.지역 || '';
    const category = r.카테고리 || '';

    if (matchedRegion && region === matchedRegion) score += 10;
    if (isYajang && category === '야장') score += 5;
    if (!isYajang && category === '노포') score += 2;

    const keywords = q.replace(/[^\w가-힣]/g, ' ').split(/\s+/).filter(k => k.length > 1);
    keywords.forEach(k => {
      if (name.includes(k)) score += 3;
      if (menus.includes(k)) score += 2;
    });

    const rating = parseFloat(r.평점);
    if (!isNaN(rating) && rating >= 4.0) score += 1;

    return { ...r, _score: score };
  });

  const relevant = scored
    .filter(r => r._score > 0)
    .sort((a, b) => b._score - a._score || (parseFloat(b.평점) || 0) - (parseFloat(a.평점) || 0))
    .slice(0, 20);

  if (relevant.length < 3) {
    return scored
      .sort((a, b) => (parseFloat(b.평점) || 0) - (parseFloat(a.평점) || 0))
      .slice(0, 15);
  }
  return relevant;
}

function buildSystemPrompt(relevant) {
  const list = relevant.map(r => {
    const parts = [
      `【${r.상호명}】`,
      `지역: ${r.지역}`,
      `카테고리: ${r.카테고리}`,
      r.평점 && r.평점 !== '정보 없음' ? `평점: ${r.평점}` : null,
      r.대표메뉴 ? `메뉴: ${r.대표메뉴}` : null,
      r.주소 ? `주소: ${r.주소}` : null,
    ].filter(Boolean).join(' | ');
    return parts;
  }).join('\n');

  return `당신은 서울 노포·야장 맛집 전문 AI 추천 도우미입니다.
아래 식당 데이터를 바탕으로 사용자 질문에 친근하고 자연스럽게 답해주세요.

답변 규칙:
- 반드시 아래 데이터에 있는 식당만 추천하세요
- 식당명, 지역, 추천 이유를 간결하게 설명하세요
- 2~4개 식당 추천이 적당합니다
- 데이터에 없는 정보는 절대 추측하지 마세요
- 한국어로 답하세요

참고 식당 데이터:
${list}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { message, history = [] } = req.body || {};
  if (!message?.trim()) return res.status(400).json({ error: 'message 필요' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 미설정' });

  const relevant = findRelevant(message);
  const systemPrompt = buildSystemPrompt(relevant);

  const contents = [];

  history.forEach(({ role, text }) => {
    contents.push({ role, parts: [{ text }] });
  });

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: `${systemPrompt}\n\n질문: ${message}` }] });
  } else {
    contents.push({ role: 'user', parts: [{ text: message }] });
  }

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error('Gemini 오류:', err);
      return res.status(502).json({ error: '모델 응답 오류' });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: '빈 응답' });

    return res.status(200).json({ text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류' });
  }
}
