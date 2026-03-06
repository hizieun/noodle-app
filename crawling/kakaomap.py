import os
import csv
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from collections import defaultdict
from urllib.parse import quote
from dotenv import load_dotenv
from webdriver_manager.chrome import ChromeDriverManager


load_dotenv()
add_word = os.getenv("ADD_WORD", "노포")

file_path = os.path.join(os.getcwd(), "crawling", "keywords.txt")

with open(file_path, "r", encoding="utf-8") as f:
    keywords = [line.strip() for line in f if line.strip()]

results_by_region = defaultdict(list)

options = webdriver.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--window-size=1280,900")
options.add_argument("--disable-blink-features=AutomationControlled")

# ChromeDriverManager가 현재 Chrome 버전에 맞는 드라이버를 자동으로 설치/사용합니다
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)


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


for keyword in keywords:
    print(f"\n🔍 [{keyword} {add_word}] 검색 중...")
    fin_keyword = keyword + " " + add_word
    url = f"https://map.kakao.com/?q={quote(fin_keyword)}"
    driver.get(url)
    time.sleep(3)

    try:
        place_list = driver.find_elements(By.CSS_SELECTOR, ".PlaceItem")

        if not place_list:
            print("⚠️ 검색 결과 없음 또는 구조 변경")
            continue

        # 1단계: 검색 결과 리스트에서 기본 데이터 수집 (상세 페이지 접근 전)
        raw_places = []
        for place in place_list:
            try:
                # 'A ', 'B ' 같은 알파벳 머리말을 제외하기 위해 .link_name만 추출
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
                print(f"❌ 기본 정보 추출 실패: {e}")
                continue

        # 2단계: 각 식당의 상세 페이지에서 메뉴 추출
        search_url = driver.current_url
        for info in raw_places:
            print(f"  📍 {info['name']} → 상세 페이지에서 메뉴 추출 중...")
            menus = get_menus_from_detail(info["place_id"], search_url)

            # 검색 결과 페이지로 복귀 후 다음 장소 처리
            kakao_link = f"https://place.map.kakao.com/{info['place_id']}" if info["place_id"] else \
                         f"https://map.kakao.com/?q={quote(info['name'] + ' ' + info['addr'])}"
            naver_blog_link = get_naver_blog_link(info["name"])
            naver_map_link = get_naver_map_link(info["name"], info["addr"])

            print(f"     ⭐ {info['rating']} | 📞 {info['phone'] or 'N/A'} | 🍽 {menus or 'N/A'}")
            results_by_region[keyword].append({
                "지역": keyword,
                "상호명": info["name"],
                "주소": info["addr"],
                "평점": info["rating"],
                "전화번호": info["phone"],
                "대표메뉴": menus,
                "카카오맵_링크": kakao_link,
                "네이버블로그_링크": naver_blog_link,
                "네이버지도_링크": naver_map_link,
            })

    except Exception as e:
        print(f"❗ 검색 중 오류 발생: {e}")
        continue

driver.quit()

# ✅ 지역별로 평점 내림차순 정렬 후 전체 리스트로 합치기
final_sorted = []
for region in sorted(results_by_region.keys()):
    sorted_places = sorted(results_by_region[region], key=lambda x: x["평점"], reverse=True)
    final_sorted.extend(sorted_places)

# ✅ CSV 저장
output_file = os.path.join(os.getcwd(), "맛집_평점순_정렬.csv")
with open(output_file, "w", newline="", encoding="utf-8-sig") as csvfile:
    fieldnames = ["지역", "상호명", "주소", "평점", "전화번호", "대표메뉴", "카카오맵_링크", "네이버블로그_링크", "네이버지도_링크"]
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(final_sorted)

print(f"\n📁 결과 CSV 저장 완료 → {output_file}")