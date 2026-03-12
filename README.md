# 澳門童軍第5旅 點名系統

## 功能特點

- ✅ 中文界面
- ✅ 童軍資料管理（添加/編輯/刪除）
- ✅ 每週集會點名（出席/請假/缺席/制服不整）
- ✅ 統計分析（圖表可視化）
- ✅ 管理員系統（多人帳號）
- ✅ 資料導出（CSV）
- ✅ 自定義集會主題

## 配色

- 深藍色：#1F3473
- 黃色：#F2E205  
- 棕色：#A65729
- 灰色：#F2F2F2

## 本地運行

```bash
# 安裝依賴
pip install -r requirements.txt

# 運行
python app.py
```

訪問 http://localhost:5000

預設管理員：
- 用戶名：admin
- 密碼：scout2024

## 部署到 Render.com（免費）

### 步驟：

1. **準備代碼**
   將所有文件上傳到 GitHub 倉庫

2. **創建 Render 帳號**
   訪問 https://render.com 註冊

3. **創建 Web Service**
   - 點 "New +" → "Web Service"
   - 連接你的 GitHub 倉庫
   - 選擇倉庫和分支
   - 設置：
     - Name: scout-attendance
     - Build Command: `pip install -r requirements.txt`
     - Start Command: `gunicorn app:app --bind 0.0.0.0:$PORT`
   - 選擇免費方案（Free）

4. **環境變量**
   在 Render 後台添加：
   - `SECRET_KEY`: 隨機字符串
   - `DATABASE_URL`: 會自動創建 SQLite

5. **訪問你的網站**
   部署完成後訪問 Render 提供的 URL

## 使用說明

1. 登入管理員帳號
2. 先在「童軍名冊」添加童軍
3. 在「點名」頁面記錄每週集會
4. 在「統計」頁面查看分析圖表
5. 在「管理員」頁面添加更多管理員帳號

## 數據導出

訪問 `/admin/export` 可導出所有記錄為 CSV 檔案
