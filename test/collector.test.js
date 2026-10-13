import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { QuotaCollector, resolveAgyBinary, categorizeCliError } from '../src/collector.js';
import { TaskStore } from '../src/task-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const FAKE_AGY = path.join(FIXTURES_DIR, 'fake-agy.sh');

describe('Collector & TaskStore Tests', () => {
  let tempDir;
  let stateFile;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-collector-test-'));
    stateFile = path.join(tempDir, 'state.json');
    delete process.env.MOCK_AGY_MODE;
    delete process.env.AGY_PATH;
    delete process.env.TRACK_INVOCATIONS_FILE;
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
    delete process.env.MOCK_AGY_MODE;
    delete process.env.AGY_PATH;
    delete process.env.TRACK_INVOCATIONS_FILE;
  });

  it('resolves binary from custom path and never falls back when invalid', () => {
    const resolved = resolveAgyBinary(FAKE_AGY);
    assert.equal(resolved, FAKE_AGY);

    // Invalid custom path throws without falling back
    assert.throws(
      () => resolveAgyBinary('/non/existent/path/agy'),
      /Specified Antigravity CLI path is not executable/
    );

    // Invalid AGY_PATH env throws without falling back
    process.env.AGY_PATH = '/non/existent/env/agy';
    assert.throws(
      () => resolveAgyBinary(),
      /AGY_PATH executable is not accessible/
    );
  });

  it('categorizes CLI errors into generic Chinese diagnostic categories', () => {
    assert.equal(categorizeCliError(new Error('Permission denied to quota')), '权限不足，无法访问配额');
    assert.equal(categorizeCliError(new Error('Auth token expired or unauthorized 401')), '认证失败，请检查登录状态');
    assert.equal(categorizeCliError({ killed: true, code: 'ETIMEDOUT' }), '执行超时，CLI 响应过慢');
    assert.equal(categorizeCliError(new Error('fetch ECONNREFUSED')), '网络连接失败，请检查网络设置');
    assert.equal(categorizeCliError(new Error('Malformed quota row')), '配额数据格式解析失败');
    assert.equal(categorizeCliError(new Error('something else unexpected')), 'CLI 执行异常');
  });

  it('performs initial refresh successfully with mock executable', async () => {
    const collector = new QuotaCollector({
      agyPath: FAKE_AGY,
      runtimeDir: tempDir,
      stateFile
    });

    const status = await collector.refresh({ force: true });
    assert.equal(status.connection.state, 'ready');
    assert.equal(status.connection.error, null);
    assert.equal(status.usage.stale, false);
    assert.equal(status.usage.windows.length, 4);

    // Verify persisted state
    assert.ok(fs.existsSync(stateFile));
    const persisted = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    assert.equal(persisted.windows.length, 4);
    assert.equal(persisted.connectionState, 'ready');
  });

  it('joins concurrent refresh calls and deduplicates actual process invocations', async () => {
    // Create tracking wrapper script
    const trackFile = path.join(tempDir, 'invocations.log');
    const trackingScript = path.join(tempDir, 'tracking-agy.sh');
    fs.writeFileSync(
      trackingScript,
      `#!/bin/bash\necho "invoked" >> "${trackFile}"\nexec /bin/bash "${FAKE_AGY}"\n`,
      { mode: 0o755 }
    );

    const collector = new QuotaCollector({
      agyPath: trackingScript,
      runtimeDir: tempDir,
      stateFile
    });

    // Fire 3 concurrent calls
    const p1 = collector.refresh({ force: true });
    const p2 = collector.refresh({ force: true });
    const p3 = collector.refresh({ force: true });

    const [res1, res2, res3] = await Promise.all([p1, p2, p3]);
    assert.equal(res1.connection.state, 'ready');
    assert.equal(res2.connection.state, 'ready');
    assert.equal(res3.connection.state, 'ready');

    // Verify exactly 1 CLI invocation occurred!
    assert.ok(fs.existsSync(trackFile));
    const lines = fs.readFileSync(trackFile, 'utf8').trim().split('\n').filter(Boolean);
    assert.equal(lines.length, 1, `Expected exactly 1 invocation, got ${lines.length}`);
  });

  it('throttles repeated attempts even after initial load failure (failure-first throttle)', async () => {
    // Tracking wrapper
    const trackFile = path.join(tempDir, 'failure-invocations.log');
    const trackingScript = path.join(tempDir, 'tracking-fail-agy.sh');
    fs.writeFileSync(
      trackingScript,
      `#!/bin/bash\necho "invoked" >> "${trackFile}"\nexec /bin/bash "${FAKE_AGY}"\n`,
      { mode: 0o755 }
    );

    process.env.MOCK_AGY_MODE = 'error';

    const collector = new QuotaCollector({
      agyPath: trackingScript,
      runtimeDir: tempDir,
      stateFile,
      manualCooldownSeconds: 10
    });

    // First load fails
    const failRes = await collector.refresh({ force: true });
    assert.equal(failRes.connection.state, 'error');
    assert.equal(collector.lastUpdatedAt, null);

    // Immediate second call MUST be throttled despite lastUpdatedAt being null
    const throttledRes = await collector.refresh({ force: true });
    assert.equal(throttledRes.connection.state, 'error');

    // Verify only 1 invocation occurred
    const lines = fs.readFileSync(trackFile, 'utf8').trim().split('\n').filter(Boolean);
    assert.equal(lines.length, 1, 'Second invocation should have been throttled by failure cooldown');
  });

  it('enforces injected short CLI timeout without waiting 20 seconds', async () => {
    process.env.MOCK_AGY_MODE = 'hang';

    const collector = new QuotaCollector({
      agyPath: FAKE_AGY,
      runtimeDir: tempDir,
      stateFile,
      cliTimeoutMs: 200 // short timeout injected
    });

    const startTime = Date.now();
    const res = await collector.refresh({ force: true });
    const durationMs = Date.now() - startTime;

    assert.ok(durationMs < 2000, `Expected quick timeout under 2000ms, took ${durationMs}ms`);
    assert.equal(res.connection.state, 'error');
    assert.equal(res.connection.error, '执行超时，CLI 响应过慢');
  });

  it('validates schema on restart, retains failed state, drops corrupt items and marks stale', () => {
    // Corrupt and duplicate items in persisted state
    const dirtyState = {
      schemaVersion: 1,
      updatedAt: '2026-10-12T10:00:00.000Z',
      connectionState: 'error',
      lastError: 'Permission denied',
      windows: [
        { id: 'win-1', group: 'G1', window: 'W1', remainingPercent: 75, resetsAt: '2026-10-15T08:00:00.000Z' },
        { id: 'corrupt-win', group: 'G1', remainingPercent: 999 }, // invalid percent
        { id: 'win-1', group: 'G1', window: 'W1', remainingPercent: 75, resetsAt: '2026-10-15T08:00:00.000Z' } // duplicate id
      ],
      tasks: [
        { id: 'task-good', status: 'running', model: 'gemini-3.8-flash-high' },
        { id: 'task-bad', status: 'invalid_status_value' }
      ]
    };
    fs.writeFileSync(stateFile, JSON.stringify(dirtyState, null, 2), 'utf8');

    // Reload collector from state
    const collector = new QuotaCollector({
      agyPath: FAKE_AGY,
      runtimeDir: tempDir,
      stateFile
    });

    assert.equal(collector.connectionState, 'error');
    assert.equal(collector.lastError, '权限不足，无法访问配额');
    assert.equal(collector.isStale(), true);

    // Only 1 valid, deduplicated window restored
    assert.equal(collector.windows.length, 1);
    assert.equal(collector.windows[0].id, 'win-1');

    // Only valid tasks loaded
    const tasks = collector.taskStore.getTasks();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, 'task-good');
  });

  it('retains previous successful windows on refresh failure and marks stale', async () => {
    const collector = new QuotaCollector({
      agyPath: FAKE_AGY,
      runtimeDir: tempDir,
      stateFile,
      manualCooldownSeconds: 0 // allow immediate testing
    });

    // 1. Successful first call
    await collector.refresh({ force: true });
    assert.equal(collector.windows.length, 4);

    // 2. Second call fails (error mode)
    collector.lastFetchCompletedAt = 0;
    process.env.MOCK_AGY_MODE = 'error';
    const failedStatus = await collector.refresh({ force: true });

    assert.equal(failedStatus.connection.state, 'error');
    assert.equal(failedStatus.connection.error, '权限不足，无法访问配额');
    // Windows must still be retained from previous success!
    assert.equal(failedStatus.usage.windows.length, 4);
    // Must be marked stale on error!
    assert.equal(failedStatus.usage.stale, true);
  });

  it('records and bounds task events in TaskStore', () => {
    const store = new TaskStore({ stateFile, maxTasks: 3 });

    // Validation checks
    assert.throws(() => store.recordEvent(null), /must be an object/);
    assert.throws(() => store.recordEvent({ id: '', status: 'running' }), /Task "id" length/);
    assert.throws(() => store.recordEvent({ id: 'task-1', status: 'invalid_status' }), /Task "status" must be one of/);
    assert.throws(() => store.recordEvent({ id: 'task-1', status: 'running', model: 'bad*model' }), /Task "model" contains invalid characters/);
    assert.throws(() => store.recordEvent({ id: 'task-1', status: 'running', usage: { inputTokens: -10 } }), /Task usage.inputTokens must be a non-negative bounded integer/);
    assert.throws(() => store.recordEvent({ id: 'task-1', status: 'running', usage: { unknownField: 10 } }), /Unexpected field/);

    // Add 4 tasks to verify maxTasks (3) bounding & queued lifecycle
    const queuedTask = store.recordEvent({ id: 'task-1', status: 'queued' });
    assert.equal(queuedTask.status, 'queued');
    assert.equal(queuedTask.startedAt, null);

    store.recordEvent({ id: 'task-2', status: 'running', usage: { inputTokens: 100 } });
    store.recordEvent({ id: 'task-3', status: 'running' });
    store.recordEvent({ id: 'task-4', status: 'completed', usage: { outputTokens: 250 } });

    const tasks = store.getTasks();
    assert.equal(tasks.length, 3);
    assert.equal(tasks[0].id, 'task-4');
    assert.equal(tasks[1].id, 'task-3');
    assert.equal(tasks[2].id, 'task-2');

    // Update existing task
    store.recordEvent({ id: 'task-3', status: 'completed' });
    const updated = store.getTasks().find(t => t.id === 'task-3');
    assert.equal(updated.status, 'completed');
    assert.ok(updated.endedAt);
  });

  it('canonicalizes snake_case exact fields to inputTokens/outputTokens, preserves numeric 0, rejects conflicting aliases, and never infers counts', () => {
    const store = new TaskStore({ stateFile });

    // 1. Accepts snake_case exact fields and canonicalizes them in stored tasks
    const taskSnake = store.recordEvent({
      id: 'task-snake-1',
      status: 'completed',
      usage: { input_tokens: 1500, output_tokens: 300 }
    });
    assert.equal(taskSnake.usage.inputTokens, 1500);
    assert.equal(taskSnake.usage.outputTokens, 300);
    assert.equal(taskSnake.usage.input_tokens, undefined, 'Stored usage must only contain canonical keys');
    assert.equal(taskSnake.usage.output_tokens, undefined, 'Stored usage must only contain canonical keys');

    // 2. Preserves exact numeric zero without inferring or omitting
    const taskZero = store.recordEvent({
      id: 'task-zero',
      status: 'completed',
      usage: { input_tokens: 0, output_tokens: 0 }
    });
    assert.equal(taskZero.usage.inputTokens, 0);
    assert.equal(taskZero.usage.outputTokens, 0);

    // 3. Never infers counts: single-sided usage leaves other side undefined
    const taskSingle = store.recordEvent({
      id: 'task-single-input',
      status: 'running',
      usage: { input_tokens: 420 }
    });
    assert.equal(taskSingle.usage.inputTokens, 420);
    assert.equal(taskSingle.usage.outputTokens, undefined, 'outputTokens must not be inferred');

    const taskSingleOut = store.recordEvent({
      id: 'task-single-output',
      status: 'running',
      usage: { output_tokens: 0 }
    });
    assert.equal(taskSingleOut.usage.inputTokens, undefined, 'inputTokens must not be inferred');
    assert.equal(taskSingleOut.usage.outputTokens, 0);

    // 4. Rejects conflicting aliases
    assert.throws(
      () => store.recordEvent({
        id: 'task-conflict-1',
        status: 'running',
        usage: { inputTokens: 100, input_tokens: 200 }
      }),
      /Conflicting aliases/
    );
    assert.throws(
      () => store.recordEvent({
        id: 'task-conflict-2',
        status: 'running',
        usage: { outputTokens: 50, output_tokens: 60 }
      }),
      /Conflicting aliases/
    );

    // 5. Accepts identical non-conflicting aliases and canonicalizes
    const taskMatching = store.recordEvent({
      id: 'task-matching',
      status: 'running',
      usage: { inputTokens: 500, input_tokens: 500, outputTokens: 100, output_tokens: 100 }
    });
    assert.equal(taskMatching.usage.inputTokens, 500);
    assert.equal(taskMatching.usage.outputTokens, 100);

    // 6. Rejects malformed snake_case values
    assert.throws(
      () => store.recordEvent({
        id: 'task-bad-1',
        status: 'running',
        usage: { input_tokens: -1 }
      }),
      /Task usage.input_tokens must be a non-negative bounded integer/
    );
    assert.throws(
      () => store.recordEvent({
        id: 'task-bad-2',
        status: 'running',
        usage: { output_tokens: 2.5 }
      }),
      /Task usage.output_tokens must be a non-negative bounded integer/
    );
    assert.throws(
      () => store.recordEvent({
        id: 'task-bad-3',
        status: 'running',
        usage: { input_tokens: '100' }
      }),
      /Task usage.input_tokens must be a non-negative bounded integer/
    );

    // 7. init canonicalizes loaded initial tasks with snake_case
    const reloadedStore = new TaskStore({ stateFile });
    reloadedStore.init([
      { id: 'init-task-1', status: 'completed', usage: { input_tokens: 888, output_tokens: 222 } },
      { id: 'init-task-2', status: 'running', usage: { inputTokens: 50 } }
    ]);
    const initTasks = reloadedStore.getTasks();
    assert.equal(initTasks.length, 2);
    assert.equal(initTasks[0].usage.inputTokens, 888);
    assert.equal(initTasks[0].usage.outputTokens, 222);
    assert.equal(initTasks[0].usage.input_tokens, undefined);
  });
});
