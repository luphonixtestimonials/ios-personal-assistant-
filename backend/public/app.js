/**
 * Luphonix — Progressive Web Application
 * Complete Client State, Offline Storage, Cloud Sync, and Audio Engine
 */

(function () {
  'use strict';

  // --- Initial State & Storage Keys ---
  const STORAGE_KEY_TASKS = 'luphonix_tasks_v1';
  const STORAGE_KEY_WATER = 'luphonix_water_logs_v1';
  const STORAGE_KEY_REMINDERS = 'luphonix_reminders_v1';
  const STORAGE_KEY_PREFS = 'luphonix_preferences_v1';
  const STORAGE_KEY_API_KEY = 'luphonix_api_key_v1';
  const STORAGE_KEY_AUTH_TOKEN = 'luphonix_auth_token_v1';
  const STORAGE_KEY_AUTH_USER = 'luphonix_auth_user_v1';
  const STORAGE_KEY_FRIENDS = 'luphonix_friends_v1';

  // Default sample friends
  const DEFAULT_FRIENDS = [
    { id: 'usr_alex', username: 'alex', name: 'Alex Rivera' },
    { id: 'usr_keval', username: 'keval', name: 'Keval Patel' },
    { id: 'usr_sarah', username: 'sarah', name: 'Sarah Chen' }
  ];

  // Default sample data for instant wow effect matching mockup
  const DEFAULT_TASKS = [
    { id: '1', title: 'Luphonix or...', category: 'work', priority: 'medium', is_completed: true, created_at: new Date().toISOString() },
    { id: '2', title: 'Make Keval wish per', category: 'work', priority: 'medium', is_completed: false, created_at: new Date().toISOString() },
    { id: '3', title: 'Complete project UI', category: 'work', priority: 'high', is_completed: false, created_at: new Date().toISOString() },
    { id: '4', title: 'Read 10 pages', category: 'personal', priority: 'low', is_completed: false, created_at: new Date().toISOString() },
    { id: '5', title: 'Gym Exercise', category: 'health', priority: 'medium', is_completed: false, created_at: new Date().toISOString() },
    { id: '6', title: 'Plan tomorrow', category: 'personal', priority: 'low', is_completed: false, created_at: new Date().toISOString() }
  ];
  const SAMPLE_TASK_IDS = new Set(['1', '2', '3', '4', '5', '6']);

  const DEFAULT_WATER = [
    { id: 'w1', amount_ml: 250, timestamp: new Date(Date.now() - 4 * 3600000).toISOString() },
    { id: 'w2', amount_ml: 500, timestamp: new Date(Date.now() - 2 * 3600000).toISOString() }
  ];

  const DEFAULT_REMINDERS = [
    { id: 'r1', title: 'Hydration Check-in', time: '14:00', recurrence: 'daily', is_enabled: true },
    { id: 'r2', title: 'Plan Tomorrow Priorities', time: '20:30', recurrence: 'daily', is_enabled: true },
    { id: 'r3', title: 'Take Medicine', time: '09:00', recurrence: 'health', is_enabled: false },
    { id: 'r4', title: 'Study Session', time: '18:00', recurrence: 'study', is_enabled: true }
  ];

  const DEFAULT_PREFS = {
    dailyWaterGoal: 2000,
    backendUrl: (window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file:') && !window.location.origin.includes(':5500')) ? window.location.origin : 'https://luphonix-web.vercel.app',
    audioEnabled: true,
    activeStreak: 3
  };

  function getBackendBaseUrl() {
    let url = state.prefs && state.prefs.backendUrl ? state.prefs.backendUrl.trim() : '';
    if (!url || url === 'null' || url.startsWith('file:') || url.includes(':5500') || url.includes(':8080')) {
      url = (window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file:') && !window.location.origin.includes(':5500') && !window.location.origin.includes(':8080'))
        ? window.location.origin
        : 'https://luphonix-web.vercel.app';
    }
    return url.replace(/\/$/, '');
  }

  // State object
  const state = {
    tasks: loadStorage(STORAGE_KEY_TASKS, DEFAULT_TASKS),
    waterLogs: loadStorage(STORAGE_KEY_WATER, DEFAULT_WATER),
    reminders: loadStorage(STORAGE_KEY_REMINDERS, DEFAULT_REMINDERS),
    prefs: loadStorage(STORAGE_KEY_PREFS, DEFAULT_PREFS),
    token: loadStorage(STORAGE_KEY_AUTH_TOKEN, null),
    user: loadStorage(STORAGE_KEY_AUTH_USER, null),
    friends: loadStorage(STORAGE_KEY_FRIENDS, DEFAULT_FRIENDS),
    currentFilter: 'all',
    currentRemFilter: 'all',
    currentReqFilter: 'all',
    searchQuery: '',
    activeView: 'dashboard',
    isOnline: navigator.onLine,
    devicePollTimer: null
  };

  function loadStorage(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      if (data === null || data === undefined) return fallback;
      try {
        return JSON.parse(data);
      } catch {
        return data; // Raw string (such as JWT token)
      }
    } catch (e) {
      return fallback;
    }
  }

  function saveStorage(key, data) {
    try {
      if (typeof data === 'string') {
        localStorage.setItem(key, data);
      } else {
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  // --- Web Audio Micro-Synthesizer (Zero asset dependencies!) ---
  let audioCtx = null;
  function playSound(type) {
    if (!state.prefs.audioEnabled) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      if (type === 'water') {
        // High soft water chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'check') {
        // Satisfying task checkmark pop
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'click') {
        // Subtle tap
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch (err) {
      // Audio not permitted or suspended, ignore gracefully
    }
  }

  // --- Toast Notifications ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'success' ? '✅' : type === 'water' ? '💧' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    recordAlert('Luphonix', message, type);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // --- Dynamic Greeting ---
  function updateGreeting() {
    const timeEl = document.getElementById('greeting-time');
    const titleEl = document.getElementById('greeting-title');
    if (!timeEl || !titleEl) return;

    const hour = new Date().getHours();
    let timeText = 'Good Morning';
    if (hour >= 12 && hour < 17) timeText = 'Good Afternoon';
    else if (hour >= 17 && hour < 22) timeText = 'Good Evening';
    else if (hour >= 22 || hour < 5) timeText = 'Good Night';

    const userName = (state.user && state.user.name) ? state.user.name.split(' ')[0] : 'Dhyey';
    const emoji = hour < 12 ? '🌤️' : hour < 18 ? '☀️' : '🌙';
    timeEl.innerHTML = `${timeText}, <span class="greeting-emoji">${emoji}</span>`;
    titleEl.textContent = userName;

    const dateEl = document.getElementById('hero-date');
    if (dateEl) {
      const now = new Date();
      const mon = now.toLocaleDateString('en-US', { month: 'short' });
      const wk = now.toLocaleDateString('en-US', { weekday: 'short' });
      dateEl.innerHTML = `${mon} ${now.getDate()}<br>${now.getFullYear()}<br>${wk}`;
    }
  }

  // --- Hydration Calculation & Ring Animation ---
  function getTodayWaterTotal() {
    const today = new Date().toDateString();
    return state.waterLogs
      .filter((log) => new Date(log.timestamp).toDateString() === today)
      .reduce((sum, log) => sum + (log.amount_ml || 0), 0);
  }

  function updateHydrationRings() {
    const totalMl = getTodayWaterTotal();
    const goalMl = state.prefs.dailyWaterGoal || 2000;
    const percent = Math.min(Math.round((totalMl / goalMl) * 100), 100);
    const circumference = 326.726; // 2 * PI * 52
    const offset = circumference - (percent / 100) * circumference;

    // Dashboard Ring Elements
    const dashVal = document.getElementById('dash-water-val');
    const dashGoal = document.getElementById('dash-water-goal');
    const dashPercent = document.getElementById('dash-water-percent');
    const dashProgress = document.getElementById('dash-ring-progress');

    if (dashVal) dashVal.textContent = totalMl.toLocaleString();
    if (dashGoal) dashGoal.textContent = goalMl.toLocaleString();
    if (dashPercent) dashPercent.textContent = `${percent}%`;
    if (dashProgress) dashProgress.style.strokeDashoffset = offset;

    // Hydration Page Elements
    const hydVal = document.getElementById('hyd-water-val');
    const hydGoalDisplay = document.getElementById('hyd-goal-display');
    const hydGoalText = document.getElementById('hyd-water-goal-text');
    const hydPercent = document.getElementById('hyd-water-percent');
    const hydProgress = document.getElementById('hyd-ring-progress');

    if (hydVal) hydVal.textContent = totalMl.toLocaleString();
    if (hydGoalDisplay) hydGoalDisplay.textContent = goalMl.toLocaleString();
    if (hydGoalText) hydGoalText.textContent = goalMl.toLocaleString();
    if (hydPercent) hydPercent.textContent = `${percent}%`;
    if (hydProgress) hydProgress.style.strokeDashoffset = offset;

    renderWeeklyChart();
    renderDrinkHistory();
  }

  function logWater(amount) {
    playSound('water');
    const newLog = {
      id: 'w_' + Date.now(),
      amount_ml: parseInt(amount, 10),
      timestamp: new Date().toISOString()
    };
    state.waterLogs.unshift(newLog);
    saveStorage(STORAGE_KEY_WATER, state.waterLogs);
    updateHydrationRings();
    showToast(`Logged ${amount} ml of water!`, 'water');

    // Async background cloud sync if backend is active
    syncWaterToCloud(newLog);
  }

  function renderWeeklyChart() {
    const container = document.getElementById('weekly-chart-bars');
    const avgLabel = document.getElementById('hyd-weekly-average');
    if (!container) return;

    container.innerHTML = '';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const dayTotals = [];
    const goal = state.prefs.dailyWaterGoal || 2000;

    // Calculate past 7 days (including today)
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dStr = d.toDateString();
      const total = state.waterLogs
        .filter((l) => new Date(l.timestamp).toDateString() === dStr)
        .reduce((acc, l) => acc + l.amount_ml, 0);

      dayTotals.push({
        dayName: days[d.getDay()],
        total,
        isToday: i === 0
      });
    }

    const weeklySum = dayTotals.reduce((a, b) => a + b.total, 0);
    const avg = Math.round(weeklySum / 7);
    if (avgLabel) avgLabel.textContent = `Avg: ${avg.toLocaleString()} ml`;

    dayTotals.forEach((item) => {
      const heightPercent = Math.min(Math.round((item.total / goal) * 100), 100);
      const isGoalMet = item.total >= goal;

      const group = document.createElement('div');
      group.className = `chart-bar-group ${item.isToday ? 'today' : ''}`;
      group.innerHTML = `
        <div class="chart-bar-track" title="${item.dayName}: ${item.total} ml">
          <div class="chart-bar-fill ${isGoalMet ? 'goal-met' : ''}" style="height: ${Math.max(heightPercent, 6)}%;"></div>
        </div>
        <span class="chart-day-label">${item.dayName}</span>
      `;
      container.appendChild(group);
    });
  }

  function renderDrinkHistory() {
    const list = document.getElementById('water-logs-list');
    if (!list) return;

    const todayStr = new Date().toDateString();
    const todayLogs = state.waterLogs.filter((l) => new Date(l.timestamp).toDateString() === todayStr);

    if (todayLogs.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💧</div>
          <p>No water logged yet today. Tap +250 ml to start!</p>
        </div>
      `;
      return;
    }

    list.innerHTML = todayLogs
      .map((log) => {
        const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
        <div class="task-item">
          <span style="font-size: 20px;">💧</span>
          <div class="task-content">
            <div class="task-title" style="text-decoration: none; color: #FFFFFF;">${log.amount_ml} ml</div>
            <div class="task-meta"><span>${time}</span></div>
          </div>
          <button class="task-delete-btn" data-delete-water="${log.id}" title="Remove entry">✕</button>
        </div>
      `;
      })
      .join('');
  }

  // --- Tasks Engine ---
  function renderTasks() {
    const previewContainer = document.getElementById('dash-tasks-preview');
    const fullContainer = document.getElementById('tasks-full-list');

    const pendingCount = state.tasks.filter((t) => !t.is_completed).length;
    const doneCount = state.tasks.filter((t) => t.is_completed).length;

    const statPending = document.getElementById('stat-tasks-pending');
    const statDone = document.getElementById('stat-tasks-done');
    if (statPending) statPending.textContent = pendingCount;
    if (statDone) statDone.textContent = doneCount;

    // Filter tasks
    let filtered = [...state.tasks];
    if (state.currentFilter === 'completed') {
      filtered = filtered.filter((t) => t.is_completed);
    } else if (state.currentFilter === 'today') {
      filtered = filtered.filter((t) => !t.is_completed);
    } else if (state.currentFilter === 'assigned') {
      filtered = filtered.filter((t) => Boolean(t.assigned_to_user_id || t.assigned_by_user_id || t.assigned_to_username || t.assigned_by_username));
    } else if (state.currentFilter !== 'all') {
      filtered = filtered.filter((t) => t.category.toLowerCase() === state.currentFilter.toLowerCase());
    }

    if (state.searchQuery.trim().length > 0) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter((t) => t.title.toLowerCase().includes(q));
    }

    // Dashboard Preview (Top 3)
    if (previewContainer) {
      const previewTasks = state.tasks.slice(0, 3);
      if (previewTasks.length === 0) {
        previewContainer.innerHTML = `
          <div class="empty-state" style="padding: 20px;">
            <p>All caught up! Add a new task above.</p>
          </div>
        `;
      } else {
        previewContainer.innerHTML = previewTasks.map((t) => renderTaskHTML(t)).join('');
      }
    }

    // Full Tasks View
    if (fullContainer) {
      if (filtered.length === 0) {
        fullContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">✨</div>
            <p>No tasks found. Tap + to add one!</p>
          </div>
        `;
      } else {
        fullContainer.innerHTML = filtered.map((t) => renderTaskHTML(t)).join('');
      }
    }
  }

  function renderTaskHTML(task) {
    const priorityClass = task.priority ? task.priority.toLowerCase() : 'medium';
    const categoryName = task.category ? task.category.toUpperCase() : 'GENERAL';

    // Collaboration Assignment Badges
    let assignmentBadge = '';
    const myUsername = (state.user && state.user.username) ? state.user.username.toLowerCase() : 'dhyey';
    const myUserId = state.user ? state.user.id : 'dhyey';

    if (task.assigned_to_username || task.assigned_to_user_id) {
      const isAssignedToMe = (task.assigned_to_username && task.assigned_to_username.toLowerCase() === myUsername) || 
                             (task.assigned_to_user_id && task.assigned_to_user_id === myUserId);
      const assigner = task.assigned_by_username || 'Friend';
      const assignee = task.assigned_to_username || 'Friend';

      if (isAssignedToMe && task.assigned_by_username && task.assigned_by_username.toLowerCase() !== myUsername) {
        assignmentBadge = `<span class="task-badge assigned-to-me" title="Assigned to you by @${escapeHTML(assigner)}"><i class="fa-solid fa-arrow-down-left"></i> From @${escapeHTML(assigner)}</span>`;
      } else {
        assignmentBadge = `<span class="task-badge assigned-to-other" title="Assigned to @${escapeHTML(assignee)}"><i class="fa-solid fa-arrow-up-right-from-square"></i> To @${escapeHTML(assignee)}</span>`;
      }
    }

    return `
      <div class="task-item ${task.is_completed ? 'completed' : ''}" data-task-id="${task.id}">
        <button class="task-checkbox-btn" data-toggle-task="${task.id}" aria-label="Toggle task">
          <span class="task-checkbox-check"><i class="fa-solid fa-check" style="font-size: 11px;"></i></span>
        </button>
        <div class="task-content">
          <div class="task-title">${escapeHTML(task.title)}</div>
          <div class="task-meta">
            <span class="priority-tag ${priorityClass}">${priorityClass}</span>
            <span class="category-tag">${categoryName}</span>
            ${assignmentBadge}
          </div>
        </div>
        <button class="task-delete-btn" data-delete-task="${task.id}" title="Task menu / delete"><i class="fa-solid fa-ellipsis-vertical" style="font-size: 14px;"></i></button>
      </div>
    `;
  }

  function toggleTask(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    task.is_completed = !task.is_completed;
    playSound('check');
    saveStorage(STORAGE_KEY_TASKS, state.tasks);
    renderTasks();
    showToast(task.is_completed ? 'Task completed! 🎉' : 'Task marked pending', 'success');

    syncTaskToggleToCloud(task);
  }

  async function deleteTaskFromCloud(id) {
    if (SAMPLE_TASK_IDS.has(id)) return;
    const base = getBackendBaseUrl();
    try {
      let key = await ensureApiKey();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      let res = await fetch(`${base}/api/tasks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timer);

      if (res && res.status === 401) {
        key = await ensureApiKey(true);
        await fetch(`${base}/api/tasks/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Accept': 'application/json'
          }
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Offline delete fallback:', e);
    }
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    saveStorage(STORAGE_KEY_TASKS, state.tasks);
    renderTasks();
    showToast('Task removed', 'info');

    deleteTaskFromCloud(id);
  }

  function addTask(title, category, priority, assignedToUserId, assignedToUsername) {
    const myUsername = (state.user && state.user.username) ? state.user.username : 'dhyey';
    const myUserId = (state.user && state.user.id) ? state.user.id : 'dhyey';

    const newTask = {
      id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 't_' + Date.now(),
      title: title.trim(),
      category: category || 'work',
      priority: priority || 'medium',
      is_completed: false,
      assigned_to_user_id: assignedToUserId || null,
      assigned_to_username: assignedToUsername || null,
      assigned_by_user_id: myUserId,
      assigned_by_username: myUsername,
      due_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      _needsCloudSync: true
    };
    state.tasks.unshift(newTask);
    saveStorage(STORAGE_KEY_TASKS, state.tasks);
    renderTasks();
    if (assignedToUsername) {
      showToast(`Task assigned to @${assignedToUsername}! 🤝`, 'success');
    } else {
      showToast('New task added!', 'success');
    }

    syncTaskToCloud(newTask);
  }

  // --- Reminders Engine ---
  function renderReminders() {
    const container = document.getElementById('reminders-full-list');
    if (!container) return;

    let filtered = [...state.reminders];
    if (state.currentRemFilter === 'today') {
      filtered = filtered.filter((r) => r.is_enabled);
    } else if (state.currentRemFilter === 'upcoming') {
      filtered = filtered.filter((r) => r.is_enabled);
    } else if (state.currentRemFilter === 'completed') {
      filtered = filtered.filter((r) => !r.is_enabled);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔔</div>
          <p>No reminders found. Tap + to set one!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered
      .map((r) => {
        let icon = '<i class="fa-solid fa-bell"></i>';
        const tLower = r.title.toLowerCase();
        if (tLower.includes('water') || tLower.includes('hydrat')) {
          icon = '<i class="fa-solid fa-droplet" style="color: #00D2FF;"></i>';
        } else if (tLower.includes('medicine') || tLower.includes('pill') || tLower.includes('health')) {
          icon = '<i class="fa-solid fa-capsules" style="color: #F43F5E;"></i>';
        } else if (tLower.includes('study') || tLower.includes('read') || tLower.includes('book')) {
          icon = '<i class="fa-solid fa-book-open" style="color: #38BDF8;"></i>';
        } else if (tLower.includes('priority') || tLower.includes('plan')) {
          icon = '<i class="fa-regular fa-clock" style="color: #F59E0B;"></i>';
        }

        return `
        <div class="reminder-item" data-reminder-id="${r.id}">
          <div class="reminder-icon-box">${icon}</div>
          <div class="task-content">
            <div class="task-title" style="text-decoration: none; color: #FFFFFF;">${escapeHTML(r.title)}</div>
            <div class="task-meta">
              <span class="priority-tag low">${r.time}</span>
              <span class="category-tag">${(r.recurrence || 'DAILY').toUpperCase()}</span>
            </div>
          </div>
          <label class="ios-switch" title="Toggle reminder on/off">
            <input type="checkbox" class="reminder-toggle-switch" data-reminder-id="${r.id}" ${r.is_enabled ? 'checked' : ''}>
            <span class="ios-slider"></span>
          </label>
          <button class="task-delete-btn" data-delete-reminder="${r.id}" title="Delete reminder" style="margin-left: 6px;"><i class="fa-solid fa-xmark" style="font-size: 13px;"></i></button>
        </div>
      `;
      })
      .join('');
  }

  function addReminder(title, time, recurrence) {
    const newReminder = {
      id: 'r_' + Date.now(),
      title: title.trim(),
      time,
      recurrence,
      is_enabled: true
    };
    state.reminders.push(newReminder);
    saveStorage(STORAGE_KEY_REMINDERS, state.reminders);
    renderReminders();
    showToast('Reminder scheduled!', 'success');
  }

  // --- Cloud Sync Helpers ---
  async function testBackendPing() {
    const urlInput = document.getElementById('setting-backend-url');
    const resultEl = document.getElementById('backend-ping-result');
    if (!resultEl) return;

    const base = urlInput ? urlInput.value.trim() : state.prefs.backendUrl;
    resultEl.textContent = 'Pinging backend...';
    resultEl.style.color = '#FBBF24';

    const start = performance.now();
    try {
      const res = await fetch(`${base}/health`, { method: 'GET', cache: 'no-store' });
      const latency = Math.round(performance.now() - start);

      if (res.ok) {
        const json = await res.json();
        resultEl.textContent = `✅ Connected to ${json.service || 'Luphonix API'} (${latency} ms)`;
        resultEl.style.color = '#34D399';
        updateConnectionStatus(true);
      } else {
        resultEl.textContent = `⚠️ Server returned HTTP ${res.status}`;
        resultEl.style.color = '#F87171';
      }
    } catch (err) {
      resultEl.textContent = `❌ Could not reach server (${err.message})`;
      resultEl.style.color = '#F87171';
      updateConnectionStatus(false);
    }
  }

  function updateConnectionStatus(connected) {
    const pill = document.getElementById('connection-pill');
    const text = document.getElementById('connection-text');
    if (!pill || !text) return;

    if (connected) {
      pill.classList.remove('offline');
      text.textContent = 'Cloud Active';
    } else {
      pill.classList.add('offline');
      text.textContent = 'Local Mode';
    }
  }

  let currentApiKey = localStorage.getItem(STORAGE_KEY_API_KEY) || '';

  function updateApiKeyUI(key) {
    const input = document.getElementById('setting-webhook-api-key');
    if (input) {
      input.value = key;
    }
  }

  async function ensureApiKey(forceRefresh = false) {
    const base = getBackendBaseUrl();
    if (state.token) {
      updateApiKeyUI(state.token);
      return state.token;
    }
    if (!forceRefresh && currentApiKey && currentApiKey !== 'luphonix-siri-master-key') {
      updateApiKeyUI(currentApiKey);
      return currentApiKey;
    }

    try {
      const res = await fetch(`${base}/api/auth/webhook-key`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.apiKey) {
          currentApiKey = data.apiKey;
          localStorage.setItem(STORAGE_KEY_API_KEY, currentApiKey);
          updateApiKeyUI(currentApiKey);
          return currentApiKey;
        }
      }
    } catch (e) {
      console.warn('Could not fetch webhook key from cloud:', e);
    }

    if (!currentApiKey) {
      currentApiKey = 'luphonix-siri-master-key';
      localStorage.setItem(STORAGE_KEY_API_KEY, currentApiKey);
    }
    updateApiKeyUI(currentApiKey);
    return currentApiKey;
  }

  async function syncWaterToCloud(log) {
    const base = getBackendBaseUrl();
    try {
      let key = await ensureApiKey();
      let res = await fetch(`${base}/api/hydration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({ amount_ml: log.amount_ml, logged_at: log.timestamp })
      });
      if (res.status === 401) {
        key = await ensureApiKey(true);
        await fetch(`${base}/api/hydration`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({ amount_ml: log.amount_ml, logged_at: log.timestamp })
        });
      }
    } catch (e) {
      // Offline fallback silent catch
    }
  }

  async function syncTaskToggleToCloud(task) {
    if (SAMPLE_TASK_IDS.has(task.id)) return;
    const base = getBackendBaseUrl();
    try {
      const key = await ensureApiKey();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      // Fast toggle via GET /api/tasks/toggle?id=... (works unconditionally without body hang)
      const res = await fetch(`${base}/api/tasks/toggle?id=${encodeURIComponent(task.id)}&apiKey=${encodeURIComponent(key)}`, {
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timer);

      if (!res || !res.ok) {
        // Fallback to query param on PATCH
        await fetch(`${base}/api/tasks/${encodeURIComponent(task.id)}?is_completed=${task.is_completed}&apiKey=${encodeURIComponent(key)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({ is_completed: Boolean(task.is_completed) })
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Task toggle sync fallback:', e);
    }
  }

  async function syncTaskToCloud(task) {
    if (SAMPLE_TASK_IDS.has(task.id)) return;
    const base = getBackendBaseUrl();
    try {
      let key = await ensureApiKey();

      // Upsert using POST /api/tasks preserving task.id so no duplicates are created
      const payload = {
        id: task.id,
        title: task.title,
        category: task.category || 'work',
        priority: task.priority || 'medium',
        is_completed: Boolean(task.is_completed),
        assigned_to_user_id: task.assigned_to_user_id || undefined,
        assigned_to_username: task.assigned_to_username || undefined,
        due_at: task.due_at || new Date().toISOString()
      };

      const res = await fetch(`${base}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(payload)
      }).catch(() => null);

      if (res && res.ok) {
        task._needsCloudSync = false;
        task._isSynced = true;
        saveStorage(STORAGE_KEY_TASKS, state.tasks);
      }
    } catch (e) {
      console.warn('Offline task fallback:', e);
    }
  }

  async function syncAllWithCloud(showToastFeedback = false) {
    const base = getBackendBaseUrl();
    try {
      let key = await ensureApiKey();

      // 1. Pull cloud tasks down FIRST so UI immediately reflects cloud state
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      let res = await fetch(`${base}/api/tasks?filter=all`, {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      }).catch(e => {
        console.warn('Cloud tasks fetch network error:', e);
        return null;
      });
      clearTimeout(timeoutId);

      if (res && res.status === 401) {
        key = await ensureApiKey(true);
        res = await fetch(`${base}/api/tasks?filter=all`, {
          headers: {
            'Authorization': `Bearer ${key}`,
            'Accept': 'application/json'
          }
        }).catch(() => null);
      }

      if (res && res.ok) {
        const body = await res.json().catch(() => null);
        if (body && Array.isArray(body.data)) {
          const cloudTasks = body.data.map(t => ({
            ...t,
            is_completed: Boolean(t.is_completed),
            _isSynced: true,
            _needsCloudSync: false
          }));

          // When cloud returns real data, dismiss sample placeholder tasks!
          // Only keep genuine local tasks (created offline) that are marked as needing cloud push
          const cloudIds = new Set(cloudTasks.map(t => t.id));
          const unsyncedLocal = (state.tasks || []).filter(
            t => !SAMPLE_TASK_IDS.has(t.id) && !cloudIds.has(t.id) && t._needsCloudSync === true
          );

          state.tasks = [...cloudTasks, ...unsyncedLocal];
          saveStorage(STORAGE_KEY_TASKS, state.tasks);
          renderTasks();
          updateConnectionStatus(true);
          if (showToastFeedback) {
            showToast(`Synced ${state.tasks.length} tasks with Siri Cloud! ☁️`, 'success');
          }
        }
      }

      // 2. ONLY push genuinely un-synced offline tasks - NEVER re-push tasks fetched from the server!
      const pendingPush = (state.tasks || []).filter(
        t => !SAMPLE_TASK_IDS.has(t.id) && t._needsCloudSync === true
      );
      for (const t of pendingPush) {
        syncTaskToCloud(t).catch(() => {});
      }

      // 3. Fetch friends list
      fetchFriendsFromCloud().catch(() => {});
    } catch (e) {
      console.warn('Cloud sync error:', e);
    }
  }

  // --- Authentication Engine (Sign In & Sign Up) ---
  function updateAuthUI() {
    const userAuthPill = document.getElementById('user-auth-pill');
    const nameSpan = document.getElementById('user-display-name');
    const avatarIcon = document.getElementById('user-avatar-icon');
    const accountName = document.getElementById('account-name-val');
    const accountEmail = document.getElementById('account-email-val');
    const accountId = document.getElementById('account-id-val');
    const accountAvatarChar = document.getElementById('account-avatar-char');
    const myHandleEl = document.getElementById('my-unique-handle');
    const accountHandleEl = document.getElementById('account-handle-val');
    const username = (state.user && state.user.username) ? state.user.username : 'dhyey';

    if (myHandleEl) myHandleEl.textContent = `@${username}`;
    if (accountHandleEl) accountHandleEl.textContent = `@${username}`;

    if (state.user && state.token) {
      if (userAuthPill) userAuthPill.classList.add('logged-in');
      const initial = (state.user.name || state.user.email || 'U').charAt(0).toUpperCase();
      if (nameSpan) nameSpan.textContent = state.user.name ? state.user.name.split(' ')[0] : 'Account';
      if (avatarIcon) avatarIcon.textContent = initial;
      if (accountName) accountName.textContent = state.user.name || 'Luphonix User';
      if (accountEmail) accountEmail.textContent = state.user.email || '';
      if (accountId) accountId.textContent = state.user.id || '';
      if (accountAvatarChar) accountAvatarChar.textContent = initial;
    } else {
      if (userAuthPill) userAuthPill.classList.remove('logged-in');
      if (nameSpan) nameSpan.textContent = 'Sign In';
      if (avatarIcon) avatarIcon.textContent = '👤';
      if (accountName) accountName.textContent = 'Guest / Siri Default';
      if (accountEmail) accountEmail.textContent = 'user@luphonix.local';
      if (accountId) accountId.textContent = 'user_siri_default';
      if (accountAvatarChar) accountAvatarChar.textContent = 'G';
    }
  }

  async function loginUser(email, password) {
    const base = getBackendBaseUrl();
    const errorDiv = document.getElementById('auth-error-msg');
    const errorText = document.getElementById('auth-error-text');
    const submitBtn = document.getElementById('btn-submit-login');
    const btnText = submitBtn?.querySelector('.btn-text');
    const btnSpinner = submitBtn?.querySelector('.btn-spinner');

    if (errorDiv) errorDiv.style.display = 'none';
    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = 'Signing in...';
    else if (submitBtn) submitBtn.textContent = 'Signing in...';
    if (btnSpinner) btnSpinner.classList.remove('hidden');

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutTimer);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid email or password. Please try again.');
      }

      state.token = data.data.token;
      state.user = data.data.user;
      saveStorage(STORAGE_KEY_AUTH_TOKEN, state.token);
      saveStorage(STORAGE_KEY_AUTH_USER, state.user);
      updateAuthUI();
      closeAllModals();
      showToast(`Welcome back, ${state.user.name || 'User'}! 🎉`, 'success');

      // Refresh cloud data for logged-in user
      syncAllWithCloud(true);
    } catch (err) {
      clearTimeout(timeoutTimer);
      const msg = err.name === 'AbortError' ? 'Server timed out. Please try again.' : (err.message || 'Login failed.');
      if (errorText) errorText.textContent = msg;
      else if (errorDiv) errorDiv.textContent = msg;
      if (errorDiv) errorDiv.style.display = 'flex';
      showToast(msg, 'error');
    } finally {
      clearTimeout(timeoutTimer);
      if (submitBtn) submitBtn.disabled = false;
      if (btnText) btnText.textContent = 'Sign In to Luphonix';
      else if (submitBtn) submitBtn.textContent = 'Sign In to Luphonix';
      if (btnSpinner) btnSpinner.classList.add('hidden');
    }
  }

  async function registerUser(name, email, password, username) {
    const base = getBackendBaseUrl();
    const errorDiv = document.getElementById('auth-error-msg');
    const errorText = document.getElementById('auth-error-text');
    const submitBtn = document.getElementById('btn-submit-signup');
    const btnText = submitBtn?.querySelector('.btn-text');
    const btnSpinner = submitBtn?.querySelector('.btn-spinner');

    if (errorDiv) errorDiv.style.display = 'none';
    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = 'Creating account...';
    else if (submitBtn) submitBtn.textContent = 'Creating account...';
    if (btnSpinner) btnSpinner.classList.remove('hidden');

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 15000);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const res = await fetch(`${base}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, username: username || undefined, timezone }),
        signal: controller.signal,
      });
      clearTimeout(timeoutTimer);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || (data.details ? data.details[0].message : 'Registration failed.'));
      }

      state.token = data.data.token;
      state.user = data.data.user;
      saveStorage(STORAGE_KEY_AUTH_TOKEN, state.token);
      saveStorage(STORAGE_KEY_AUTH_USER, state.user);
      updateAuthUI();
      closeAllModals();
      showToast(`Account created! Welcome, ${state.user.name}! 🚀`, 'success');

      // Refresh cloud data
      syncAllWithCloud(true);
    } catch (err) {
      clearTimeout(timeoutTimer);
      const msg = err.name === 'AbortError' ? 'Server timed out. Please try again.' : (err.message || 'Registration failed.');
      if (errorText) errorText.textContent = msg;
      else if (errorDiv) errorDiv.textContent = msg;
      if (errorDiv) errorDiv.style.display = 'flex';
      showToast(msg, 'error');
    } finally {
      clearTimeout(timeoutTimer);
      if (submitBtn) submitBtn.disabled = false;
      if (btnText) btnText.textContent = 'Create My Account';
      else if (submitBtn) submitBtn.textContent = 'Create My Account';
      if (btnSpinner) btnSpinner.classList.add('hidden');
    }
  }

  function logoutUser() {
    state.token = null;
    state.user = null;
    localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEY_AUTH_USER);
    updateAuthUI();
    closeAllModals();
    showToast('Signed out of Luphonix', 'info');
    ensureApiKey(true);
    syncAllWithCloud();
  }

  // --- Connected Devices & Live Request Feed Engine ---
  async function fetchDevicesAndRequests() {
    const base = getBackendBaseUrl();
    try {
      const [devRes, reqRes] = await Promise.all([
        fetch(`${base}/api/devices`).catch(() => null),
        fetch(`${base}/api/devices/requests?filter=${state.currentReqFilter || 'all'}`).catch(() => null)
      ]);

      if (devRes && devRes.ok) {
        const devData = await devRes.json();
        renderDevices(devData.devices || [], devData.currentDevice);
        const onlineCountEl = document.getElementById('stat-devices-online');
        if (onlineCountEl && devData.stats) {
          onlineCountEl.textContent = devData.stats.onlineCount || 1;
        }
      }

      if (reqRes && reqRes.ok) {
        const reqData = await reqRes.json();
        renderRequests(reqData.requests || [], reqData.stats);
        const totalReqEl = document.getElementById('stat-requests-total');
        if (totalReqEl && reqData.stats) {
          totalReqEl.textContent = reqData.stats.totalLogs || 0;
        }
      }

      const dbTasksEl = document.getElementById('stat-db-tasks-count');
      if (dbTasksEl) {
        dbTasksEl.textContent = state.tasks ? state.tasks.length : '--';
      }
    } catch (e) {
      console.warn('Devices fetch error:', e);
    }
  }

  function renderDevices(devices, currentDevice) {
    const container = document.getElementById('devices-list-container');
    if (!container) return;

    if (!devices || devices.length === 0) {
      const curr = currentDevice || { name: 'Web Browser Client', ip: '127.0.0.1', type: 'desktop' };
      devices = [{
        id: 'curr_dev',
        name: curr.name,
        type: curr.type,
        ip: curr.ip,
        status: 'online',
        lastSeen: new Date().toISOString(),
        requestCount: 1,
        lastEndpoint: 'GET /api/devices'
      }];
    }

    container.innerHTML = devices.map(dev => {
      const isOnline = dev.status === 'online';
      const statusClass = isOnline ? 'device-badge-active' : 'device-badge-idle';
      const statusText = isOnline ? '● Online' : '○ Idle';
      const isCurrent = currentDevice && (dev.ip === currentDevice.ip || dev.name === currentDevice.name);

      let icon = '📱';
      if (dev.type === 'desktop') icon = '💻';
      else if (dev.type === 'siri') icon = '🎙️';
      else if (dev.type === 'terminal') icon = '⚡';

      const timeAgo = formatTimeAgo(dev.lastSeen);

      return `
        <div class="device-card">
          <div class="device-card-header">
            <div style="display: flex; align-items: center;">
              <div class="device-icon-wrap">${icon}</div>
              <div class="device-details">
                <div class="device-title">
                  ${escapeHTML(dev.name)}
                  ${isCurrent ? '<span class="device-badge-current" style="margin-left: 6px;">This Device</span>' : ''}
                </div>
                <div class="device-subtitle">IP: <code>${escapeHTML(dev.ip)}</code></div>
              </div>
            </div>
            <span class="${statusClass}">${statusText}</span>
          </div>
          <div class="device-meta-row">
            <span>Last Activity: <strong>${timeAgo}</strong></span>
            <span>Requests: <strong>${dev.requestCount || 1}</strong></span>
            <span>Endpoint: <code>${escapeHTML(dev.lastEndpoint || 'Active')}</code></span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderRequests(requests, stats) {
    const container = document.getElementById('requests-feed-container');
    if (!container) return;

    if (!requests || requests.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 30px 10px; color: var(--text-sub);">
          <div style="font-size: 24px; margin-bottom: 6px;">📡</div>
          <div>No requests matching this filter yet. Send a request or use Siri!</div>
        </div>
      `;
      return;
    }

    container.innerHTML = requests.map(req => {
      const isOk = req.status >= 200 && req.status < 300;
      const statusClass = isOk ? 'ok' : 'err';
      const isTaskAdd = req.isTaskAdd;

      let paramSummary = '';
      if (req.params && Object.keys(req.params).length > 0) {
        paramSummary = Object.entries(req.params)
          .map(([k, v]) => `${escapeHTML(k)}=<strong style="color: #38BDF8;">${escapeHTML(v)}</strong>`)
          .join('&nbsp; ');
      }

      return `
        <div class="request-row ${isTaskAdd ? 'task-add-row' : ''}">
          <div class="request-row-top">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="method-tag ${req.method}">${req.method}</span>
              <span class="status-tag ${statusClass}">${req.status}</span>
              <span class="action-pill-tag ${isTaskAdd ? 'task-warn' : ''}">${escapeHTML(req.actionTag)}</span>
            </div>
            <span style="font-family: monospace; font-size: 11px; color: var(--text-muted);">${req.timeStr || ''}</span>
          </div>
          <div class="request-path-text">${escapeHTML(req.path)}</div>
          <div class="request-meta-text">
            <span>Client: <strong style="color: #CBD5E1;">${escapeHTML(req.device)}</strong></span>
            <span>IP: <code>${escapeHTML(req.ip)}</code></span>
            ${req.durationMs ? `<span>${req.durationMs}ms</span>` : ''}
            ${paramSummary ? `<span>Params: ${paramSummary}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function formatTimeAgo(isoString) {
    if (!isoString) return 'Just now';
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  }

  async function deduplicateDbTasks() {
    const base = getBackendBaseUrl();
    showToast('Cleaning duplicate tasks in DB...', 'info');
    try {
      const res = await fetch(`${base}/api/devices/deduplicate-tasks`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        syncAllWithCloud(true);
        fetchDevicesAndRequests();
      } else {
        showToast(data.error || 'Deduplication failed', 'error');
      }
    } catch (e) {
      showToast('Could not reach backend for cleanup', 'error');
    }
  }

  async function clearRequestLogs() {
    const base = getBackendBaseUrl();
    try {
      await fetch(`${base}/api/devices/requests`, { method: 'DELETE' });
      showToast('Request logs cleared', 'info');
      fetchDevicesAndRequests();
    } catch (e) {
      showToast('Failed to clear request logs', 'error');
    }
  }

  // --- Siri Shortcuts Copy Helpers ---
  function setupSiriCopyButtons() {
    const waterBtn = document.getElementById('btn-copy-siri-water');
    const tasksBtn = document.getElementById('btn-copy-siri-tasks');
    const completeBtn = document.getElementById('btn-copy-siri-complete');
    const addBtn = document.getElementById('btn-copy-siri-add');
    const assignBtn = document.getElementById('btn-copy-siri-assign');
    const assignedMeBtn = document.getElementById('btn-copy-siri-assigned-me');
    const hydrationTodayBtn = document.getElementById('btn-copy-siri-hydration-today');
    const quickReminderBtn = document.getElementById('btn-copy-siri-quick-reminder');
    const copyTokenBtn = document.getElementById('btn-copy-token');
    const refreshBtn = document.getElementById('btn-regenerate-token');

    const base = state.prefs.backendUrl || window.location.origin;

    const copyUrlWithFeedback = async (url, successMsg) => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          showToast(successMsg, 'success');
        } else {
          prompt('Copy Webhook URL:', url);
        }
      } catch (err) {
        prompt('Copy Webhook URL:', url);
      }
    };

    if (waterBtn) {
      waterBtn.addEventListener('click', async () => {
        const key = await ensureApiKey();
        const url = `${base}/api/hydration?amount=250&format=text&apiKey=${encodeURIComponent(key)}`;
        await copyUrlWithFeedback(url, 'Copied Water Webhook URL (with API key)!');
      });
    }

    if (tasksBtn) {
      tasksBtn.addEventListener('click', async () => {
        const key = await ensureApiKey();
        const url = `${base}/api/tasks?filter=today&format=text&apiKey=${encodeURIComponent(key)}`;
        await copyUrlWithFeedback(url, 'Copied Today\'s Tasks Webhook URL (with API key)!');
      });
    }

    if (completeBtn) {
      completeBtn.addEventListener('click', async () => {
        const key = await ensureApiKey();
        const url = `${base}/api/tasks/complete?task=1&format=text&apiKey=${encodeURIComponent(key)}`;
        await copyUrlWithFeedback(url, 'Copied Complete Task Webhook URL (with API key)!');
      });
    }

    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        const key = await ensureApiKey();
        const url = `${base}/api/tasks/add?title=prepare%20presentation&format=text&apiKey=${encodeURIComponent(key)}`;
        await copyUrlWithFeedback(url, 'Copied Add Task Webhook URL (with API key)!');
      });
    }

    if (assignBtn) {
      assignBtn.addEventListener('click', async () => {
        const key = await ensureApiKey();
        const url = `${base}/api/tasks/assign?task=2&to=Alex&format=text&apiKey=${encodeURIComponent(key)}`;
        await copyUrlWithFeedback(url, 'Copied Assign Task Webhook URL (with API key)!');
      });
    }

    if (assignedMeBtn) {
      assignedMeBtn.addEventListener('click', async () => {
        const key = await ensureApiKey();
        const url = `${base}/api/tasks?filter=assigned_to_me&format=text&apiKey=${encodeURIComponent(key)}`;
        await copyUrlWithFeedback(url, 'Copied Assigned Tasks Webhook URL (with API key)!');
      });
    }

    if (hydrationTodayBtn) {
      hydrationTodayBtn.addEventListener('click', async () => {
        const key = await ensureApiKey();
        const url = `${base}/api/hydration/today?format=text&apiKey=${encodeURIComponent(key)}`;
        await copyUrlWithFeedback(url, 'Copied Hydration Progress Webhook URL (with API key)!');
      });
    }

    if (quickReminderBtn) {
      quickReminderBtn.addEventListener('click', async () => {
        const key = await ensureApiKey();
        const url = `${base}/api/reminders/quick?title=drink%20water&minutes=30&format=text&apiKey=${encodeURIComponent(key)}`;
        await copyUrlWithFeedback(url, 'Copied Quick Reminder Webhook URL (with API key)!');
      });
    }

    if (copyTokenBtn) {
      copyTokenBtn.addEventListener('click', async () => {
        const key = await ensureApiKey();
        await copyUrlWithFeedback(key, 'Copied API Key to clipboard!');
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        showToast('Refreshing API key...', 'info');
        await ensureApiKey(true);
        showToast('API Key refreshed successfully!', 'success');
      });
    }
  }


  // --- Modal Controllers ---
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
      document.body.classList.add('modal-open');
      const input = modal.querySelector('input');
      if (input) setTimeout(() => input.focus(), 150);
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
    if (!document.querySelector('.modal-overlay.active')) {
      document.body.classList.remove('modal-open');
    }
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.remove('active'));
    document.body.classList.remove('modal-open');
  }

  // --- Tab Navigation Controller ---
  function switchView(viewName) {
    playSound('click');
    state.activeView = viewName;
    document.body.dataset.view = viewName;

    // Toggle View Sections
    document.querySelectorAll('.view-section').forEach((sec) => {
      sec.classList.remove('active');
    });
    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) targetSection.classList.add('active');

    // Toggle Nav Icons & Circular Orbit Icons
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.remove('active');
      if (item.dataset.view === (viewName === 'notifications' ? 'reminders' : viewName)) {
        item.classList.add('active');
      }
    });
    document.querySelectorAll('.circular-orbit-item').forEach((item) => {
      item.classList.remove('active');
      if (item.dataset.view === viewName) {
        item.classList.add('active');
      }
    });

    const headerSettingsBtn = document.getElementById('btn-header-settings');
    if (headerSettingsBtn) {
      if (viewName === 'settings') {
        headerSettingsBtn.classList.add('active');
      } else {
        headerSettingsBtn.classList.remove('active');
      }
    }

    if (viewName === 'notifications') renderNotifications();

    if (viewName === 'devices') {
      fetchDevicesAndRequests();
      if (!state.devicePollTimer) {
        state.devicePollTimer = setInterval(fetchDevicesAndRequests, 3000);
      }
    } else {
      if (state.devicePollTimer) {
        clearInterval(state.devicePollTimer);
        state.devicePollTimer = null;
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Friends & Task Collaboration Engine ---
  async function fetchFriendsFromCloud() {
    const base = getBackendBaseUrl();
    try {
      let key = await ensureApiKey();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      let res = await fetch(`${base}/api/friends`, {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timer);

      if (res && res.status === 401) {
        key = await ensureApiKey(true);
        res = await fetch(`${base}/api/friends`, {
          headers: {
            'Authorization': `Bearer ${key}`,
            'Accept': 'application/json'
          }
        }).catch(() => null);
      }

      if (res && res.ok) {
        const body = await res.json().catch(() => null);
        if (body && Array.isArray(body.data)) {
          state.friends = body.data;
          saveStorage(STORAGE_KEY_FRIENDS, state.friends);
          renderFriendsList();
          populateAssignDropdown();
        }
      }
    } catch (e) {
      console.warn('Friends fetch error:', e);
    }
  }

  function renderFriendsList() {
    const container = document.getElementById('friends-list-container');
    const countEl = document.getElementById('friends-count');
    const myHandleEl = document.getElementById('my-unique-handle');
    const myUsername = (state.user && state.user.username) ? state.user.username : 'dhyey';

    if (myHandleEl) {
      myHandleEl.textContent = `@${myUsername}`;
    }
    if (countEl) {
      countEl.textContent = state.friends ? state.friends.length : 0;
    }
    if (!container) return;

    if (!state.friends || state.friends.length === 0) {
      container.innerHTML = `
        <div style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 20px 0;">
          <div style="font-size: 24px; margin-bottom: 6px;">👥</div>
          No friends connected yet.<br>Add a friend above using their unique username to share & assign tasks!
        </div>
      `;
      return;
    }

    container.innerHTML = state.friends.map((f) => {
      const initial = (f.name || f.username || 'F').charAt(0).toUpperCase();
      return `
        <div class="friend-item-card" data-friend-id="${f.id}">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, rgba(0, 210, 255, 0.2), rgba(59, 130, 246, 0.25)); border: 1px solid rgba(0, 210, 255, 0.35); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #00D2FF; font-size: 14px;">
              ${initial}
            </div>
            <div>
              <div style="font-size: 14px; font-weight: 700; color: #F8FAFC;">${escapeHTML(f.name || f.username)}</div>
              <div style="font-size: 12px; color: var(--accent-cyan); font-family: monospace;">@${escapeHTML(f.username)}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button type="button" class="btn-secondary" data-quick-assign-friend="${f.id}" data-friend-username="${f.username}" style="padding: 5px 10px; font-size: 11px; height: 28px; border-radius: 8px; cursor: pointer;" title="Assign task to ${f.username}">
              <i class="fa-solid fa-plus"></i> Task
            </button>
            <button type="button" class="task-delete-btn" data-remove-friend="${f.id}" title="Remove friend" style="color: #FB7185; cursor: pointer;">
              <i class="fa-solid fa-trash-can" style="font-size: 12px;"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function populateAssignDropdown() {
    const select = document.getElementById('task-assign-select');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="">Myself (Personal Task)</option>';

    if (state.friends && state.friends.length > 0) {
      state.friends.forEach((f) => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.dataset.username = f.username;
        opt.textContent = `${f.name || f.username} (@${f.username})`;
        if (f.id === currentVal) opt.selected = true;
        select.appendChild(opt);
      });
    }
  }

  async function addFriendByUsername(username) {
    if (!username || !username.trim()) return;
    const cleanHandle = username.trim().replace(/^@/, '');
    const base = getBackendBaseUrl();

    try {
      let key = await ensureApiKey();
      const res = await fetch(`${base}/api/friends/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({ username: cleanHandle })
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        throw new Error(body.error || 'Could not add friend');
      }

      const newFriend = body.data;
      state.friends = state.friends.filter(f => f.id !== newFriend.id);
      state.friends.unshift(newFriend);
      saveStorage(STORAGE_KEY_FRIENDS, state.friends);

      renderFriendsList();
      populateAssignDropdown();
      showToast(`Added @${newFriend.username} as friend! 🎉`, 'success');
      return newFriend;
    } catch (err) {
      showToast(err.message || 'Failed to add friend', 'error');
    }
  }

  async function removeFriend(friendId) {
    const friend = state.friends.find(f => f.id === friendId);
    state.friends = state.friends.filter(f => f.id !== friendId);
    saveStorage(STORAGE_KEY_FRIENDS, state.friends);
    renderFriendsList();
    populateAssignDropdown();
    showToast(`Removed friend ${friend ? '@' + friend.username : ''}`, 'info');

    const base = getBackendBaseUrl();
    try {
      const key = await ensureApiKey();
      await fetch(`${base}/api/friends/${encodeURIComponent(friendId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${key}` }
      }).catch(() => {});
    } catch (e) {
      console.warn('Remove friend sync error:', e);
    }
  }

  // --- Event Bindings & Init ---
  function initEvents() {
    // Bottom Nav Tabs
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view) switchView(view);
      });
    });

    // --- Circular Radial Navigation Logic ---
    const circularNavOverlay = document.getElementById('circular-nav-overlay');
    const circularNavCloseBtn = document.getElementById('circular-nav-close-btn');

    function updateCircularItemPositions() {
      const portal = document.getElementById('circular-nav-portal');
      if (!portal) return;
      const portalWidth = portal.offsetWidth || 390;
      const radius = Math.min(Math.round(portalWidth * 0.38), 150);
      const items = document.querySelectorAll('.circular-orbit-item');
      const total = items.length;
      items.forEach((item, idx) => {
        // 8 items spaced evenly, starting from top (angle = -90deg)
        const angleDeg = (360 / total) * idx - 90;
        const angleRad = (angleDeg * Math.PI) / 180;
        const x = Math.round(radius * Math.cos(angleRad));
        const y = Math.round(radius * Math.sin(angleRad));
        item.style.setProperty('--orbit-x', `${x}px`);
        item.style.setProperty('--orbit-y', `${y}px`);

        // Highlight active view
        const view = item.dataset.view;
        if (view && state.currentView === view) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }

    function openCircularNav() {
      if (!circularNavOverlay) return;
      playSound('check');
      updateCircularItemPositions();
      circularNavOverlay.classList.add('open');
      circularNavOverlay.setAttribute('aria-hidden', 'false');
    }

    function closeCircularNav() {
      if (!circularNavOverlay) return;
      circularNavOverlay.classList.remove('open');
      circularNavOverlay.setAttribute('aria-hidden', 'true');
    }

    function toggleCircularNav() {
      if (!circularNavOverlay) return;
      if (circularNavOverlay.classList.contains('open')) {
        closeCircularNav();
      } else {
        openCircularNav();
      }
    }

    // Compact Central Luphonix Emblem - Opens Circular Radial Navigation Menu
    const centerEmblem = document.getElementById('nav-btn-center-emblem');
    if (centerEmblem) {
      centerEmblem.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCircularNav();
      });
    }

    if (circularNavCloseBtn) {
      circularNavCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playSound('click');
        closeCircularNav();
      });
    }

    if (circularNavOverlay) {
      circularNavOverlay.addEventListener('click', (e) => {
        if (e.target === circularNavOverlay) {
          closeCircularNav();
        }
      });
    }

    // Radial Orbit Items
    document.querySelectorAll('.circular-orbit-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        playSound('check');
        const view = item.dataset.view;
        const action = item.dataset.action;
        closeCircularNav();
        if (view) {
          switchView(view);
        } else if (action === 'quick-add') {
          openModal('modal-task');
        }
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && circularNavOverlay && circularNavOverlay.classList.contains('open')) {
        closeCircularNav();
      }
    });

    window.addEventListener('resize', () => {
      if (circularNavOverlay && circularNavOverlay.classList.contains('open')) {
        updateCircularItemPositions();
      }
    });

    // Header Quick Add
    const quickAddBtn = document.getElementById('btn-quick-add');
    if (quickAddBtn) {
      quickAddBtn.addEventListener('click', () => openModal('modal-task'));
    }

    // Modal Close Buttons
    document.querySelectorAll('.modal-close-btn').forEach((btn) => {
      btn.addEventListener('click', closeAllModals);
    });

    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeAllModals();
      });
    });

    // Quick Water Buttons (Dashboard + Hydration Page)
    document.querySelectorAll('[data-water]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const amount = btn.dataset.water;
        if (amount) logWater(amount);
      });
    });

    // Custom Water Buttons
    const customWaterBtns = [document.getElementById('btn-quick-custom'), document.getElementById('btn-hyd-custom')];
    customWaterBtns.forEach((btn) => {
      if (btn) btn.addEventListener('click', () => openModal('modal-water'));
    });

    // Custom Water Form
    const customWaterForm = document.getElementById('form-custom-water');
    if (customWaterForm) {
      customWaterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('custom-water-amount');
        if (input && input.value) {
          logWater(input.value);
          closeAllModals();
        }
      });
    }

    // Reset Today's Water
    const resetWaterBtn = document.getElementById('btn-clear-water-logs');
    if (resetWaterBtn) {
      resetWaterBtn.addEventListener('click', () => {
        const todayStr = new Date().toDateString();
        state.waterLogs = state.waterLogs.filter((l) => new Date(l.timestamp).toDateString() !== todayStr);
        saveStorage(STORAGE_KEY_WATER, state.waterLogs);
        updateHydrationRings();
        showToast("Today's water logs reset", 'info');
      });
    }

    // Delete individual water log
    document.addEventListener('click', (e) => {
      const delWaterId = e.target.closest('[data-delete-water]')?.dataset.deleteWater;
      if (delWaterId) {
        state.waterLogs = state.waterLogs.filter((l) => l.id !== delWaterId);
        saveStorage(STORAGE_KEY_WATER, state.waterLogs);
        updateHydrationRings();
        showToast('Water log removed', 'info');
      }
    });

    // Tasks Filter Pills
    document.querySelectorAll('.filter-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        state.currentFilter = pill.dataset.filter || 'all';
        renderTasks();
      });
    });

    // Tasks Search Input
    const searchInput = document.getElementById('tasks-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderTasks();
      });
    }

    // Task Item Checkmark & Delete delegation
    document.addEventListener('click', (e) => {
      const toggleId = e.target.closest('[data-toggle-task]')?.dataset.toggleTask;
      if (toggleId) {
        toggleTask(toggleId);
        return;
      }

      const deleteId = e.target.closest('[data-delete-task]')?.dataset.deleteTask;
      if (deleteId) {
        deleteTask(deleteId);
        return;
      }

      const deleteRemId = e.target.closest('[data-delete-reminder]')?.dataset.deleteReminder;
      if (deleteRemId) {
        state.reminders = state.reminders.filter((r) => r.id !== deleteRemId);
        saveStorage(STORAGE_KEY_REMINDERS, state.reminders);
        renderReminders();
        showToast('Reminder deleted', 'info');
      }
    });

    // Add Task Button
    const addTaskBtn = document.getElementById('btn-add-task-modal');
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', () => openModal('modal-task'));
    }

    // Add Task Form Submit
    const formAddTask = document.getElementById('form-add-task');
    if (formAddTask) {
      formAddTask.addEventListener('submit', (e) => {
        e.preventDefault();
        const titleInput = document.getElementById('task-title-input');
        const catSelect = document.getElementById('task-category-select');
        const prioSelect = document.getElementById('task-priority-select');
        const assignSelect = document.getElementById('task-assign-select');

        if (titleInput && titleInput.value.trim().length > 0) {
          const assignedId = assignSelect ? assignSelect.value : '';
          const selectedOpt = assignSelect ? assignSelect.options[assignSelect.selectedIndex] : null;
          const assignedUsername = selectedOpt ? selectedOpt.dataset.username : null;

          addTask(
            titleInput.value,
            catSelect ? catSelect.value : 'work',
            prioSelect ? prioSelect.value : 'medium',
            assignedId || null,
            assignedUsername || null
          );
          titleInput.value = '';
          if (assignSelect) assignSelect.value = '';
          closeAllModals();
        }
      });
    }

    // Friends Modal & Actions
    const btnFriendsModal = document.getElementById('btn-friends-modal');
    if (btnFriendsModal) {
      btnFriendsModal.addEventListener('click', () => {
        playSound('check');
        renderFriendsList();
        openModal('modal-friends');
        fetchFriendsFromCloud();
      });
    }

    const btnCopyHandle = document.getElementById('btn-copy-my-handle');
    if (btnCopyHandle) {
      btnCopyHandle.addEventListener('click', () => {
        const username = (state.user && state.user.username) ? state.user.username : 'dhyey';
        const handle = `@${username}`;
        navigator.clipboard.writeText(handle).then(() => {
          showToast(`Copied ${handle} to clipboard! 📋`, 'success');
        }).catch(() => {
          showToast(`Your handle: ${handle}`, 'info');
        });
      });
    }

    const formAddFriend = document.getElementById('form-add-friend');
    if (formAddFriend) {
      formAddFriend.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('friend-username-input');
        if (input && input.value.trim().length > 0) {
          await addFriendByUsername(input.value.trim());
          input.value = '';
        }
      });
    }

    document.querySelectorAll('.quick-add-friend-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const username = chip.dataset.username;
        if (username) {
          addFriendByUsername(username);
        }
      });
    });

    document.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-remove-friend]');
      if (removeBtn) {
        const friendId = removeBtn.dataset.removeFriend;
        if (friendId) removeFriend(friendId);
        return;
      }

      const quickAssignBtn = e.target.closest('[data-quick-assign-friend]');
      if (quickAssignBtn) {
        const friendId = quickAssignBtn.dataset.quickAssignFriend;
        closeAllModals();
        openModal('modal-task');
        const assignSelect = document.getElementById('task-assign-select');
        if (assignSelect) assignSelect.value = friendId;
      }
    });

    // Add Reminder Button & Form
    const addReminderBtn = document.getElementById('btn-add-reminder-modal');
    if (addReminderBtn) {
      addReminderBtn.addEventListener('click', () => openModal('modal-reminder'));
    }

    const formAddReminder = document.getElementById('form-add-reminder');
    if (formAddReminder) {
      formAddReminder.addEventListener('submit', (e) => {
        e.preventDefault();
        const titleInput = document.getElementById('reminder-title-input');
        const timeInput = document.getElementById('reminder-time-input');
        const recSelect = document.getElementById('reminder-recurring-select');

        if (titleInput && titleInput.value.trim().length > 0) {
          addReminder(titleInput.value, timeInput ? timeInput.value : '09:00', recSelect ? recSelect.value : 'daily');
          titleInput.value = '';
          closeAllModals();
        }
      });
    }

    // Back Button on all sub-screens
    document.querySelectorAll('.view-back-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchView('dashboard'));
    });

    // Motivational Quote Banner Rotator
    const MOTIVATIONAL_QUOTES = [
      'Stay consistent, your future self will thank you.',
      'Small habits, big changes.',
      'Stay consistent, progress takes time but it is always worth it.',
      'Discipline is choosing between what you want now and what you want most.',
      'Every healthy choice counts towards your highest potential.'
    ];
    let quoteIdx = 0;
    const quoteBanner = document.getElementById('quote-banner');
    const quoteTextEl = document.getElementById('quote-text');
    if (quoteBanner && quoteTextEl) {
      const cycleQuote = () => {
        quoteIdx = (quoteIdx + 1) % MOTIVATIONAL_QUOTES.length;
        quoteTextEl.style.opacity = '0';
        setTimeout(() => {
          quoteTextEl.textContent = MOTIVATIONAL_QUOTES[quoteIdx];
          quoteTextEl.style.opacity = '1';
        }, 220);
      };
      quoteBanner.addEventListener('click', cycleQuote);
      setInterval(cycleQuote, 8500);
    }

    // Keep Going Button inside Today's Water card
    const btnKeepGoing = document.getElementById('btn-keep-going');
    if (btnKeepGoing) {
      btnKeepGoing.addEventListener('click', () => {
        logWater(250);
      });
    }

    // 4 Squircle Quick Action Buttons (Dashboard Screen 1)
    const qaWater = document.getElementById('btn-qa-water');
    if (qaWater) qaWater.addEventListener('click', () => openModal('modal-water'));

    const qaTask = document.getElementById('btn-qa-task');
    if (qaTask) qaTask.addEventListener('click', () => openModal('modal-task'));

    const qaSiri = document.getElementById('btn-qa-siri');
    if (qaSiri) qaSiri.addEventListener('click', () => switchView('siri'));

    const qaNote = document.getElementById('btn-qa-note');
    if (qaNote) qaNote.addEventListener('click', () => openModal('modal-reminder'));

    // Global Floating Action Button (FAB)
    const globalFab = document.getElementById('btn-global-fab');
    if (globalFab) {
      globalFab.addEventListener('click', () => {
        if (state.activeView === 'reminders') openModal('modal-reminder');
        else if (state.activeView === 'hydration') openModal('modal-water');
        else openModal('modal-task');
      });
    }

    // Notification Bell Button
    const headerBell = document.getElementById('btn-header-bell');
    if (headerBell) {
      headerBell.addEventListener('click', () => {
        playSound('check');
        switchView('notifications');
      });
    }

    // Settings Button in Header (Next to Bell)
    const headerSettings = document.getElementById('btn-header-settings');
    if (headerSettings) {
      headerSettings.addEventListener('click', () => {
        playSound('check');
        switchView('settings');
      });
    }

    // Reminders Filter Pills Bar
    const remFilterBar = document.getElementById('reminders-filter-bar');
    if (remFilterBar) {
      remFilterBar.querySelectorAll('.filter-pill').forEach((pill) => {
        pill.addEventListener('click', () => {
          remFilterBar.querySelectorAll('.filter-pill').forEach((p) => p.classList.remove('active'));
          pill.classList.add('active');
          state.currentRemFilter = pill.dataset.remFilter || 'all';
          renderReminders();
        });
      });
    }

    // Interactive iOS Switch Toggle for Reminders
    document.addEventListener('change', (e) => {
      if (e.target && e.target.classList.contains('reminder-toggle-switch')) {
        const remId = e.target.dataset.reminderId;
        const rem = state.reminders.find((r) => r.id === remId);
        if (rem) {
          rem.is_enabled = e.target.checked;
          saveStorage(STORAGE_KEY_REMINDERS, state.reminders);
          playSound(rem.is_enabled ? 'check' : 'click');
          showToast(rem.is_enabled ? `Reminder "${rem.title}" active` : `Reminder "${rem.title}" paused`, 'info');
        }
      }
    });

    // Siri 3 Action Buttons (Screen 5)
    const btnSiriView = document.getElementById('btn-siri-action-view');
    if (btnSiriView) {
      btnSiriView.addEventListener('click', () => {
        document.querySelector('.siri-shortcut-card')?.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const btnSiriCopy = document.getElementById('btn-siri-action-copy');
    if (btnSiriCopy) {
      btnSiriCopy.addEventListener('click', async () => {
        const base = getBackendBaseUrl();
        const key = await ensureApiKey();
        const url = `${base}/api/water/add?apiKey=${encodeURIComponent(key)}&amount=250`;
        navigator.clipboard.writeText(url).then(() => {
          showToast('Siri API Webhook URL copied! 📋', 'success');
        }).catch(() => {
          showToast('Webhook: ' + url, 'info');
        });
      });
    }

    const btnSiriTest = document.getElementById('btn-siri-action-test');
    if (btnSiriTest) {
      btnSiriTest.addEventListener('click', () => {
        playSound('water');
        showToast('🎙️ Siri Voice Simulation: "Logged 250ml water in Luphonix!"', 'water');
        logWater(250);
      });
    }

    const btnSiriHelp = document.getElementById('btn-siri-help');
    if (btnSiriHelp) {
      btnSiriHelp.addEventListener('click', () => openModal('modal-install'));
    }

    // Popular Voice Command Pills (Screen 5)
    document.querySelectorAll('.popular-cmd-bubble').forEach((pill) => {
      pill.addEventListener('click', () => {
        const id = pill.id;
        if (id === 'pill-cmd-water') {
          logWater(250);
        } else if (id === 'pill-cmd-tasks') {
          switchView('tasks');
          showToast('Siri: "Here are your tasks for today"', 'info');
        } else if (id === 'pill-cmd-complete') {
          const firstUncompleted = state.tasks.find((t) => !t.is_completed);
          if (firstUncompleted) {
            toggleTask(firstUncompleted.id);
          } else {
            showToast('All tasks are already completed!', 'success');
          }
        } else if (id === 'pill-cmd-progress') {
          switchView('dashboard');
          showToast('Siri: "Showing your today\'s progress"', 'info');
        } else if (id === 'pill-cmd-add') {
          openModal('modal-task');
        } else if (id === 'pill-cmd-assign') {
          showToast('Siri: "Hey Siri, assign task 2 to Alex in Luphonix"', 'info');
          const uncompleted = state.tasks.filter((t) => !t.is_completed);
          if (uncompleted.length >= 2) {
            assignTask(uncompleted[1].id, 'alex');
          } else {
            switchView('tasks');
            showToast('Tip: Use Siri shortcut to assign task by number or name', 'info');
          }
        } else if (id === 'pill-cmd-reminder') {
          showToast('Siri: "Hey Siri, remind me to drink water in Luphonix"', 'info');
          switchView('reminders');
        }
      });
    });

    // Settings iOS Grouped Menu Item Accordion
    document.querySelectorAll('.ios-list-item[data-accordion]').forEach((item) => {
      item.addEventListener('click', () => {
        const targetId = item.dataset.accordion;
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetEl.style.borderColor = 'rgba(0, 210, 255, 0.8)';
          targetEl.style.boxShadow = '0 0 25px rgba(0, 210, 255, 0.4)';
          setTimeout(() => {
            targetEl.style.borderColor = '';
            targetEl.style.boxShadow = '';
          }, 1500);
        }
      });
    });

    // Settings View Triggers
    const linkViewAllTasks = document.getElementById('link-view-all-tasks');
    if (linkViewAllTasks) {
      linkViewAllTasks.addEventListener('click', () => switchView('tasks'));
    }

    const linkEditGoal = document.getElementById('link-edit-water-goal');
    if (linkEditGoal) {
      linkEditGoal.addEventListener('click', () => switchView('settings'));
    }

    const btnShowInstall = document.getElementById('btn-show-install-guide');
    if (btnShowInstall) {
      btnShowInstall.addEventListener('click', () => openModal('modal-install'));
    }

    // Test Backend Ping
    const btnPing = document.getElementById('btn-test-backend-ping');
    if (btnPing) {
      btnPing.addEventListener('click', testBackendPing);
    }

    // Save Settings
    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', () => {
        const goalInput = document.getElementById('setting-daily-water-goal');
        const urlInput = document.getElementById('setting-backend-url');
        const audioSelect = document.getElementById('setting-audio-toggle');

        if (goalInput) state.prefs.dailyWaterGoal = parseInt(goalInput.value, 10) || 2000;
        if (urlInput) state.prefs.backendUrl = urlInput.value.trim();
        if (audioSelect) state.prefs.audioEnabled = audioSelect.value === 'enabled';

        saveStorage(STORAGE_KEY_PREFS, state.prefs);
        updateHydrationRings();
        showToast('Settings saved successfully!', 'success');
      });
    }

    // Reset Data
    const btnReset = document.getElementById('btn-reset-data');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all tasks and hydration history to defaults?')) {
          state.tasks = [...DEFAULT_TASKS];
          state.waterLogs = [...DEFAULT_WATER];
          state.reminders = [...DEFAULT_REMINDERS];
          saveStorage(STORAGE_KEY_TASKS, state.tasks);
          saveStorage(STORAGE_KEY_WATER, state.waterLogs);
          saveStorage(STORAGE_KEY_REMINDERS, state.reminders);
          renderTasks();
          updateHydrationRings();
          renderReminders();
          showToast('Data reset to default', 'info');
        }
      });
    }

    // Load initial settings fields
    const backendInput = document.getElementById('setting-backend-url');
    if (backendInput && state.prefs.backendUrl) {
      backendInput.value = state.prefs.backendUrl;
    }

    const goalInput = document.getElementById('setting-daily-water-goal');
    if (goalInput && state.prefs.dailyWaterGoal) {
      goalInput.value = state.prefs.dailyWaterGoal;
    }

    // Sync Tasks with Cloud Button
    const btnSyncTasks = document.getElementById('btn-sync-tasks-cloud');
    if (btnSyncTasks) {
      btnSyncTasks.addEventListener('click', () => {
        showToast('Syncing with Siri Cloud...', 'info');
        syncAllWithCloud(true);
      });
    }

    // Click on status pill to manually refresh from cloud
    const pill = document.getElementById('connection-pill');
    if (pill) {
      pill.style.cursor = 'pointer';
      pill.title = 'Click to sync with Siri Cloud';
      pill.addEventListener('click', () => {
        showToast('Syncing with Siri Cloud... ☁️', 'info');
        syncAllWithCloud(true);
      });
    }

    // Auto-sync whenever tab becomes visible (e.g. after adding task via Siri or terminal)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        syncAllWithCloud();
      }
    });

    // Background interval sync every 15 seconds
    setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        syncAllWithCloud();
      }
    }, 15000);

    setupSiriCopyButtons();

    // --- Authentication Event Handlers ---
    const userAuthPill = document.getElementById('user-auth-pill');
    if (userAuthPill) {
      userAuthPill.addEventListener('click', () => {
        if (state.user && state.token) {
          openModal('modal-account');
        } else {
          openModal('modal-auth');
        }
      });
    }

    const settingsAccountRow = document.getElementById('settings-account-row');
    if (settingsAccountRow && userAuthPill) {
      settingsAccountRow.addEventListener('click', () => userAuthPill.click());
    }

    const tabBtnLogin = document.getElementById('tab-btn-login');
    const tabBtnSignup = document.getElementById('tab-btn-signup');
    const formLogin = document.getElementById('form-auth-login');
    const formSignup = document.getElementById('form-auth-signup');
    const authTitle = document.getElementById('auth-modal-title');
    const authSubtitle = document.getElementById('auth-modal-subtitle');
    const authHeaderIcon = document.getElementById('auth-header-icon');
    const authError = document.getElementById('auth-error-msg');

    if (tabBtnLogin && tabBtnSignup) {
      tabBtnLogin.addEventListener('click', () => {
        tabBtnLogin.classList.add('active');
        tabBtnSignup.classList.remove('active');
        if (formLogin) formLogin.style.display = 'block';
        if (formSignup) formSignup.style.display = 'none';
        if (authTitle) authTitle.textContent = 'Welcome Back';
        if (authSubtitle) authSubtitle.textContent = 'Sign in to access your cloud tasks and personalized Siri shortcuts.';
        if (authHeaderIcon) authHeaderIcon.textContent = '✨';
        if (authError) authError.style.display = 'none';
        const emailInput = document.getElementById('login-email');
        if (emailInput) setTimeout(() => emailInput.focus(), 150);
      });

      tabBtnSignup.addEventListener('click', () => {
        tabBtnSignup.classList.add('active');
        tabBtnLogin.classList.remove('active');
        if (formSignup) formSignup.style.display = 'block';
        if (formLogin) formLogin.style.display = 'none';
        if (authTitle) authTitle.textContent = 'Create New Account';
        if (authSubtitle) authSubtitle.textContent = 'Sync tasks, hydration, and Siri voice shortcuts across all devices.';
        if (authHeaderIcon) authHeaderIcon.textContent = '🚀';
        if (authError) authError.style.display = 'none';
        const nameInput = document.getElementById('signup-name');
        if (nameInput) setTimeout(() => nameInput.focus(), 150);
      });
    }

    const linkSwitchSignup = document.getElementById('link-switch-to-signup');
    if (linkSwitchSignup && tabBtnSignup) {
      linkSwitchSignup.addEventListener('click', (e) => {
        e.preventDefault();
        tabBtnSignup.click();
      });
    }

    const linkSwitchLogin = document.getElementById('link-switch-to-login');
    if (linkSwitchLogin && tabBtnLogin) {
      linkSwitchLogin.addEventListener('click', (e) => {
        e.preventDefault();
        tabBtnLogin.click();
      });
    }

    // Password Visibility Toggles
    document.querySelectorAll('.pwd-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (!input) return;
        if (input.type === 'password') {
          input.type = 'text';
          btn.innerHTML = '<i class="fa-regular fa-eye-slash"></i>';
        } else {
          input.type = 'password';
          btn.innerHTML = '<i class="fa-regular fa-eye"></i>';
        }
      });
    });

    if (formLogin) {
      formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email')?.value.trim();
        const password = document.getElementById('login-password')?.value;
        if (email && password) {
          loginUser(email, password);
        }
      });
    }

    if (formSignup) {
      formSignup.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name')?.value.trim();
        const username = document.getElementById('signup-username')?.value.trim();
        const email = document.getElementById('signup-email')?.value.trim();
        const password = document.getElementById('signup-password')?.value;
        if (name && email && password) {
          registerUser(name, email, password, username);
        }
      });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', logoutUser);
    }

    // --- Connected Devices & Request Monitor Event Handlers ---
    const btnRefreshDevices = document.getElementById('btn-refresh-devices');
    if (btnRefreshDevices) {
      btnRefreshDevices.addEventListener('click', () => {
        showToast('Refreshing devices & live requests...', 'info');
        fetchDevicesAndRequests();
      });
    }

    const btnPingDevice = document.getElementById('btn-ping-device');
    if (btnPingDevice) {
      btnPingDevice.addEventListener('click', async () => {
        const base = getBackendBaseUrl();
        const start = performance.now();
        try {
          const res = await fetch(`${base}/api/devices/ping`, { method: 'POST' });
          const latency = Math.round(performance.now() - start);
          if (res.ok) {
            showToast(`⚡ Device Ping: ${latency}ms latency`, 'success');
            fetchDevicesAndRequests();
          } else {
            showToast('Device Ping failed', 'error');
          }
        } catch {
          showToast('Device Ping failed - offline', 'error');
        }
      });
    }

    const btnDeduplicate = document.getElementById('btn-deduplicate-tasks');
    if (btnDeduplicate) {
      btnDeduplicate.addEventListener('click', deduplicateDbTasks);
    }

    const btnClearReqLogs = document.getElementById('btn-clear-request-logs');
    if (btnClearReqLogs) {
      btnClearReqLogs.addEventListener('click', clearRequestLogs);
    }

    // Request filter pills
    document.querySelectorAll('[data-req-filter]').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('[data-req-filter]').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        state.currentReqFilter = pill.dataset.reqFilter || 'all';
        fetchDevicesAndRequests();
      });
    });
  }

  // --- Service Worker Registration ---
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then(() => console.log('✅ Luphonix PWA Service Worker Registered'))
          .catch((err) => console.log('Service Worker registration skipped:', err));
      });
    }
  }

  // --- Notification Center (recent alerts + browser push permission) ---
  const STORAGE_KEY_ALERTS = 'luphonix_alerts_v1';
  let alertLog = loadStorage(STORAGE_KEY_ALERTS, []);
  if (!Array.isArray(alertLog)) alertLog = [];

  function recordAlert(title, body, type) {
    alertLog.unshift({
      id: 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title,
      body: String(body || '').replace(/<[^>]*>/g, ''),
      type: type || 'info',
      ts: new Date().toISOString(),
      read: false
    });
    alertLog = alertLog.slice(0, 30);
    saveStorage(STORAGE_KEY_ALERTS, alertLog);
    updateNotifBadge();
    if (state.activeView === 'notifications') renderNotifications();
  }

  function updateNotifBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const unread = alertLog.filter((a) => !a.read).length;
    badge.textContent = unread > 9 ? '9+' : unread ? String(unread) : '';
  }

  function updatePushChip() {
    const chip = document.getElementById('notif-permission-chip');
    if (!chip) return;
    const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
    chip.className = 'notif-chip' + (perm === 'granted' ? ' ok' : perm === 'denied' ? ' blocked' : '');
    chip.textContent = perm === 'granted' ? 'Enabled' : perm === 'denied' ? 'Blocked' : perm === 'unsupported' ? 'Unsupported' : 'Permission Required';
  }

  function alertTimeAgo(iso) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function renderNotifications() {
    const list = document.getElementById('notif-list');
    const count = document.getElementById('notif-count');
    if (count) count.textContent = alertLog.length;
    updatePushChip();
    if (!list) return;
    if (!alertLog.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔔</div><p>No alerts yet.</p></div>`;
      return;
    }
    list.innerHTML = alertLog.map((a) => {
      const icon = a.type === 'water' ? 'fa-droplet' : a.type === 'success' ? 'fa-circle-check' : 'fa-bell';
      return `
        <div class="alert-item ${a.read ? '' : 'unread'}">
          <div class="alert-icon"><i class="fa-solid ${icon}"></i></div>
          <div class="alert-body">
            <div class="alert-title">${escapeHTML(a.title)}</div>
            <div class="alert-text">${escapeHTML(a.body)}</div>
          </div>
          <div class="alert-time">${alertTimeAgo(a.ts)}</div>
        </div>`;
    }).join('');
  }

  function initNotifications() {
    const enable = document.getElementById('btn-enable-push');
    const test = document.getElementById('btn-send-test-push');
    const markAll = document.getElementById('btn-mark-all-read');
    const toggle = document.getElementById('btn-notif-toggle');

    if (enable) {
      enable.addEventListener('click', async () => {
        if (!('Notification' in window)) {
          showToast('Push is not supported in this browser', 'info');
          return;
        }
        try {
          await Notification.requestPermission();
        } catch (e) { /* ignore */ }
        updatePushChip();
        showToast(Notification.permission === 'granted' ? 'Phone push enabled!' : 'Push permission not granted', 'info');
      });
    }
    if (test) {
      test.addEventListener('click', async () => {
        const title = 'Luphonix: Phone Notification';
        const body = 'Test push — notifications are working.';
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
            if (reg && reg.showNotification) reg.showNotification(title, { body, icon: '/icons/icon-192.png' });
            else new Notification(title, { body, icon: '/icons/icon-192.png' });
          } catch (e) { /* ignore */ }
        }
        recordAlert(title, body, 'info');
        showToast('Test push sent', 'info');
      });
    }
    if (markAll) {
      markAll.addEventListener('click', () => {
        alertLog.forEach((a) => { a.read = true; });
        saveStorage(STORAGE_KEY_ALERTS, alertLog);
        updateNotifBadge();
        renderNotifications();
      });
    }
    if (toggle) toggle.addEventListener('click', updatePushChip);
    updateNotifBadge();
    updatePushChip();
  }

  // --- App Initialization ---
  function init() {
    updateGreeting();
    updateHydrationRings();
    renderTasks();
    renderReminders();
    renderFriendsList();
    populateAssignDropdown();
    initEvents();
    initNotifications();
    updateAuthUI();
    ensureApiKey();
    registerServiceWorker();

    // Instant sync with cloud on load so Siri & terminal tasks show up right away
    setTimeout(syncAllWithCloud, 200);

    // Initial devices & requests pre-fetch
    setTimeout(fetchDevicesAndRequests, 400);

    // Initial friends fetch
    setTimeout(fetchFriendsFromCloud, 600);

    // Health ping test on load
    setTimeout(testBackendPing, 800);
  }


  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
