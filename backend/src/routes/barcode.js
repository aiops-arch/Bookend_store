/**
 * Universal barcode endpoints — the "brain" the store scans into.
 *
 *   POST /api/barcode/parse     { raw }                  → parse only (no DB)
 *   POST /api/barcode/resolve   { raw }                  → parse + match item; capture if unknown
 *   GET  /api/barcode/unmapped                           → pending unknown scans to teach
 *   POST /api/barcode/learn     { raw, item_id }         → teach a barcode → item (alias)
 *   DELETE /api/barcode/unmapped/:id                     → dismiss an unknown scan
 *   POST /api/barcode/inward    { raw, qty, rate?, expiry?, location_id? }  → auto stock-add
 *   POST /api/barcode/outward   { raw, qty }                                → auto FIFO deduct
 */
'use strict';

const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../services/audit');
const { parseBarcode } = require('../services/barcodeParser');
const { resolveScan, itemWithStock } = require('../services/scanResolver');
const { generateEAN13 } = require('../services/barcode');
const { lookupProduct } = require('../services/productLookup');
const { classifyItem, aiEnabled } = require('../services/aiClassify');

const router = express.Router();

// Distinct catalog category names — fed to the AI/heuristic classifier.
async function existingCategories(conn) {
  const rows = await conn('categories').distinct('name').orderBy('name');
  return rows.map(r => r.name);
}

async function nextItemCode(conn) {
  const row = await conn('items').select('item_code').orderBy('id', 'desc').first();
  if (!row || !/^FG-\d+$/.test(row.item_code)) return 'FG-0001';
  return 'FG-' + String(parseInt(row.item_code.slice(3), 10) + 1).padStart(4, '0');
}

// Find a sub_category to hang an item on, creating the category + a same-named
// sub_category when the suggested category is new.
async function resolveSubCategory(trx, categoryName, shelfLife) {
  let cat = await trx('categories').whereRaw('LOWER(name)=LOWER(?)', [categoryName]).first();
  if (!cat) { [cat] = await trx('categories').insert({ name: categoryName }).returning('*'); }
  let sub = await trx('sub_categories').where({ category_id: cat.id }).first();
  if (!sub) {
    [sub] = await trx('sub_categories')
      .insert({ category_id: cat.id, name: categoryName, shelf_life_days: shelfLife || 365 })
      .returning('*');
  }
  return sub.id;
}

// Look a parsed barcode up externally and classify it into catalog fields.
// Returns { product, suggestion } or { product:{found:false} }.
async function enrichParsed(conn, parsed) {
  const product = await lookupProduct(parsed.lookup_keys || []);
  if (!product.found) return { product };
  const cats = await existingCategories(conn);
  const suggestion = await classifyItem(product, cats);
  return { product, suggestion };
}

// Auto-create a catalogued item from an enrichment result. The real product
// barcode (the one printed on the packet) becomes the primary barcode so the
// very next scan resolves instantly; unbranded items get our own EAN-13 label.
async function autoCreateItem(trx, parsed, product, suggestion, userId, purchaseRate) {
  const subCatId = await resolveSubCategory(trx, suggestion.category, suggestion.shelf_life_days);
  const item_code = await nextItemCode(trx);
  const realEan = /^\d{8,14}$/.test(product.barcode) ? product.barcode : null;

  const [created] = await trx('items').insert({
    sub_category_id: subCatId,
    item_code,
    barcode: realEan || ('TMP-' + item_code),
    unit: suggestion.unit || 'pcs',
    variant_grade: suggestion.variant_grade,
    purchase_rate: purchaseRate != null && !isNaN(parseFloat(purchaseRate)) ? parseFloat(purchaseRate) : null,
    pack_size: suggestion.pack_size || null,
    gst_rate: 5,
    is_active: true,
    item_image_url: product.image_url || null,
    description: `Auto-created on scan via ${product.source} (${suggestion.method})`,
  }).returning('*');

  if (!realEan) {
    await trx('items').where({ id: created.id }).update({ barcode: generateEAN13(created.id) });
  }
  // Always record every scanned lookup key as an alias so any GS1/embedded form resolves too.
  for (const key of parsed.lookup_keys || []) {
    if (key === created.barcode) continue;
    const exists = await trx('item_aliases').where({ alias_barcode: key }).first();
    if (!exists) await trx('item_aliases').insert({ item_id: created.id, alias_barcode: key, alias_name: suggestion.variant_grade });
  }
  await logAudit({
    table_name: 'items', record_id: created.id, action: 'INSERT',
    user_id: userId, new_value: { ...created, auto_created: true, source: product.source },
  }, trx);
  return await itemWithStock(trx, created.id);
}

// Record an unknown scan so it can be taught later. Idempotent on raw_value.
async function captureUnmapped(conn, parsed, userId, source) {
  const existing = await conn('unmapped_scans')
    .where({ raw_value: parsed.raw, status: 'pending' }).first();
  if (existing) return existing;
  const [row] = await conn('unmapped_scans').insert({
    raw_value: parsed.raw,
    scan_format: parsed.symbology,
    source: source || 'resolve',
    status: 'pending',
    external_data: JSON.stringify(parsed.extracted || {}),
    confidence: parsed.confidence || 0,
    scanned_by: userId || null,
  }).returning('*');
  return row;
}

// POST /api/barcode/parse — inspect a barcode without touching the catalog.
router.post('/parse', authenticate, (req, res) => {
  const { raw } = req.body;
  if (!raw) return res.status(400).json({ success: false, error: 'raw is required' });
  res.json({ success: true, data: parseBarcode(raw) });
});

// POST /api/barcode/resolve — parse + find the item; capture if unknown.
router.post('/resolve', authenticate, async (req, res, next) => {
  try {
    const { raw } = req.body;
    if (!raw) return res.status(400).json({ success: false, error: 'raw is required' });
    const result = await resolveScan(db, raw);
    if (!result.item) {
      const captured = await captureUnmapped(db, result.parsed, req.user.id, 'resolve');
      return res.json({ success: true, data: { ...result, unmapped_id: captured.id } });
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /api/barcode/enrich — parse + external lookup + AI classify (no write).
// Use this to preview what a brand-new barcode would become before stocking.
router.post('/enrich', authenticate, async (req, res, next) => {
  try {
    const { raw } = req.body;
    if (!raw) return res.status(400).json({ success: false, error: 'raw is required' });
    const result = await resolveScan(db, raw);
    if (result.item) return res.json({ success: true, data: { status: 'known', ...result, ai_enabled: aiEnabled } });
    const { product, suggestion } = await enrichParsed(db, result.parsed);
    res.json({
      success: true,
      data: {
        status: product.found ? 'enriched' : 'not_found',
        parsed: result.parsed, product, suggestion: suggestion || null, ai_enabled: aiEnabled,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/barcode/unmapped — pending unknown scans awaiting a mapping.
router.get('/unmapped', authenticate, async (req, res, next) => {
  try {
    const rows = await db('unmapped_scans')
      .leftJoin('users', 'users.id', 'unmapped_scans.scanned_by')
      .where('unmapped_scans.status', 'pending')
      .select('unmapped_scans.*', 'users.name as scanned_by_name')
      .orderBy('unmapped_scans.created_at', 'desc')
      .limit(200);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /api/barcode/learn — teach the system that a barcode means an item.
// Registers it as an alias so every future scan resolves instantly.
router.post('/learn', authenticate, authorize('admin', 'purchase', 'warehouse'), async (req, res, next) => {
  const trx = await db.transaction();
  try {
    const { raw, item_id, alias_name } = req.body;
    if (!raw || !item_id) {
      await trx.rollback();
      return res.status(400).json({ success: false, error: 'raw and item_id are required' });
    }
    const item = await trx('items').where({ id: item_id }).first();
    if (!item) { await trx.rollback(); return res.status(404).json({ success: false, error: 'Item not found' }); }

    const parsed = parseBarcode(raw);
    // Store the most useful key as the alias: the GTIN/clean form the scanner emits.
    const aliasBarcode = parsed.lookup_keys[0] || parsed.raw;

    const conflict = await trx('item_aliases').where({ alias_barcode: aliasBarcode }).first();
    if (conflict && conflict.item_id !== Number(item_id)) {
      await trx.rollback();
      return res.status(409).json({ success: false, error: 'Barcode already linked to a different item' });
    }
    if (!conflict) {
      await trx('item_aliases').insert({
        item_id, alias_barcode: aliasBarcode, alias_name: alias_name || item.variant_grade || null,
      });
    }

    // Close out any pending unmapped rows for this raw value.
    await trx('unmapped_scans')
      .where({ raw_value: parsed.raw, status: 'pending' })
      .update({ status: 'mapped', item_id, mapped_by: req.user.id, mapped_at: new Date() });

    await logAudit({
      table_name: 'item_aliases', record_id: item_id, action: 'INSERT',
      user_id: req.user.id, new_value: { alias_barcode: aliasBarcode, item_id },
    }, trx);

    await trx.commit();
    res.status(201).json({ success: true, data: { item_id, alias_barcode: aliasBarcode } });
  } catch (err) { await trx.rollback(); next(err); }
});

// POST /api/barcode/create-item — create a brand-new product on the spot and
// bond the scanned barcode to it. Used when a product isn't in the catalogue
// at all and isn't found online (the "new product" case at the counter).
router.post('/create-item', authenticate, authorize('admin', 'purchase', 'warehouse'), async (req, res, next) => {
  const trx = await db.transaction();
  try {
    const { raw, item_name, category, unit, purchase_rate, mrp } = req.body || {};
    if (!raw || !item_name || !String(item_name).trim()) {
      await trx.rollback();
      return res.status(400).json({ success: false, error: 'raw and item_name are required' });
    }
    const parsed = parseBarcode(raw);
    // Guard: don't create a duplicate if the barcode already resolves.
    const existing = await resolveScan(trx, raw);
    if (existing.item) {
      await trx.rollback();
      return res.status(409).json({ success: false, error: 'This barcode is already linked to ' + existing.item.item_code, data: existing });
    }
    const suggestion = {
      category: category && String(category).trim() ? String(category).trim() : 'Others',
      variant_grade: String(item_name).trim().slice(0, 50),
      unit: unit || 'pcs',
      shelf_life_days: 365,
      method: 'manual',
    };
    const product = { barcode: parsed.lookup_keys.find(k => /^\d{8,14}$/.test(k)) || '', source: 'manual', image_url: null };
    const item = await autoCreateItem(trx, parsed, product, suggestion, req.user.id, purchase_rate);
    if (mrp != null && !isNaN(parseFloat(mrp))) await trx('items').where({ id: item.id }).update({ mrp: parseFloat(mrp) });
    // Close any pending unmapped rows for this barcode.
    await trx('unmapped_scans').where({ raw_value: parsed.raw, status: 'pending' })
      .update({ status: 'mapped', item_id: item.id, mapped_by: req.user.id, mapped_at: new Date() });
    await trx.commit();
    res.status(201).json({ success: true, data: { item, created: true } });
  } catch (err) { await trx.rollback(); next(err); }
});

// DELETE /api/barcode/unmapped/:id — dismiss a junk/unwanted scan.
router.delete('/unmapped/:id', authenticate, authorize('admin', 'purchase', 'warehouse'), async (req, res, next) => {
  try {
    await db('unmapped_scans').where({ id: req.params.id }).update({ status: 'dismissed' });
    res.json({ success: true, data: { dismissed: true } });
  } catch (err) { next(err); }
});

// POST /api/barcode/inward — SCAN TO ADD STOCK.
// Resolves the item, then creates a stock batch immediately. GS1 expiry / net
// weight are used as defaults when the body doesn't override them.
router.post('/inward', authenticate, authorize('admin', 'purchase', 'warehouse'), async (req, res, next) => {
  const trx = await db.transaction();
  try {
    const { raw, qty, rate, expiry, location_id } = req.body;
    if (!raw) { await trx.rollback(); return res.status(400).json({ success: false, error: 'raw is required' }); }

    const result = await resolveScan(trx, raw);
    let autoCreated = false;

    if (!result.item) {
      // Zero-typing path: try to self-catalogue this brand-new item from an
      // external product lookup + AI classification. Disable with autocreate:false.
      const autocreate = req.body.autocreate !== false;
      if (autocreate) {
        const { product, suggestion } = await enrichParsed(trx, result.parsed);
        if (product.found && suggestion) {
          const created = await autoCreateItem(trx, result.parsed, product, suggestion, req.user.id, rate);
          result.item = created;
          result.matched_via = `auto_created:${product.source}`;
          result.enrichment = { product, suggestion };
          autoCreated = true;
        }
      }
      if (!result.item) {
        const captured = await captureUnmapped(trx, result.parsed, req.user.id, 'inward');
        await trx.commit();
        return res.status(404).json({
          success: false, error: 'UNKNOWN_BARCODE',
          data: { ...result, unmapped_id: captured.id },
          hint: 'Not found online. Map it once via POST /api/barcode/learn (or add the item), then scan again.',
        });
      }
    }

    // Quantity: explicit body value wins, else GS1 net weight, else 1 unit.
    const gs1Weight = result.parsed.extracted.net_weight && !result.parsed.extracted.net_weight.assumed
      ? result.parsed.extracted.net_weight.value : null;
    const finalQty = parseFloat(qty) || gs1Weight || 1;
    if (finalQty <= 0) { await trx.rollback(); return res.status(400).json({ success: false, error: 'qty must be positive' }); }

    const expiryDate = expiry || result.parsed.extracted.expiry || null;
    const today = new Date().toISOString().split('T')[0];

    const [batch] = await trx('batches').insert({
      item_id: result.item.id,
      receipt_date: today,
      expiry_date: expiryDate,
      qty_received: finalQty,
      qty_remaining: finalQty,
      location_id: location_id || null,
    }).returning('*');

    if (rate != null && !isNaN(parseFloat(rate))) {
      await trx('items').where({ id: result.item.id }).update({ purchase_rate: parseFloat(rate) });
    }

    await logAudit({
      table_name: 'batches', record_id: batch.id, action: 'INSERT',
      user_id: req.user.id,
      new_value: { item_id: result.item.id, qty: finalQty, expiry_date: expiryDate, via: 'barcode_scan', batch: result.parsed.extracted.batch || null },
    }, trx);

    const item = await itemWithStock(trx, result.item.id);
    await trx.commit();
    res.status(201).json({
      success: true,
      data: {
        action: autoCreated ? 'AUTO_CREATED_AND_STOCKED' : 'STOCK_ADDED',
        matched_via: result.matched_via, auto_created: autoCreated,
        item, batch, added_qty: finalQty, new_stock: item.live_stock,
        enrichment: result.enrichment || null,
        parsed: result.parsed,
      },
    });
  } catch (err) { await trx.rollback(); next(err); }
});

async function fifoPick(itemId, qtyRequired, trx) {
  const today = new Date().toISOString().split('T')[0];
  const batches = await trx('batches')
    .where({ item_id: itemId }).where('qty_remaining', '>', 0)
    .where(function () { this.whereNull('expiry_date').orWhere('expiry_date', '>=', today); })
    .orderBy('receipt_date', 'asc').forUpdate();
  let remaining = qtyRequired;
  const picks = [];
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(parseFloat(b.qty_remaining), remaining);
    picks.push({ batch_id: b.id, expiry: b.expiry_date, take });
    remaining -= take;
  }
  if (remaining > 0) throw new Error(`INSUFFICIENT_STOCK: short by ${remaining}`);
  return picks;
}

// POST /api/barcode/outward — SCAN TO REMOVE STOCK (FIFO).
router.post('/outward', authenticate, authorize('admin', 'sales', 'warehouse'), async (req, res, next) => {
  const trx = await db.transaction();
  try {
    const { raw, qty } = req.body;
    if (!raw) { await trx.rollback(); return res.status(400).json({ success: false, error: 'raw is required' }); }

    const result = await resolveScan(trx, raw);
    if (!result.item) {
      const captured = await captureUnmapped(trx, result.parsed, req.user.id, 'outward');
      await trx.commit();
      return res.status(404).json({
        success: false, error: 'UNKNOWN_BARCODE',
        data: { ...result, unmapped_id: captured.id },
        hint: 'Map this barcode to an item via POST /api/barcode/learn, then scan again.',
      });
    }

    const finalQty = parseFloat(qty) || 1;
    if (finalQty <= 0) { await trx.rollback(); return res.status(400).json({ success: false, error: 'qty must be positive' }); }

    let picks;
    try {
      picks = await fifoPick(result.item.id, finalQty, trx);
    } catch (e) {
      await trx.rollback();
      if (String(e.message).startsWith('INSUFFICIENT_STOCK')) {
        const cur = await itemWithStock(db, result.item.id);
        return res.status(409).json({ success: false, error: e.message, data: { item: cur, requested: finalQty, available: cur.live_stock } });
      }
      throw e;
    }

    for (const pick of picks) {
      await trx('batches').where({ id: pick.batch_id })
        .update({ qty_remaining: db.raw('qty_remaining - ?', [pick.take]) });
      await logAudit({
        table_name: 'batches', record_id: pick.batch_id, action: 'UPDATE',
        user_id: req.user.id,
        changed_fields: { qty_remaining: true },
        new_value: { deducted: pick.take, via: 'barcode_scan', item_id: result.item.id },
      }, trx);
    }

    const item = await itemWithStock(trx, result.item.id);
    await trx.commit();
    res.json({
      success: true,
      data: {
        action: 'STOCK_DEDUCTED', matched_via: result.matched_via,
        item, removed_qty: finalQty, picks, new_stock: item.live_stock,
        parsed: result.parsed,
      },
    });
  } catch (err) { await trx.rollback(); next(err); }
});

module.exports = router;
