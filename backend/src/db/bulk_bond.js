/**
 * Bulk-bond scanned barcodes to catalogue items.
 *
 *   node src/db/bulk_bond.js <file.xlsx|csv> [--dry-run]
 *
 * Reads a sheet of scanned barcodes and, for each one:
 *   1. If it already resolves (primary barcode / alias / our label) → skip.
 *   2. If the row gives an item_code or item_name → bond to that item.
 *   3. Else → look the barcode up online, take the product name, and
 *      fuzzy-match it against your catalogue. Confident match → auto-bond.
 *   4. Anything left → written to bulk_bond_leftovers.csv with the online name
 *      (if any) + best guess, so you can drop in the item_code and re-run.
 *
 * Bonding = an item_aliases row (barcode → item), exactly like the app's
 * "learn"/SETUP. Re-runnable and idempotent.
 *
 * Accepted columns (case-insensitive, any subset):
 *   barcode | scanned_barcode | code | ean      (required)
 *   item_code | code                            (optional, strongest)
 *   item_name | name | product                  (optional)
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const db = require('../config/db');
const { parseBarcode } = require('../services/barcodeParser');
const { lookupProduct } = require('../services/productLookup');
const { normalizeKey } = require('../services/normalize');

const FILE = process.argv[2];
const DRY = process.argv.includes('--dry-run');
const MATCH_THRESHOLD = 0.5;   // min token-overlap score to auto-bond by name

function pick(row, ...names) {
  for (const n of names) {
    const k = Object.keys(row).find(k => k.trim().toLowerCase() === n);
    if (k != null && row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim();
  }
  return null;
}

// token-overlap similarity between two names (0..1)
function similarity(a, b) {
  const A = new Set(normalizeKey(a).split(' ').filter(Boolean));
  const B = new Set(normalizeKey(b).split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let hit = 0; for (const t of A) if (B.has(t)) hit++;
  return hit / Math.max(A.size, B.size);
}

function bestCatalogMatch(name, catalog) {
  let best = null, score = 0;
  for (const it of catalog) {
    const s = similarity(name, it.variant_grade || '');
    if (s > score) { score = s; best = it; }
  }
  return { best, score };
}

async function alreadyKnown(parsed) {
  const keys = parsed.lookup_keys || [];
  if (parsed.internal_item_id) return true;
  if (keys.length) {
    if (await db('items').whereIn('barcode', keys).first()) return true;
    if (await db('item_aliases').whereIn('alias_barcode', keys).first()) return true;
  }
  return false;
}

async function bond(itemId, aliasBarcode, name) {
  if (DRY) return;
  const exists = await db('item_aliases').where({ alias_barcode: aliasBarcode }).first();
  if (exists) return;
  await db('item_aliases').insert({ item_id: itemId, alias_barcode: aliasBarcode, alias_name: name || null });
}

async function main() {
  if (!FILE) { console.error('Usage: node src/db/bulk_bond.js <file.xlsx|csv> [--dry-run]'); process.exit(1); }
  const abs = path.isAbsolute(FILE) ? FILE : path.resolve(process.cwd(), FILE);
  if (!fs.existsSync(abs)) { console.error('File not found:', abs); process.exit(1); }

  const wb = XLSX.readFile(abs);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log(`Read ${rows.length} rows from ${path.basename(abs)}${DRY ? '  [DRY RUN]' : ''}`);

  const catalog = await db('items').select('id', 'item_code', 'variant_grade');
  const byCode = new Map(catalog.map(i => [i.item_code.toUpperCase(), i]));

  const report = { total: 0, already: 0, by_code: 0, by_name: 0, by_online: 0, leftover: 0, errors: 0 };
  const leftovers = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = pick(rows[i], 'scanned_barcode', 'barcode', 'code', 'ean');
    if (!raw) continue;
    report.total++;
    try {
      const parsed = parseBarcode(raw);
      const aliasKey = parsed.lookup_keys[0] || parsed.raw;

      if (await alreadyKnown(parsed)) { report.already++; continue; }

      // 2a. explicit item_code
      const codeHint = pick(rows[i], 'item_code');
      if (codeHint && byCode.has(codeHint.toUpperCase())) {
        const it = byCode.get(codeHint.toUpperCase());
        await bond(it.id, aliasKey, it.variant_grade);
        report.by_code++; continue;
      }
      // 2b. item_name on the row
      const nameHint = pick(rows[i], 'item_name', 'name', 'product');
      if (nameHint) {
        const { best, score } = bestCatalogMatch(nameHint, catalog);
        if (best && score >= MATCH_THRESHOLD) { await bond(best.id, aliasKey, best.variant_grade); report.by_name++; continue; }
      }
      // 3. online lookup → name → fuzzy match catalog
      const product = await lookupProduct(parsed.lookup_keys || []);
      if (product.found) {
        const { best, score } = bestCatalogMatch(product.name, catalog);
        if (best && score >= MATCH_THRESHOLD) {
          await bond(best.id, aliasKey, best.variant_grade);
          report.by_online++; continue;
        }
        leftovers.push({ barcode: raw, online_name: product.name, suggested_item_code: best ? best.item_code : '', suggested_item_name: best ? best.variant_grade : '', match_score: (score * 100).toFixed(0) + '%' });
      } else {
        leftovers.push({ barcode: raw, online_name: '', suggested_item_code: '', suggested_item_name: '', match_score: '' });
      }
      report.leftover++;
    } catch (e) {
      report.errors++;
      leftovers.push({ barcode: raw, online_name: 'ERROR: ' + e.message, suggested_item_code: '', suggested_item_name: '', match_score: '' });
    }
  }

  // Write leftovers for manual mapping (fill item_code, re-run).
  if (leftovers.length) {
    const outWb = XLSX.utils.book_new();
    const outWs = XLSX.utils.json_to_sheet(leftovers);
    XLSX.utils.book_append_sheet(outWb, outWs, 'Leftovers');
    const outPath = path.resolve(path.dirname(abs), 'bulk_bond_leftovers.xlsx');
    if (!DRY) XLSX.writeFile(outWb, outPath);
    console.log(`\nLeftovers needing manual mapping → ${DRY ? '(dry run, not written)' : outPath}`);
  }

  console.log('\n──────── SUMMARY ────────');
  console.log('  scanned barcodes   :', report.total);
  console.log('  already bonded     :', report.already);
  console.log('  bonded by item_code:', report.by_code);
  console.log('  bonded by name     :', report.by_name);
  console.log('  bonded via online  :', report.by_online);
  console.log('  NEED YOU (leftover):', report.leftover);
  console.log('  errors             :', report.errors);
  const bonded = report.by_code + report.by_name + report.by_online;
  console.log(`\n  → ${bonded} auto-bonded, ${report.leftover} to map by hand (see leftovers file).`);
  await db.destroy();
}

main().catch(async e => { console.error('FAILED:', e.message); await db.destroy(); process.exit(1); });
