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

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseHm(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function isOpenAtServer(hours, now) {
  if (!hours || typeof hours !== 'object') return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const todayKey = DAY_KEYS[now.getDay()];
  const yesterdayKey = DAY_KEYS[(now.getDay() + 6) % 7];

  const matches = (range, cursor) => {
    const [s, e] = range.split('-').map(parseHm);
    const end = e === 0 ? 1440 : e;
    if (end > s) return cursor === 'today' && minutes >= s && minutes < end;
    if (cursor === 'today') return minutes >= s;
    if (cursor === 'yesterday') return minutes < end;
    return false;
  };

  const checkRanges = (val, cursor) => {
    if (val === 'closed') return false;
    if (val === '24h') return true;
    if (typeof val === 'string') return matches(val, cursor);
    if (Array.isArray(val)) return val.some(r => matches(r, cursor));
    return null;
  };

  const today = checkRanges(hours[todayKey], 'today');
  if (today === true) return true;
  const yesterday = checkRanges(hours[yesterdayKey], 'yesterday');
  if (yesterday === true) return true;
  if (today === false || yesterday === false) return false;
  return null;
}

function findRelevant(query) {
  const q = query.toLowerCase();
  const matchedRegion = REGIONS.find(r => q.includes(r));
  const isYajang = /야장|포차|야외|노천/.test(q);
  const wantsOpenNow = /지금|영업중|오픈|문 열|열려|열린/.test(q);

  const now = new Date();
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

    const openStatus = isOpenAtServer(r.영업시간, now);
    if (wantsOpenNow) {
      if (openStatus === true) score += 8;
      else if (openStatus === false) score -= 100; // 휴무 식당 사실상 제외
    }

    return { ...r, _score: score, _isOpen: openStatus };
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

function formatHours(hours) {
  if (!hours) return null;
  const dayKo = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
  return ['mon','tue','wed','thu','fri','sat','sun']
    .map(k => {
      const v = hours[k];
      if (v == null) return null;
      const txt = v === 'closed' ? '휴무' : v === '24h' ? '24시간' : Array.isArray(v) ? v.join('/') : v;
      return `${dayKo[k]} ${txt}`;
    })
    .filter(Boolean)
    .join(', ');
}

function buildSystemPrompt(relevant) {
  const list = relevant.map(r => {
    const hoursTxt = formatHours(r.영업시간);
    const statusTxt = r._isOpen === true ? '지금 영업중' : r._isOpen === false ? '지금 영업종료/휴무' : null;
    const parts = [
      `【${r.상호명}】`,
      `지역: ${r.지역}`,
      `카테고리: ${r.카테고리}`,
      r.평점 && r.평점 !== '정보 없음' ? `평점: ${r.평점}` : null,
      r.대표메뉴 ? `메뉴: ${r.대표메뉴}` : null,
      r.주소 ? `주소: ${r.주소}` : null,
      hoursTxt ? `영업시간: ${hoursTxt}` : null,
      statusTxt,
    ].filter(Boolean).join(' | ');
    return parts;
  }).join('\n');

  const nowTxt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short', hour: '2-digit', minute: '2-digit' });

  return `당신은 서울 노포·야장 맛집 전문 AI 추천 도우미입니다.
현재 시각(서울): ${nowTxt}
아래 식당 데이터를 바탕으로 사용자 질문에 친근하고 자연스럽게 답해주세요.

답변 규칙:
- 반드시 아래 데이터에 있는 식당만 추천하세요
- 사용자가 "지금 영업중" 같은 시간 관련 요청을 했다면, 데이터의 '지금 영업중' 표시를 활용해 영업하는 곳만 추천하세요
- 영업시간 정보가 있으면 답변에 함께 알려주세요 (없으면 추측 금지)
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
