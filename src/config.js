import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const PUBLIC_DIR = path.resolve(PROJECT_ROOT, 'public');
export const RUNTIME_DIR = process.env.AGY_USAGE_RUNTIME_DIR
  ? path.resolve(process.env.AGY_USAGE_RUNTIME_DIR)
  : path.resolve(PROJECT_ROOT, '.runtime');
export const STATE_FILE = path.resolve(RUNTIME_DIR, 'state.json');

export const DEFAULT_PORT = parseInt(process.env.AGY_USAGE_PORT || process.env.PORT || '8766', 10);
export const HOST = '127.0.0.1';

export const REFRESH_INTERVAL_SECONDS = 60;
export const STALE_THRESHOLD_SECONDS = 120;
export const MIN_PROCESS_INTERVAL_SECONDS = 30;
export const MANUAL_REFRESH_COOLDOWN_SECONDS = 10;
export const CLI_TIMEOUT_MS = 20000;
export const MAX_CLI_BUFFER_BYTES = 64 * 1024;
export const MAX_TASKS_STORED = 100;
export const MAX_BODY_SIZE_BYTES = 100 * 1024;

export const DEFAULT_MODEL_ID = 'gemini-3.8-flash-high';
export const APP_ID = 'agy-usage-dashboard';
export const APP_VERSION = '1.0.0';
