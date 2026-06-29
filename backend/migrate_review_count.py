"""review_count 컬럼 추가 마이그레이션 (idempotent).

사용:
  python backend/migrate_review_count.py
"""
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", "restaurants.db")

NEW_COLUMNS = [
    ("review_count", "INTEGER"),  # 카카오맵 리뷰(후기) 수
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
        print(f"추가됨: {', '.join(added)}")
    else:
        print("이미 모든 컬럼이 존재합니다.")


if __name__ == "__main__":
    main()
