'use strict';

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_REPORT = path.join(ROOT, 'Surat Store report 202605.xlsx');
const OUT = path.resolve(__dirname, 'opening_stock.json');
const DETAIL_SHEET = 'Category Wise Detail';

const GROUPS = {
  'FOOD ITEM': 'Food Item',
  PACKING: 'Packing',
  HOUSEKEEPING: 'Housekeeping',
};

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function groupFromHeading(value) {
  const text = clean(value).toUpperCase();
  for (const [needle, group] of Object.entries(GROUPS)) {
    if (text.includes(needle)) return group;
  }
  return null;
}

function main() {
  const reportPath = path.resolve(process.argv[2] || DEFAULT_REPORT);
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Report not found: ${reportPath}`);
  }

  const workbook = XLSX.readFile(reportPath);
  const sheet = workbook.Sheets[DETAIL_SHEET];
  if (!sheet) {
    throw new Error(`Sheet not found: ${DETAIL_SHEET}`);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const items = [];
  let category = null;

  for (const row of rows) {
    const maybeGroup = groupFromHeading(row[0]);
    if (maybeGroup) {
      category = maybeGroup;
      continue;
    }

    if (!category || !Number.isFinite(Number(row[0]))) continue;

    const name = clean(row[1]);
    if (!name) continue;

    const subCategory = clean(row[2]) || category;
    const unit = clean(row[3]) || 'Qty';
    const purchaseRate = asNumber(row[4]);
    const qty = asNumber(row[5]);
    const stockValue = row[6] == null ? qty * purchaseRate : asNumber(row[6]);

    items.push({
      name,
      category,
      sub_category: subCategory,
      hsn: null,
      unit,
      qty,
      purchase_rate: purchaseRate,
      mrp: null,
      stock_value: stockValue,
      extra_units: null,
    });
  }

  const categories = [...new Set(items.map((item) => item.category))];
  const invalid = categories.filter((cat) => !Object.values(GROUPS).includes(cat));
  if (invalid.length) {
    throw new Error(`Unexpected categories found: ${invalid.join(', ')}`);
  }

  fs.writeFileSync(OUT, JSON.stringify(items, null, 2));

  const summary = categories.map((cat) => ({
    category: cat,
    items: items.filter((item) => item.category === cat).length,
    value: items
      .filter((item) => item.category === cat)
      .reduce((sum, item) => sum + item.stock_value, 0),
  }));

  console.log(`Wrote ${items.length} rows to ${OUT}`);
  for (const row of summary) {
    console.log(`${row.category}: ${row.items} items, value ${row.value.toFixed(2)}`);
  }
}

main();
