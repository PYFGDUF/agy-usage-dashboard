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
  const spinIcon = refreshBtn ? refreshBtn.querySelector('.spin-icon') : null;
  const taskCountBadge = document.getElementById('task-count-badge');
  const tasksEmpty = document.getElementById('tasks-empty');
  const tasksTableWrap = document.getElementById('tasks-table-wrap');
  const tasksTableBody = document.getElementById('tasks-table-body');
  const langSelect = document.getElementById('lang-select');
  const supervisorBadge = document.getElementById('supervisor-badge');
  const autoRefreshLabel = document.getElementById('auto-refresh-label');
  const autoRefreshText = document.getElementById('auto-refresh-text');
  const statusBarSection = document.getElementById('status-bar-section');
  const updatedAtLabel = document.getElementById('updated-at-label');
  const freshnessLabel = document.getElementById('freshness-label');
  const quotaHeading = document.getElementById('quota-heading');
  const quotaNote = document.getElementById('quota-note');
  const tasksHeading = document.getElementById('tasks-heading');
  const tasksNote = document.getElementById('tasks-note');
  const tasksEmptyTitle = document.getElementById('tasks-empty-title');
  const tasksEmptySub = document.getElementById('tasks-empty-sub');
  const thTaskId = document.getElementById('th-task-id');
  const thModel = document.getElementById('th-model');
  const thStatus = document.getElementById('th-status');
  const thTokens = document.getElementById('th-tokens');
  const thTimeFirst = document.getElementById('th-time-first');
  const thTimeDone = document.getElementById('th-time-done');
  const footerServer = document.getElementById('footer-server');
  const footerTz = document.getElementById('footer-tz');
  const footerDesc = document.getElementById('footer-desc');

  let state = null;
  let autoRefreshTimer = null;
  let cooldownTimer = null;
  let cooldownSecondsRemaining = 0;
  let countdownUpdateTimer = null;
  let currentLang = 'zh-CN';
  let activeError = null;
  let lastConnectionState = 'unavailable';

  function renderError() {
    if (!errorBanner || !errorMessage) return;
    if (activeError) errorBanner.classList.remove('hidden');
    else errorBanner.classList.add('hidden');
    errorMessage.textContent = activeError ? activeError(I18N[currentLang]) : '-';
  }

  const STORAGE_KEY = 'agy_quota_lang';

  const I18N = {
    'zh-CN': {
      docTitle: 'AGY / Usage - Antigravity 配额监控看板',
      supervisorBadge: 'Supervisor 集成',
      langSelectLabel: '选择语言',
      connConnecting: '连接中...',
      connReady: '正常 (就绪)',
      connRefreshing: '正在刷新...',
      connError: '刷新异常',
      connUnavailable: '未连接',
      autoSyncTitle: '每 2 秒自动同步界面显示，后台定时 60 秒轮询',
      autoSyncLabel: '自动更新显示',
      refreshBtnAria: '手动刷新配额',
      refreshNow: '立即刷新',
      refreshing: '刷新中...',
      btnCooldown: (s) => `冷却中 (${s}s)`,
      statusBarAria: '状态信息',
      updatedAtLabel: '数据更新时间:',
      freshnessLabel: '新鲜度:',
      freshnessAwaiting: '等待数据',
      freshnessAwaitingFirst: '等待首次刷新',
      freshnessRefreshing: '正在刷新...',
      freshnessStaleError: '已过期 (刷新异常)',
      freshnessStale120: '已过期 (>120s 或 刷新异常)',
      freshnessRealtime: '实时 (正常)',
      freshnessDisconnected: '连接中断',
      quotaHeading: '模型配额监控',
      quotaNote: '本地配额状态实时同步，低余量阈值 ≤ 20%',
      quotaEmpty: '暂无配额窗口数据，请点击右上角「立即刷新」',
      quotaGeneralGroup: '通用模型',
      quotaGeminiGroup: 'Gemini 模型',
      quotaClaudeGptGroup: 'Claude 与 GPT 模型',
      quotaGroupTag: (n) => `${n} 个限额窗口`,
      lowAllowanceTag: '额度紧张 ≤20%',
      progressAriaLabel: (title, percent) => `${title} 剩余 ${percent}%`,
      resetPrefix: '重置: ',
      countdownExpired: '已到期 (等待下次刷新)',
      countdownDays: (d, h, m) => `倒计时: ${d}天 ${h}小时 ${m}分`,
      countdownHours: (h, m, s) => `倒计时: ${h}小时 ${m}分 ${s}秒`,
      tasksHeading: 'Supervisor 显式报告事件',
      tasksNote: '仅展示由 Supervisor 显式上报的任务事件，不自动枚举后台桥接任务',
      tasksEmptyTitle: '暂无 Supervisor 任务事件',
      tasksEmptySub: '当 Supervisor 任务通过 MCP 或 API 显式上报时将显示于此',
      thTaskId: '任务 ID',
      thModel: '模型',
      thStatus: '状态',
      thTokens: 'Token 消耗 (输入 / 输出)',
      thTimeFirst: '首次上报时间 (CST)',
      thTimeDone: '完成上报时间 (CST)',
      statusQueued: '排队中',
      statusRunning: '运行中',
      statusCompleted: '已完成',
      statusFailed: '失败',
      statusUnknown: '未知',
      tokensMissing: '未提供',
      errConnectPrefix: '无法连接本地服务: ',
      errRefreshPrefix: '刷新失败: ',
      footerServer: '服务地址: <code>http://127.0.0.1:8766</code>',
      footerTz: '时区: <code>Asia/Shanghai (CST)</code>',
      footerDesc: 'Antigravity 本地配额仪表盘',
      windowWeeklyRemaining: '每周限额剩余',
      windowFiveHourRemaining: '5小时限额剩余',
      windowWeekly: '每周限额',
      windowFiveHour: '5小时限额'
    },
    'en': {
      docTitle: 'AGY / Usage - Antigravity Quota Dashboard',
      supervisorBadge: 'Supervisor Integration',
      langSelectLabel: 'Select language',
      connConnecting: 'Connecting...',
      connReady: 'Normal (Ready)',
      connRefreshing: 'Refreshing...',
      connError: 'Refresh Error',
      connUnavailable: 'Disconnected',
      autoSyncTitle: 'Auto-sync display every 2s, background poll every 60s',
      autoSyncLabel: 'Auto-update UI',
      refreshBtnAria: 'Manually refresh quota',
      refreshNow: 'Refresh Now',
      refreshing: 'Refreshing...',
      btnCooldown: (s) => `Cooldown (${s}s)`,
      statusBarAria: 'Status Information',
      updatedAtLabel: 'Last Updated:',
      freshnessLabel: 'Freshness:',
      freshnessAwaiting: 'Awaiting Data',
      freshnessAwaitingFirst: 'Awaiting First Refresh',
      freshnessRefreshing: 'Refreshing...',
      freshnessStaleError: 'Stale (Refresh Error)',
      freshnessStale120: 'Stale (>120s or Refresh Error)',
      freshnessRealtime: 'Real-time (Normal)',
      freshnessDisconnected: 'Connection Lost',
      quotaHeading: 'Model Quota Monitor',
      quotaNote: 'Real-time local quota sync, low threshold ≤ 20%',
      quotaEmpty: 'No quota window data. Click "Refresh Now" at top right',
      quotaGeneralGroup: 'General Models',
      quotaGeminiGroup: 'Gemini Models',
      quotaClaudeGptGroup: 'Claude & GPT Models',
      quotaGroupTag: (n) => `${n} limit window${n === 1 ? '' : 's'}`,
      lowAllowanceTag: 'Low Quota ≤20%',
      progressAriaLabel: (title, percent) => `${title} remaining ${percent}%`,
      resetPrefix: 'Resets: ',
      countdownExpired: 'Expired (awaiting refresh)',
      countdownDays: (d, h, m) => `Reset in: ${d}d ${h}h ${m}m`,
      countdownHours: (h, m, s) => `Reset in: ${h}h ${m}m ${s}s`,
      tasksHeading: 'Supervisor Explicit Event Reports',
      tasksNote: 'Only displays tasks explicitly reported by Supervisor; background bridged tasks are not enumerated',
      tasksEmptyTitle: 'No Supervisor task events',
      tasksEmptySub: 'Events will appear here when explicitly reported by Supervisor via MCP or API',
      thTaskId: 'Task ID',
      thModel: 'Model',
      thStatus: 'Status',
      thTokens: 'Token Usage (Input / Output)',
      thTimeFirst: 'First Reported (UTC+8)',
      thTimeDone: 'Completed (UTC+8)',
      statusQueued: 'Queued',
      statusRunning: 'Running',
      statusCompleted: 'Completed',
      statusFailed: 'Failed',
      statusUnknown: 'Unknown',
      tokensMissing: 'Not provided',
      errConnectPrefix: 'Cannot connect to local service: ',
      errRefreshPrefix: 'Refresh failed: ',
      footerServer: 'Server Address: <code>http://127.0.0.1:8766</code>',
      footerTz: 'Timezone: <code>Asia/Shanghai (UTC+8 / CST)</code>',
      footerDesc: 'Antigravity Local Quota Dashboard',
      windowWeeklyRemaining: 'Weekly Limit Remaining',
      windowFiveHourRemaining: '5-Hour Limit Remaining',
      windowWeekly: 'Weekly Limit',
      windowFiveHour: '5-Hour Limit'
    }
  };

  // Defensive localStorage access
  function getStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const testKey = '__agy_storage_test__';
        window.localStorage.setItem(testKey, '1');
        window.localStorage.removeItem(testKey);
        return window.localStorage;
      }
    } catch {
      // Sandbox or denied
    }
    return null;
  }

  function normalizeLang(lang) {
    if (!lang || typeof lang !== 'string') return null;
    const l = lang.trim().toLowerCase();
    if (l.startsWith('zh')) return 'zh-CN';
    if (l.startsWith('en')) return 'en';
    return null;
  }

  function resolveInitialLanguage() {
    // 1. Saved valid preference
    const storage = getStorage();
    if (storage) {
      try {
        const saved = storage.getItem(STORAGE_KEY);
        const normalizedSaved = normalizeLang(saved);
        if (normalizedSaved) {
          return normalizedSaved;
        }
      } catch {
        // Ignore
      }
    }

    // 2. Navigator language(s) (zh=>zh-CN, others English, missing defaults Chinese)
    try {
      let nav = null;
      if (typeof window !== 'undefined' && window.navigator) {
        nav = window.navigator;
      } else if (typeof navigator !== 'undefined') {
        nav = navigator;
      }
      if (nav) {
        let primary = null;
        if (Array.isArray(nav.languages) && nav.languages.length > 0) {
          primary = nav.languages.find(l => typeof l === 'string' && l.trim().length > 0);
        } else if (typeof nav.language === 'string' && nav.language.trim().length > 0) {
          primary = nav.language;
        }
        if (primary) {
          const lower = primary.trim().toLowerCase();
          if (lower.startsWith('zh')) return 'zh-CN';
          return 'en';
        }
      }
    } catch {
      // Ignore
    }

    // 3. Missing defaults Chinese
    return 'zh-CN';
  }

  function saveLanguagePreference(lang) {
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem(STORAGE_KEY, lang);
      } catch {
        // Storage quota or denied
      }
    }
  }

  // Format UTC ISO string into Asia/Shanghai CST string (UTC+8 in English)
  function formatShanghaiTime(isoString, lang = currentLang) {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return String(isoString);
      const isEn = lang === 'en';
      const locale = isEn ? 'en-US' : 'zh-CN';
      const suffix = isEn ? ' UTC+8' : ' CST';
      return new Intl.DateTimeFormat(locale, {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(d) + suffix;
    } catch {
      return String(isoString);
    }
  }

  // Format countdown string or awaiting refresh
  function getCountdownInfo(isoString, lang = currentLang) {
    const dict = I18N[lang] || I18N['zh-CN'];
    if (!isoString) return { text: '-', isPassed: false };
    const diffMs = new Date(isoString).getTime() - Date.now();
    if (diffMs <= 0) {
      return { text: dict.countdownExpired, isPassed: true };
    }
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return { text: dict.countdownDays(days, remHours, mins), isPassed: false };
    }
    return { text: dict.countdownHours(hours, mins, secs), isPassed: false };
  }

  // Map weekly/five-hour window labels
  function formatWindowLabel(windowName, lang = currentLang) {
    if (!windowName) return '';
    const lower = windowName.toLowerCase();
    const dict = I18N[lang] || I18N['zh-CN'];
    if (lower.includes('weekly') && lower.includes('remaining')) {
      return dict.windowWeeklyRemaining;
    }
    if ((lower.includes('five hour') || lower.includes('5-hour') || lower.includes('5 hour')) && lower.includes('remaining')) {
      return dict.windowFiveHourRemaining;
    }
    if (lower.includes('weekly')) {
      return dict.windowWeekly;
    }
    if (lower.includes('five hour') || lower.includes('5-hour') || lower.includes('5 hour')) {
      return dict.windowFiveHour;
    }
    return windowName;
  }

  // Map model group labels
  function formatGroupLabel(groupName, lang = currentLang) {
    const dict = I18N[lang] || I18N['zh-CN'];
    if (!groupName) return dict.quotaGeneralGroup;
    const lower = groupName.toLowerCase();
    if (lower.includes('gemini')) return dict.quotaGeminiGroup;
    if (lower.includes('claude') || lower.includes('gpt')) return dict.quotaClaudeGptGroup;
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
    lastConnectionState = connState;
    if (!connBadge || !connText) return;
    const dict = I18N[currentLang] || I18N['zh-CN'];
    connBadge.className = 'badge badge-status';
    if (connState === 'ready') {
      connBadge.classList.add('badge-ready');
      connText.textContent = dict.connReady;
    } else if (connState === 'refreshing') {
      connBadge.classList.add('badge-refreshing');
      connText.textContent = dict.connRefreshing;
    } else if (connState === 'error') {
      connBadge.classList.add('badge-error');
      connText.textContent = dict.connError;
    } else {
      connBadge.classList.add('badge-unavailable');
      connText.textContent = dict.connUnavailable;
    }
  }

  // Render Quota Grid
  function renderQuotaGrid(windows) {
    if (!quotaGrid) return;
    const dict = I18N[currentLang] || I18N['zh-CN'];
    if (!windows || windows.length === 0) {
      quotaGrid.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 40px 20px;">
          <p>${escapeHtml(dict.quotaEmpty)}</p>
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
        const rawPercent = (typeof win.remainingPercent === 'number') ? win.remainingPercent : 0;
        const percent = Math.max(0, Math.min(100, rawPercent));
        const isLow = percent <= 20;
        const countdown = getCountdownInfo(win.resetsAt, currentLang);
        const resetCst = formatShanghaiTime(win.resetsAt, currentLang);
        const displayTitle = formatWindowLabel(win.window, currentLang);

        itemsHtml += `
          <div class="quota-item ${isLow ? 'is-low' : ''}" data-resets-at="${escapeHtml(win.resetsAt || '')}">
            <div class="quota-item-top">
              <span class="quota-window-title">${escapeHtml(displayTitle)}</span>
              <div class="quota-percent-wrap">
                ${isLow ? `<span class="quota-low-badge">${escapeHtml(dict.lowAllowanceTag)}</span>` : ''}
                <span class="quota-percent">${percent}%</span>
              </div>
            </div>
            <div class="progress-bar-track" role="progressbar" aria-label="${escapeHtml(dict.progressAriaLabel(displayTitle, percent))}" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar-fill" style="width: ${percent}%;"></div>
            </div>
            <div class="quota-item-meta">
              <span class="meta-reset-time">${escapeHtml(dict.resetPrefix)}${escapeHtml(resetCst)}</span>
              <span class="meta-countdown ${countdown.isPassed ? 'is-passed' : ''}">${escapeHtml(countdown.text)}</span>
            </div>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="group-card-header">
          <div class="group-title">
            <span>${escapeHtml(formatGroupLabel(groupName, currentLang))}</span>
          </div>
          <span class="group-tag">${escapeHtml(dict.quotaGroupTag(winList.length))}</span>
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
    if (quotaItems && typeof quotaItems.forEach === 'function') {
      quotaItems.forEach(item => {
        const resetsAt = item.getAttribute ? item.getAttribute('data-resets-at') : null;
        const countdownEl = item.querySelector ? item.querySelector('.meta-countdown') : null;
        if (countdownEl && resetsAt) {
          const countdown = getCountdownInfo(resetsAt, currentLang);
          countdownEl.textContent = countdown.text;
          if (countdown.isPassed) {
            if (countdownEl.classList && countdownEl.classList.add) countdownEl.classList.add('is-passed');
          } else {
            if (countdownEl.classList && countdownEl.classList.remove) countdownEl.classList.remove('is-passed');
          }
        }
      });
    }
  }

  // Render Tasks Table
  function renderTasks(tasks) {
    const list = Array.isArray(tasks) ? tasks : [];
    const dict = I18N[currentLang] || I18N['zh-CN'];
    if (taskCountBadge) taskCountBadge.textContent = String(list.length);

    if (list.length === 0) {
      if (tasksEmpty) tasksEmpty.classList.remove('hidden');
      if (tasksTableWrap) tasksTableWrap.classList.add('hidden');
      if (tasksTableBody) tasksTableBody.innerHTML = '';
      return;
    }

    if (tasksEmpty) tasksEmpty.classList.add('hidden');
    if (tasksTableWrap) tasksTableWrap.classList.remove('hidden');

    const statusMap = {
      queued: dict.statusQueued,
      running: dict.statusRunning,
      completed: dict.statusCompleted,
      failed: dict.statusFailed,
      unknown: dict.statusUnknown
    };

    let rowsHtml = '';
    for (const task of list) {
      const statusClass = ['queued', 'running', 'completed', 'failed'].includes(task.status)
        ? task.status
        : 'unknown';

      const statusLabel = statusMap[task.status] || task.status;

      const rawUsage = task.usage || {};
      const inputVal = rawUsage.inputTokens !== undefined ? rawUsage.inputTokens : rawUsage.input_tokens;
      const outputVal = rawUsage.outputTokens !== undefined ? rawUsage.outputTokens : rawUsage.output_tokens;
      const hasInput = (inputVal !== undefined && inputVal !== null);
      const hasOutput = (outputVal !== undefined && outputVal !== null);

      let tokensText = dict.tokensMissing;
      if (hasInput || hasOutput) {
        const inp = hasInput ? Number(inputVal).toLocaleString() : dict.tokensMissing;
        const out = hasOutput ? Number(outputVal).toLocaleString() : dict.tokensMissing;
        tokensText = `${inp} / ${out}`;
      }

      rowsHtml += `
        <tr>
          <td><span class="task-id-code">${escapeHtml(task.id)}</span></td>
          <td>${escapeHtml(task.model || '-')}</td>
          <td><span class="status-tag ${statusClass}">${escapeHtml(statusLabel)}</span></td>
          <td>${escapeHtml(tokensText)}</td>
          <td>${escapeHtml(formatShanghaiTime(task.startedAt || task.createdAt, currentLang))}</td>
          <td>${escapeHtml(formatShanghaiTime(task.endedAt, currentLang))}</td>
        </tr>
      `;
    }

    if (tasksTableBody) tasksTableBody.innerHTML = rowsHtml;
  }

  // Local dynamic freshness check
  function checkLocalFreshness() {
    if (!freshnessText) return;
    const dict = I18N[currentLang] || I18N['zh-CN'];
    if (lastConnectionState === 'error' && activeError) {
      freshnessText.textContent = dict.freshnessDisconnected;
      freshnessText.className = 'status-value freshness-stale';
      return;
    }
    if (!state) {
      freshnessText.textContent = dict.freshnessAwaiting;
      freshnessText.className = 'status-value freshness-ok';
      return;
    }
    if (state.connection?.state === 'refreshing') {
      freshnessText.textContent = dict.freshnessRefreshing;
      freshnessText.className = 'status-value';
      return;
    }
    if (state.connection?.state === 'error') {
      freshnessText.textContent = dict.freshnessStaleError;
      freshnessText.className = 'status-value freshness-stale';
      return;
    }
    if (!state.usage?.updatedAt) {
      freshnessText.textContent = dict.freshnessAwaitingFirst;
      freshnessText.className = 'status-value';
      return;
    }
    const ageSeconds = (Date.now() - Date.parse(state.usage.updatedAt)) / 1000;
    if (ageSeconds > 120) {
      freshnessText.textContent = dict.freshnessStale120;
      freshnessText.className = 'status-value freshness-stale';
    } else {
      freshnessText.textContent = dict.freshnessRealtime;
      freshnessText.className = 'status-value freshness-ok';
    }
  }

  // Update UI from fetched status
  function applyState(newStatus, isNewStatus = true) {
    state = newStatus;
    const connState = isNewStatus ? (state.connection?.state || 'unavailable') : lastConnectionState;
    updateConnectionBadge(connState);

    // Updated at
    if (updatedAtText) {
      updatedAtText.textContent = formatShanghaiTime(state.usage?.updatedAt, currentLang);
    }

    // Dynamic freshness
    checkLocalFreshness();

    // Error banner
    if (isNewStatus) {
      const detail = state.connection?.error;
      const raw = typeof detail === 'string' ? detail : detail?.message || (detail ? JSON.stringify(detail) : '');
      activeError = raw ? () => raw : null;
    }
    renderError();

    // Quota windows
    renderQuotaGrid(state.usage?.windows || []);

    // Tasks
    renderTasks(state.tasks || []);
  }

  // Set language & update UI immediately
  function setLanguage(lang) {
    if (lang !== 'zh-CN' && lang !== 'en') return;
    currentLang = lang;
    saveLanguagePreference(lang);

    const dict = I18N[currentLang] || I18N['zh-CN'];
    if (document.documentElement) {
      document.documentElement.lang = currentLang;
      if (typeof document.documentElement.setAttribute === 'function') {
        document.documentElement.setAttribute('lang', currentLang);
      }
    }
    document.title = dict.docTitle;

    if (langSelect) {
      if (langSelect.value !== currentLang) {
        langSelect.value = currentLang;
      }
      if (typeof langSelect.setAttribute === 'function') {
        langSelect.setAttribute('aria-label', dict.langSelectLabel);
      }
    }

    // Update static DOM elements if present
    if (supervisorBadge) supervisorBadge.textContent = dict.supervisorBadge;
    if (autoRefreshLabel) autoRefreshLabel.title = dict.autoSyncTitle;
    if (autoRefreshText) autoRefreshText.textContent = dict.autoSyncLabel;
    if (refreshBtn && typeof refreshBtn.setAttribute === 'function') {
      refreshBtn.setAttribute('aria-label', dict.refreshBtnAria);
    }
    if (statusBarSection && typeof statusBarSection.setAttribute === 'function') {
      statusBarSection.setAttribute('aria-label', dict.statusBarAria);
    }
    if (updatedAtLabel) updatedAtLabel.textContent = dict.updatedAtLabel;
    if (freshnessLabel) freshnessLabel.textContent = dict.freshnessLabel;
    if (quotaHeading) quotaHeading.textContent = dict.quotaHeading;
    if (quotaNote) quotaNote.textContent = dict.quotaNote;
    if (tasksHeading) tasksHeading.textContent = dict.tasksHeading;
    if (tasksNote) tasksNote.textContent = dict.tasksNote;
    if (tasksEmptyTitle) tasksEmptyTitle.textContent = dict.tasksEmptyTitle;
    if (tasksEmptySub) tasksEmptySub.textContent = dict.tasksEmptySub;
    if (thTaskId) thTaskId.textContent = dict.thTaskId;
    if (thModel) thModel.textContent = dict.thModel;
    if (thStatus) thStatus.textContent = dict.thStatus;
    if (thTokens) thTokens.textContent = dict.thTokens;
    if (thTimeFirst) thTimeFirst.textContent = dict.thTimeFirst;
    if (thTimeDone) thTimeDone.textContent = dict.thTimeDone;
    if (footerServer) footerServer.innerHTML = dict.footerServer;
    if (footerTz) footerTz.innerHTML = dict.footerTz;
    if (footerDesc) footerDesc.textContent = dict.footerDesc;

    // Button state
    if (refreshBtnText) {
      if (cooldownSecondsRemaining > 0) {
        refreshBtnText.textContent = dict.btnCooldown(cooldownSecondsRemaining);
      } else if (refreshBtn && refreshBtn.disabled) {
        refreshBtnText.textContent = dict.refreshing;
      } else {
        refreshBtnText.textContent = dict.refreshNow;
      }
    }

    if (state) {
      applyState(state, false);
    } else {
      updateConnectionBadge(lastConnectionState);
      checkLocalFreshness();
    }
    renderError();
  }

  // Fetch status from API
  async function fetchStatus() {
    const dict = I18N[currentLang] || I18N['zh-CN'];
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
      if (freshnessText) {
        freshnessText.textContent = dict.freshnessDisconnected;
        freshnessText.className = 'status-value freshness-stale';
      }
      const detail = err.message;
      activeError = (d) => `${d.errConnectPrefix}${detail}`;
      renderError();
    }
  }

  // Start button cooldown (10s)
  function startCooldown(seconds = 10) {
    cooldownSecondsRemaining = seconds;
    if (refreshBtn) refreshBtn.disabled = true;
    if (spinIcon) spinIcon.classList.remove('spinning');

    if (cooldownTimer) clearInterval(cooldownTimer);
    const dict = I18N[currentLang] || I18N['zh-CN'];
    if (refreshBtnText) refreshBtnText.textContent = dict.btnCooldown(cooldownSecondsRemaining);

    cooldownTimer = setInterval(() => {
      cooldownSecondsRemaining -= 1;
      const d = I18N[currentLang] || I18N['zh-CN'];
      if (cooldownSecondsRemaining <= 0) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        if (refreshBtn) refreshBtn.disabled = false;
        if (refreshBtnText) refreshBtnText.textContent = d.refreshNow;
      } else {
        if (refreshBtnText) refreshBtnText.textContent = d.btnCooldown(cooldownSecondsRemaining);
      }
    }, 1000);
  }

  // Manual refresh handler
  async function triggerRefresh() {
    if (cooldownSecondsRemaining > 0) return;
    const dict = I18N[currentLang] || I18N['zh-CN'];

    if (refreshBtn) refreshBtn.disabled = true;
    if (spinIcon) spinIcon.classList.add('spinning');
    if (refreshBtnText) refreshBtnText.textContent = dict.refreshing;
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
      const detail = err.message;
      activeError = (d) => `${d.errRefreshPrefix}${detail}`;
      updateConnectionBadge('error');
      renderError();
    } finally {
      if (spinIcon) spinIcon.classList.remove('spinning');
      startCooldown(10);
    }
  }

  // Auto refresh timer setup
  function setupAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
    if (autoRefreshToggle && autoRefreshToggle.checked) {
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
  if (refreshBtn) refreshBtn.addEventListener('click', triggerRefresh);
  if (autoRefreshToggle) autoRefreshToggle.addEventListener('change', setupAutoRefresh);
  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      if (e && e.target && e.target.value) {
        setLanguage(e.target.value);
      }
    });
  }

  // Bootstrap initial language
  currentLang = resolveInitialLanguage();
  setLanguage(currentLang);

  // Initialize data fetch
  fetchStatus();
  setupAutoRefresh();

  // Tick relative countdowns every second
  countdownUpdateTimer = setInterval(updateAllCountdowns, 1000);
})();
