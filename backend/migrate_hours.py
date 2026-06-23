"""영업시간/결제수단/검증일 컬럼 추가 마이그레이션 (idempotent).

사용:
  python backend/migrate_hours.py
"""
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", "restaurants.db")

NEW_COLUMNS = [
    ("business_hours", "TEXT"),     # JSON: {"mon": "11:00-22:00", "sun": "closed", ...}
    ("closed_days",    "TEXT"),     # JSON: ["일", "공휴일"]
    ("payment",        "TEXT"),     # JSON: ["현금", "카드"]
    ("last_verified_at", "DATETIME"),
]


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    existing = {row[1] for row in cur.execute("PRAGMA table_info(restaurants)")}
    added = []
    for name, typ in NEW_COLUMNS:
        if name in existing:
            continue
        cur.execute(f"ALTER TABLE restaurants ADD COLUMN {name} {typ}")
        added.append(name)
    conn.commit()
    conn.close()
    if added:
        print(f"✅ 추가됨: {', '.join(added)}")
    else:
        print("ℹ️  이미 모든 컬럼이 존재합니다.")


if __name__ == "__main__":
    main()
