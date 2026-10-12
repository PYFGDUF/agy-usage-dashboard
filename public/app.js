// AGY / Usage Dashboard Client Application
(function () {
  'use strict';

  // DOM Elements
  const connBadge = document.getElementById('conn-badge');
  const connText = document.getElementById('conn-text');
  const updatedAtText = document.getElementById('updated-at-text');
  const freshnessText = document.getElementById('freshness-text');
  const errorBanner = document.getElementById('error-banner');
  const errorMessage = document.getElementById('error-message');
  const quotaGrid = document.getElementById('quota-grid');
  const refreshBtn = document.getElementById('refresh-btn');
  const refreshBtnText = document.getElementById('refresh-btn-text');
  const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
  const spinIcon = refreshBtn.querySelector('.spin-icon');
  const taskCountBadge = document.getElementById('task-count-badge');
  const tasksEmpty = document.getElementById('tasks-empty');
  const tasksTableWrap = document.getElementById('tasks-table-wrap');
  const tasksTableBody = document.getElementById('tasks-table-body');

  let state = null;
  let autoRefreshTimer = null;
  let cooldownTimer = null;
  let cooldownSecondsRemaining = 0;
  let countdownUpdateTimer = null;

  // Format UTC ISO string into Asia/Shanghai CST string
  function formatShanghaiTime(isoString) {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(d) + ' CST';
    } catch {
      return isoString;
    }
  }

  // Format countdown string or awaiting refresh
  function getCountdownInfo(isoString) {
    if (!isoString) return { text: '-', isPassed: false };
    const diffMs = new Date(isoString).getTime() - Date.now();
    if (diffMs <= 0) {
      return { text: '已到期 (等待下次刷新)', isPassed: true };
    }
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return { text: `倒计时: ${days}天 ${remHours}小时 ${mins}分`, isPassed: false };
    }
    return { text: `倒计时: ${hours}小时 ${mins}分 ${secs}秒`, isPassed: false };
  }

  // Map weekly/five-hour window labels to Chinese
  function formatWindowLabel(windowName) {
    if (!windowName) return '';
    const lower = windowName.toLowerCase();
    if (lower.includes('weekly') && lower.includes('remaining')) {
      return '每周限额剩余';
    }
    if ((lower.includes('five hour') || lower.includes('5-hour') || lower.includes('5 hour')) && lower.includes('remaining')) {
      return '5小时限额剩余';
    }
    if (lower.includes('weekly')) {
      return '每周限额';
    }
    if (lower.includes('five hour') || lower.includes('5-hour') || lower.includes('5 hour')) {
      return '5小时限额';
    }
    return windowName;
  }

  // Map model group labels to Chinese
  function formatGroupLabel(groupName) {
    if (!groupName) return '通用模型';
    const lower = groupName.toLowerCase();
    if (lower.includes('gemini')) return 'Gemini 模型';
    if (lower.includes('claude') || lower.includes('gpt')) return 'Claude 与 GPT 模型';
    return groupName;
  }

  // Group windows by model group
  function groupWindows(windows) {
    const groups = new Map();
    for (const win of windows) {
      const gName = win.group || '通用模型';
      if (!groups.has(gName)) {
        groups.set(gName, []);
      }
      groups.get(gName).push(win);
    }
    return groups;
  }

  // Update connection badge
  function updateConnectionBadge(connState) {
    connBadge.className = 'badge badge-status';
    if (connState === 'ready') {
      connBadge.classList.add('badge-ready');
      connText.textContent = '正常 (就绪)';
    } else if (connState === 'refreshing') {
      connBadge.classList.add('badge-refreshing');
      connText.textContent = '正在刷新...';
    } else if (connState === 'error') {
      connBadge.classList.add('badge-error');
      connText.textContent = '刷新异常';
    } else {
      connBadge.classList.add('badge-unavailable');
      connText.textContent = '未连接';
    }
  }

  // Render Quota Grid
  function renderQuotaGrid(windows) {
    if (!windows || windows.length === 0) {
      quotaGrid.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 40px 20px;">
          <p>暂无配额窗口数据，请点击右上角「立即刷新」</p>
        </div>
      `;
      return;
    }

    const grouped = groupWindows(windows);
    quotaGrid.innerHTML = '';

    for (const [groupName, winList] of grouped.entries()) {
      const card = document.createElement('div');
      card.className = 'card group-card';

      let itemsHtml = '';
      for (const win of winList) {
        const percent = Math.max(0, Math.min(100, win.remainingPercent));
        const isLow = percent <= 20;
        const countdown = getCountdownInfo(win.resetsAt);
        const resetCst = formatShanghaiTime(win.resetsAt);
        const displayTitle = formatWindowLabel(win.window);

        itemsHtml += `
          <div class="quota-item ${isLow ? 'is-low' : ''}" data-resets-at="${escapeHtml(win.resetsAt || '')}">
            <div class="quota-item-top">
              <span class="quota-window-title">${escapeHtml(displayTitle)}</span>
              <div class="quota-percent-wrap">
                ${isLow ? '<span class="quota-low-badge">额度紧张 ≤20%</span>' : ''}
                <span class="quota-percent">${percent}%</span>
              </div>
            </div>
            <div class="progress-bar-track" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar-fill" style="width: ${percent}%;"></div>
            </div>
            <div class="quota-item-meta">
              <span class="meta-reset-time">重置: ${escapeHtml(resetCst)}</span>
              <span class="meta-countdown ${countdown.isPassed ? 'is-passed' : ''}">${escapeHtml(countdown.text)}</span>
            </div>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="group-card-header">
          <div class="group-title">
            <span>${escapeHtml(formatGroupLabel(groupName))}</span>
          </div>
          <span class="group-tag">${winList.length} 个限额窗口</span>
        </div>
        ${itemsHtml}
      `;

      quotaGrid.appendChild(card);
    }
  }

  // Update countdown timers dynamically every second
  function updateAllCountdowns() {
    checkLocalFreshness();
    const quotaItems = document.querySelectorAll('.quota-item[data-resets-at]');
    quotaItems.forEach(item => {
      const resetsAt = item.getAttribute('data-resets-at');
      const countdownEl = item.querySelector('.meta-countdown');
      if (countdownEl && resetsAt) {
        const countdown = getCountdownInfo(resetsAt);
        countdownEl.textContent = countdown.text;
        if (countdown.isPassed) {
          countdownEl.classList.add('is-passed');
        } else {
          countdownEl.classList.remove('is-passed');
        }
      }
    });
  }

  // Render Tasks Table
  function renderTasks(tasks) {
    const list = Array.isArray(tasks) ? tasks : [];
    taskCountBadge.textContent = list.length;

    if (list.length === 0) {
      tasksEmpty.classList.remove('hidden');
      tasksTableWrap.classList.add('hidden');
      tasksTableBody.innerHTML = '';
      return;
    }

    tasksEmpty.classList.add('hidden');
    tasksTableWrap.classList.remove('hidden');

    let rowsHtml = '';
    for (const task of list) {
      const statusClass = ['queued', 'running', 'completed', 'failed'].includes(task.status)
        ? task.status
        : 'unknown';

      const statusMap = {
        queued: '排队中',
        running: '运行中',
        completed: '已完成',
        failed: '失败',
        unknown: '未知'
      };
      const statusLabel = statusMap[task.status] || task.status;

      let tokensText = '-';
      if (task.usage && (task.usage.inputTokens !== undefined || task.usage.outputTokens !== undefined)) {
        const inp = task.usage.inputTokens !== undefined ? task.usage.inputTokens.toLocaleString() : '未知';
        const out = task.usage.outputTokens !== undefined ? task.usage.outputTokens.toLocaleString() : '未知';
        tokensText = `${inp} / ${out}`;
      }

      rowsHtml += `
        <tr>
          <td><span class="task-id-code">${escapeHtml(task.id)}</span></td>
          <td>${escapeHtml(task.model || '-')}</td>
          <td><span class="status-tag ${statusClass}">${escapeHtml(statusLabel)}</span></td>
          <td>${escapeHtml(tokensText)}</td>
          <td>${escapeHtml(formatShanghaiTime(task.startedAt || task.createdAt))}</td>
          <td>${escapeHtml(formatShanghaiTime(task.endedAt))}</td>
        </tr>
      `;
    }

    tasksTableBody.innerHTML = rowsHtml;
  }

  // Local dynamic freshness check (rechecked locally even when display updates paused)
  function checkLocalFreshness() {
    if (!state) return;
    if (state.connection?.state === 'refreshing') {
      freshnessText.textContent = '正在刷新...';
      freshnessText.className = 'status-value';
      return;
    }
    if (state.connection?.state === 'error') {
      freshnessText.textContent = '已过期 (刷新异常)';
      freshnessText.className = 'status-value freshness-stale';
      return;
    }
    if (!state.usage?.updatedAt) {
      freshnessText.textContent = '等待首次刷新';
      freshnessText.className = 'status-value';
      return;
    }
    const ageSeconds = (Date.now() - Date.parse(state.usage.updatedAt)) / 1000;
    if (ageSeconds > 120) {
      freshnessText.textContent = '已过期 (>120s 或 刷新异常)';
      freshnessText.className = 'status-value freshness-stale';
    } else {
      freshnessText.textContent = '实时 (正常)';
      freshnessText.className = 'status-value freshness-ok';
    }
  }

  // Update UI from fetched status
  function applyState(newStatus) {
    state = newStatus;
    const connState = state.connection?.state || 'unavailable';
    updateConnectionBadge(connState);

    // Updated at
    updatedAtText.textContent = formatShanghaiTime(state.usage?.updatedAt);

    // Dynamic freshness
    checkLocalFreshness();

    // Error banner
    if (state.connection?.error) {
      errorBanner.classList.remove('hidden');
      errorMessage.textContent = state.connection.error;
    } else {
      errorBanner.classList.add('hidden');
      errorMessage.textContent = '-';
    }

    // Quota windows
    renderQuotaGrid(state.usage?.windows || []);

    // Tasks
    renderTasks(state.tasks || []);
  }

  // Fetch status from API
  async function fetchStatus() {
    try {
      const res = await fetch('/api/status', {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      applyState(data);
    } catch (err) {
      updateConnectionBadge('error');
      freshnessText.textContent = '连接中断';
      freshnessText.className = 'status-value freshness-stale';
      errorBanner.classList.remove('hidden');
      errorMessage.textContent = `无法连接本地服务: ${err.message}`;
    }
  }

  // Start button cooldown (10s)
  function startCooldown(seconds = 10) {
    cooldownSecondsRemaining = seconds;
    refreshBtn.disabled = true;
    spinIcon.classList.remove('spinning');

    if (cooldownTimer) clearInterval(cooldownTimer);
    refreshBtnText.textContent = `冷却中 (${cooldownSecondsRemaining}s)`;

    cooldownTimer = setInterval(() => {
      cooldownSecondsRemaining -= 1;
      if (cooldownSecondsRemaining <= 0) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        refreshBtn.disabled = false;
        refreshBtnText.textContent = '立即刷新';
      } else {
        refreshBtnText.textContent = `冷却中 (${cooldownSecondsRemaining}s)`;
      }
    }, 1000);
  }

  // Manual refresh handler
  async function triggerRefresh() {
    if (cooldownSecondsRemaining > 0) return;

    refreshBtn.disabled = true;
    spinIcon.classList.add('spinning');
    refreshBtnText.textContent = '刷新中...';
    updateConnectionBadge('refreshing');

    try {
      const res = await fetch('/api/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      applyState(data);
    } catch (err) {
      errorBanner.classList.remove('hidden');
      errorMessage.textContent = `刷新失败: ${err.message}`;
    } finally {
      spinIcon.classList.remove('spinning');
      startCooldown(10);
    }
  }

  // Auto refresh timer setup (polls cache every 2s for live first-load/task states)
  function setupAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
    if (autoRefreshToggle.checked) {
      autoRefreshTimer = setInterval(() => {
        fetchStatus();
      }, 2000);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Event Listeners
  refreshBtn.addEventListener('click', triggerRefresh);
  autoRefreshToggle.addEventListener('change', setupAutoRefresh);

  // Initialize
  fetchStatus();
  setupAutoRefresh();

  // Tick relative countdowns every second
  countdownUpdateTimer = setInterval(updateAllCountdowns, 1000);
})();
