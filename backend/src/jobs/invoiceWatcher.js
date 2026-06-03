/**
 * Watches invoices/inbox for structured invoice JSON files (dropped by the
 * reader / Codex), enters each into the system (auto confirm + lock), and moves
 * the file to invoices/done (with a .result.json) or invoices/failed.
 *
 *   node src/jobs/invoiceWatcher.js            # watch continuously (poll every 3s)
 *   node src/jobs/invoiceWatcher.js --once     # process whatever is in inbox, then exit
 *   node src/jobs/invoiceWatcher.js --once --dry-run   # simulate, write nothing to DB
 *
 * See invoices/README_FOR_CODEX.md for the JSON shape.
 */
'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { ingestInvoice } = require('../services/invoiceIngest');

const ONCE = process.argv.includes('--once');
const DRY = process.argv.includes('--dry-run');
const POLL_MS = 3000;

const ROOT = path.resolve(__dirname, '../../../invoices');
const INBOX = path.join(ROOT, 'inbox');
const DONE = path.join(ROOT, 'done');
const FAILED = path.join(ROOT, 'failed');
for (const d of [INBOX, DONE, FAILED]) fs.mkdirSync(d, { recursive: true });

function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Wait until a file's size is stable, so we don't read a half-written drop.
function isStable(file) {
  try {
    const a = fs.statSync(file).size;
    return new Promise(res => setTimeout(() => {
      try { res(fs.statSync(file).size === a && a > 0); } catch { res(false); }
    }, 400));
  } catch { return Promise.resolve(false); }
}

async function processFile(file) {
  const full = path.join(INBOX, file);
  const base = path.basename(file, '.json');
  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(full, 'utf-8'));
  } catch (e) {
    return moveOut(full, FAILED, base, { ok: false, error: 'Invalid JSON: ' + e.message });
  }
  try {
    const summary = await ingestInvoice(obj, { dryRun: DRY });
    console.log(`✓ ${file}: ${summary.status} (inward ${summary.inward_id || '-'}, ${summary.items_matched} matched, ${summary.items_created} new, ${summary.batches_created} batches)`);
    if (!DRY) moveOut(full, DONE, base, { ok: true, summary });
    return summary;
  } catch (e) {
    console.log(`✗ ${file}: ${e.message}`);
    if (!DRY) moveOut(full, FAILED, base, { ok: false, error: e.message });
    return { ok: false, error: e.message };
  }
}

function moveOut(full, destDir, base, result) {
  const tag = stamp();
  try { fs.renameSync(full, path.join(destDir, `${base}.${tag}.json`)); } catch {}
  try { fs.writeFileSync(path.join(destDir, `${base}.${tag}.result.json`), JSON.stringify(result, null, 2)); } catch {}
}

async function sweep() {
  const files = fs.readdirSync(INBOX).filter(f => f.toLowerCase().endsWith('.json'));
  for (const f of files) {
    if (!(await isStable(path.join(INBOX, f)))) continue; // still being written
    await processFile(f);
  }
  return files.length;
}

async function main() {
  console.log(`Invoice watcher ${DRY ? '[DRY RUN] ' : ''}— inbox: ${INBOX}`);
  if (ONCE) {
    const n = await sweep();
    console.log(`Processed sweep of inbox (${n} file(s)).`);
    await db.destroy();
    return;
  }
  console.log(`Watching every ${POLL_MS / 1000}s. Drop *.json into inbox. Ctrl+C to stop.`);
  // continuous poll
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try { await sweep(); } catch (e) { console.error('sweep error:', e.message); }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
}

main().catch(async e => { console.error('WATCHER FAILED:', e.message); await db.destroy(); process.exit(1); });
