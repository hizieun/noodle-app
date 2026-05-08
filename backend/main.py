from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import sqlite3
import os
from typing import Optional

load_dotenv()

app = FastAPI(title="Nopo Map API")

# CORS: env var로 허용 origin 관리. 미설정 시 로컬 개발 환경만 허용
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "restaurants.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@app.get("/api/restaurants")
async def get_restaurants(
    region: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=100),
):
    conn = get_db_connection()
    cursor = conn.cursor()

    base = "FROM restaurants WHERE 1=1"
    params = []

    if region:
        base += " AND region = ?"
        params.append(region)
    if category:
        base += " AND category = ?"
        params.append(category)
    if search:
        base += " AND (name LIKE ? OR address LIKE ? OR menus LIKE ?)"
        s = f"%{search}%"
        params.extend([s, s, s])

    order = " ORDER BY CAST(rating AS REAL) DESC"

    # 전체 개수 (페이지네이션 메타용)
    cursor.execute(f"SELECT COUNT(*) {base}", params)
    total = cursor.fetchone()[0]

    # 데이터 조회
    if page is not None and limit is not None:
        offset = (page - 1) * limit
        cursor.execute(f"SELECT * {base}{order} LIMIT ? OFFSET ?", params + [limit, offset])
    else:
        cursor.execute(f"SELECT * {base}{order}", params)

    rows = cursor.fetchall()
    conn.close()

    data = [dict(row) for row in rows]

    # 페이지네이션 파라미터가 있으면 메타 포함 응답, 없으면 기존과 동일하게 배열만
    if page is not None and limit is not None:
        return {
            "total": total,
            "page": page,
            "limit": limit,
            "data": data,
        }
    return data


@app.get("/api/stats")
async def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT region, COUNT(*) as count FROM restaurants GROUP BY region ORDER BY count DESC")
    region_stats = cursor.fetchall()

    cursor.execute("SELECT category, COUNT(*) as count FROM restaurants GROUP BY category")
    category_stats = cursor.fetchall()

    conn.close()

    total = sum(row["count"] for row in region_stats)
    return {
        "total": total,
        "regions": {row["region"]: row["count"] for row in region_stats},
        "categories": {row["category"]: row["count"] for row in category_stats},
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
