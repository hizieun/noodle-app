# 1. 프로젝트 개요

## 목적
카카오맵에서 서울 각 지역구의 **노포 맛집**을 크롤링해서 평점 순으로 정리하고, 이 데이터를 예쁜 **웹 애플리케이션** 형태로 시각화하는 프로젝트입니다.

## 폴더 구조
```
noodle/
├── crawling/
│   ├── kakaomap.py      # 카카오맵 크롤러 핵심 코드
│   ├── main.py          # 크롤링 진입점 (빈 파일, 추후 확장 예정)
│   └── keywords.txt     # 크롤링할 지역구 목록 (서울 25개구)
│
├── frontend/            # React + Vite 웹 앱
│   ├── index.html       # SEO 메타 태그 및 Google Fonts 포함
│   ├── src/
│   │   ├── main.jsx     # React 앱의 진입점
│   │   ├── App.jsx      # 핵심 앱 로직 (카드, 필터 드롭다운 등)
│   │   ├── index.css    # 전체 스타일 시트 (프리미엄 다크 테마)
│   │   └── data.json    # 크롤러로 가져온 식당 데이터 (JSON 포맷)
│   └── package.json     # Node.js 의존성 정의
│
├── docs/                # 이 문서 폴더
├── .env                 # 환경 변수 (크롤러용, 미포함)
├── .gitignore
├── README.md
├── RELEASE_NOTES.md
└── 맛집_평점순_정렬.csv  # 크롤러 출력물 (미포함, gitignore)
```

## 주요 기술 스택

| 영역 | 기술 |
|------|------|
| 크롤링 | Python 3, Selenium, Chrome WebDriver |
| 프론트엔드 | React 19, Vite 7 (JavaScript) |
| 스타일 | Vanilla CSS (Dark Theme + Glassmorphism) |
| 폰트 | Google Fonts - Inter |
| 배포 | Vercel |
| 버전관리 | Git, GitHub |

## 개발 흐름 요약
1. `keywords.txt`에 지역구 목록을 작성한다.
2. `kakaomap.py` 크롤러를 실행하면 지역구별 노포 맛집 정보가 `맛집_평점순_정렬.csv`에 저장된다.
3. CSV 데이터를 `data.json`으로 변환하는 스크립트를 실행한다.
4. `frontend/` React 앱이 `data.json`을 불러와서 시각화한다.
5. Vercel을 통해 무료로 배포, 링크 공유가 가능하다.

## 배포된 링크
- **라이브 서비스**: https://frontend-kappa-six-36.vercel.app
- **GitHub 저장소**: https://github.com/hizieun/noodle-app
