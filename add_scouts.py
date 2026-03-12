# -*- coding: utf-8 -*-
import psycopg2
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 連接 Supabase PostgreSQL
conn = psycopg2.connect(
    host="db.jfedyerqsklhuedscovt.supabase.co",
    port="5432",
    database="postgres",
    user="postgres",
    password="zPl8SsaI1kTa3PFU"
)

cur = conn.cursor()

# 童軍名單
scouts = [
    ("伍穎萱", "團隊長"),
    ("譚俊灝", "1-C-鳶"),
    ("張琛雅", "1-B-鳶"),
    ("陳子韜", "1-C-鳶"),
    ("黃虹鈞", "1-C-鳶"),
    ("李奕霆", "1-C-鳶"),
    ("余承澧", "2-A-茶隼"),
    ("岑沛蕎", "2-B-茶隼"),
    ("顏紫皓", "2-C-茶隼"),
    ("陳仕楷", "2-C-茶隼"),
    ("吳梓希", "2-C-茶隼"),
    ("姚卓樂", "2-C-茶隼"),
    ("曾奕熹", "3-A-獵鷹"),
    ("黎浩炘", "3-B-獵鷹"),
    ("鍾昊軒", "3-C-獵鷹"),
    ("王馨璐", "3-C-獵鷹"),
    ("劉唯葳", "3-C-獵鷹"),
    ("林晉霆", "3-C-獵鷹"),
    ("盧可豐", "領袖"),
    ("顏紫琳", "領袖"),
    ("鄭絲尹", "領袖"),
]

# 插入童軍
for name, troop in scouts:
    cur.execute("INSERT INTO scout (name, troop, active) VALUES (%s, %s, true)", (name, troop))
    print(f"Added: {name} - {troop}")

conn.commit()
cur.close()
conn.close()

print("\nAll scouts added!")
