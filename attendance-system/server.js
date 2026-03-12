const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Database setup
const db = new sqlite3.Database('./scouts.db', (err) => {
    if (err) console.error('資料庫連接錯誤:', err.message);
    else console.log('已連接到 SQLite 資料庫');
});

// Initialize tables
db.serialize(() => {
    // Admin table
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Members table
    db.run(`CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        troop TEXT NOT NULL,
        position TEXT,
        phone TEXT,
        emergency_contact TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Attendance table
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        meeting_date DATE NOT NULL,
        status TEXT NOT NULL,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id),
        UNIQUE(member_id, meeting_date)
    )`);

    // Meetings table
    db.run(`CREATE TABLE IF NOT EXISTS meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL UNIQUE,
        theme TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create default admin if not exists
    const defaultPassword = bcrypt.hashSync('scout5th', 10);
    db.run(`INSERT OR IGNORE INTO admins (username, password, name) VALUES (?, ?, ?)`, 
        ['admin', defaultPassword, '管理員'], 
        (err) => {
            if (!err) console.log('已建立預設管理員帳號: admin / scout5th');
        }
    );
});

// ============ Admin APIs ============

// Login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM admins WHERE username = ?', [username], (err, admin) => {
        if (err || !admin) {
            return res.json({ success: false, message: '帳號或密碼錯誤' });
        }
        if (bcrypt.compareSync(password, admin.password)) {
            res.json({ success: true, admin: { id: admin.id, username: admin.username, name: admin.name } });
        } else {
            res.json({ success: false, message: '帳號或密碼錯誤' });
        }
    });
});

// Change password
app.post('/api/admin/change-password', (req, res) => {
    const { adminId, oldPassword, newPassword } = req.body;
    db.get('SELECT password FROM admins WHERE id = ?', [adminId], (err, admin) => {
        if (err || !admin) {
            return res.json({ success: false, message: '管理員不存在' });
        }
        if (!bcrypt.compareSync(oldPassword, admin.password)) {
            return res.json({ success: false, message: '舊密碼錯誤' });
        }
        const hashed = bcrypt.hashSync(newPassword, 10);
        db.run('UPDATE admins SET password = ? WHERE id = ?', [hashed, adminId], (err) => {
            res.json({ success: true, message: '密碼已更新' });
        });
    });
});

// ============ Member APIs ============

// Get all members
app.get('/api/members', (req, res) => {
    db.all('SELECT * FROM members WHERE status = ? ORDER BY troop, name', ['active'], (err, rows) => {
        if (err) return res.json({ error: err.message });
        res.json(rows);
    });
});

// Add member
app.post('/api/members', (req, res) => {
    const { name, troop, position, phone, emergency_contact } = req.body;
    db.run('INSERT INTO members (name, troop, position, phone, emergency_contact) VALUES (?, ?, ?, ?, ?)',
        [name, troop, position, phone, emergency_contact],
        function(err) {
            if (err) return res.json({ success: false, error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// Update member
app.put('/api/members/:id', (req, res) => {
    const { name, troop, position, phone, emergency_contact, status } = req.body;
    db.run('UPDATE members SET name = ?, troop = ?, position = ?, phone = ?, emergency_contact = ?, status = ? WHERE id = ?',
        [name, troop, position, phone, emergency_contact, status, req.params.id],
        function(err) {
            if (err) return res.json({ success: false, error: err.message });
            res.json({ success: true });
        }
    );
});

// Delete member (soft delete)
app.delete('/api/members/:id', (req, res) => {
    db.run('UPDATE members SET status = ? WHERE id = ?', ['inactive', req.params.id], function(err) {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// ============ Attendance APIs ============

// Get attendance for a specific meeting
app.get('/api/attendance/:date', (req, res) => {
    const { date } = req.params;
    db.all(`
        SELECT m.id, m.name, m.troop, m.position, a.status, a.remark
        FROM members m
        LEFT JOIN attendance a ON m.id = a.member_id AND a.meeting_date = ?
        WHERE m.status = 'active'
        ORDER BY m.troop, m.name
    `, [date], (err, rows) => {
        if (err) return res.json({ error: err.message });
        res.json(rows);
    });
});

// Submit attendance
app.post('/api/attendance', (req, res) => {
    const { memberId, meetingDate, status, remark } = req.body;
    db.run(`
        INSERT INTO attendance (member_id, meeting_date, status, remark)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(member_id, meeting_date) DO UPDATE SET status = ?, remark = ?
    `, [memberId, meetingDate, status, remark, status, remark], function(err) {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// Submit multiple attendance records
app.post('/api/attendance/batch', (req, res) => {
    const { meetingDate, records } = req.body;
    const stmt = db.prepare(`
        INSERT INTO attendance (member_id, meeting_date, status, remark)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(member_id, meeting_date) DO UPDATE SET status = ?, remark = ?
    `);
    
    records.forEach(r => {
        stmt.run([r.memberId, meetingDate, r.status, r.remark, r.status, r.remark]);
    });
    stmt.finalize();
    
    res.json({ success: true });
});

// Get all attendance records
app.get('/api/attendance', (req, res) => {
    const { startDate, endDate } = req.query;
    let sql = `
        SELECT a.*, m.name, m.troop, m.position
        FROM attendance a
        JOIN members m ON a.member_id = m.id
    `;
    const params = [];
    if (startDate && endDate) {
        sql += ' WHERE a.meeting_date BETWEEN ? AND ?';
        params.push(startDate, endDate);
    }
    sql += ' ORDER BY a.meeting_date DESC, m.troop, m.name';
    
    db.all(sql, params, (err, rows) => {
        if (err) return res.json({ error: err.message });
        res.json(rows);
    });
});

// ============ Meeting APIs ============

// Get all meetings
app.get('/api/meetings', (req, res) => {
    db.all('SELECT * FROM meetings ORDER BY date DESC', (err, rows) => {
        if (err) return res.json({ error: err.message });
        res.json(rows);
    });
});

// Create meeting
app.post('/api/meetings', (req, res) => {
    const { date, theme, notes } = req.body;
    db.run('INSERT INTO meetings (date, theme, notes) VALUES (?, ?, ?)',
        [date, theme, notes],
        function(err) {
            if (err) return res.json({ success: false, error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// ============ Statistics APIs ============

// Get statistics
app.get('/api/stats', (req, res) => {
    const { startDate, endDate } = req.query;
    
    let dateFilter = '';
    const params = [];
    if (startDate && endDate) {
        dateFilter = 'WHERE meeting_date BETWEEN ? AND ?';
        params.push(startDate, endDate);
    }
    
    // Overall stats
    db.get(`
        SELECT 
            COUNT(*) as total_records,
            SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
            SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
            SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave,
            SUM(CASE WHEN status = 'uniform' THEN 1 ELSE 0 END) as uniform,
            COUNT(DISTINCT meeting_date) as total_meetings
        FROM attendance ${dateFilter}
    `, params, (err, overall) => {
        if (err) return res.json({ error: err.message });
        
        // Attendance by member
        db.all(`
            SELECT m.id, m.name, m.troop,
                COUNT(*) as total,
                SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
                SUM(CASE WHEN a.status = 'leave' THEN 1 ELSE 0 END) as leave,
                SUM(CASE WHEN a.status = 'uniform' THEN 1 ELSE 0 END) as uniform
            FROM members m
            JOIN attendance a ON m.id = a.member_id
            ${dateFilter ? 'WHERE ' + dateFilter.split('WHERE')[1].replace('a.', 'a.') : ''}
            GROUP BY m.id
            ORDER BY m.troop, m.name
        `, params, (err, byMember) => {
            if (err) return res.json({ error: err.message });
            
            // Attendance by meeting
            db.all(`
                SELECT meeting_date,
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
                    SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
                    SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave,
                    SUM(CASE WHEN status = 'uniform' THEN 1 ELSE 0 END) as uniform
                FROM attendance
                ${dateFilter}
                GROUP BY meeting_date
                ORDER BY meeting_date DESC
            `, params, (err, byMeeting) => {
                if (err) return res.json({ error: err.message });
                
                // Attendance rate by troop
                db.all(`
                    SELECT m.troop,
                        COUNT(*) as total,
                        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present
                    FROM members m
                    JOIN attendance a ON m.id = a.member_id
                    ${dateFilter ? 'WHERE ' + dateFilter.split('WHERE')[1].replace('a.', 'a.') : ''}
                    GROUP BY m.troop
                    ORDER BY m.troop
                `, params, (err, byTroop) => {
                    if (err) return res.json({ error: err.message });
                    
                    res.json({
                        overall: overall || { total_records: 0, present: 0, absent: 0, leave: 0, uniform: 0, total_meetings: 0 },
                        byMember: byMember || [],
                        byMeeting: byMeeting || [],
                        byTroop: byTroop || []
                    });
                });
            });
        });
    });
});

// Export attendance to CSV
app.get('/api/export', (req, res) => {
    const { startDate, endDate } = req.query;
    let sql = `
        SELECT m.name, m.troop, m.position, a.meeting_date, a.status, a.remark
        FROM attendance a
        JOIN members m ON a.member_id = m.id
    `;
    const params = [];
    if (startDate && endDate) {
        sql += ' WHERE a.meeting_date BETWEEN ? AND ?';
        params.push(startDate, endDate);
    }
    sql += ' ORDER BY a.meeting_date, m.troop, m.name';
    
    db.all(sql, params, (err, rows) => {
        if (err) return res.json({ error: err.message });
        
        let csv = '姓名,小隊,職位,日期,狀態,備註\n';
        const statusMap = { present: '出席', absent: '缺席', leave: '請假', uniform: '制服不整' };
        
        rows.forEach(r => {
            csv += `${r.name},${r.troop},${r.position || ''},${r.meeting_date},${statusMap[r.status]},${r.remark || ''}\n`;
        });
        
        res.setHeader('Content-Type', 'text/csv;charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance.csv');
        res.send('\ufeff' + csv);
    });
});

app.listen(PORT, () => {
    console.log(`澳門童軍第5旅點名系統 server running on http://localhost:${PORT}`);
});
