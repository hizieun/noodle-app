"""
크롤링 → DB → data.json → git push 를 한 번에 처리하는 자동화 스크립트.

사용법:
  python crawling/sync_data.py          # DB → data.json 내보내기만
  python crawling/sync_data.py --crawl  # 크롤링 후 내보내기
  python crawling/sync_data.py --push   # 내보내기 + git commit & push
  python crawling/sync_data.py --crawl --push  # 전체 파이프라인
"""

import argparse
import json
import os
import sqlite3
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ROOT, "backend", "restaurants.db")
DATA_JSON_PATH = os.path.join(ROOT, "frontend", "public", "data.json")


def export_db_to_json():
    print("📦 DB → data.json 내보내는 중...")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = [
        dict(r)
        for r in conn.execute(
            """
            SELECT
                region        AS 지역,
                category      AS 카테고리,
                name          AS 상호명,
                address       AS 주소,
                rating        AS 평점,
                phone         AS 전화번호,
                menus         AS 대표메뉴,
                kakao_link    AS 카카오맵_링크,
                naver_blog_link AS 네이버블로그_링크,
                naver_map_link  AS 네이버지도_링크,
                business_hours AS 영업시간,
                closed_days    AS 휴무일,
                payment        AS 결제수단,
                last_verified_at AS 정보검증일,
                review_count   AS 리뷰수,
                lat, lng
            FROM restaurants
            WHERE (active IS NULL OR active = 1)
              -- 서울 전용 앱: 동명 지역(부산 강서구·인천 중구 등) 유입 차단(권위 경계 필터)
              AND address LIKE '서울%'
            ORDER BY CAST(rating AS REAL) DESC
            """
        )
    ]
    conn.close()

    # JSON 문자열로 저장된 컬럼은 디코드, None/빈문자열은 제거 (크기 절약)
    json_columns = ("영업시간", "휴무일", "결제수단")
    cleaned = []
    for r in rows:
        item = {}
        for k, v in r.items():
            if v is None or v == "":
                continue
            if k in json_columns and isinstance(v, str):
                try:
                    item[k] = json.loads(v)
                except json.JSONDecodeError:
                    # 잘못된 JSON은 원본 문자열 그대로 유지하지 않고 건너뜀
                    continue
            else:
                item[k] = v
        cleaned.append(item)

    with open(DATA_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(cleaned, f, ensure_ascii=False, indent=2)

    print(f"✅ data.json 저장 완료: {len(cleaned)}개")
    return len(cleaned)


def run_crawler():
    print("🕷️  크롤러 실행 중... (시간이 걸릴 수 있습니다)")
    result = subprocess.run(
        [sys.executable, os.path.join(ROOT, "crawling", "kakaomap.py")],
        cwd=ROOT,
    )
    if result.returncode != 0:
        print("❌ 크롤링 중 오류 발생")
        sys.exit(1)
    print("✅ 크롤링 완료")


def git_push(count):
    print("🚀 git commit & push 중...")
    subprocess.run(["git", "add", DATA_JSON_PATH], cwd=ROOT, check=True)
    subprocess.run(
        ["git", "commit", "-m", f"data: sync data.json ({count}개 식당)"],
        cwd=ROOT,
        check=True,
    )
    subprocess.run(["git", "push", "origin", "main"], cwd=ROOT, check=True)
    print("✅ push 완료 — Vercel이 자동 재배포를 시작합니다.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="노포지도 데이터 동기화 스크립트")
    parser.add_argument("--crawl", action="store_true", help="크롤러 실행 후 내보내기")
    parser.add_argument("--push", action="store_true", help="git commit & push")
    args = parser.parse_args()

    if args.crawl:
        run_crawler()

    count = export_db_to_json()

    if args.push:
        git_push(count)
