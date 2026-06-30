"""
Nominatim이 못 푼 잔여 주소를 Kakao Local API로 지오코딩해 lat/lng 저장.
데이터가 카카오맵 출처라 주소 매칭률이 Nominatim보다 높다(도로명·지번 모두).

키: 환경변수 KAKAO_REST_API_KEY (Kakao Developers > 앱 > REST API 키).
사용법: KAKAO_REST_API_KEY=... python crawling/geocode_kakao.py
"""

import os
import sqlite3
import time

import requests

from geocode import clean_address, road_level  # 동일 디렉토리, 주소 정제 재사용

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ROOT, "backend", "restaurants.db")
ADDR_URL = "https://dapi.kakao.com/v2/local/search/address.json"
KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
DELAY = 0.1  # Kakao 쿼터 넉넉(일 10만). 예의상 소폭 지연


def _first_coord(docs):
    """Kakao 응답 documents에서 첫 좌표 (lat, lng). x=경도, y=위도."""
    if not docs:
        return None
    d = docs[0]
    try:
        return float(d["y"]), float(d["x"])
    except (KeyError, TypeError, ValueError):
        return None


def geocode_kakao(name, address, session):
    """주소 검색 → 실패 시 키워드(상호명+주소) 검색 폴백. (lat, lng) | None."""
    headers = {"Authorization": f"KakaoAK {os.environ['KAKAO_REST_API_KEY']}"}

    # 1) 주소 검색: 원본 → 정제 → 도로명 단위 순으로 시도
    for q in dict.fromkeys([address, clean_address(address), road_level(address)]):
        if not q:
            continue
        try:
            r = session.get(ADDR_URL, params={"query": q}, headers=headers, timeout=8)
            if r.status_code == 401:
                raise SystemExit("❌ KAKAO_REST_API_KEY 인증 실패(401). 키를 확인하세요.")
            coord = _first_coord(r.json().get("documents"))
            if coord:
                return coord
        except requests.RequestException as e:
            print(f"     ⚠️ 주소검색 실패: {e}")
        time.sleep(DELAY)

    # 2) 키워드 검색 폴백: 상호명 + 주소(구까지)로 POI 매칭
    region = " ".join(address.split()[:2]) if address else ""
    try:
        r = session.get(KEYWORD_URL, params={"query": f"{name} {region}".strip()},
                        headers=headers, timeout=8)
        coord = _first_coord(r.json().get("documents"))
        if coord:
            return coord
    except requests.RequestException as e:
        print(f"     ⚠️ 키워드검색 실패: {e}")
    return None


def main():
    if not os.environ.get("KAKAO_REST_API_KEY"):
        # CI에서 secret 미설정 시 파이프라인 깨지 않고 스킵(exit 0)
        print("⏭️  KAKAO_REST_API_KEY 없음 — Kakao 지오코딩 스킵")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, address FROM restaurants WHERE lat IS NULL AND address IS NOT NULL")
    rows = cursor.fetchall()
    total = len(rows)
    print(f"🗺️  Kakao 지오코딩 대상: {total}개")

    session = requests.Session()
    success = 0
    for i, (rid, name, address) in enumerate(rows, 1):
        coords = geocode_kakao(name, address, session)
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
