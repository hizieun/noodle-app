export const getRestaurantEmoji = (name) => {
  if (/냉면|국수|면|우동|짬뽕|소바|라면|파스타|칼국수|수제비/.test(name)) return "🍜";
  if (/만두|교자/.test(name)) return "🥟";
  if (/국밥|해장국|탕|찌개|전골|순대|국|설렁탕|곰탕/.test(name)) return "🍲";
  if (/회|세꼬시|참치|초밥|스시|해물|오징어|낙지|쭈꾸미|수산|어시장|횟집/.test(name)) return "🐟";
  if (/치킨|통닭|백숙|닭갈비|닭발|찜닭|닭/.test(name)) return "🍗";
  if (/돼지|소고기|고기|삼겹살|갈비|막창|곱창|육|숯불|한우|식육|정육|보쌈|족발/.test(name)) return "🍖";
  if (/술|포차|호프|주막|비어|바|펍/.test(name)) return "🍻";
  if (/식당|상회|가든|회관|밥|식탁|반점|식구|백반/.test(name)) return "🍚";
  if (/떡볶이|오뎅|김밥|분식|튀김/.test(name)) return "🍢";
  if (/빵|베이커리|과자|제과/.test(name)) return "🥐";
  if (/피자|버거/.test(name)) return "🍕";
  if (/카페|커피|다방|디저트/.test(name)) return "☕";
  return "🍽️";
};

export const formatRestaurantName = (name) => {
  const cleanName = name.replace(/^[a-zA-Z]\s+/, '');
  const emoji = getRestaurantEmoji(cleanName);
  return { emoji, cleanName };
};

export const favKey = (r) => `${r.상호명}|${r.주소}`;
export const visitKey = (r) => `${r.상호명}|${r.주소}`;

// 날짜 문자열(YYYY-MM-DD 등)을 결정적 정수로 해시 → pool 크기 modulo
// Math.random 없이 오늘 하루 고정, 매일 변경되는 인덱스 생성
export const dateHashIndex = (poolLength, seed) => {
  if (poolLength === 0) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0xffffff;
  }
  return h % poolLength;
};

export const ITEMS_PER_PAGE = 30;
