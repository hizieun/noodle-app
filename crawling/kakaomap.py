import os
import csv
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from collections import defaultdict
from urllib.parse import quote
from dotenv import load_dotenv


load_dotenv()
add_word = os.getenv("ADD_WORD", "노포")

file_path = os.path.join(os.getcwd(), "crawling", "keywords.txt")

with open(file_path, "r", encoding="utf-8") as f:
    keywords = [line.strip() for line in f if line.strip()]

results_by_region = defaultdict(list)

options = webdriver.ChromeOptions()
options.add_argument("--headless")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")

driver = webdriver.Chrome(options=options)

def get_kakao_link(name, addr):
    """식당 이름과 주소를 기반으로 카카오맵 검색 링크 생성"""
    query = quote(f"{name} {addr}")
    return f"https://map.kakao.com/?q={query}"

def get_naver_blog_link(name):
    """식당 이름으로 네이버 블로그 검색 링크 생성"""
    query = quote(f"{name} 후기")
    return f"https://search.naver.com/search.naver?where=blog&query={query}"

def get_naver_map_link(name, addr):
    """식당 이름과 주소로 네이버지도 검색 링크 생성"""
    query = quote(f"{name} {addr}")
    return f"https://map.naver.com/v5/search/{query}"

def extract_menus(place):
    """PlaceItem에서 대표 메뉴 태그 추출"""
    menus = []
    try:
        menu_elements = place.find_elements(By.CSS_SELECTOR, ".tag_list .tag_item")
        menus = [m.text.strip() for m in menu_elements if m.text.strip()]
    except:
        pass
    if not menus:
        try:
            menu_elements = place.find_elements(By.CSS_SELECTOR, ".menu_list li")
            menus = [m.text.strip() for m in menu_elements if m.text.strip()]
        except:
            pass
    return ", ".join(menus) if menus else ""

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

        for place in place_list:
            try:
                name = place.find_element(By.CSS_SELECTOR, ".head_item .tit_name").text

                # 주소 fallback
                try:
                    addr = place.find_element(By.CSS_SELECTOR, ".addr .details span").text
                except:
                    addr = place.find_element(By.CSS_SELECTOR, ".addr p").text

                # 평점 추출
                try:
                    rating = place.find_element(By.CSS_SELECTOR, ".rating span").text
                except:
                    try:
                        rating = place.find_element(By.CSS_SELECTOR, ".score .num").text
                    except:
                        rating = "정보 없음"

                # 전화번호
                phone = extract_phone(place)

                # 대표 메뉴
                menus = extract_menus(place)

                # 링크 자동 생성
                kakao_link = get_kakao_link(name, addr)
                naver_blog_link = get_naver_blog_link(name)
                naver_map_link = get_naver_map_link(name, addr)

                print(f"📍 {name} - {addr} | ⭐ {rating} | 📞 {phone or 'N/A'} | 🍽 {menus or 'N/A'}")
                results_by_region[keyword].append({
                    "지역": keyword,
                    "상호명": name,
                    "주소": addr,
                    "평점": rating,
                    "전화번호": phone,
                    "대표메뉴": menus,
                    "카카오맵_링크": kakao_link,
                    "네이버블로그_링크": naver_blog_link,
                    "네이버지도_링크": naver_map_link,
                })
            except Exception as e:
                print(f"❌ 항목 추출 실패: {e}")
                continue

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