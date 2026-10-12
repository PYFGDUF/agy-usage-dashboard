import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CLI_TIMEOUT_MS,
  HOST,
  MANUAL_REFRESH_COOLDOWN_SECONDS,
  MAX_CLI_BUFFER_BYTES,
  MIN_PROCESS_INTERVAL_SECONDS,
  REFRESH_INTERVAL_SECONDS,
  RUNTIME_DIR,
  STALE_THRESHOLD_SECONDS,
  STATE_FILE
} from './config.js';
import { parseUsageOutput } from './parser.js';
import { TaskStore } from './task-store.js';

export function resolveAgyBinary(customPath) {
  if (customPath && typeof customPath === 'string') {
    try {
      fs.accessSync(customPath, fs.constants.X_OK);
      return customPath;
    } catch {
      throw new Error(`Specified Antigravity CLI path is not executable: "${customPath}"`);
    }
  }

  if (process.env.AGY_PATH) {
    try {
      fs.accessSync(process.env.AGY_PATH, fs.constants.X_OK);
      return process.env.AGY_PATH;
    } catch {
      throw new Error(`AGY_PATH executable is not accessible: "${process.env.AGY_PATH}"`);
    }
  }

  const homedir = os.homedir();
  const candidatePaths = [
    path.join(homedir, '.local', 'bin', 'agy'),
    path.join(homedir, '.gemini', 'antigravity-cli', 'bin', 'agy'),
    '/opt/homebrew/bin/agy',
    '/usr/local/bin/agy'
  ];

  // Also check PATH
  if (process.env.PATH) {
    const pathDirs = process.env.PATH.split(path.delimiter);
    for (const dir of pathDirs) {
      if (dir) {
        candidatePaths.push(path.join(dir, 'agy'));
      }
    }
  }

  for (const candidate of candidatePaths) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Continue searching
    }
  }

  throw new Error('Antigravity CLI executable ("agy") not found in PATH or standard directories');
}

/**
 * Categorize CLI execution and parsing errors into short, generic Chinese categories.
 * Prevents raw stderr, email addresses, or internal paths from leaking to state or API.
 */
export function categorizeCliError(error, stderr = '') {
  const msg = error?.message || '';

  // If already categorized, preserve category directly
  const KNOWN_CATEGORIES = new Set([
    '执行超时，CLI 响应过慢',
    '权限不足，无法访问配额',
    '认证失败，请检查登录状态',
    '网络连接失败，请检查网络设置',
    '配额数据格式解析失败',
    'CLI 返回内容为空',
    'CLI 执行异常'
  ]);
  if (KNOWN_CATEGORIES.has(msg)) {
    return msg;
  }

  const errText = `${msg} ${stderr || ''}`.toLowerCase();

  if (
    error?.killed ||
    error?.code === 'ETIMEDOUT' ||
    error?.signal === 'SIGTERM' ||
    /\b(timed out|timeout expired|operation timed out)\b/i.test(msg) ||
    errText.includes('timed out') ||
    errText.includes('timeout expired') ||
    errText.includes('超时')
  ) {
    return '执行超时，CLI 响应过慢';
  }

  if (errText.includes('permission') || errText.includes('access denied') || errText.includes('forbidden') || errText.includes('权限')) {
    return '权限不足，无法访问配额';
  }
  if (errText.includes('auth') || errText.includes('login') || errText.includes('credential') || errText.includes('unauthorized') || errText.includes('unauthenticated') || errText.includes('认证') || errText.includes('登录')) {
    return '认证失败，请检查登录状态';
  }
  if (errText.includes('econnrefused') || errText.includes('enotfound') || errText.includes('network') || errText.includes('connect') || errText.includes('网络')) {
    return '网络连接失败，请检查网络设置';
  }
  if (errText.includes('parse') || errText.includes('malformed') || errText.includes('duplicate') || errText.includes('解析')) {
    return '配额数据格式解析失败';
  }
  if (errText.includes('empty') || errText.includes('为空')) {
    return 'CLI 返回内容为空';
  }
  return 'CLI 执行异常';
}

export class QuotaCollector {
  /**
   * @param {Object} [options]
   * @param {string} [options.agyPath]
   * @param {string} [options.stateFile]
   * @param {string} [options.runtimeDir]
   * @param {TaskStore} [options.taskStore]
   * @param {number} [options.manualCooldownSeconds]
   * @param {number} [options.minProcessIntervalSeconds]
   * @param {number} [options.cliTimeoutMs]
   */
  constructor(options = {}) {
    this.customAgyPath = options.agyPath || null;
    this.runtimeDir = options.runtimeDir || RUNTIME_DIR;
    this.stateFile = options.stateFile || (this.runtimeDir ? path.resolve(this.runtimeDir, 'state.json') : STATE_FILE);
    this.taskStore = options.taskStore || new TaskStore({ stateFile: this.stateFile });

    this.manualCooldownSeconds = options.manualCooldownSeconds ?? MANUAL_REFRESH_COOLDOWN_SECONDS;
    this.minProcessIntervalSeconds = options.minProcessIntervalSeconds ?? MIN_PROCESS_INTERVAL_SECONDS;
    this.cliTimeoutMs = options.cliTimeoutMs ?? CLI_TIMEOUT_MS;

    this.windows = [];
    this.lastUpdatedAt = null;
    this.lastFetchCompletedAt = 0;
    this.lastError = null;
    this.connectionState = 'unavailable'; // 'unavailable' | 'ready' | 'refreshing' | 'error'
    this.pendingPromise = null;

    this.ensureRuntimeDir();
    this.loadState();
  }

  ensureRuntimeDir() {
    try {
      if (!fs.existsSync(this.runtimeDir)) {
        fs.mkdirSync(this.runtimeDir, { recursive: true, mode: 0o700 });
      }
    } catch {
      // Ignore
    }
  }

  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const raw = fs.readFileSync(this.stateFile, 'utf8');
        const data = JSON.parse(raw);
        if (data && typeof data === 'object' && data.schemaVersion === 1) {
          if (Array.isArray(data.windows)) {
            const validWindows = [];
            const seenIds = new Set();
            for (const win of data.windows) {
              if (
                win &&
                typeof win.id === 'string' &&
                typeof win.group === 'string' &&
                typeof win.window === 'string' &&
                typeof win.remainingPercent === 'number' &&
                Number.isFinite(win.remainingPercent) &&
                win.remainingPercent >= 0 &&
                win.remainingPercent <= 100 &&
                typeof win.resetsAt === 'string' &&
                !isNaN(Date.parse(win.resetsAt)) &&
                !seenIds.has(win.id)
              ) {
                seenIds.add(win.id);
                validWindows.push({
                  id: win.id,
                  group: win.group,
                  window: win.window,
                  remainingPercent: Math.floor(win.remainingPercent),
                  resetsAt: win.resetsAt
                });
              }
            }
            this.windows = validWindows;
          }
          if (typeof data.updatedAt === 'string' && !isNaN(Date.parse(data.updatedAt))) {
            this.lastUpdatedAt = data.updatedAt;
          }
          if (typeof data.lastError === 'string') {
            this.lastError = categorizeCliError(new Error(data.lastError));
          }
          if (data.connectionState === 'error') {
            this.connectionState = 'error';
          } else if (data.connectionState === 'ready' && this.lastUpdatedAt) {
            this.connectionState = 'ready';
          } else {
            this.connectionState = this.lastUpdatedAt ? 'ready' : 'unavailable';
          }
          if (Array.isArray(data.tasks)) {
            this.taskStore.init(data.tasks);
          }
        }
      }
    } catch {
      // If corrupted or unreadable, start clean
    }
  }

  persistState() {
    this.ensureRuntimeDir();
    try {
      const persistedConnection = this.connectionState === 'refreshing'
        ? (this.lastError ? 'error' : (this.lastUpdatedAt ? 'ready' : 'unavailable'))
        : this.connectionState;

      const state = {
        schemaVersion: 1,
        updatedAt: this.lastUpdatedAt,
        connectionState: persistedConnection,
        lastError: this.lastError,
        windows: this.windows,
        tasks: this.taskStore.getTasks()
      };
      const tmpFile = `${this.stateFile}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), { mode: 0o600 });
      fs.renameSync(tmpFile, this.stateFile);
    } catch (err) {
      // State persistence failure should not crash the collector
    }
  }

  isStale() {
    if (!this.lastUpdatedAt) return true;
    if (this.connectionState === 'error') return true;
    const ageSeconds = (Date.now() - Date.parse(this.lastUpdatedAt)) / 1000;
    return ageSeconds > STALE_THRESHOLD_SECONDS;
  }

  getStatus() {
    return {
      schemaVersion: 1,
      connection: {
        state: this.connectionState,
        error: this.lastError
      },
      usage: {
        source: this.lastUpdatedAt ? 'cli' : 'initial',
        updatedAt: this.lastUpdatedAt,
        stale: this.isStale(),
        refreshIntervalSeconds: REFRESH_INTERVAL_SECONDS,
        windows: this.windows
      },
      tasks: this.taskStore.getTasks()
    };
  }

  /**
   * Runs the agy CLI with bounded arguments and passes native --log-file inside runtime
   */
  async executeAgyCli() {
    const binary = resolveAgyBinary(this.customAgyPath);
    const cliLogFile = path.join(this.runtimeDir, 'agy-cli.log');
    const args = ['--log-file', cliLogFile, '--print', '/usage', '--print-timeout', '15s'];

    return new Promise((resolve, reject) => {
      execFile(
        binary,
        args,
        {
          timeout: this.cliTimeoutMs,
          maxBuffer: MAX_CLI_BUFFER_BYTES,
          env: {
            ...process.env
          }
        },
        (error, stdout, stderr) => {
          // Bounded generic audit in runtime dir - NO raw stdout/stderr
          try {
            const diagPath = path.join(this.runtimeDir, 'agy-usage-status.log');
            const summary = `[${new Date().toISOString()}] exitCode=${error ? (error.code ?? 1) : 0} ` +
              `stdoutBytes=${stdout ? stdout.length : 0} stderrBytes=${stderr ? stderr.length : 0}\n`;
            fs.writeFileSync(diagPath, summary, 'utf8');
          } catch {
            // Non-critical
          }

          if (error) {
            const categoryMsg = categorizeCliError(error, stderr);
            return reject(new Error(categoryMsg));
          }

          if (!stdout || !stdout.trim()) {
            return reject(new Error('CLI 返回内容为空'));
          }

          try {
            const parsedWindows = parseUsageOutput(stdout);
            resolve(parsedWindows);
          } catch (parseErr) {
            const categoryMsg = categorizeCliError(parseErr);
            reject(new Error(categoryMsg));
          }
        }
      );
    });
  }

  /**
   * Refreshes quota information.
   * Concurrent requests join the same pending promise.
   * Honors cooldown and minimum interval even after failed fetch attempts.
   *
   * @param {Object} [options]
   * @param {boolean} [options.force=false]
   */
  async refresh({ force = false } = {}) {
    // If a refresh is already in flight, join the same pending promise
    if (this.pendingPromise) {
      return this.pendingPromise;
    }

    const now = Date.now();
    const timeSinceLastFetch = (now - this.lastFetchCompletedAt) / 1000;

    // Cooldown check: applies even if initial or previous refresh failed
    if (this.lastFetchCompletedAt > 0 && timeSinceLastFetch < this.manualCooldownSeconds) {
      return this.getStatus();
    }

    // Interval check for non-forced requests
    if (!force && this.lastFetchCompletedAt > 0 && timeSinceLastFetch < this.minProcessIntervalSeconds) {
      return this.getStatus();
    }

    this.connectionState = 'refreshing';

    this.pendingPromise = (async () => {
      try {
        const freshWindows = await this.executeAgyCli();
        this.windows = freshWindows;
        this.lastUpdatedAt = new Date().toISOString();
        this.lastError = null;
        this.connectionState = 'ready';
        this.lastFetchCompletedAt = Date.now();
        this.persistState();
      } catch (err) {
        this.connectionState = 'error';
        this.lastError = categorizeCliError(err);
        this.lastFetchCompletedAt = Date.now();
        // Retain previous windows on error
        this.persistState();
      } finally {
        this.pendingPromise = null;
      }
      return this.getStatus();
    })();

    return this.pendingPromise;
  }
}
