import sqlite3
import pandas as pd
import os

# DB 파일 경로
DB_PATH = os.path.join(os.getcwd(), 'backend', 'restaurants.db')

def init_db():
    """데이터베이스 초기화 및 테이블 생성"""
    # backend 디렉토리가 없으면 생성
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 테이블 생성 (상호명과 주소 조합으로 중복 방지)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS restaurants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        region TEXT NOT NULL,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        address TEXT,
        rating TEXT,
        phone TEXT,
        menus TEXT,
        kakao_link TEXT,
        naver_blog_link TEXT,
        naver_map_link TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, address)
    )
    ''')
    
    conn.commit()
    conn.close()
    print(f"✅ 데이터베이스 초기화 완료: {DB_PATH}")

def migrate_csv_to_db(csv_path):
    """CSV 데이터를 DB로 이관 (Upsert 로직)"""
    if not os.path.exists(csv_path):
        print(f"⚠️ CSV 파일이 없습니다: {csv_path}")
        return

    df = pd.read_csv(csv_path)
    conn = sqlite3.connect(DB_PATH)
    
    count = 0
    for _, row in df.iterrows():
        try:
            conn.execute('''
            INSERT INTO restaurants (
                region, category, name, address, rating, phone, menus, 
                kakao_link, naver_blog_link, naver_map_link
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name, address) DO UPDATE SET
                region=excluded.region,
                category=excluded.category,
                rating=excluded.rating,
                phone=excluded.phone,
                menus=excluded.menus,
                kakao_link=excluded.kakao_link,
                naver_blog_link=excluded.naver_blog_link,
                naver_map_link=excluded.naver_map_link,
                updated_at=CURRENT_TIMESTAMP
            ''', (
                row['지역'], row['카테고리'], row['상호명'], row['주소'], 
                row['평점'], row['전화번호'], row['대표메뉴'],
                row['카카오맵_링크'], row['네이버블로그_링크'], row['네이버지도_링크']
            ))
            count += 1
        except Exception as e:
            print(f"❌ {row['상호명']} 이관 실패: {e}")
            
    conn.commit()
    conn.close()
    print(f"✅ {count}개의 데이터를 DB로 이관 완료했습니다.")

if __name__ == "__main__":
    init_db()
    migrate_csv_to_db('맛집_평점순_정렬.csv')
