// 카카오톡 공유 (Kakao JS SDK) — 리스트를 미리보기 카드로 공유.
// JS 키(VITE_KAKAO_JS_KEY)가 없으면 비활성 → 호출부에서 kakaoEnabled()로 버튼 숨김.
const JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY;
const SDK_SRC = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
let loading = null;

export function kakaoEnabled() {
  return Boolean(JS_KEY);
}

function loadSdk() {
  if (window.Kakao) return Promise.resolve(window.Kakao);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK_SRC;
    s.async = true;
    s.onload = () => resolve(window.Kakao);
    s.onerror = () => reject(new Error('카카오 SDK 로드 실패'));
    document.head.appendChild(s);
  });
  return loading;
}

// 리스트 공유. url=공유 링크, imageUrl=미리보기 이미지(OG).
export async function shareListToKakao({ title, description, url, imageUrl }) {
  if (!JS_KEY) throw new Error('카카오 공유 키 미설정');
  const Kakao = await loadSdk();
  if (!Kakao.isInitialized()) Kakao.init(JS_KEY);
  Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title,
      description,
      imageUrl,
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [{ title: '리스트 보기', link: { mobileWebUrl: url, webUrl: url } }],
  });
}
