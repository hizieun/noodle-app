import os
import csv
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from collections import defaultdict
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

for keyword in keywords:
    print(f"\n🔍 [{keyword}", "노포]", "검색 중...")
    fin_keywword = keyword + " " + add_word
    url = f"https://map.kakao.com/?q={fin_keywword}"
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

                print(f"📍 {name} - {addr} | ⭐ {rating}")
                results_by_region[keyword].append({
                    "지역": keyword,
                    "상호명": name,
                    "주소": addr,
                    "평점": rating
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
    fieldnames = ["지역", "상호명", "주소", "평점"]
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(final_sorted)

print(f"\n📁 결과 CSV 저장 완료 → {output_file}")

'''
TODO : 평점 높은 순으로 정렬, 후기 문장 분석, 다음 페이지 넘기기, 상세정보 접근, 지도 마커 UI 연결
'''