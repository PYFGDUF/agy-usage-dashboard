import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_MODEL_ID, MAX_TASKS_STORED, STATE_FILE, RUNTIME_DIR } from './config.js';

const VALID_STATUSES = new Set(['queued', 'running', 'completed', 'failed', 'unknown']);

export class TaskStore {
  /**
   * @param {Object} [options]
   * @param {string} [options.stateFile]
   * @param {number} [options.maxTasks]
   */
  constructor(options = {}) {
    this.stateFile = options.stateFile || STATE_FILE;
    this.maxTasks = options.maxTasks || MAX_TASKS_STORED;
    this.tasks = [];
  }

  /**
   * Loads initial tasks if state file exists.
   * @param {Array} [initialTasks]
   */
  init(initialTasks) {
    if (Array.isArray(initialTasks)) {
      const valid = [];
      for (const t of initialTasks) {
        if (
          t &&
          typeof t.id === 'string' &&
          typeof t.status === 'string' &&
          VALID_STATUSES.has(t.status.toLowerCase())
        ) {
          valid.push(t);
        }
      }
      this.tasks = valid.slice(0, this.maxTasks);
    }
  }

  /**
   * Records or updates a Supervisor task event.
   *
   * @param {Object} event
   * @param {string} event.id
   * @param {string} [event.model]
   * @param {string} event.status
   * @param {Object} [event.usage]
   * @returns {Object} the updated/created task
   */
  recordEvent(event) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      const err = new Error('Event body must be an object');
      err.statusCode = 400;
      throw err;
    }

    const { id, model, status, usage } = event;

    if (typeof id !== 'string') {
      const err = new Error('Task "id" is required and must be a string');
      err.statusCode = 400;
      throw err;
    }

    const trimmedId = id.trim();
    if (trimmedId.length === 0 || trimmedId.length > 64) {
      const err = new Error('Task "id" length must be between 1 and 64 characters');
      err.statusCode = 400;
      throw err;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedId)) {
      const err = new Error('Task "id" must contain only alphanumeric characters, underscores, or dashes');
      err.statusCode = 400;
      throw err;
    }

    if (!status || typeof status !== 'string' || !VALID_STATUSES.has(status.toLowerCase())) {
      const err = new Error(`Task "status" must be one of: ${Array.from(VALID_STATUSES).join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const normalizedStatus = status.toLowerCase();

    let normalizedModel = DEFAULT_MODEL_ID;
    if (model !== undefined && model !== null) {
      if (typeof model !== 'string') {
        const err = new Error('Task "model" must be a string');
        err.statusCode = 400;
        throw err;
      }
      const trimmedModel = model.trim();
      if (trimmedModel.length === 0 || trimmedModel.length > 64 || !/^[a-zA-Z0-9_.:\/-]+$/.test(trimmedModel)) {
        const err = new Error('Task "model" contains invalid characters or exceeds 64 characters');
        err.statusCode = 400;
        throw err;
      }
      normalizedModel = trimmedModel;
    }

    let sanitizedUsage = null;
    if (usage !== undefined && usage !== null) {
      if (typeof usage !== 'object' || Array.isArray(usage)) {
        const err = new Error('Task "usage" must be an object');
        err.statusCode = 400;
        throw err;
      }
      sanitizedUsage = {};
      const MAX_TOKENS = 100_000_000_000;

      for (const key of Object.keys(usage)) {
        if (key !== 'inputTokens' && key !== 'outputTokens') {
          const err = new Error(`Unexpected field in task usage: "${key}"`);
          err.statusCode = 400;
          throw err;
        }
      }

      if (usage.inputTokens !== undefined) {
        if (
          typeof usage.inputTokens !== 'number' ||
          !Number.isFinite(usage.inputTokens) ||
          !Number.isInteger(usage.inputTokens) ||
          usage.inputTokens < 0 ||
          usage.inputTokens > MAX_TOKENS
        ) {
          const err = new Error('Task usage.inputTokens must be a non-negative bounded integer');
          err.statusCode = 400;
          throw err;
        }
        sanitizedUsage.inputTokens = usage.inputTokens;
      }

      if (usage.outputTokens !== undefined) {
        if (
          typeof usage.outputTokens !== 'number' ||
          !Number.isFinite(usage.outputTokens) ||
          !Number.isInteger(usage.outputTokens) ||
          usage.outputTokens < 0 ||
          usage.outputTokens > MAX_TOKENS
        ) {
          const err = new Error('Task usage.outputTokens must be a non-negative bounded integer');
          err.statusCode = 400;
          throw err;
        }
        sanitizedUsage.outputTokens = usage.outputTokens;
      }
    }

    const nowIso = new Date().toISOString();
    const existingIndex = this.tasks.findIndex(t => t.id === trimmedId);

    let updatedTask;
    if (existingIndex !== -1) {
      const existing = this.tasks[existingIndex];
      let startedAt = existing.startedAt;
      if (!startedAt && normalizedStatus === 'running') {
        startedAt = nowIso;
      }

      const isTerminal = normalizedStatus === 'completed' || normalizedStatus === 'failed';
      const endedAt = isTerminal ? (existing.endedAt || nowIso) : null;

      updatedTask = {
        ...existing,
        model: model !== undefined ? normalizedModel : existing.model,
        status: normalizedStatus,
        usage: sanitizedUsage ? { ...existing.usage, ...sanitizedUsage } : existing.usage,
        startedAt,
        updatedAt: nowIso,
        endedAt
      };
      this.tasks[existingIndex] = updatedTask;
    } else {
      const isTerminal = normalizedStatus === 'completed' || normalizedStatus === 'failed';
      const startedAt = normalizedStatus === 'queued' ? null : nowIso;
      updatedTask = {
        id: trimmedId,
        model: normalizedModel,
        status: normalizedStatus,
        usage: sanitizedUsage || {},
        createdAt: nowIso,
        startedAt,
        updatedAt: nowIso,
        endedAt: isTerminal ? nowIso : null
      };
      // Insert at front
      this.tasks.unshift(updatedTask);
      if (this.tasks.length > this.maxTasks) {
        this.tasks = this.tasks.slice(0, this.maxTasks);
      }
    }

    return updatedTask;
  }

  /**
   * Returns list of recorded tasks.
   * @returns {Array<Object>}
   */
  getTasks() {
    return [...this.tasks];
  }
}
