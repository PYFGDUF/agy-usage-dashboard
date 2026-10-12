/**
 * Parses timestamp string into an ISO UTC string.
 * Supports:
 * - ISO 8601: "2026-10-15T08:29:26Z"
 * - CST string: "2026-10-15 16:29 CST" or "2026-10-15 16:29:00 CST" (China Standard Time, UTC+8)
 * - Standard Date-compatible strings
 */
export function parseResetTimestamp(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error('Reset timestamp must be a non-empty string');
  }

  const trimmed = dateStr.trim();

  // CST: e.g. "2026-10-15 16:29 CST" or "2026-10-15 16:29:30 CST"
  const cstMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+CST$/);
  if (cstMatch) {
    const year = parseInt(cstMatch[1], 10);
    const month = parseInt(cstMatch[2], 10) - 1;
    const day = parseInt(cstMatch[3], 10);
    const hour = parseInt(cstMatch[4], 10);
    const min = parseInt(cstMatch[5], 10);
    const sec = cstMatch[6] ? parseInt(cstMatch[6], 10) : 0;

    // CST is UTC+8, subtract 8 hours for UTC
    const utcTimestamp = Date.UTC(year, month, day, hour - 8, min, sec);
    const d = new Date(utcTimestamp);
    if (isNaN(d.getTime())) {
      throw new Error(`Failed to parse CST timestamp: "${trimmed}"`);
    }
    return d.toISOString();
  }

  // ISO or other formats
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date format for reset timestamp: "${trimmed}"`);
  }
  return parsed.toISOString();
}

/**
 * Creates a slug identifier from group and window names.
 */
export function generateWindowId(group, window) {
  const cleanGroup = group.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const cleanWindow = window.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `${cleanGroup}-${cleanWindow}`;
}

/**
 * Parses raw output from `agy --print /usage --print-timeout 15s`.
 * Handles both TAB-separated and multi-space aligned outputs.
 *
 * @param {string} rawText
 * @returns {Array<{id: string, group: string, window: string, remainingPercent: number, resetsAt: string}>}
 */
export function parseUsageOutput(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error('Empty or invalid output from agy usage');
  }

  let textToParse = rawText.trim();
  if (textToParse.startsWith('{') && textToParse.endsWith('}')) {
    try {
      const parsedJson = JSON.parse(textToParse);
      if (parsedJson && typeof parsedJson.response === 'string') {
        textToParse = parsedJson.response;
      }
    } catch {
      // Continue parsing as plain text
    }
  }

  const lines = textToParse.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const windows = [];
  const seenIds = new Set();

  for (const line of lines) {
    // Skip header lines like "Quota:"
    if (/^quota:?$/i.test(line) || /^(model\s+group|group)\s+(window|quota)/i.test(line)) {
      continue;
    }

    let parts = [];
    if (line.includes('\t')) {
      parts = line.split('\t').map(s => s.trim()).filter(Boolean);
    } else {
      // Split by 2 or more spaces
      parts = line.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
    }

    // Determine if this line is recognized as a quota data row
    const isRecognizedRow = line.includes('\t') || parts.length >= 2 || line.includes('%');
    if (!isRecognizedRow) {
      continue;
    }

    if (parts.length < 4) {
      throw new Error(`Malformed quota row: expected at least 4 fields, got ${parts.length} in line: "${line}"`);
    }

    const group = parts[0];
    const window = parts[1];
    const percentStr = parts[2];
    const resetTimeStr = parts.slice(3).join(' '); // in case timestamp was split

    const percentMatch = percentStr.match(/^(\d{1,3})%$/);
    if (!percentMatch) {
      throw new Error(`Malformed quota row: invalid percentage "${percentStr}" in line: "${line}"`);
    }

    const remainingPercent = parseInt(percentMatch[1], 10);
    if (isNaN(remainingPercent) || remainingPercent < 0 || remainingPercent > 100) {
      throw new Error(`Invalid remaining percentage value: "${percentStr}"`);
    }

    const resetsAt = parseResetTimestamp(resetTimeStr);
    const id = generateWindowId(group, window);

    if (seenIds.has(id)) {
      throw new Error(`Duplicate quota window id "${id}" detected in usage output`);
    }
    seenIds.add(id);

    windows.push({
      id,
      group,
      window,
      remainingPercent,
      resetsAt
    });
  }

  if (windows.length === 0) {
    throw new Error('No valid quota windows parsed from agy usage output');
  }

  return windows;
}
