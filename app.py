import os
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'scout-secret-key-2024')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///scout.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# ==================== 資料庫模型 ====================

class Admin(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    name = db.Column(db.String(80))  # 管理員顯示名稱

class Scout(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    troop = db.Column(db.String(20))  # 小隊編號
    join_date = db.Column(db.Date, default=datetime.utcnow)
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Attendance(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    scout_id = db.Column(db.Integer, db.ForeignKey('scout.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), nullable=False)  # present, absent, leave, uniform
    note = db.Column(db.String(200))
    recorded_by = db.Column(db.String(80))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    scout = db.relationship('Scout', backref='attendances')

class Meeting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    theme = db.Column(db.String(200))  # 集會主題
    note = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(Admin, int(user_id))

# ==================== 路由 ====================

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        admin = Admin.query.filter_by(username=username).first()
        
        if admin and check_password_hash(admin.password_hash, password):
            login_user(admin)
            return redirect(url_for('dashboard'))
        else:
            flash('用戶名或密碼錯誤', 'error')
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    # 獲取最近集會
    recent_meetings = Meeting.query.order_by(Meeting.date.desc()).limit(10).all()
    # 獲取總童軍數
    total_scouts = Scout.query.filter_by(active=True).count()
    # 獲取今日集會
    today = datetime.now().date()
    today_meeting = Meeting.query.filter_by(date=today).first()
    
    return render_template('dashboard.html', 
                         recent_meetings=recent_meetings,
                         total_scouts=total_scouts,
                         today_meeting=today_meeting)

@app.route('/scouts')
@login_required
def scouts():
    all_scouts = Scout.query.filter_by(active=True).order_by(Scout.troop, Scout.name).all()
    return render_template('scouts.html', scouts=all_scouts)

@app.route('/scout/add', methods=['POST'])
@login_required
def add_scout():
    name = request.form.get('name')
    troop = request.form.get('troop')
    
    if name:
        scout = Scout(name=name, troop=troop)
        db.session.add(scout)
        db.session.commit()
        flash('童軍已添加', 'success')
    
    return redirect(url_for('scouts'))

@app.route('/scout/<int:id>/edit', methods=['POST'])
@login_required
def edit_scout(id):
    scout = Scout.query.get_or_404(id)
    scout.name = request.form.get('name')
    scout.troop = request.form.get('troop')
    db.session.commit()
    flash('童軍資料已更新', 'success')
    return redirect(url_for('scouts'))

@app.route('/scout/<int:id>/delete', methods=['POST'])
@login_required
def delete_scout(id):
    scout = Scout.query.get_or_404(id)
    scout.active = False
    db.session.commit()
    flash('童軍已移除', 'success')
    return redirect(url_for('scouts'))

@app.route('/attendance', methods=['GET', 'POST'])
@login_required
def attendance():
    if request.method == 'POST':
        meeting_date = request.form.get('date')
        theme = request.form.get('theme')
        
        # 創建或獲取集會
        meeting = Meeting.query.filter_by(date=meeting_date).first()
        if not meeting:
            meeting = Meeting(date=meeting_date, theme=theme)
            db.session.add(meeting)
            db.session.commit()
        
        # 記錄點名
        scouts = Scout.query.filter_by(active=True).all()
        for scout in scouts:
            status = request.form.get(f'status_{scout.id}')
            note = request.form.get(f'note_{scout.id}')
            
            if status:
                # 檢查是否已有記錄
                existing = Attendance.query.filter_by(
                    scout_id=scout.id, 
                    date=meeting_date
                ).first()
                
                if existing:
                    existing.status = status
                    existing.note = note
                    existing.recorded_by = current_user.name or current_user.username
                else:
                    att = Attendance(
                        scout_id=scout.id,
                        date=meeting_date,
                        status=status,
                        note=note,
                        recorded_by=current_user.name or current_user.username
                    )
                    db.session.add(att)
        
        db.session.commit()
        flash('點名記錄已儲存', 'success')
        return redirect(url_for('attendance_history', date=meeting_date))
    
    # GET 請求
    meeting_date = request.args.get('date', datetime.now().date().isoformat())
    meeting = Meeting.query.filter_by(date=meeting_date).first()
    scouts = Scout.query.filter_by(active=True).order_by(Scout.troop, Scout.name).all()
    
    # 獲取當日記錄
    records = {}
    if meeting:
        atts = Attendance.query.filter_by(date=meeting_date).all()
        records = {att.scout_id: att for att in atts}
    
    return render_template('attendance.html', 
                         scouts=scouts, 
                         meeting_date=meeting_date,
                         meeting=meeting,
                         records=records)

@app.route('/attendance/history')
@login_required
def attendance_history():
    meetings = Meeting.query.order_by(Meeting.date.desc()).limit(20).all()
    return render_template('history.html', meetings=meetings)

@app.route('/attendance/<date>')
@login_required
def attendance_detail(date):
    meeting = Meeting.query.filter_by(date=date).first()
    records = Attendance.query.filter_by(date=date).all()
    return render_template('detail.html', meeting=meeting, records=records, date=date)

@app.route('/stats')
@login_required
def stats():
    # 獲取所有記錄
    attendances = Attendance.query.all()
    
    # 統計每個童軍
    scout_stats = {}
    for att in attendances:
        if att.scout_id not in scout_stats:
            scout_stats[att.scout_id] = {
                'name': att.scout.name,
                'troop': att.scout.troop,
                'present': 0,
                'absent': 0,
                'leave': 0,
                'uniform': 0,
                'total': 0
            }
        scout_stats[att.scout_id][att.status] += 1
        scout_stats[att.scout_id]['total'] += 1
    
    # 計算出席率
    for sid in scout_stats:
        total = scout_stats[sid]['total']
        if total > 0:
            scout_stats[sid]['rate'] = round(
                (scout_stats[sid]['present'] + scout_stats[sid]['leave']) / total * 100, 1
            )
        else:
            scout_stats[sid]['rate'] = 0
    
    # 每月統計
    monthly_stats = {}
    for att in attendances:
        month_key = att.date.strftime('%Y-%m')
        if month_key not in monthly_stats:
            monthly_stats[month_key] = {'present': 0, 'absent': 0, 'leave': 0, 'uniform': 0}
        monthly_stats[month_key][att.status] += 1
    
    # 總體統計
    total_records = len(attendances)
    stats_summary = {
        'present': sum(1 for a in attendances if a.status == 'present'),
        'absent': sum(1 for a in attendances if a.status == 'absent'),
        'leave': sum(1 for a in attendances if a.status == 'leave'),
        'uniform': sum(1 for a in attendances if a.status == 'uniform'),
    }
    
    return render_template('stats.html',
                         scout_stats=scout_stats,
                         monthly_stats=monthly_stats,
                         stats_summary=stats_summary,
                         total_records=total_records)

@app.route('/api/stats')
@login_required
def api_stats():
    """API: 返回 JSON 格式的統計數據"""
    attendances = Attendance.query.all()
    
    # 每月數據
    monthly = {}
    for att in attendances:
        m = att.date.strftime('%Y-%m')
        if m not in monthly:
            monthly[m] = {'present': 0, 'absent': 0, 'leave': 0, 'uniform': 0}
        monthly[m][att.status] += 1
    
    # 轉為列表格式
    months = sorted(monthly.keys())
    chart_data = {
        'labels': months,
        'present': [monthly[m]['present'] for m in months],
        'absent': [monthly[m]['absent'] for m in months],
        'leave': [monthly[m]['leave'] for m in months],
        'uniform': [monthly[m]['uniform'] for m in months],
    }
    
    return jsonify(chart_data)

# ==================== 管理員相關 ====================

@app.route('/admin/users')
@login_required
def admin_users():
    users = Admin.query.all()
    return render_template('admin_users.html', users=users)

@app.route('/admin/user/add', methods=['POST'])
@login_required
def admin_add_user():
    username = request.form.get('username')
    password = request.form.get('password')
    name = request.form.get('name')
    
    if Admin.query.filter_by(username=username).first():
        flash('用戶名已存在', 'error')
    else:
        admin = Admin(
            username=username,
            password_hash=generate_password_hash(password),
            name=name
        )
        db.session.add(admin)
        db.session.commit()
        flash('管理員已添加', 'success')
    
    return redirect(url_for('admin_users'))

@app.route('/admin/user/<int:id>/delete', methods=['POST'])
@login_required
def admin_delete_user(id):
    admin = Admin.query.get_or_404(id)
    if admin.id == current_user.id:
        flash('不能刪除自己的帳號', 'error')
    else:
        db.session.delete(admin)
        db.session.commit()
        flash('管理員已刪除', 'success')
    return redirect(url_for('admin_users'))

@app.route('/admin/export')
@login_required
def admin_export():
    """導出所有數據為 CSV"""
    import csv
    from flask import make_response
    
    response = make_response()
    response.headers['Content-Type'] = 'text/csv; charset=utf-8'
    response.headers['Content-Disposition'] = f'attachment; filename=scout_attendance_{datetime.now().date()}.csv'
    
    writer = csv.writer(response)
    writer.writerow(['日期', '童軍姓名', '小隊', '狀態', '備註', '記錄人'])
    
    records = Attendance.query.order_by(Attendance.date).all()
    for r in records:
        status_map = {'present': '出席', 'absent': '缺席', 'leave': '請假', 'uniform': '制服不整'}
        writer.writerow([
            r.date,
            r.scout.name,
            r.scout.troop,
            status_map.get(r.status, r.status),
            r.note or '',
            r.recorded_by or ''
        ])
    
    return response

# ==================== 初始化 ====================

def init_db():
    with app.app_context():
        db.create_all()
        
        # 如果沒有管理員，創建默認管理員
        if not Admin.query.first():
            admin = Admin(
                username='admin',
                password_hash=generate_password_hash('scout2024'),
                name='系統管理員'
            )
            db.session.add(admin)
            db.session.commit()
            print('已創建默認管理員: admin / scout2024')

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
