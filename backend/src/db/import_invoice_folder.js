'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const db = require('../config/db');
const { generateEAN13 } = require('../services/barcode');
const { logAudit } = require('../services/audit');

const ROOT = path.resolve(__dirname, '../..');
const INVOICE_ROOT = path.resolve(process.env.INVOICE_FOLDER || path.join(ROOT, 'invoices'));
const INBOX = path.join(INVOICE_ROOT, 'inbox');
const PROCESSED = path.join(INVOICE_ROOT, 'processed');
const FAILED = path.join(INVOICE_ROOT, 'failed');
const DRY_RUN = process.argv.includes('--dry-run');
const COMMIT = process.argv.includes('--commit');
const CONFIRM = process.argv.includes('--confirm');
const LOCK = process.argv.includes('--lock');
const USER_EMAIL = valueArg('--user') || process.env.INVOICE_IMPORT_USER || 'admin@fg.local';
const ALLOWED_CATEGORIES = ['Food Item', 'Packing', 'Housekeeping'];
const FILE_EXTS = new Set(['.xlsx', '.xls', '.csv']);

function valueArg(name) {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

function ensureDirs() {
  for (const dir of [INVOICE_ROOT, INBOX, PROCESSED, FAILED]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function number(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function excelDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString().slice(0, 10);
    }
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function pick(row, aliases) {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const key = keys.find((k) => clean(k).toLowerCase() === alias.toLowerCase());
    if (key && row[key] !== null && row[key] !== undefined && clean(row[key]) !== '') return row[key];
  }
  return null;
}

function readRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

async function importerUser(trx) {
  const user = await trx('users').whereRaw('LOWER(email)=LOWER(?)', [USER_EMAIL]).first();
  if (!user) throw new Error(`Import user not found: ${USER_EMAIL}`);
  return user;
}

async function vendorId(trx, name) {
  const vendorName = clean(name);
  if (!vendorName) throw new Error('vendor is required');
  const existing = await trx('vendors').whereRaw('LOWER(name)=LOWER(?)', [vendorName]).first();
  if (existing) return existing.id;
  const [created] = await trx('vendors').insert({ name: vendorName }).returning('*');
  return created.id;
}

async function nextItemCode(trx) {
  const row = await trx('items').select('item_code').orderBy('id', 'desc').first();
  if (!row) return 'FG-0001';
  const num = parseInt(String(row.item_code).replace('FG-', ''), 10);
  return `FG-${String(num + 1).padStart(4, '0')}`;
}

async function subCategoryId(trx, category, subCategory) {
  const catName = clean(category);
  const subName = clean(subCategory) || catName;
  if (!ALLOWED_CATEGORIES.includes(catName)) {
    throw new Error(`category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
  }

  let cat = await trx('categories').whereRaw('LOWER(name)=LOWER(?)', [catName]).first();
  if (!cat) {
    [cat] = await trx('categories').insert({ name: catName }).returning('*');
  }

  let sub = await trx('sub_categories')
    .where({ category_id: cat.id })
    .whereRaw('LOWER(name)=LOWER(?)', [subName])
    .first();
  if (!sub) {
    [sub] = await trx('sub_categories')
      .insert({ category_id: cat.id, name: subName, shelf_life_days: 365 })
      .returning('*');
  }
  return sub.id;
}

async function findItem(trx, row) {
  const itemCode = clean(pick(row, ['item_code', 'Item Code', 'code']));
  const barcode = clean(pick(row, ['barcode', 'Barcode', 'ean', 'sku']));
  const itemName = clean(pick(row, ['item', 'Item', 'item_name', 'Item Name', 'name', 'Name']));

  if (itemCode) {
    const byCode = await trx('items').whereRaw('LOWER(item_code)=LOWER(?)', [itemCode]).first();
    if (byCode) return byCode;
  }
  if (barcode) {
    const byBarcode = await trx('items').where({ barcode }).first();
    if (byBarcode) return byBarcode;
    const alias = await trx('item_aliases').where({ alias_barcode: barcode }).first();
    if (alias) return trx('items').where({ id: alias.item_id }).first();
  }
  if (itemName) {
    const exact = await trx('items').whereRaw('LOWER(variant_grade)=LOWER(?)', [itemName.slice(0, 50)]).first();
    if (exact) return exact;
  }
  return null;
}

async function createItem(trx, row) {
  const itemName = clean(pick(row, ['item', 'Item', 'item_name', 'Item Name', 'name', 'Name']));
  const category = clean(pick(row, ['category', 'Category']));
  const subCategory = clean(pick(row, ['sub_category', 'Sub Category', 'subcategory']));
  const unit = clean(pick(row, ['unit', 'Unit'])) || 'Qty';
  const rate = number(pick(row, ['rate', 'Rate', 'purchase_rate', 'Purchase Rate', 'avg_price', 'Avg Price']));

  if (!itemName) throw new Error('item name is required for new items');

  const subId = await subCategoryId(trx, category, subCategory);
  const itemCode = await nextItemCode(trx);
  const tempBarcode = `TEMP_${crypto.randomBytes(8).toString('hex')}`;
  const [created] = await trx('items')
    .insert({
      sub_category_id: subId,
      item_code: itemCode,
      barcode: tempBarcode,
      unit,
      variant_grade: itemName.slice(0, 50),
      purchase_rate: rate || null,
      description: `Auto-created from invoice folder import: ${itemName}`,
      is_active: true,
    })
    .returning('*');
  const barcode = generateEAN13(created.id);
  const [updated] = await trx('items').where({ id: created.id }).update({ barcode }).returning('*');
  return updated;
}

function invoiceMeta(filePath, rows) {
  const first = rows[0] || {};
  const stem = path.basename(filePath, path.extname(filePath));
  return {
    vendor: clean(pick(first, ['vendor', 'Vendor', 'supplier', 'Supplier'])),
    invoiceNo: clean(pick(first, ['invoice_no', 'Invoice No', 'invoice', 'Invoice', 'bill_no', 'Bill No'])) || stem,
    invoiceDate: excelDate(pick(first, ['invoice_date', 'Invoice Date', 'date', 'Date'])) || new Date().toISOString().slice(0, 10),
  };
}

async function importFile(filePath) {
  const rows = readRows(filePath).filter((row) => Object.values(row).some((value) => clean(value) !== ''));
  if (!rows.length) throw new Error('file has no invoice rows');

  const trx = await db.transaction();
  const preview = {
    file: path.basename(filePath),
    invoice_no: null,
    vendor: null,
    invoice_date: null,
    lines: 0,
    items_created: 0,
    errors: [],
  };

  try {
    const user = await importerUser(trx);
    const meta = invoiceMeta(filePath, rows);
    preview.invoice_no = meta.invoiceNo;
    preview.vendor = meta.vendor;
    preview.invoice_date = meta.invoiceDate;

    const vId = await vendorId(trx, meta.vendor);
    const [entry] = await trx('inward_entries')
      .insert({
        vendor_id: vId,
        invoice_no: meta.invoiceNo,
        invoice_date: meta.invoiceDate,
        status: 'draft',
        created_by: user.id,
      })
      .returning('*');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const qty = number(pick(row, ['qty', 'Qty', 'quantity', 'Quantity', 'current_stock', 'Current Stock']));
      const rate = number(pick(row, ['rate', 'Rate', 'purchase_rate', 'Purchase Rate', 'avg_price', 'Avg Price']));
      const expiryDate = excelDate(pick(row, ['expiry_date', 'Expiry Date', 'expiry', 'Expiry']));
      if (qty <= 0 || rate <= 0) {
        preview.errors.push({ row: i + 2, error: 'qty and rate must be greater than 0' });
        continue;
      }

      let item = await findItem(trx, row);
      if (!item) {
        item = await createItem(trx, row);
        preview.items_created++;
      }

      await trx('inward_lines').insert({
        inward_id: entry.id,
        item_id: item.id,
        qty,
        rate,
        expiry_date: expiryDate,
      });
      preview.lines++;
    }

    if (!preview.lines) throw new Error('no valid invoice lines found');

    await logAudit({
      table_name: 'inward_entries',
      record_id: entry.id,
      action: 'INSERT',
      user_id: user.id,
      new_value: { invoice_folder_import: true, file: preview.file, lines: preview.lines },
    }, trx);

    if (CONFIRM || LOCK) {
      const today = new Date().toISOString().slice(0, 10);
      const lines = await trx('inward_lines').where({ inward_id: entry.id });
      for (const line of lines) {
        const [batch] = await trx('batches')
          .insert({
            item_id: line.item_id,
            receipt_date: today,
            expiry_date: line.expiry_date || null,
            qty_received: line.qty,
            qty_remaining: line.qty,
          })
          .returning('*');
        await trx('inward_lines').where({ id: line.id }).update({ batch_id: batch.id });
      }
      await trx('inward_entries').where({ id: entry.id }).update({ status: LOCK ? 'locked' : 'confirmed', locked_at: LOCK ? new Date() : null });
    }

    if (DRY_RUN || !COMMIT) {
      await trx.rollback();
      preview.dry_run = true;
    } else {
      await trx.commit();
      preview.dry_run = false;
      const dest = path.join(PROCESSED, `${Date.now()}-${path.basename(filePath)}`);
      fs.renameSync(filePath, dest);
      preview.moved_to = dest;
    }

    return preview;
  } catch (error) {
    await trx.rollback();
    if (COMMIT) {
      const dest = path.join(FAILED, `${Date.now()}-${path.basename(filePath)}`);
      fs.renameSync(filePath, dest);
    }
    throw error;
  }
}

async function main() {
  ensureDirs();
  const files = fs.readdirSync(INBOX)
    .filter((name) => FILE_EXTS.has(path.extname(name).toLowerCase()))
    .map((name) => path.join(INBOX, name));

  if (!files.length) {
    console.log(`No invoice files found in ${INBOX}`);
    await db.destroy();
    return;
  }

  console.log(`${DRY_RUN || !COMMIT ? 'DRY RUN' : 'COMMIT'} invoice import from ${INBOX}`);
  const results = [];
  for (const file of files) {
    try {
      const result = await importFile(file);
      results.push({ ok: true, ...result });
      console.log(`OK ${path.basename(file)}: ${result.lines} lines, ${result.items_created} new items`);
      if (result.errors.length) console.log(`  skipped rows: ${JSON.stringify(result.errors)}`);
    } catch (error) {
      results.push({ ok: false, file: path.basename(file), error: error.message });
      console.log(`FAILED ${path.basename(file)}: ${error.message}`);
    }
  }

  console.log(JSON.stringify({ files: results.length, results }, null, 2));
  await db.destroy();
}

main().catch(async (error) => {
  console.error('Import failed:', error.message);
  await db.destroy();
  process.exit(1);
});
