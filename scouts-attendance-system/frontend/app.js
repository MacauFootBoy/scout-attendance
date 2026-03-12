// 澳門童軍第5旅出席管理系統 - 前端應用
// API 基礎 URL（根據部署環境修改）
const API_BASE = 'http://localhost:3001';

// 全局狀態
let currentUser = null;
let currentToken = null;
let currentPage = 'dashboard';
let membersData = [];
let meetingsData = [];

// DOM 元素
const loginPage = document.getElementById('loginPage');
const appPage = document.getElementById('appPage');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const contentArea = document.getElementById('contentArea');
const menuItems = document.querySelectorAll('.menu-item');

// 初始化應用
document.addEventListener('DOMContentLoaded', () => {
    // 檢查本地是否有保存的登入令牌
    const savedToken = localStorage.getItem('scouts_token');
    if (savedToken) {
        currentToken = savedToken;
        currentUser = JSON.parse(localStorage.getItem('scouts_user') || 'null');
        if (currentUser) {
            showApp();
        }
    }

    // 事件監聽
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    
    // 菜單點擊事件
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            if (page) {
                setActivePage(page);
            }
        });
    });
});

// ========== 登入/登出 ==========

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginBtn = loginForm.querySelector('button');
    
    // 保存按鈕原始內容
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登入中...';
    loginBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || '登入失敗');
        }
        
        // 保存令牌和用戶信息
        currentToken = data.token;
        currentUser = data.user;
        localStorage.setItem('scouts_token', currentToken);
        localStorage.setItem('scouts_user', JSON.stringify(currentUser));
        
        showApp();
        
    } catch (error) {
        alert('登入錯誤: ' + error.message);
        console.error('Login error:', error);
    } finally {
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

function handleLogout() {
    if (confirm('確定要登出嗎？')) {
        currentToken = null;
        currentUser = null;
        localStorage.removeItem('scouts_token');
        localStorage.removeItem('scouts_user');
        showLogin();
    }
}

function showLogin() {
    loginPage.classList.add('active');
    loginPage.classList.remove('hidden');
    appPage.classList.add('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function showApp() {
    loginPage.classList.remove('active');
    loginPage.classList.add('hidden');
    appPage.classList.remove('hidden');
    document.getElementById('currentUser').textContent = currentUser?.display_name || '管理員';
    setActivePage('dashboard');
}

// ========== 頁面導航 ==========

function setActivePage(page) {
    currentPage = page;
    
    // 更新菜單激活狀態
    menuItems.forEach(item => {
        if (item.dataset.page === page) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // 加載頁面內容
    loadPage(page);
}

async function loadPage(page) {
    contentArea.innerHTML = '<div class="loading-container"><p><i class="fas fa-spinner fa-spin"></i> 載入中...</p></div>';
    
    try {
        switch(page) {
            case 'dashboard':
                await renderDashboard();
                break;
            case 'members':
                await renderMembers();
                break;
            case 'meetings':
                await renderMeetings();
                break;
            case 'attendance':
                await renderAttendance();
                break;
            case 'stats':
                await renderStats();
                break;
            case 'settings':
                await renderSettings();
                break;
            default:
                contentArea.innerHTML = '<div class="welcome-message"><h2>頁面未找到</h2></div>';
        }
    } catch (error) {
        console.error(`Error loading page ${page}:`, error);
        contentArea.innerHTML = `
            <div class="error-message">
                <h3>載入頁面時出錯</h3>
                <p>${error.message}</p>
                <button onclick="loadPage('${page}')" class="btn-secondary">重試</button>
            </div>
        `;
    }
}

// ========== API 輔助函數 ==========

async function apiFetch(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
    }
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    if (response.status === 401) {
        // 令牌無效，強制登出
        handleLogout();
        throw new Error('登入已過期，請重新登入');
    }
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '未知錯誤' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
}

// ========== 儀表板頁面 ==========

async function renderDashboard() {
    const template = document.getElementById('dashboardTemplate');
    contentArea.innerHTML = template.innerHTML;
    
    try {
        // 獲取統計數據
        const stats = await apiFetch('/api/stats/overview');
        
        // 更新統計卡片
        document.getElementById('totalMembers').textContent = stats.totalMembers?.count || 0;
        document.getElementById('activeMembers').textContent = stats.activeMembers?.count || 0;
        document.getElementById('totalMeetings').textContent = stats.totalMeetings?.count || 0;
        
        // 計算出席率
        const attendanceStats = stats.attendanceByStatus || {};
        const totalRecords = Object.values(attendanceStats).reduce((sum, item) => sum + (item.count || 0), 0);
        const presentRecords = attendanceStats.present?.count || 0;
        const attendanceRate = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;
        document.getElementById('attendanceRate').textContent = `${attendanceRate}%`;
        
        // 渲染圖表
        renderAttendanceChart(stats.attendanceByStatus);
        renderTrendChart(stats.recentAttendance);
        
        // 顯示最近集會
        await renderRecentMeetings();
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        document.getElementById('recentMeetings').innerHTML = `<p class="error">載入數據失敗: ${error.message}</p>`;
    }
}

function renderAttendanceChart(attendanceData) {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    
    const labels = ['出席', '缺席', '請假', '制服不整'];
    const data = [
        attendanceData?.present?.count || 0,
        attendanceData?.absent?.count || 0,
        attendanceData?.leave?.count || 0,
        attendanceData?.uniform_issue?.count || 0
    ];
    
    const colors = ['#10B981', '#DC2626', '#F59E0B', '#8B5CF6'];
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#FFFFFF'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? Math.round((context.raw / total) * 100) : 0;
                            return `${context.label}: ${context.raw} 次 (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderTrendChart(recentData) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    if (!recentData || !Array.isArray(recentData)) {
        // 如果沒有數據，顯示空圖表
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            }
        });
        return;
    }
    
    const labels = recentData.map(item => item.date?.split('-').slice(1).join('/') || '');
    const presentData = recentData.map(item => item.present || 0);
    const absentData = recentData.map(item => item.absent || 0);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.reverse(),
            datasets: [
                {
                    label: '出席',
                    data: presentData.reverse(),
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: '缺席',
                    data: absentData.reverse(),
                    borderColor: '#DC2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '人數'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '日期'
                    }
                }
            }
        }
    });
}

async function renderRecentMeetings() {
    try {
        const meetings = await apiFetch('/api/meetings');
        const container = document.getElementById('recentMeetings');
        
        if (!meetings || meetings.length === 0) {
            container.innerHTML = '<p class="empty-state">暫無集會記錄</p>';
            return;
        }
        
        const recent = meetings.slice(0, 5);
        let html = '<div class="recent-list">';
        
        recent.forEach(meeting => {
            html += `
                <div class="recent-item">
                    <div class="recent-date">${meeting.date}</div>
                    <div class="recent-theme">${meeting.theme || '無主題'}</div>
                    <div class="recent-location">${meeting.location || '未指定'}</div>
                    <button class="btn-small" onclick="setActivePage('attendance'); setTimeout(() => { document.getElementById('meetingSelect').value = '${meeting.id}'; handleMeetingSelect(); }, 100);">
                        記錄出席
                    </button>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading recent meetings:', error);
    }
}

// ========== 成員管理頁面 ==========

async function renderMembers() {
    const template = document.getElementById('membersTemplate');
    contentArea.innerHTML = template.innerHTML;
    
    // 事件監聽
    document.getElementById('addMemberBtn').addEventListener('click', () => showMemberModal());
    document.getElementById('memberSearch').addEventListener('input', filterMembers);
    document.getElementById('patrolFilter').addEventListener('change', filterMembers);
    
    // 加載成員數據
    await loadMembers();
}

async function loadMembers() {
    try {
        membersData = await apiFetch('/api/members');
        renderMembersTable(membersData);
    } catch (error) {
        console.error('Error loading members:', error);
        document.getElementById('membersTableBody').innerHTML = `
            <tr>
                <td colspan="8" class="error">載入失敗: ${error.message}</td>
            </tr>
        `;
    }
}

function renderMembersTable(members) {
    const tbody = document.getElementById('membersTableBody');
    
    if (!members || members.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>暫無成員記錄，請添加成員</p>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    members.forEach(member => {
        html += `
            <tr>
                <td>${member.member_number || 'N/A'}</td>
                <td>${member.chinese_name}</td>
                <td>${member.english_name || 'N/A'}</td>
                <td><span class="patrol-badge">${member.patrol || '未分配'}</span></td>
                <td>${member.rank || 'N/A'}</td>
                <td>${member.join_date || 'N/A'}</td>
                <td>
                    <span class="status-badge ${member.status === 'active' ? 'present' : 'absent'}"></span>
                    ${member.status === 'active' ? '活躍' : '非活躍'}
                </td>
                <td>
                    <button class="btn-small" onclick="editMember(${member.id})">
                        <i class="fas fa-edit"></i> 編輯
                    </button>
                    <button class="btn-small btn-danger" onclick="deleteMember(${member.id})">
                        <i class="fas fa-trash"></i> 刪除
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function filterMembers() {
    const searchTerm = document.getElementById('memberSearch').value.toLowerCase();
    const patrolFilter = document.getElementById('patrolFilter').value;
    
    const filtered = membersData.filter(member => {
        const matchesSearch = !searchTerm || 
            member.chinese_name?.toLowerCase().includes(searchTerm) ||
            member.english_name?.toLowerCase().includes(searchTerm) ||
            member.member_number?.toLowerCase().includes(searchTerm);
        
        const matchesPatrol = !patrolFilter || member.patrol === patrolFilter;
        
        return matchesSearch && matchesPatrol;
    });
    
    renderMembersTable(filtered);
}

function showMemberModal(member = null) {
    const isEdit = member !== null;
    const template = document.getElementById('memberModalTemplate');
    
    // 創建模態對話框
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = template.innerHTML;
    document.body.appendChild(modal);
    
    // 設置表單值
    if (isEdit) {
        document.getElementById('memberModalTitle').textContent = '編輯成員';
        document.getElementById('modalMemberNumber').value = member.member_number || '';
        document.getElementById('modalChineseName').value = member.chinese_name || '';
        document.getElementById('modalEnglishName').value = member.english_name || '';
        document.getElementById('modalPatrol').value = member.patrol || '';
        document.getElementById('modalRank').value = member.rank || '';
        document.getElementById('modalJoinDate').value = member.join_date || '';
        document.getElementById('modalStatus').value = member.status || 'active';
    } else {
        document.getElementById('memberModalTitle').textContent = '添加成員';
        document.getElementById('modalJoinDate').value = new Date().toISOString().split('T')[0];
    }
    
    // 事件監聽
    const form = document.getElementById('memberForm');
    const cancelBtn = modal.querySelector('.btn-cancel');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const memberData = {
            member_number: document.getElementById('modalMemberNumber').value,
            chinese_name: document.getElementById('modalChineseName').value,
            english_name: document.getElementById('modalEnglishName').value,
            patrol: document.getElementById('modalPatrol').value,
            rank: document.getElementById('modalRank').value,
            join_date: document.getElementById('modalJoinDate').value,
            status: document.getElementById('modalStatus').value
        };
        
        try {
            if (isEdit) {
                await apiFetch(`/api/members/${member.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(memberData)
                });
            } else {
                await apiFetch('/api/members', {
                    method: 'POST',
                    body: JSON.stringify(memberData)
                });
            }
            
            modal.remove();
            await loadMembers(); // 重新加載列表
            
        } catch (error) {
            alert('保存失敗: ' + error.message);
        }
    });
    
    cancelBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

async function editMember(id) {
    try {
        const member = membersData.find(m => m.id === id);
        if (member) {
            showMemberModal(member);
        }
    } catch (error) {
        console.error('Error editing member:', error);
    }
}

async function deleteMember(id) {
    if (!confirm('確定要刪除此成員嗎？此操作無法復原。')) {
        return;
    }
    
    try {
        await apiFetch(`/api/members/${id}`, {
            method: 'DELETE'
        });
        await loadMembers();
    } catch (error) {
        alert('刪除失敗: ' + error.message);
    }
}

// ========== 集會管理頁面 ==========

async function renderMeetings() {
    const template = document.getElementById('meetingsTemplate');
    contentArea.innerHTML = template.innerHTML;
    
    document.getElementById('addMeetingBtn').addEventListener('click', () => showMeetingModal());
    
    await loadMeetings();
}

async function loadMeetings() {
    try {
        meetingsData = await apiFetch('/api/meetings');
        renderMeetingsTable(meetingsData);
    } catch (error) {
        console.error('Error loading meetings:', error);
        document.getElementById('meetingsTableBody').innerHTML = `
            <tr>
                <td colspan="6" class="error">載入失敗: ${error.message}</td>
            </tr>
        `;
    }
}

function renderMeetingsTable(meetings) {
    const tbody = document.getElementById('meetingsTableBody');
    
    if (!meetings || meetings.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>暫無集會記錄，請新增集會</p>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    meetings.forEach(meeting => {
        html += `
            <tr>
                <td>${meeting.date}</td>
                <td>${meeting.theme || '無主題'}</td>
                <td>${meeting.location || '未指定'}</td>
                <td class="notes-cell">${meeting.notes || '無備註'}</td>
                <td>
                    <button class="btn-small" onclick="setActivePage('attendance'); setTimeout(() => { document.getElementById('meetingSelect').value = '${meeting.id}'; handleMeetingSelect(); }, 100);">
                        <i class="fas fa-clipboard-check"></i> 記錄出席
                    </button>
                </td>
                <td>
                    <button class="btn-small" onclick="editMeeting(${meeting.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-small btn-danger" onclick="deleteMeeting(${meeting.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function showMeetingModal(meeting = null) {
    // 類似成員模態對話框的實現
    // 由於時間關係，此處省略詳細實現
    alert('新增集會功能待實現');
}

// ========== 出席記錄頁面 ==========

async function renderAttendance() {
    const template = document.getElementById('attendanceTemplate');
    contentArea.innerHTML = template.innerHTML;
    
    // 加載集會下拉選單
    await loadMeetingSelect();
    
    // 事件監聽
    document.getElementById('meetingSelect').addEventListener('change', handleMeetingSelect);
    document.getElementById('saveAttendanceBtn').addEventListener('click', saveAttendance);
}

async function loadMeetingSelect() {
    try {
        const meetings = await apiFetch('/api/meetings');
        const select = document.getElementById('meetingSelect');
        
        // 清空現有選項（保留第一個選項）
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // 添加集會選項
        meetings.forEach(meeting => {
            const option = document.createElement('option');
            option.value = meeting.id;
            option.textContent = `${meeting.date} - ${meeting.theme || '集會'}`;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading meetings for select:', error);
    }
}

async function handleMeetingSelect() {
    const meetingId = document.getElementById('meetingSelect').value;
    const controls = document.getElementById('attendanceControls');
    const noMeeting = document.getElementById('noMeetingSelected');
    const saveBtn = document.getElementById('saveAttendanceBtn');
    
    if (!meetingId) {
        controls.classList.add('hidden');
        noMeeting.classList.remove('hidden');
        saveBtn.disabled = true;
        return;
    }
    
    controls.classList.remove('hidden');
    noMeeting.classList.add('hidden');
    saveBtn.disabled = false;
    
    // 加載成員和現有出席記錄
    await loadAttendanceRecords(meetingId);
}

async function loadAttendanceRecords(meetingId) {
    try {
        // 獲取所有成員
        const members = await apiFetch('/api/members');
        
        // 獲取現有出席記錄
        let existingRecords = [];
        try {
            existingRecords = await apiFetch(`/api/meetings/${meetingId}/attendance`);
        } catch (error) {
            // 如果沒有記錄，這是正常的
        }
        
        // 創建記錄映射
        const recordMap = {};
        existingRecords.forEach(record => {
            recordMap[record.member_id] = record;
        });
        
        // 渲染表格
        const tbody = document.getElementById('attendanceTableBody');
        let html = '';
        
        members.forEach(member => {
            const record = recordMap[member.id];
            html += `
                <tr>
                    <td>
                        <strong>${member.chinese_name}</strong>
                        ${member.english_name ? `<br><small>${member.english_name}</small>` : ''}
                    </td>
                    <td>${member.patrol || '未分配'}</td>
                    <td>
                        <select class="status-select" data-member-id="${member.id}">
                            <option value="present" ${record?.status === 'present' ? 'selected' : ''}>出席</option>
                            <option value="absent" ${record?.status === 'absent' ? 'selected' : ''}>缺席</option>
                            <option value="leave" ${record?.status === 'leave' ? 'selected' : ''}>請假</option>
                            <option value="uniform_issue" ${record?.status === 'uniform_issue' ? 'selected' : ''}>制服不整</option>
                        </select>
                    </td>
                    <td>
                        <input type="text" class="notes-input" data-member-id="${member.id}" 
                               value="${record?.notes || ''}" placeholder="備註">
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading attendance records:', error);
        document.getElementById('attendanceTableBody').innerHTML = `
            <tr>
                <td colspan="4" class="error">載入失敗: ${error.message}</td>
            </tr>
        `;
    }
}

async function saveAttendance() {
    const meetingId = document.getElementById('meetingSelect').value;
    const statusSelects = document.querySelectorAll('.status-select');
    const notesInputs = document.querySelectorAll('.notes-input');
    
    const records = [];
    statusSelects.forEach(select => {
        const memberId = select.dataset.memberId;
        const notesInput = document.querySelector(`.notes-input[data-member-id="${memberId}"]`);
        
        records.push({
            member_id: parseInt(memberId),
            status: select.value,
            notes: notesInput?.value || ''
        });
    });
    
    try {
        await apiFetch(`/api/meetings/${meetingId}/attendance`, {
            method: 'POST',
            body: JSON.stringify({ records })
        });
        
        alert('出席記錄已保存！');
        
    } catch (error) {
        alert('保存失敗: ' + error.message);
    }
}

// ========== 統計頁面 ==========

async function renderStats() {
    const template = document.getElementById('statsTemplate');
    contentArea.innerHTML = template.innerHTML;
    
    document.getElementById('refreshStats').addEventListener('click', loadStats);
    
    await loadStats();
}

async function loadStats() {
    try {
        // 加載統計數據
        // 由於時間關係，此處省略詳細圖表實現
        document.getElementById('topMembersList').innerHTML = '<p>統計功能開發中...</p>';
        document.getElementById('lowAttendanceList').innerHTML = '<p>統計功能開發中...</p>';
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ========== 系統設置頁面 ==========

async function renderSettings() {
    const template = document.getElementById('settingsTemplate');
    contentArea.innerHTML = template.innerHTML;
    
    // 更改密碼表單
    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (newPassword !== confirmPassword) {
            alert('新密碼與確認密碼不一致！');
            return;
        }
        
        try {
            await apiFetch('/api/admin/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword })
            });
            
            alert('密碼更改成功！');
            document.getElementById('changePasswordForm').reset();
            
        } catch (error) {
            alert('更改密碼失敗: ' + error.message);
        }
    });
}

// ========== 全局函數（用於HTML事件）==========

// 使函數在全局可訪問
window.setActivePage = setActivePage;
window.editMember = editMember;
window.deleteMember = deleteMember;
window.handleMeetingSelect = handleMeetingSelect;