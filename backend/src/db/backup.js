/**
 * Full database backup — dependency-free (no pg_dump needed).
 *   node src/db/backup.js
 *
 * Dumps every table to backups/backup-YYYYMMDD-HHMMSS.json and keeps the most
 * recent KEEP files. Restore with: node src/db/restore.js <file>
 */
'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const KEEP = parseInt(process.env.BACKUP_KEEP || '30', 10);
const DIR = path.resolve(__dirname, '../../backups');

function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function main() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  const tablesRes = await db.raw("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const tables = tablesRes.rows.map(r => r.tablename);

  const dump = { _meta: { created_at: new Date().toISOString(), tables: tables.length }, data: {} };
  let totalRows = 0;
  for (const t of tables) {
    const rows = await db(t).select('*');
    dump.data[t] = rows;
    totalRows += rows.length;
  }

  const file = path.join(DIR, `backup-${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(dump));
  const sizeKb = (fs.statSync(file).size / 1024).toFixed(0);
  console.log(`Backup OK → ${file}  (${tables.length} tables, ${totalRows} rows, ${sizeKb} KB)`);

  // Prune old backups, keep newest KEEP.
  const files = fs.readdirSync(DIR).filter(f => f.startsWith('backup-') && f.endsWith('.json')).sort();
  while (files.length > KEEP) {
    const old = files.shift();
    fs.unlinkSync(path.join(DIR, old));
    console.log('  pruned old backup', old);
  }
  await db.destroy();
}
main().catch(async e => { console.error('BACKUP FAILED:', e.message); await db.destroy(); process.exit(1); });
