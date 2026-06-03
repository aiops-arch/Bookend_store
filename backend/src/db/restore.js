/**
 * Restore the database from a backup made by backup.js.
 *   node src/db/restore.js <backups/backup-XXXX.json> [--commit]
 *
 * Without --commit it's a DRY RUN (reports what it would restore, no changes).
 * With --commit it wipes the current data and reloads the snapshot inside one
 * transaction (FK triggers disabled during load, sequences fixed afterwards).
 *
 * Use for disaster recovery, or to move data into a fresh/local database:
 * point DATABASE_URL at the new database and run this against a backup.
 */
'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const FILE = process.argv[2];
const COMMIT = process.argv.includes('--commit');

async function main() {
  if (!FILE) { console.error('Usage: node src/db/restore.js <backup.json> [--commit]'); process.exit(1); }
  const abs = path.isAbsolute(FILE) ? FILE : path.resolve(process.cwd(), FILE);
  if (!fs.existsSync(abs)) { console.error('Backup not found:', abs); process.exit(1); }

  const dump = JSON.parse(fs.readFileSync(abs, 'utf-8'));
  if (!dump.data) { console.error('Not a valid backup file (no .data)'); process.exit(1); }
  const tables = Object.keys(dump.data);
  const rowCount = tables.reduce((n, t) => n + dump.data[t].length, 0);
  console.log(`Backup: ${path.basename(abs)}  (created ${dump._meta?.created_at || '?'})`);
  console.log(`Contains ${tables.length} tables, ${rowCount} rows.`);

  // Only restore tables that actually exist in the target DB.
  const existRes = await db.raw("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  const existing = new Set(existRes.rows.map(r => r.tablename));
  const toLoad = tables.filter(t => existing.has(t));
  const missing = tables.filter(t => !existing.has(t));
  if (missing.length) console.log('  (skipping tables not in target DB:', missing.join(', '), ')');

  if (!COMMIT) {
    console.log('\nDRY RUN — no changes made. Re-run with --commit to actually restore.');
    await db.destroy();
    return;
  }

  await db.transaction(async (trx) => {
    const quoted = toLoad.map(t => `"${t}"`).join(', ');
    for (const t of toLoad) await trx.raw(`ALTER TABLE "${t}" DISABLE TRIGGER ALL`);
    await trx.raw(`TRUNCATE ${quoted} RESTART IDENTITY CASCADE`);
    for (const t of toLoad) {
      const rows = dump.data[t];
      for (let i = 0; i < rows.length; i += 500) {
        await trx(t).insert(rows.slice(i, i + 500));
      }
    }
    for (const t of toLoad) await trx.raw(`ALTER TABLE "${t}" ENABLE TRIGGER ALL`);
    // Fix auto-increment sequences so new inserts don't collide.
    for (const t of toLoad) {
      const seq = await trx.raw(`SELECT pg_get_serial_sequence(?, 'id') AS s`, [t]);
      const s = seq.rows[0] && seq.rows[0].s;
      if (s) await trx.raw(`SELECT setval(?, COALESCE((SELECT MAX(id) FROM "${t}"), 1))`, [s]);
    }
  });

  console.log(`\nRestored ${toLoad.length} tables, ${rowCount} rows. Done.`);
  await db.destroy();
}
main().catch(async e => { console.error('RESTORE FAILED:', e.message); await db.destroy(); process.exit(1); });
