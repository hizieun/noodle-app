"""sweep 로직 단위 검증 — 인메모리 SQLite 사용 (실DB 무관).

시나리오:
  (a) 미발견 행: missed_crawls 2 → 3, active=0 전환
  (b) 발견 행: missed_crawls 0, active=1 복구
  (c) 0건 지역 가드: 해당 행은 sweep 대상 제외 → 값 불변

실행: python crawling/test_sweep.py
"""

import sqlite3
from datetime import datetime, timedelta


# ── 헬퍼: 인메모리 DB 셋업 ─────────────────────────────────────────────────

def make_db():
    conn = sqlite3.connect(":memory:")
    conn.execute("""
        CREATE TABLE restaurants (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            region        TEXT,
            category      TEXT,
            name          TEXT,
            address       TEXT,
            last_seen_at  TEXT,
            active        INTEGER DEFAULT 1,
            missed_crawls INTEGER DEFAULT 0
        )
    """)
    conn.commit()
    return conn


def insert_row(conn, region, category, name, last_seen_at, active=1, missed_crawls=0):
    conn.execute("""
        INSERT INTO restaurants (region, category, name, address, last_seen_at, active, missed_crawls)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (region, category, name, f"{region}-addr", last_seen_at, active, missed_crawls))
    conn.commit()


# ── sweep 로직 (kakaomap.py의 run_sweep과 동일 SQL) ────────────────────────

def run_sweep(conn, crawl_counts, run_started_at):
    valid_pairs = [(cat, reg) for (cat, reg), cnt in crawl_counts.items() if cnt > 0]
    if not valid_pairs:
        return

    categories_in_scope = list({cat for cat, reg in valid_pairs})
    regions_in_scope    = list({reg for cat, reg in valid_pairs})

    cat_ph = ",".join("?" * len(categories_in_scope))
    reg_ph = ",".join("?" * len(regions_in_scope))

    # 1) 발견 → 복구
    conn.execute(f"""
        UPDATE restaurants
        SET missed_crawls = 0, active = 1
        WHERE category IN ({cat_ph})
          AND region IN ({reg_ph})
          AND last_seen_at >= ?
    """, categories_in_scope + regions_in_scope + [run_started_at])

    # 2) 미발견 → 카운트 증가
    conn.execute(f"""
        UPDATE restaurants
        SET missed_crawls = missed_crawls + 1
        WHERE category IN ({cat_ph})
          AND region IN ({reg_ph})
          AND (last_seen_at IS NULL OR last_seen_at < ?)
    """, categories_in_scope + regions_in_scope + [run_started_at])

    # 3) missed_crawls >= 3 → 숨김
    conn.execute(f"""
        UPDATE restaurants
        SET active = 0
        WHERE category IN ({cat_ph})
          AND region IN ({reg_ph})
          AND missed_crawls >= 3
    """, categories_in_scope + regions_in_scope)

    conn.commit()


def fetch(conn, name):
    return conn.execute(
        "SELECT active, missed_crawls FROM restaurants WHERE name = ?", (name,)
    ).fetchone()


# ── 시나리오 ───────────────────────────────────────────────────────────────

def test_a_missed_reaches_3_and_hidden():
    """(a) 미발견 행: missed 2 → 3, active=0."""
    conn = make_db()
    now = datetime.now()
    run_started_at = now.isoformat(timespec='seconds')
    old_ts = (now - timedelta(days=7)).isoformat(timespec='seconds')  # 이전 크롤 시각

    insert_row(conn, "강남구", "노포", "오래된집", old_ts, active=1, missed_crawls=2)

    crawl_counts = {("노포", "강남구"): 5}  # 강남구-노포는 5건 수집 (가드 통과)
    run_sweep(conn, crawl_counts, run_started_at)

    active, missed = fetch(conn, "오래된집")
    assert missed == 3, f"missed_crawls 기대 3, 실제 {missed}"
    assert active == 0, f"active 기대 0, 실제 {active}"
    print("  (a) PASS: missed 2→3, active=0")
    conn.close()


def test_b_found_restores_active():
    """(b) 발견 행: missed=0, active=1 복구."""
    conn = make_db()
    now = datetime.now()
    run_started_at = now.isoformat(timespec='seconds')
    # 이번 크롤에서 발견 → last_seen_at = run_started_at
    insert_row(conn, "마포구", "야장", "복귀식당", run_started_at, active=0, missed_crawls=2)

    crawl_counts = {("야장", "마포구"): 3}
    run_sweep(conn, crawl_counts, run_started_at)

    active, missed = fetch(conn, "복귀식당")
    assert missed == 0, f"missed_crawls 기대 0, 실제 {missed}"
    assert active == 1, f"active 기대 1, 실제 {active}"
    print("  (b) PASS: 발견 시 missed=0, active=1 복구")
    conn.close()


def test_c_zero_count_region_untouched():
    """(c) 0건 지역 가드: sweep 제외 → 값 불변."""
    conn = make_db()
    now = datetime.now()
    run_started_at = now.isoformat(timespec='seconds')
    old_ts = (now - timedelta(days=7)).isoformat(timespec='seconds')

    # 서초구-노포는 0건 → 가드로 sweep 제외
    insert_row(conn, "서초구", "노포", "미수집지역식당", old_ts, active=1, missed_crawls=1)

    crawl_counts = {("노포", "서초구"): 0}  # 0건 → 가드 발동
    run_sweep(conn, crawl_counts, run_started_at)

    active, missed = fetch(conn, "미수집지역식당")
    assert missed == 1, f"missed_crawls 기대 1(불변), 실제 {missed}"
    assert active == 1, f"active 기대 1(불변), 실제 {active}"
    print("  (c) PASS: 0건 지역 가드 — 값 불변")
    conn.close()


if __name__ == "__main__":
    print("sweep 단위 검증 시작...")
    test_a_missed_reaches_3_and_hidden()
    test_b_found_restores_active()
    test_c_zero_count_region_untouched()
    print("\n모든 assert 통과.")
