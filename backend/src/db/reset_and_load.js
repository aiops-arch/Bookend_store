/**
 * Wipe the database and reload it from the real Surat Store stock file.
 *
 *   node src/db/reset_and_load.js            # wipe + reload
 *   node src/db/reset_and_load.js --dry-run  # report only, no writes
 *
 * Steps:
 *   1. TRUNCATE every public table (RESTART IDENTITY CASCADE) — full wipe.
 *   2. Reseed the 5 role users.
 *   3. Create the 3 Surat report category groups + report sub-categories.
 *   4. Insert every item with a scannable EAN-13 (890 + item id).
 *   5. Create one opening-stock batch per item that has stock on hand.
 *
 * Reads backend/src/db/opening_stock.json (produced from the Pet Pooja export).
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { generateEAN13 } = require('../services/barcode');

const DRY_RUN = process.argv.includes('--dry-run');
const BCRYPT_ROUNDS = 10;

const USERS = [
  { name: 'Admin',     email: 'admin@fg.local',     password: 'Admin@123',     role: 'admin' },
  { name: 'Purchase',  email: 'purchase@fg.local',  password: 'Purchase@123',  role: 'purchase' },
  { name: 'Warehouse', email: 'warehouse@fg.local', password: 'Warehouse@123', role: 'warehouse' },
  { name: 'Sales',     email: 'sales@fg.local',     password: 'Sales@123',     role: 'sales' },
  { name: 'Viewer',    email: 'view@fg.local',      password: 'View@123',      role: 'view' },
];

async function main() {
  const stockPath = path.resolve(__dirname, 'opening_stock.json');
  const items = JSON.parse(fs.readFileSync(stockPath, 'utf-8'));
  console.log(`Loaded ${items.length} items from opening_stock.json`);

  const allowedCategories = ['Food Item', 'Packing', 'Housekeeping'];
  const invalidCategories = [...new Set(items.map(i => i.category))]
    .filter((category) => !allowedCategories.includes(category));
  if (invalidCategories.length) {
    throw new Error(`Unexpected categories in opening_stock.json: ${invalidCategories.join(', ')}`);
  }

  const categories = allowedCategories.filter((category) => items.some((item) => item.category === category));
  const subCategories = [...new Set(items.map((item) => `${item.category}|||${item.sub_category || item.category}`))];

  if (DRY_RUN) {
    console.log(`[dry-run] would create ${categories.length} categories, ${subCategories.length} sub-categories, ${items.length} items, ` +
      `${items.filter(i => i.qty > 0).length} opening batches. No writes performed.`);
    await db.destroy();
    return;
  }

  // 1. Full wipe — truncate every base table in the public schema.
  const tablesRes = await db.raw(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  );
  const tables = tablesRes.rows.map(r => `"${r.tablename}"`);
  if (tables.length) {
    await db.raw(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
    console.log(`Wiped ${tables.length} tables.`);
  }

  const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
  const today = new Date().toISOString().split('T')[0];

  // 2. Users
  const userRows = [];
  for (const u of USERS) {
    userRows.push({ name: u.name, email: u.email, password_hash: await bcrypt.hash(u.password, BCRYPT_ROUNDS), role: u.role });
  }
  await db('users').insert(userRows);
  console.log(`Seeded ${USERS.length} users.`);

  // 3. Top-level category groups + report sub-categories.
  const categoryId = {};
  for (const name of categories) {
    const [cat] = await db('categories').insert({ name }).returning('id');
    categoryId[name] = cat.id;
  }

  const subId = {};
  for (const key of subCategories) {
    const [category, subCategory] = key.split('|||');
    const [sub] = await db('sub_categories')
      .insert({ category_id: categoryId[category], name: subCategory, shelf_life_days: 365 })
      .returning('id');
    subId[key] = sub.id;
  }
  console.log(`Created ${categories.length} categories + ${subCategories.length} sub-categories.`);

  // 4. Items — bulk insert (temp barcode = item_code), capture ids, then stamp
  //    a real EAN-13 from each id in a single UPDATE…FROM VALUES statement.
  const itemRows = items.map((it, i) => {
    const descParts = [];
    if (it.extra_units) descParts.push('Also stocked as: ' + it.extra_units.join(', '));
    if (it.stock_value != null) descParts.push(`Opening stock value Rs ${it.stock_value}`);
    const item_code = 'FG-' + String(i + 1).padStart(4, '0');
    return {
      sub_category_id: subId[`${it.category}|||${it.sub_category || it.category}`],
      item_code,
      barcode: item_code, // temporary unique placeholder
      hsn_code: it.hsn || null,
      unit: it.unit || 'pcs',
      variant_grade: it.name.slice(0, 50),
      purchase_rate: it.purchase_rate || null,
      mrp: it.mrp || null,
      gst_rate: 5,
      is_active: true,
      description: descParts.join(' | ') || null,
    };
  });

  const ids = [];
  for (const part of chunk(itemRows, 100)) {
    const got = await db('items').insert(part).returning('id');
    ids.push(...got.map(r => r.id));
  }
  console.log(`Inserted ${ids.length} items.`);

  // Stamp real EAN-13 barcodes in bulk.
  const bcValues = ids.map(id => `(${id}, '${generateEAN13(id)}')`).join(',');
  await db.raw(`UPDATE items AS t SET barcode = v.bc FROM (VALUES ${bcValues}) AS v(id, bc) WHERE t.id = v.id`);
  console.log('Stamped EAN-13 barcodes.');

  // 5. Opening-stock batches for items that have stock on hand.
  const batchRows = [];
  items.forEach((it, i) => {
    if (it.qty && it.qty > 0) {
      batchRows.push({ item_id: ids[i], receipt_date: today, expiry_date: null, qty_received: it.qty, qty_remaining: it.qty });
    }
  });
  for (const part of chunk(batchRows, 200)) await db('batches').insert(part);
  console.log(`Created ${batchRows.length} opening batches.`);

  // Sanity summary
  const counts = {};
  for (const t of ['users', 'categories', 'sub_categories', 'items', 'batches']) {
    counts[t] = (await db(t).count('* as n').first()).n;
  }
  console.log('Final counts:', counts);
  console.log('Done.');
  await db.destroy();
}

main().catch(async (e) => {
  console.error('RESET FAILED:', e.message);
  await db.destroy();
  process.exit(1);
});
