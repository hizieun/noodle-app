# 2. 크롤러 설정 및 사용 방법

## 목적
카카오맵에서 Selenium을 이용한 headless 브라우저 자동화로, 지역구별 노포 맛집 정보(이름, 주소, 평점, 전화번호, 대표 메뉴)를 가져옵니다. 
특히 상세 페이지(`place.map.kakao.com`)에 직접 접근하여 메뉴 데이터를 추출하는 2단계 크로울링 방식을 사용합니다.

## 필요한 환경 준비

### 1. Python 및 가상환경
```bash
# 가상환경 생성 (최초 1회)
python3 -m venv venv

# 가상환경 활성화 (macOS/Linux)
source venv/bin/activate
```

### 2. 패키지 설치
```bash
pip install selenium python-dotenv webdriver-manager
```
> `webdriver-manager`를 사용하여 Chrome 브라우저 버전에 맞는 드라이버를 자동으로 설치하고 관리합니다.

### 3. 환경 변수 설정 (`.env` 파일)
프로젝트 루트에 `.env` 파일을 생성하고 아래 내용을 입력합니다:
```
ADD_WORD=노포
```
> `ADD_WORD`는 검색 키워드에 붙이는 수식어입니다. (예: "강남구 노포")

---

## 크롤리 대상 키워드 설정

`crawling/keywords.txt` 파일에 크롤링할 지역명을 한 줄씩 작성합니다.

```
강남구
강동구
마포구
...
```
현재 서울 25개 구 전체가 등록되어 있습니다.

---

## 크롤러 실행

```bash
python crawling/kakaomap.py
```

실행 후, 프로젝트 루트에 `맛집_평점순_정렬.csv` 파일이 생성됩니다.

---

## CSV → JSON 변환 (프론트엔드 연동)

CSV를 React 프론트엔드에서 바로 읽을 수 있는 JSON 형태로 변환합니다.

```bash
python csv_to_json.py
```

→ `frontend/src/data.json` 파일이 생성(또는 덮어쓰기)됩니다.

---

## 코드 구조 (`kakaomap.py`)

```python
# 1. .env에서 검색어 추가 단어 로드
load_dotenv()
add_word = os.getenv("ADD_WORD", "노포")

# 2. keywords.txt에서 지역구 목록 읽기
with open("crawling/keywords.txt", ...) as f:
    keywords = [line.strip() for line in f if line.strip()]

# 3. Chrome headless 모드로 카카오맵 접속
driver = webdriver.Chrome(options=options)

# 4. 각 키워드 + add_word 조합으로 검색, 결과 파싱
for keyword in keywords:
    url = f"https://map.kakao.com/?q={keyword} {add_word}"
    driver.get(url)
    # .PlaceItem CSS 선택자로 업소 정보 추출 (이름, 주소, 평점)
    # results_by_region[keyword].append({...})

# 5. 상세 메뉴 추출을 위해 각 식당 ID 파싱 및 상세페이지 이동
# place.map.kakao.com/{place_id} 이동 후 'ul li .tit_item' 셀렉터로 메뉴 추출

# 6. 지역별 평점 내림차순 정렬 후 CSV 저장
writer.writerows(final_sorted)
```
> **주의**: 상세 페이지를 하나씩 방문하므로 전체 실행 시 약 20~30분 정도 소요될 수 있습니다.

---

- 다음 페이지 넘기기 (현재 검색 결과 1페이지만 크롤링)
- 리뷰 문장 추출 및 AI 감성 분석
- 정기 자동 실행 (Vercel Cron 또는 Github Actions 이용)
