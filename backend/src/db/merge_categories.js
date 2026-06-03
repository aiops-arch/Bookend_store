/**
 * Merge near-duplicate categories into clean ones.
 *   node src/db/merge_categories.js [--commit]
 * Without --commit it only reports the plan (dry run).
 *
 * For each (source -> target): move every item from the source's sub-category
 * to the target's sub-category, then delete the now-empty source sub-category
 * and category. Wrapped in a transaction.
 */
'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('../config/db');

const COMMIT = process.argv.includes('--commit');

// target  <-  [sources]
const MERGES = {
  'Grocery': ['Grocery/dry Goods', 'Dry Goods'],
  'Housekeeping': ['House Keeping Materials'],
  'Dairy & Cheese': ['Dairy & Cake'],
  'Beverages': ['Cold Drinks'],
  'Sauces & Seasoning & Oils': ['Sauce', 'Oil'],
};

async function catByName(trx, name) {
  return trx('categories').whereRaw('LOWER(name)=LOWER(?)', [name]).first();
}
async function subOfCat(trx, catId) {
  return trx('sub_categories').where({ category_id: catId }).first();
}

async function main() {
  console.log(COMMIT ? 'MERGING (commit)…' : 'DRY RUN (no changes) — pass --commit to apply\n');
  await db.transaction(async (trx) => {
    let movedTotal = 0, removed = 0;
    for (const [target, sources] of Object.entries(MERGES)) {
      const tCat = await catByName(trx, target);
      if (!tCat) { console.log(`! target "${target}" not found — skipping`); continue; }
      const tSub = await subOfCat(trx, tCat.id);
      for (const src of sources) {
        const sCat = await catByName(trx, src);
        if (!sCat) { console.log(`  (no "${src}" — already merged?)`); continue; }
        const sSubs = await trx('sub_categories').where({ category_id: sCat.id });
        const sSubIds = sSubs.map(s => s.id);
        const cnt = sSubIds.length ? (await trx('items').whereIn('sub_category_id', sSubIds).count('* as n').first()).n : 0;
        console.log(`  ${src}  →  ${target}   (${cnt} items)`);
        if (COMMIT) {
          if (sSubIds.length) await trx('items').whereIn('sub_category_id', sSubIds).update({ sub_category_id: tSub.id });
          await trx('sub_categories').where({ category_id: sCat.id }).delete();
          await trx('categories').where({ id: sCat.id }).delete();
        }
        movedTotal += Number(cnt); removed++;
      }
    }
    console.log(`\n${COMMIT ? 'Moved' : 'Would move'} ${movedTotal} items; ${COMMIT ? 'removed' : 'would remove'} ${removed} duplicate categories.`);
    if (!COMMIT) throw new Error('__DRYRUN_ROLLBACK__');
  }).catch(e => { if (e.message !== '__DRYRUN_ROLLBACK__') throw e; });

  const remaining = await db('categories').count('* as n').first();
  console.log('Categories now:', remaining.n);
  await db.destroy();
}
main().catch(async e => { console.error('FAILED:', e.message); await db.destroy(); process.exit(1); });
