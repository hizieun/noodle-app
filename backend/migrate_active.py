"""active/missed_crawls/last_seen_at 컬럼 추가 마이그레이션 (idempotent).

사용:
  python backend/migrate_active.py
"""
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", "restaurants.db")

# (컬럼명, 타입, 기본값 표현식 — ALTER TABLE 용)
NEW_COLUMNS = [
    ("last_seen_at", "DATETIME",  None),
    ("active",       "INTEGER",   "1"),
    ("missed_crawls","INTEGER",   "0"),
]


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    existing = {row[1] for row in cur.execute("PRAGMA table_info(restaurants)")}

    added = []
    for col_name, col_type, default in NEW_COLUMNS:
        if col_name in existing:
            print(f"  skip: {col_name} (이미 존재)")
            continue
        ddl = f"ALTER TABLE restaurants ADD COLUMN {col_name} {col_type}"
        if default is not None:
            ddl += f" DEFAULT {default}"
        cur.execute(ddl)
        added.append(col_name)
        print(f"  추가: {col_name} {col_type}")

    conn.commit()

    # 백필 — 추가됐거나 이미 있어도 NULL 행이 있을 수 있으므로 조건부 UPDATE
    cur.execute("""
        UPDATE restaurants
        SET last_seen_at = updated_at
        WHERE last_seen_at IS NULL AND updated_at IS NOT NULL
    """)
    last_seen_filled = cur.rowcount

    cur.execute("""
        UPDATE restaurants
        SET active = 1
        WHERE active IS NULL
    """)
    active_filled = cur.rowcount

    cur.execute("""
        UPDATE restaurants
        SET missed_crawls = 0
        WHERE missed_crawls IS NULL
    """)
    missed_filled = cur.rowcount

    conn.commit()
    conn.close()

    if added:
        print(f"\n컬럼 추가 완료: {', '.join(added)}")
    else:
        print("\n모든 컬럼이 이미 존재합니다.")

    print(f"백필 — last_seen_at: {last_seen_filled}행 / active: {active_filled}행 / missed_crawls: {missed_filled}행")


if __name__ == "__main__":
    main()
