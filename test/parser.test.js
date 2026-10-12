import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUsageOutput, parseResetTimestamp, generateWindowId } from '../src/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

describe('Parser Unit Tests', () => {
  it('parses standard tab-separated usage TSV correctly', () => {
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'valid-usage.tsv'), 'utf8');
    const windows = parseUsageOutput(raw);

    assert.equal(windows.length, 4);

    const first = windows[0];
    assert.equal(first.group, 'Gemini Models');
    assert.equal(first.window, 'Weekly Limit Remaining');
    assert.equal(first.remainingPercent, 85);
    assert.equal(first.resetsAt, '2026-10-15T08:29:26.000Z');
    assert.equal(first.id, 'gemini-models-weekly-limit-remaining');

    const second = windows[1];
    assert.equal(second.remainingPercent, 72);
  });

  it('parses real multi-space CST aligned output with Quota header', () => {
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'valid-usage-spaces.txt'), 'utf8');
    const windows = parseUsageOutput(raw);

    assert.equal(windows.length, 4);

    const first = windows[0];
    assert.equal(first.group, 'Gemini Models');
    assert.equal(first.window, 'Weekly Limit Remaining');
    assert.equal(first.remainingPercent, 83);
    // 2026-10-15 16:29 CST -> 16:29 - 8h = 08:29 UTC
    assert.equal(first.resetsAt, '2026-10-15T08:29:00.000Z');

    const fourth = windows[3];
    assert.equal(fourth.remainingPercent, 100);
  });

  it('parses JSON-wrapped response from non-interactive agy --print CLI', () => {
    const jsonWrapped = JSON.stringify({
      conversation_id: '',
      status: 'SUCCESS',
      response: "Gemini Models\tWeekly Limit Remaining\t81%\t2026-10-15T08:29:26Z\nGemini Models\tFive Hour Limit Remaining\t61%\t2026-10-12T18:56:46Z\nClaude and GPT models\tWeekly Limit Remaining\t48%\t2026-10-15T10:24:35Z\nClaude and GPT models\tFive Hour Limit Remaining\t100%\t2026-10-12T20:46:13Z\n"
    });
    const windows = parseUsageOutput(jsonWrapped);

    assert.equal(windows.length, 4);
    assert.equal(windows[0].remainingPercent, 81);
    assert.equal(windows[1].remainingPercent, 61);
    assert.equal(windows[2].remainingPercent, 48);
    assert.equal(windows[3].remainingPercent, 100);
  });

  it('properly preserves 0% quota windows', () => {
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'zero-percent.tsv'), 'utf8');
    const windows = parseUsageOutput(raw);

    assert.equal(windows.length, 4);
    assert.equal(windows[0].remainingPercent, 0);
    assert.equal(windows[1].remainingPercent, 0);
    assert.equal(windows[2].remainingPercent, 12);
  });

  it('correctly handles CST and UTC timestamps in parseResetTimestamp', () => {
    const isoUtc = parseResetTimestamp('2026-10-15T08:29:26Z');
    assert.equal(isoUtc, '2026-10-15T08:29:26.000Z');

    const cst = parseResetTimestamp('2026-10-15 16:29 CST');
    assert.equal(cst, '2026-10-15T08:29:00.000Z');

    const cstSec = parseResetTimestamp('2026-10-15 16:29:30 CST');
    assert.equal(cstSec, '2026-10-15T08:29:30.000Z');
  });

  it('throws on invalid timestamps', () => {
    assert.throws(() => parseResetTimestamp('not-a-date'), /Invalid date format/);
    assert.throws(() => parseResetTimestamp(''), /non-empty string/);
  });

  it('throws on empty or malformed output', () => {
    assert.throws(() => parseUsageOutput(''), /Empty or invalid output/);
    assert.throws(() => parseUsageOutput('   \n  \n'), /Empty or invalid output/);

    const malformed = fs.readFileSync(path.join(FIXTURES_DIR, 'malformed.tsv'), 'utf8');
    assert.throws(() => parseUsageOutput(malformed), /No valid quota windows/);
  });

  it('throws parse failure when valid row is accompanied by a row with invalid percentage', () => {
    const mixedProbe = "Gemini Models\tWeekly Limit Remaining\t0%\t2026-10-15T08:29:26Z\n" +
      "Gemini Models\tFive Hour Limit Remaining\tINVALID%\t2026-10-12T18:56:00Z\n";
    assert.throws(
      () => parseUsageOutput(mixedProbe),
      /Malformed quota row: invalid percentage/
    );
  });

  it('throws parse failure when recognized row has incomplete columns', () => {
    const incompleteProbe = "Gemini Models\tWeekly Limit Remaining\t0%\t2026-10-15T08:29:26Z\n" +
      "Claude and GPT models\tWeekly Limit Remaining\t40%\n";
    assert.throws(
      () => parseUsageOutput(incompleteProbe),
      /Malformed quota row: expected at least 4 fields/
    );
  });

  it('throws parse failure on duplicate window id', () => {
    const duplicateProbe = "Gemini Models\tWeekly Limit Remaining\t85%\t2026-10-15T08:29:26Z\n" +
      "Gemini Models\tWeekly Limit Remaining\t50%\t2026-10-15T08:29:26Z\n";
    assert.throws(
      () => parseUsageOutput(duplicateProbe),
      /Duplicate quota window id "gemini-models-weekly-limit-remaining"/
    );
  });

  it('generates consistent, sanitized slug IDs', () => {
    const id = generateWindowId('Claude and GPT models', 'Five Hour Limit Remaining');
    assert.equal(id, 'claude-and-gpt-models-five-hour-limit-remaining');
  });
});
