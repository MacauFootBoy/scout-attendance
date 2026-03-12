import requests

url = "https://scout-attendance.onrender.com/scout/bulk-add"
data = {
    "scouts_data": "伍穎萱,團隊長;譚俊灝,1-C-鳶;張琛雅,1-B-鳶;陳子韜,1-C-鳶;黃虹鈞,1-C-鳶;李奕霆,1-C-鳶;余承澧,2-A-茶隼;岑沛蕎,2-B-茶隼;顏紫皓,2-C-茶隼;陳仕楷,2-C-茶隼;吳梓希,2-C-茶隼;姚卓樂,2-C-茶隼;曾奕熹,3-A-獵鷹;黎浩炘,3-B-獵鷹;鍾昊軒,3-C-獵鷹;王馨璐,3-C-獵鷹;劉唯葳,3-C-獵鷹;林晉霆,3-C-獵鷹;盧可豐,領袖;顏紫琳,領袖;鄭絲尹,領袖"
}

# 需要先登入才能添加
# 使用 session 來保持登入狀態
session = requests.Session()

# 先登入
login_url = "https://scout-attendance.onrender.com/login"
login_data = {
    "username": "admin",
    "password": "scout2024"
}
session.post(login_url, data=login_data)

# 然後添加童軍
response = session.post(url, data=data)
print(f"Status: {response.status_code}")
print(response.text[:500] if response.text else "No response")
