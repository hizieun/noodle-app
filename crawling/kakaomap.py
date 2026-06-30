import os
import csv
import time
import json
import re
import argparse
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from collections import defaultdict
from urllib.parse import quote
from dotenv import load_dotenv
import sqlite3
from webdriver_manager.chrome import ChromeDriverManager
import subprocess

# DB 파일 경로
DB_PATH = os.path.join(os.getcwd(), 'backend', 'restaurants.db')

load_dotenv()

parser = argparse.ArgumentParser()
parser.add_argument(
    '--categories', nargs='+',
    default=["노포", "야장"],
    help='크롤링할 카테고리 목록 (예: --categories 야장)'
)
args = parser.parse_args()
categories = args.categories

RUN_STARTED_AT = datetime.now().isoformat(timespec='seconds')

file_path = os.path.join(os.getcwd(), "crawling", "keywords.txt")

with open(file_path, "r", encoding="utf-8") as f:
    keywords = [line.strip() for line in f if line.strip()]

results_by_region = defaultdict(list)
# (category, keyword) 쌍별 수집 건수 추적 — sweep 가드에 사용
crawl_counts = {}

def init_driver(retries=3):
    """드라이버 초기화 및 옵션 설정"""
    for i in range(retries):
        try:
            options = webdriver.ChromeOptions()
            options.add_argument("--headless")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")

            # CHROMEDRIVER_PATH가 있으면 그 드라이버를 직접 사용 — 로컬에서
            # ChromeDriverManager().install()가 storage.googleapis.com 네트워크를
            # 무한 대기하며 멈추는 문제 회피. 미설정 시(CI 등) 기존 자동 해석.
            driver_path = os.getenv("CHROMEDRIVER_PATH")
            service = Service(driver_path) if driver_path else Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
            driver.set_page_load_timeout(60)
            return driver
        except Exception as e:
            print(f"⚠️ 드라이버 초기화 실패 ({i+1}/{retries}): {e}")
            time.sleep(5)
    raise Exception("❌ 드라이버 초기화에 최종 실패했습니다.")

driver = init_driver()


def get_naver_blog_link(name):
    """식당 이름으로 네이버 블로그 검색 링크 생성"""
    query = quote(f"{name} 후기")
    return f"https://search.naver.com/search.naver?where=blog&query={query}"


def get_naver_map_link(name, addr):
    """식당 이름과 주소로 네이버지도 검색 링크 생성"""
    query = quote(f"{name} {addr}")
    return f"https://map.naver.com/v5/search/{query}"


def extract_place_id(place):
    """PlaceItem의 리뷰/상세 링크에서 카카오맵 place ID 추출"""
    import re
    try:
        # '#review'가 붙은 place.map.kakao.com 링크에서 ID 추출
        links = place.find_elements(By.CSS_SELECTOR, "a[href*='place.map.kakao.com']")
        for link in links:
            href = link.get_attribute("href") or ""
            m = re.search(r"place\.map\.kakao\.com/(\d+)", href)
            if m:
                return m.group(1)
    except:
        pass
    return None


DAY_KEY_MAP = {"월": "mon", "화": "tue", "수": "wed", "목": "thu", "금": "fri", "토": "sat", "일": "sun"}

def _normalize_time_range(txt):
    """카카오맵 영업시간 문자열을 표준화. "17:00 ~ 02:00" → "17:00-02:00"."""
    m = re.match(r"\s*(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})", txt)
    if not m:
        return None
    return f"{m.group(1)}-{m.group(2)}"

def extract_business_info(place_id):
    """현재 driver가 carko상세페이지에 있다는 전제로 영업시간/휴무일 추출.

    반환: (business_hours_dict|None, closed_days_list|None, payment_list|None)
    """
    business_hours = {}
    closed_days = None

    try:
        info_op = driver.find_element(By.CSS_SELECTOR, ".info_operation")
    except Exception:
        return None, None, None

    # 헤더에 "매주 월요일 휴무" 같은 텍스트가 있으면 추출
    try:
        notes = info_op.find_elements(By.CSS_SELECTOR, ".txt_detail3, .txt_detail2")
        for n in notes:
            t = (n.text or "").strip()
            m = re.search(r"매주\s*([월화수목금토일])요일\s*휴무", t)
            if m:
                closed_days = [m.group(1)]
                break
    except Exception:
        pass

    # 요일별 풀 패널 (hidden 영역이라 textContent로 읽어야 함)
    try:
        rows = info_op.find_elements(By.CSS_SELECTOR, ".fold_detail .line_fold")
        for row in rows:
            try:
                tit_el = row.find_element(By.CSS_SELECTOR, ".tit_fold")
                tit = (tit_el.get_attribute("textContent") or "").strip()
                # 예: "월(6/22)" → "월"
                day_ko = tit[0] if tit and tit[0] in DAY_KEY_MAP else None
                if not day_ko:
                    continue
                day_key = DAY_KEY_MAP[day_ko]

                detail_txts = [
                    (d.get_attribute("textContent") or "").strip()
                    for d in row.find_elements(By.CSS_SELECTOR, ".detail_fold .txt_detail")
                ]
                # 휴무일 판정
                if any("휴무" in t for t in detail_txts):
                    business_hours[day_key] = "closed"
                    continue
                # 24시간 영업
                if any("24" in t and "시간" in t for t in detail_txts):
                    business_hours[day_key] = "24h"
                    continue
                # 시간 범위 추출 (라스트오더 등 부가 정보는 제외)
                ranges = []
                for t in detail_txts:
                    norm = _normalize_time_range(t)
                    if norm:
                        ranges.append(norm)
                if not ranges:
                    continue
                business_hours[day_key] = ranges[0] if len(ranges) == 1 else ranges
            except Exception:
                continue
    except Exception:
        pass

    if not business_hours:
        business_hours = None
    # 결제수단: 카카오맵에서 직접 추출 어려움 (별도 필드 없음)
    return business_hours, closed_days, None


def get_menus_from_detail(place_id, current_url):
    """카카오맵 장소 상세 페이지에서 대표 메뉴 + 영업시간 + 휴무일 추출.

    반환: (menus_str, business_hours, closed_days, payment)
    """
    if not place_id:
        return "", None, None, None

    detail_url = f"https://place.map.kakao.com/{place_id}"

    try:
        driver.get(detail_url)
        time.sleep(2)

        menus = []
        try:
            menu_els = driver.find_elements(By.CSS_SELECTOR, "ul li .tit_item")
            menus = [m.text.strip() for m in menu_els if m.text.strip()]
        except:
            pass

        bh, cd, pay = extract_business_info(place_id)
        return ", ".join(menus[:5]), bh, cd, pay
    except Exception as e:
        print(f"     ⚠️ 상세페이지 접근 실패 (ID: {place_id}): {e}")
        return "", None, None, None
    finally:
        driver.get(current_url)
        time.sleep(2)


def extract_phone(place):
    """PlaceItem에서 전화번호 추출"""
    try:
        phone_el = place.find_element(By.CSS_SELECTOR, ".phone")
        return phone_el.text.strip()
    except:
        pass
    try:
        phone_el = place.find_element(By.CSS_SELECTOR, ".contact")
        return phone_el.text.strip()
    except:
        return ""


def extract_review_count(place):
    """PlaceItem에서 카카오 자체 후기 수 추출. 실패 시 None 반환.

    카카오맵 .rating 블록 구조 (2025 기준):
      .numberofscore  — "240건" 형태 (카카오 자체 별점 후기 수) ← 1순위
      em[data-id="numberofreview"]  — 블로그 리뷰 수 (참고용) ← 2순위 폴백

    headless 환경에서 .text가 빈 문자열을 반환하는 경우를 대비해
    textContent(JS 속성)를 우선 사용한다.
    """
    def _get_text(el):
        """headless에서도 안정적인 텍스트 추출 (.text → textContent 순)."""
        t = el.text.strip()
        if not t:
            t = (el.get_attribute("textContent") or "").strip()
        return t

    # 1순위: 카카오 자체 후기 수 (".numberofscore" → "240건")
    try:
        el = place.find_element(By.CSS_SELECTOR, ".rating .numberofscore")
        raw = _get_text(el)
        nums = re.findall(r"\d+", raw)
        if nums:
            return int(nums[0])
    except:
        pass

    # 2순위 폴백: 블로그 리뷰 수 (em[data-id="numberofreview"])
    try:
        el = place.find_element(By.CSS_SELECTOR, ".rating em[data-id='numberofreview']")
        raw = _get_text(el)
        nums = re.findall(r"\d+", raw)
        if nums:
            return int(nums[0])
    except:
        pass

    return None


def save_to_db(data_list):
    """수집된 데이터를 DB에 저장 (Upsert)"""
    if not data_list:
        return

    conn = sqlite3.connect(DB_PATH)
    for row in data_list:
        try:
            bh = row.get('영업시간')
            cd = row.get('휴무일')
            pay = row.get('결제수단')
            bh_json = json.dumps(bh, ensure_ascii=False) if bh else None
            cd_json = json.dumps(cd, ensure_ascii=False) if cd else None
            pay_json = json.dumps(pay, ensure_ascii=False) if pay else None
            verified_at = row.get('정보검증일') or datetime.now().isoformat(timespec='seconds') if bh or cd else None

            conn.execute('''
            INSERT INTO restaurants (
                region, category, name, address, rating, phone, menus,
                kakao_link, naver_blog_link, naver_map_link,
                business_hours, closed_days, payment, last_verified_at,
                review_count, last_seen_at, active, missed_crawls
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
            ON CONFLICT(name, address) DO UPDATE SET
                region=excluded.region,
                category=excluded.category,
                rating=excluded.rating,
                phone=excluded.phone,
                menus=excluded.menus,
                kakao_link=excluded.kakao_link,
                naver_blog_link=excluded.naver_blog_link,
                naver_map_link=excluded.naver_map_link,
                business_hours=COALESCE(excluded.business_hours, business_hours),
                closed_days=COALESCE(excluded.closed_days, closed_days),
                payment=COALESCE(excluded.payment, payment),
                last_verified_at=COALESCE(excluded.last_verified_at, last_verified_at),
                review_count=COALESCE(excluded.review_count, review_count),
                last_seen_at=excluded.last_seen_at,
                updated_at=CURRENT_TIMESTAMP
            ''', (
                row['지역'], row['카테고리'], row['상호명'], row['주소'],
                row['평점'], row['전화번호'], row['대표메뉴'],
                row['카카오맵_링크'], row['네이버블로그_링크'], row['네이버지도_링크'],
                bh_json, cd_json, pay_json, verified_at,
                row.get('리뷰수'), RUN_STARTED_AT,
            ))
        except Exception as e:
            print(f"❌ DB 저장 실패: {e}")

    conn.commit()
    conn.close()

def save_to_csv(data_dict, file_name):
    """현재까지 수집된 데이터를 CSV로 저장 (평점순 정렬)"""
    final_list = []
    for region in sorted(data_dict.keys()):
        # 평점 문자열을 숫자로 변환하여 정렬 시도
        def get_score(x):
            try: return float(x["평점"])
            except: return 0.0
        sorted_places = sorted(data_dict[region], key=get_score, reverse=True)
        final_list.extend(sorted_places)

    output_path = os.path.join(os.getcwd(), file_name)
    with open(output_path, "w", newline="", encoding="utf-8-sig") as csvfile:
        fieldnames = ["지역", "카테고리", "상호명", "주소", "평점", "전화번호", "대표메뉴", "카카오맵_링크", "네이버블로그_링크", "네이버지도_링크"]
        # 영업시간/휴무일/결제수단은 DB에만 저장하고 CSV엔 안 씀 → 추가 키 무시
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(final_list)
    return output_path

region_count = 0
for category_word in categories:
    print(f"\n🚀 [{category_word}] 카테고리 크롤링 시작...")
    for keyword in keywords:
        region_count += 1
        # 5개 지역마다 드라이버 재시작하여 안정성 확보
        if region_count > 1 and region_count % 5 == 1:
            print("\n🔄 드라이버 재시작 중 (안정성 확보)...")
            driver.quit()
            time.sleep(2)
            driver = init_driver()

        print(f"\n🔍 [{keyword} {category_word}] 검색 중...")
        fin_keyword = keyword + " " + category_word
        url = f"https://map.kakao.com/?q={quote(fin_keyword)}"
        
        try:
            driver.get(url)
            time.sleep(3)

            place_list = driver.find_elements(By.CSS_SELECTOR, ".PlaceItem")

            if not place_list:
                print("⚠️ 검색 결과 없음 또는 구조 변경")
                continue

            # 1단계: 검색 결과 리스트에서 기본 데이터 수집
            raw_places = []
            for place in place_list:
                try:
                    name_el = place.find_element(By.CSS_SELECTOR, ".head_item .link_name")
                    name = name_el.get_attribute("title") or name_el.text
                    
                    try:
                        addr = place.find_element(By.CSS_SELECTOR, ".addr .details span").text
                    except:
                        addr = place.find_element(By.CSS_SELECTOR, ".addr p").text

                    try:
                        rating_raw = place.find_element(By.CSS_SELECTOR, ".rating span").text
                        rating = rating_raw.split("\n")[0].strip() if rating_raw else "정보 없음"
                    except:
                        try:
                            rating_raw = place.find_element(By.CSS_SELECTOR, ".score .num").text
                            rating = rating_raw.split("\n")[0].strip() if rating_raw else "정보 없음"
                        except:
                            rating = "정보 없음"

                    phone = extract_phone(place)
                    place_id = extract_place_id(place)
                    review_count = extract_review_count(place)

                    raw_places.append({
                        "name": name,
                        "addr": addr,
                        "rating": rating,
                        "phone": phone,
                        "place_id": place_id,
                        "review_count": review_count,
                    })
                except Exception as e:
                    continue

            # 2단계: 각 식당의 상세 페이지에서 메뉴 추출
            search_url = driver.current_url
            for info in raw_places:
                try:
                    print(f"  📍 {info['name']} → 상세정보 추출 중...")
                    menus, bh, cd, pay = get_menus_from_detail(info["place_id"], search_url)

                    kakao_link = f"https://place.map.kakao.com/{info['place_id']}" if info["place_id"] else \
                                 f"https://map.kakao.com/?q={quote(info['name'] + ' ' + info['addr'])}"
                    naver_blog_link = get_naver_blog_link(info["name"])
                    naver_map_link = get_naver_map_link(info["name"], info["addr"])

                    results_by_region[keyword].append({
                        "지역": keyword,
                        "카테고리": category_word,
                        "상호명": info["name"],
                        "주소": info["addr"],
                        "평점": info["rating"],
                        "전화번호": info["phone"],
                        "대표메뉴": menus,
                        "카카오맵_링크": kakao_link,
                        "네이버블로그_링크": naver_blog_link,
                        "네이버지도_링크": naver_map_link,
                        "영업시간": bh,
                        "휴무일": cd,
                        "결제수단": pay,
                        "리뷰수": info["review_count"],
                    })
                except:
                    continue

            # 지역 하나 끝날 때마다 임시 저장 (CSV & DB)
            # raw_places 길이로 이번 이터레이션 수집 건수 기록 (sweep 가드용)
            crawl_counts[(category_word, keyword)] = len(raw_places)
            save_to_csv(results_by_region, "맛집_평점순_정렬.csv")
            save_to_db(results_by_region[keyword])
            print(f"✅ {keyword} 저장 완료 (CSV & DB)")

        except Exception as e:
            print(f"❗ {keyword} 처리 중 오류 발생: {e}")
            # 오류 발생 시 드라이버 재시작 시도
            try:
                driver.quit()
                driver = init_driver()
            except:
                pass
            continue

driver.quit()
save_to_csv(results_by_region, "맛집_평점순_정렬.csv")
print("\n✨ 모든 크롤링 및 저장 완료!")


def run_sweep(crawl_counts, run_started_at):
    """정리 sweep — 이번 크롤 scope에서만 미발견 카운트 증가·폐업 숨김·재발견 복구.

    crawl_counts: {(category, region): int} — 이번 실행에서 수집된 PlaceItem 수.
    0건인 쌍은 차단/에러로 수집 실패일 수 있으므로 sweep에서 제외(가드).
    """
    # 0건 제외 — 가드 적용
    valid_pairs = [(cat, reg) for (cat, reg), cnt in crawl_counts.items() if cnt > 0]
    if not valid_pairs:
        print("\n[sweep] 유효 scope 없음 — sweep 건너뜀")
        return

    categories_in_scope = list({cat for cat, reg in valid_pairs})
    regions_in_scope = list({reg for cat, reg in valid_pairs})

    # 플레이스홀더 생성 (IN 절용)
    cat_placeholders = ",".join("?" * len(categories_in_scope))
    reg_placeholders = ",".join("?" * len(regions_in_scope))

    conn = sqlite3.connect(DB_PATH)

    # 1) 발견 행: missed_crawls=0, active=1 (복구)
    conn.execute(f"""
        UPDATE restaurants
        SET missed_crawls = 0, active = 1
        WHERE category IN ({cat_placeholders})
          AND region IN ({reg_placeholders})
          AND last_seen_at >= ?
    """, categories_in_scope + regions_in_scope + [run_started_at])
    recovered = conn.execute("""SELECT changes()""").fetchone()[0]

    # 2) 미발견 행: missed_crawls + 1
    conn.execute(f"""
        UPDATE restaurants
        SET missed_crawls = missed_crawls + 1
        WHERE category IN ({cat_placeholders})
          AND region IN ({reg_placeholders})
          AND (last_seen_at IS NULL OR last_seen_at < ?)
    """, categories_in_scope + regions_in_scope + [run_started_at])

    # 3) missed_crawls >= 3 이면 active=0 (숨김)
    conn.execute(f"""
        UPDATE restaurants
        SET active = 0
        WHERE category IN ({cat_placeholders})
          AND region IN ({reg_placeholders})
          AND missed_crawls >= 3
    """, categories_in_scope + regions_in_scope)
    hidden = conn.execute("""
        SELECT COUNT(*) FROM restaurants
        WHERE active = 0
    """).fetchone()[0]

    conn.commit()
    conn.close()

    skipped_pairs = [(cat, reg) for (cat, reg), cnt in crawl_counts.items() if cnt == 0]
    print(f"\n[sweep] 완료")
    print(f"  scope: {len(valid_pairs)}쌍 ({len(categories_in_scope)}카테고리 × {len(regions_in_scope)}지역)")
    print(f"  복구(재발견): {recovered}건 / 누적 숨김(active=0): {hidden}건")
    if skipped_pairs:
        print(f"  가드로 제외된 0건 쌍: {skipped_pairs}")


run_sweep(crawl_counts, RUN_STARTED_AT)