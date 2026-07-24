"""크롤·sync 후 커밋 전 데이터 이상 감지 가드.

직전 배포본(git HEAD의 frontend/public/data.json)과 새로 생성된 data.json을 비교해
활성 식당 수가 비정상적으로 급감하면 exit 1 → CI 커밋 스텝이 실행 안 됨(마지막 정상 데이터 보존).

2026-07 사고 재발 방지: 폐업 sweep 오탐으로 식당 31%가 조용히 숨겨진 채 배포됨.
사람이 우연히 발견하기 전까지 몇 주간 방치 → 자동 가드로 차단.

사용법: python crawling/health_check.py   (통과 exit 0 / 이상 exit 1)
환경변수 HEALTH_MAX_DROP 로 임계 조정(기본 0.15 = 15%).
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JSON = os.path.join(ROOT, "frontend", "public", "data.json")
MAX_DROP = float(os.getenv("HEALTH_MAX_DROP", "0.15"))  # 15% 이상 급감 시 차단
MIN_COUNT = int(os.getenv("HEALTH_MIN_COUNT", "300"))    # 절대 하한 (완전 붕괴 방지)


def load_current():
    with open(DATA_JSON, encoding="utf-8") as f:
        return json.load(f)


def load_previous():
    """git HEAD에 커밋된 직전 data.json. 없으면 None(최초 실행 등)."""
    try:
        out = subprocess.run(
            ["git", "show", "HEAD:frontend/public/data.json"],
            cwd=ROOT, capture_output=True, text=True, check=True,
        )
        return json.loads(out.stdout)
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None


def main():
    cur = load_current()
    n_cur = len(cur)
    print(f"[health] 현재 data.json: {n_cur}곳")

    # 절대 하한
    if n_cur < MIN_COUNT:
        print(f"❌ [health] 식당 수 {n_cur} < 하한 {MIN_COUNT} — 데이터 붕괴 의심. 커밋 차단.")
        sys.exit(1)

    prev = load_previous()
    if prev is None:
        print("[health] 직전 data.json 없음 — 비교 생략, 통과.")
        return
    n_prev = len(prev)
    if n_prev == 0:
        print("[health] 직전이 0곳 — 비교 생략, 통과.")
        return

    drop = (n_prev - n_cur) / n_prev
    print(f"[health] 직전 {n_prev}곳 → 현재 {n_cur}곳 (변화 {drop*100:+.1f}%)")

    if drop > MAX_DROP:
        # 어느 지역이 가장 많이 줄었는지 진단 출력
        def by_region(data):
            d = {}
            for r in data:
                d[r.get("지역", "?")] = d.get(r.get("지역", "?"), 0) + 1
            return d
        pr, cr = by_region(prev), by_region(cur)
        deltas = sorted(((reg, cr.get(reg, 0) - c) for reg, c in pr.items()), key=lambda x: x[1])
        print(f"❌ [health] 식당 수 {drop*100:.1f}% 급감 (임계 {MAX_DROP*100:.0f}%) — 크롤 이상 의심. 커밋 차단.")
        print("  가장 많이 줄어든 지역:", [f"{reg} {d:+d}" for reg, d in deltas[:5]])
        print("  → 크롤 로그·sweep 확인 필요. 정상 변동이면 HEALTH_MAX_DROP 상향 후 재실행.")
        sys.exit(1)

    print("✅ [health] 정상 범위 — 통과.")


if __name__ == "__main__":
    main()
