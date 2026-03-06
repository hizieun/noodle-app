import csv
import json
import os

csv_path = os.path.join(os.path.dirname(__file__), "..", "맛집_평점순_정렬.csv")
json_path = os.path.join(os.path.dirname(__file__), "src", "data.json")

def convert():
    data = []
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            data.append(dict(row))
            
    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    convert()
    print(f"✅ CSV → JSON 변환 완료: {json_path}")
