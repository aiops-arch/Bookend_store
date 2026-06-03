/**
 * Turn a raw scanned string into a concrete item in our catalog.
 *
 * Strategy (highest-confidence first):
 *   1. Our own EAN-13 label → item id baked into the barcode.
 *   2. Any parsed lookup key matches items.barcode (primary).
 *   3. Any parsed lookup key matches item_aliases.alias_barcode (learned).
 *   4. embedded_item_code matches our item_code (FG-xxxx) or an item id.
 *
 * Returns { parsed, item, matched_via, stock } where item is null when the
 * barcode is unknown — the caller then captures it for one-tap learning.
 */
'use strict';

const { parseBarcode } = require('./barcodeParser');

async function itemWithStock(conn, id) {
  const item = await conn('items')
    .select(
      'items.*',
      'sub_categories.name as sub_category_name',
      'categories.name as category_name'
    )
    .join('sub_categories', 'sub_categories.id', 'items.sub_category_id')
    .join('categories', 'categories.id', 'sub_categories.category_id')
    .where('items.id', id)
    .first();
  if (!item) return null;
  const stockRow = await conn('batches')
    .where({ item_id: id }).where('qty_remaining', '>', 0)
    .sum('qty_remaining as live_stock').count('* as batch_count').first();
  item.live_stock = parseFloat(stockRow.live_stock) || 0;
  item.batch_count = parseInt(stockRow.batch_count, 10) || 0;
  return item;
}

async function resolveScan(conn, raw) {
  const parsed = parseBarcode(raw);
  const keys = parsed.lookup_keys || [];
  let item = null;
  let matched_via = null;

  // 1. Our own label carries the item id directly.
  if (parsed.internal_item_id) {
    item = await itemWithStock(conn, parsed.internal_item_id);
    if (item) matched_via = 'internal_label';
  }

  // 2. Primary barcode.
  if (!item && keys.length) {
    const hit = await conn('items').whereIn('barcode', keys).first();
    if (hit) { item = await itemWithStock(conn, hit.id); matched_via = 'primary_barcode'; }
  }

  // 3. Learned alias (taught from a previous unmapped scan).
  if (!item && keys.length) {
    const alias = await conn('item_aliases').whereIn('alias_barcode', keys).first();
    if (alias) { item = await itemWithStock(conn, alias.item_id); matched_via = 'alias'; }
  }

  // 4. Embedded / internal item code (FG-xxxx) or numeric item id.
  if (!item && parsed.extracted.embedded_item_code) {
    const code = parsed.extracted.embedded_item_code;
    let hit = await conn('items').whereRaw('UPPER(item_code) = UPPER(?)', [code]).first();
    if (!hit && /^\d+$/.test(code)) hit = await conn('items').where({ id: parseInt(code, 10) }).first();
    if (hit) { item = await itemWithStock(conn, hit.id); matched_via = 'item_code'; }
  }

  return { parsed, item, matched_via, status: item ? 'matched' : 'unmapped' };
}

module.exports = { resolveScan, itemWithStock };
