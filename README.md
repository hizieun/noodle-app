# Noodle 노포 맛집 탐험기 🍜

카카오맵 데이터를 기반으로 각 지역의 숨겨진 노포 맛집들을 평점 높은 순으로 한눈에 볼 수 있는 웹 애플리케이션입니다.

## 📸 프로젝트 화면

Noodle 웹앱 화면 예시
<img width="1470" height="761" alt="image" src="https://github.com/user-attachments/assets/dfb97daf-2647-49e8-9aa5-a97be89cee9d" />


## ✨ 주요 기능
- **지역별 필터링**: 우측 상단의 드롭다운을 통해 서울 지역구별로 노포 맛집 필터링 가능
- **직관적인 식당 카드**: 
  - 메뉴에 어울리는 귀여운 **이모지 자동 매칭** (예: 🍜 냉면, 🍖 고기, 🐟 횟집)
  - 카카오맵 크롤링 데이터 기반의 **상호명, 주소, 평점** 제공
- **상세 정보 모달 (Detailed View)**:
  - 식당 클릭 시 나타나는 슬라이드업 모달
  - **전화번호**, **대표 메뉴** (크롤링 데이터) 확인 가능
  - 카카오맵, 네이버 지도, 네이버 블로그 후기 바로가기 버튼 제공
- **반응형 프리미엄 UI**: 모바일과 데스크톱 모두에서 부드럽게 동작하는 모던한 다크모드 글래스모피즘 디자인 (ESC 닫기, 외부 클릭 닫기 지원)

## 🛠 기술 스택
- **데이터 크롤링**: Python, Selenium (`crawling/` 폴더 참조)
- **프론트엔드**: Vite, React, Vanilla CSS (`frontend/` 폴더 참조)
- **배포**: Vercel

## 🚀 로컬 실행 방법

### 데이터 세팅 (선택)
```bash
# Python 크롤러를 통해 최신 데이터를 맛집_평점순_정렬.csv 로 추출 (사전 셋팅 필요)
python3 crawling/main.py

# CSV 데이터를 프론트엔드용 JSON으로 변환
python3 frontend/csv_to_json.py
```

### 프론트엔드 빌드 및 실행
```bash
cd frontend
npm install
npm run dev
```
브라우저에서 `http://localhost:5173` 으로 접속합니다.
