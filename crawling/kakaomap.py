import os
import csv
import time
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
# 기본적으로 '노포'와 '야장' 두 가지 카테고리를 처리합니다.
categories = ["노포", "야장"]

file_path = os.path.join(os.getcwd(), "crawling", "keywords.txt")

with open(file_path, "r", encoding="utf-8") as f:
    keywords = [line.strip() for line in f if line.strip()]

results_by_region = defaultdict(list)

def init_driver(retries=3):
    """드라이버 초기화 및 옵션 설정"""
    for i in range(retries):
        try:
            options = webdriver.ChromeOptions()
            options.add_argument("--headless")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            
            service = Service(ChromeDriverManager().install())
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


def get_menus_from_detail(place_id, current_url):
    """카카오맵 장소 상세 페이지에서 대표 메뉴명 추출"""
    if not place_id:
        return ""

    detail_url = f"https://place.map.kakao.com/{place_id}"

    try:
        driver.get(detail_url)
        time.sleep(2)

        menus = []
        # 검증된 셀렉터: ul li .tit_item
        try:
            menu_els = driver.find_elements(By.CSS_SELECTOR, "ul li .tit_item")
            menus = [m.text.strip() for m in menu_els if m.text.strip()]
        except:
            pass

        return ", ".join(menus[:5])  # 최대 5개
    except Exception as e:
        print(f"     ⚠️ 상세페이지 접근 실패 (ID: {place_id}): {e}")
        return ""
    finally:
        # 원래 검색 결과 페이지로 복귀
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


def save_to_db(data_list):
    """수집된 데이터를 DB에 저장 (Upsert)"""
    if not data_list:
        return
        
    conn = sqlite3.connect(DB_PATH)
    for row in data_list:
        try:
            conn.execute('''
            INSERT INTO restaurants (
                region, category, name, address, rating, phone, menus, 
                kakao_link, naver_blog_link, naver_map_link
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name, address) DO UPDATE SET
                region=excluded.region,
                category=excluded.category,
                rating=excluded.rating,
                phone=excluded.phone,
                menus=excluded.menus,
                kakao_link=excluded.kakao_link,
                naver_blog_link=excluded.naver_blog_link,
                naver_map_link=excluded.naver_map_link,
                updated_at=CURRENT_TIMESTAMP
            ''', (
                row['지역'], row['카테고리'], row['상호명'], row['주소'], 
                row['평점'], row['전화번호'], row['대표메뉴'],
                row['카카오맵_링크'], row['네이버블로그_링크'], row['네이버지도_링크']
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
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
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

                    raw_places.append({
                        "name": name,
                        "addr": addr,
                        "rating": rating,
                        "phone": phone,
                        "place_id": place_id,
                    })
                except Exception as e:
                    continue

            # 2단계: 각 식당의 상세 페이지에서 메뉴 추출
            search_url = driver.current_url
            for info in raw_places:
                try:
                    print(f"  📍 {info['name']} → 메뉴 추출 중...")
                    menus = get_menus_from_detail(info["place_id"], search_url)

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
                    })
                except:
                    continue

            # 지역 하나 끝날 때마다 임시 저장 (CSV & DB)
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