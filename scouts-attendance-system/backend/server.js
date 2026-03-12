const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'scouts-macau-5th-secret-key';

app.use(cors());
app.use(bodyParser.json());

// 初始化 SQLite 數據庫
const db = new sqlite3.Database('./scouts_attendance.db', (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// 初始化數據庫表
function initializeDatabase() {
  db.serialize(() => {
    // 管理員表
    db.run(`CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 童軍成員表
    db.run(`CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_number TEXT UNIQUE,
      chinese_name TEXT NOT NULL,
      english_name TEXT,
      patrol TEXT, -- 小隊（如狼、鷹、豹等）
      rank TEXT, -- 階級
      join_date DATE,
      status TEXT DEFAULT 'active', -- active, inactive
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 集會表（每週集會）
    db.run(`CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL UNIQUE,
      theme TEXT,
      location TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 出席記錄表
    db.run(`CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'leave', 'uniform_issue')),
      notes TEXT,
      recorded_by INTEGER, -- admin user id
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
      UNIQUE(meeting_id, member_id)
    )`);

    // 創建默認管理員帳戶（如果不存在）
    const defaultAdmin = {
      username: 'admin',
      password: 'admin123', // 首次登入後應更改
      display_name: '系統管理員'
    };

    db.get('SELECT id FROM admin_users WHERE username = ?', [defaultAdmin.username], (err, row) => {
      if (err) {
        console.error('Error checking admin user:', err);
        return;
      }
      if (!row) {
        const hashedPassword = bcrypt.hashSync(defaultAdmin.password, 10);
        db.run(
          'INSERT INTO admin_users (username, password, display_name) VALUES (?, ?, ?)',
          [defaultAdmin.username, hashedPassword, defaultAdmin.display_name],
          (err) => {
            if (err) {
              console.error('Error creating default admin:', err);
            } else {
              console.log('Default admin user created (username: admin, password: admin123)');
            }
          }
        );
      }
    });
  });
}

// JWT 驗證中間件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '需要登入令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '無效的令牌' });
    }
    req.user = user;
    next();
  });
}

// ========== 管理員 API ==========

// 管理員登入
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM admin_users WHERE username = ?', [username], (err, admin) => {
    if (err) {
      return res.status(500).json({ error: '數據庫錯誤' });
    }
    if (!admin) {
      return res.status(401).json({ error: '用戶名或密碼錯誤' });
    }

    const passwordValid = bcrypt.compareSync(password, admin.password);
    if (!passwordValid) {
      return res.status(401).json({ error: '用戶名或密碼錯誤' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, display_name: admin.display_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: admin.id,
        username: admin.username,
        display_name: admin.display_name
      }
    });
  });
});

// 更改管理員密碼
app.post('/api/admin/change-password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const adminId = req.user.id;

  db.get('SELECT password FROM admin_users WHERE id = ?', [adminId], (err, admin) => {
    if (err) {
      return res.status(500).json({ error: '數據庫錯誤' });
    }

    const passwordValid = bcrypt.compareSync(currentPassword, admin.password);
    if (!passwordValid) {
      return res.status(401).json({ error: '當前密碼錯誤' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.run('UPDATE admin_users SET password = ? WHERE id = ?', [hashedPassword, adminId], (err) => {
      if (err) {
        return res.status(500).json({ error: '更新密碼失敗' });
      }
      res.json({ message: '密碼已更新' });
    });
  });
});

// ========== 成員管理 API ==========

// 獲取所有成員
app.get('/api/members', authenticateToken, (req, res) => {
  db.all('SELECT * FROM members ORDER BY patrol, chinese_name', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 創建成員
app.post('/api/members', authenticateToken, (req, res) => {
  const { member_number, chinese_name, english_name, patrol, rank, join_date } = req.body;

  db.run(
    `INSERT INTO members (member_number, chinese_name, english_name, patrol, rank, join_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [member_number, chinese_name, english_name, patrol, rank, join_date],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: this.lastID,
        message: '成員添加成功'
      });
    }
  );
});

// 更新成員
app.put('/api/members/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { member_number, chinese_name, english_name, patrol, rank, join_date, status } = req.body;

  db.run(
    `UPDATE members SET 
      member_number = ?, 
      chinese_name = ?, 
      english_name = ?, 
      patrol = ?, 
      rank = ?, 
      join_date = ?,
      status = ?
     WHERE id = ?`,
    [member_number, chinese_name, english_name, patrol, rank, join_date, status, id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: '成員更新成功' });
    }
  );
});

// 刪除成員
app.delete('/api/members/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM members WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: '成員刪除成功' });
  });
});

// ========== 集會管理 API ==========

// 獲取所有集會
app.get('/api/meetings', authenticateToken, (req, res) => {
  db.all('SELECT * FROM meetings ORDER BY date DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 創建集會
app.post('/api/meetings', authenticateToken, (req, res) => {
  const { date, theme, location, notes } = req.body;

  db.run(
    'INSERT INTO meetings (date, theme, location, notes) VALUES (?, ?, ?, ?)',
    [date, theme, location, notes],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: this.lastID,
        message: '集會創建成功'
      });
    }
  );
});

// 更新集會
app.put('/api/meetings/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { date, theme, location, notes } = req.body;

  db.run(
    'UPDATE meetings SET date = ?, theme = ?, location = ?, notes = ? WHERE id = ?',
    [date, theme, location, notes, id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: '集會更新成功' });
    }
  );
});

// 刪除集會
app.delete('/api/meetings/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM meetings WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: '集會刪除成功' });
  });
});

// ========== 出席記錄 API ==========

// 獲取集會的出席記錄
app.get('/api/meetings/:meetingId/attendance', authenticateToken, (req, res) => {
  const { meetingId } = req.params;

  db.all(
    `SELECT ar.*, m.chinese_name, m.english_name, m.patrol, m.member_number
     FROM attendance_records ar
     JOIN members m ON ar.member_id = m.id
     WHERE ar.meeting_id = ?
     ORDER BY m.patrol, m.chinese_name`,
    [meetingId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// 提交出席記錄（批量）
app.post('/api/meetings/:meetingId/attendance', authenticateToken, (req, res) => {
  const { meetingId } = req.params;
  const { records } = req.body; // [{member_id, status, notes}]
  const recordedBy = req.user.id;

  // 開始事務
  db.run('BEGIN TRANSACTION');

  // 先刪除該集會的所有舊記錄
  db.run('DELETE FROM attendance_records WHERE meeting_id = ?', [meetingId], (err) => {
    if (err) {
      db.run('ROLLBACK');
      return res.status(500).json({ error: err.message });
    }

    // 插入新記錄
    const stmt = db.prepare(
      'INSERT INTO attendance_records (meeting_id, member_id, status, notes, recorded_by) VALUES (?, ?, ?, ?, ?)'
    );

    let errorOccurred = false;
    records.forEach(record => {
      stmt.run([meetingId, record.member_id, record.status, record.notes, recordedBy], (err) => {
        if (err) {
          errorOccurred = true;
          console.error('Error inserting attendance:', err);
        }
      });
    });

    stmt.finalize((err) => {
      if (errorOccurred || err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: '保存出席記錄時出錯' });
      }

      db.run('COMMIT', (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: '出席記錄已保存', count: records.length });
      });
    });
  });
});

// ========== 統計數據 API ==========

// 獲取整體統計
app.get('/api/stats/overview', authenticateToken, (req, res) => {
  // 總成員數
  // 活躍成員數
  // 總集會數
  // 各狀態統計
  const queries = {
    totalMembers: 'SELECT COUNT(*) as count FROM members',
    activeMembers: 'SELECT COUNT(*) as count FROM members WHERE status = "active"',
    totalMeetings: 'SELECT COUNT(*) as count FROM meetings',
    attendanceByStatus: `
      SELECT status, COUNT(*) as count 
      FROM attendance_records 
      GROUP BY status
    `,
    recentAttendance: `
      SELECT m.date, 
        COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present,
        COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent,
        COUNT(CASE WHEN ar.status = 'leave' THEN 1 END) as leave,
        COUNT(CASE WHEN ar.status = 'uniform_issue' THEN 1 END) as uniform_issue,
        COUNT(*) as total
      FROM meetings m
      LEFT JOIN attendance_records ar ON m.id = ar.meeting_id
      GROUP BY m.id
      ORDER BY m.date DESC
      LIMIT 10
    `
  };

  const results = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;

  Object.keys(queries).forEach(key => {
    db.get(queries[key], (err, row) => {
      if (err) {
        console.error(`Error in query ${key}:`, err);
      } else {
        results[key] = row;
      }
      completed++;
      if (completed === totalQueries) {
        res.json(results);
      }
    });
  });
});

// 獲取小隊統計
app.get('/api/stats/patrol', authenticateToken, (req, res) => {
  db.all(`
    SELECT m.patrol,
      COUNT(DISTINCT m.id) as total_members,
      COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as total_present,
      COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as total_absent,
      COUNT(CASE WHEN ar.status = 'leave' THEN 1 END) as total_leave,
      COUNT(CASE WHEN ar.status = 'uniform_issue' THEN 1 END) as total_uniform
    FROM members m
    LEFT JOIN attendance_records ar ON m.id = ar.member_id
    WHERE m.patrol IS NOT NULL AND m.patrol != ''
    GROUP BY m.patrol
    ORDER BY m.patrol
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// ========== 公開 API（用於QR碼簽到）==========

// 通過QR碼獲取集會信息
app.get('/api/public/meeting/:code', (req, res) => {
  // 簡化版：code可以是集會ID或日期
  const { code } = req.params;
  // 這裡可以實現QR碼對應集會的邏輯
  // 目前暫時返回示例
  res.json({ 
    meeting_id: code,
    message: '此功能待實現，請使用管理後台記錄出席' 
  });
});

// ========== 根路徑 ==========

app.get('/', (req, res) => {
  res.json({ 
    message: '澳門童軍第5旅出席管理系統 API',
    version: '1.0.0'
  });
});

// ========== 啟動服務器 ==========

app.listen(port, () => {
  console.log(`澳門童軍第5旅出席管理系統後端運行在端口 ${port}`);
  console.log(`默認管理員帳戶: admin / admin123`);
  console.log(`請立即登入並更改密碼！`);
});