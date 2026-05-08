"""
restaurants.db의 주소를 Nominatim(OpenStreetMap)으로 지오코딩해 lat/lng를 저장.
Nominatim 이용 정책: 최대 1 req/sec, User-Agent 필수.

사용법: python crawling/geocode.py
"""

import os
import sqlite3
import time

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ROOT, "backend", "restaurants.db")
HEADERS = {"User-Agent": "nopo-map-geocoder/1.0 (contact: nopo-map)"}
DELAY = 1.1  # Nominatim 정책: 초당 1건 이하


import re

def clean_address(address: str) -> str:
    """층수, 호수 등 Nominatim이 처리 못하는 부분 제거"""
    # "B1층", "지하1층", "1층", "2층", "B동 101호" 등 제거
    addr = re.sub(r'\s*(지하\d+층|\d+층|B\d+층|[A-Z동]\d+호|\d+호)\s*$', '', address).strip()
    # 번지 뒤 괄호 제거: "123 (역삼동)" → "123"
    addr = re.sub(r'\s*\(.*?\)\s*$', '', addr).strip()
    return addr


def geocode(address: str) -> tuple[float, float] | None:
    queries = [address, clean_address(address)]
    for q in dict.fromkeys(queries):  # 중복 제거
        try:
            r = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": q, "format": "json", "limit": 1, "countrycodes": "kr"},
                headers=HEADERS,
                timeout=8,
            )
            data = r.json()
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
            time.sleep(DELAY)
        except Exception as e:
            print(f"  ⚠️  요청 실패: {e}")
    return None


def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 좌표 없는 항목만 처리
    cursor.execute("SELECT id, name, address FROM restaurants WHERE lat IS NULL AND address IS NOT NULL")
    rows = cursor.fetchall()
    total = len(rows)
    print(f"🗺️  지오코딩 대상: {total}개")

    success = 0
    for i, (rid, name, address) in enumerate(rows, 1):
        coords = geocode(address)
        if coords:
            lat, lng = coords
            cursor.execute("UPDATE restaurants SET lat=?, lng=? WHERE id=?", (lat, lng, rid))
            success += 1
            print(f"  [{i}/{total}] ✅ {name[:15]:15} ({lat:.4f}, {lng:.4f})")
        else:
            print(f"  [{i}/{total}] ❌ {name[:15]:15} — 좌표 없음")

        if i % 50 == 0:
            conn.commit()
            print(f"  💾 중간 저장 ({i}건)")

        time.sleep(DELAY)

    conn.commit()
    conn.close()
    print(f"\n✅ 완료: {success}/{total}개 좌표 획득")


if __name__ == "__main__":
    main()
