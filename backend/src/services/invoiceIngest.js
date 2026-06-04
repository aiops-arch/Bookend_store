/**
 * Invoice → Inward pipeline.
 *
 * Takes a structured invoice object (produced by the reader / Codex) and enters
 * it into this system: resolves the vendor + each line's catalogue item, creates
 * an Inward entry, confirms it (creates stock batches) and locks it — all in one
 * transaction. Item matching: item_code → barcode/alias → exact name → fuzzy
 * name → auto-create. Idempotent on (vendor, invoice_no).
 *
 * ingestInvoice(obj, { dryRun }) → summary
 */
'use strict';

const db = require('../config/db');
const { logAudit } = require('./audit');
const { generateEAN13 } = require('./barcode');
const { normalizeKey } = require('./normalize');

const FUZZY_THRESHOLD = 0.6;

function toISO(d) {
  if (!d) return null;
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// Combined name similarity (0..1): max of word-overlap and char-level ratio,
// so typos/spacing ("Nodles 320 gm" vs "Noodles 320gm") still match.
function similarity(a, b) {
  const na = normalizeKey(a), nb = normalizeKey(b);
  if (!na || !nb) return 0;
  const A = new Set(na.split(' ').filter(Boolean));
  const B = new Set(nb.split(' ').filter(Boolean));
  let hit = 0; for (const t of A) if (B.has(t)) hit++;
  const overlap = hit / Math.max(A.size, B.size);
  const ca = na.replace(/\s+/g, ''), cb = nb.replace(/\s+/g, '');
  const charRatio = 1 - levenshtein(ca, cb) / Math.max(ca.length, cb.length);
  return Math.max(overlap, charRatio);
}

async function findVendor(trx, vendor) {
  const name = (vendor && vendor.name || '').trim();
  if (!name) throw new Error('vendor.name is required');
  let row = await trx('vendors').whereRaw('LOWER(name)=LOWER(?)', [name]).first();
  if (!row) {
    [row] = await trx('vendors').insert({
      name, gstin: vendor.gstin || null, contact: vendor.contact || null,
    }).returning('*');
  }
  return row;
}

async function defaultSubCategoryId(trx, categoryHint) {
  if (categoryHint) {
    const sub = await trx('sub_categories').whereRaw('LOWER(name)=LOWER(?)', [categoryHint]).first();
    if (sub) return sub.id;
    // match a top-level category name → its first sub
    const cat = await trx('categories').whereRaw('LOWER(name)=LOWER(?)', [categoryHint]).first();
    if (cat) {
      const s = await trx('sub_categories').where({ category_id: cat.id }).first();
      if (s) return s.id;
    }
  }
  for (const name of ['Uncategorized', 'Others', 'General']) {
    const s = await trx('sub_categories').whereRaw('LOWER(name)=LOWER(?)', [name]).first();
    if (s) return s.id;
  }
  const any = await trx('sub_categories').orderBy('id').first();
  if (!any) throw new Error('no sub_categories exist to attach items to');
  return any.id;
}

async function nextItemCode(trx) {
  const row = await trx('items').select('item_code').orderBy('id', 'desc').first();
  if (!row || !/^FG-\d+$/.test(row.item_code)) return 'FG-0001';
  return 'FG-' + String(parseInt(row.item_code.slice(3), 10) + 1).padStart(4, '0');
}

// Resolve (or create) the catalogue item for an invoice line.
// Returns { item, how } where how = item_code|barcode|exact_name|fuzzy_name|created.
async function resolveLineItem(trx, line, catalog, userId, counters) {
  const name = (line.name || '').trim();

  // 1. item_code
  if (line.item_code) {
    const hit = await trx('items').whereRaw('UPPER(item_code)=UPPER(?)', [String(line.item_code)]).first();
    if (hit) { counters.matched++; return { item: hit, how: 'item_code' }; }
  }
  // 2. barcode (primary or alias)
  if (line.barcode) {
    const bc = String(line.barcode);
    let hit = await trx('items').where({ barcode: bc }).first();
    if (!hit) {
      const al = await trx('item_aliases').where({ alias_barcode: bc }).first();
      if (al) hit = await trx('items').where({ id: al.item_id }).first();
    }
    if (hit) { counters.matched++; return { item: hit, how: 'barcode' }; }
  }
  if (!name) throw new Error('line has no name/item_code/barcode to match');

  // 3. exact name
  const exact = await trx('items').whereRaw('LOWER(variant_grade)=LOWER(?)', [name]).first();
  if (exact) { counters.matched++; return { item: exact, how: 'exact_name' }; }

  // 4. fuzzy name against catalogue
  let best = null, score = 0;
  for (const it of catalog) {
    const s = similarity(name, it.variant_grade || '');
    if (s > score) { score = s; best = it; }
  }
  if (best && score >= FUZZY_THRESHOLD) {
    counters.matched++;
    return { item: await trx('items').where({ id: best.id }).first(), how: 'fuzzy_name', score: Math.round(score * 100) };
  }

  // 5. auto-create
  const subId = await defaultSubCategoryId(trx, line.category);
  const item_code = await nextItemCode(trx);
  const realEan = line.barcode && /^\d{8,14}$/.test(String(line.barcode)) ? String(line.barcode) : null;
  const [created] = await trx('items').insert({
    sub_category_id: subId,
    item_code,
    barcode: realEan || ('TMP-' + item_code),
    unit: line.unit || 'pcs',
    variant_grade: name.slice(0, 50),
    purchase_rate: line.rate != null ? parseFloat(line.rate) : null,
    gst_rate: 5,
    is_active: true,
    description: 'Auto-created from invoice intake',
  }).returning('*');
  if (!realEan) await trx('items').where({ id: created.id }).update({ barcode: generateEAN13(created.id) });
  await logAudit({ table_name: 'items', record_id: created.id, action: 'INSERT', user_id: userId, new_value: { ...created, via: 'invoice_intake' } }, trx);
  catalog.push({ id: created.id, item_code, variant_grade: name.slice(0, 50) });
  counters.created++;
  return { item: await trx('items').where({ id: created.id }).first(), how: 'created' };
}

async function ingestInvoice(obj, opts = {}) {
  const dryRun = !!opts.dryRun;
  if (!obj || !Array.isArray(obj.lines) || obj.lines.length === 0) {
    throw new Error('invoice has no lines');
  }
  const invoiceNo = (obj.invoice_no || '').toString().trim() || null;
  // invoice_no is required — it's the key that prevents the same invoice being
  // entered twice if the automation retries.
  if (!invoiceNo) throw new Error('invoice_no is required (prevents double-entry on retry)');
  // Store guard: only mirror the configured store (default Surat 117185). This
  // stops another store's invoices (e.g. Ahmedabad 358609) polluting this catalogue.
  const expectedStore = process.env.EXPECTED_STORE_PP_ID || '117185';
  const gotStore = obj.store && (obj.store.pp_id || obj.store.id);
  if (gotStore && String(gotStore).trim() !== String(expectedStore).trim()) {
    throw new Error(`store ${gotStore} is not accepted — this system mirrors store ${expectedStore} only`);
  }
  const summary = { invoice_no: invoiceNo, vendor: obj.vendor && obj.vendor.name, lines_total: obj.lines.length, items_matched: 0, items_created: 0, batches_created: 0, status: null, dry_run: dryRun };
  const counters = { matched: 0, created: 0 };

  const trx = await db.transaction();
  try {
    const admin = await trx('users').where({ role: 'admin' }).first();
    if (!admin) throw new Error('no admin user to attribute the entry to');

    const vendor = await findVendor(trx, obj.vendor || {});

    // Idempotency: same vendor + invoice_no already entered (not draft) → skip.
    if (invoiceNo) {
      const dup = await trx('inward_entries')
        .where({ vendor_id: vendor.id, invoice_no: invoiceNo })
        .whereIn('status', ['confirmed', 'locked']).first();
      if (dup) {
        await trx.rollback();
        return { ...summary, status: 'skipped_duplicate', existing_inward_id: dup.id };
      }
    }

    const receiptDate = toISO(obj.invoice_date) || new Date().toISOString().split('T')[0];
    const catalog = await trx('items').select('id', 'item_code', 'variant_grade');

    // Create the inward entry (draft). raw_invoice keeps a VERBATIM copy of the
    // whole invoice exactly as sent — so nothing Pet Pooja had is ever lost,
    // even fields we don't have dedicated columns for.
    const [entry] = await trx('inward_entries').insert({
      vendor_id: vendor.id, invoice_no: invoiceNo, invoice_date: toISO(obj.invoice_date),
      status: 'draft', created_by: admin.id,
      raw_invoice: JSON.stringify(obj),
    }).returning('*');
    await logAudit({ table_name: 'inward_entries', record_id: entry.id, action: 'INSERT', user_id: admin.id, new_value: { ...entry, via: 'invoice_intake' } }, trx);

    // Resolve + add lines, then create batches (confirm), then lock.
    const lineMap = []; // Pet Pooja ↔ this-system reconciliation
    for (const line of obj.lines) {
      const qty = parseFloat(line.qty);
      if (!qty || qty <= 0) throw new Error(`line "${line.name || line.item_code}" has invalid qty`);
      const { item, how, score } = await resolveLineItem(trx, line, catalog, admin.id, counters);
      const rate = line.rate != null && !isNaN(parseFloat(line.rate)) ? parseFloat(line.rate) : 0;
      const expiry = toISO(line.expiry_date);
      const num = (...vals) => { for (const v of vals) { if (v != null && !isNaN(parseFloat(v))) return parseFloat(v); } return null; };

      const [il] = await trx('inward_lines').insert({
        inward_id: entry.id, item_id: item.id, qty, rate, expiry_date: expiry,
        // exact invoice figures (tax/discount/total) + the raw item name + HSN
        tax_rate: num(line.tax_rate, line.gst, line.gst_rate),
        tax_amount: num(line.tax_amount, line.tax),
        discount: num(line.discount),
        line_total: num(line.line_total, line.total, line.amount),
        source_name: (line.name || '').toString().slice(0, 200) || null,
        hsn_code: (line.hsn || line.hsn_code || '').toString().slice(0, 20) || null,
      }).returning('*');

      const [batch] = await trx('batches').insert({
        item_id: item.id, receipt_date: receiptDate, expiry_date: expiry,
        qty_received: qty, qty_remaining: qty,
      }).returning('*');
      await trx('inward_lines').where({ id: il.id }).update({ batch_id: batch.id });
      await logAudit({ table_name: 'batches', record_id: batch.id, action: 'INSERT', user_id: admin.id, new_value: { item_id: item.id, qty, via: 'invoice_intake' } }, trx);
      summary.batches_created++;

      lineMap.push({
        name: line.name || null,
        pp_item_id: line.pp_item_id || line.petpooja_item_id || null,
        item_id: item.id, item_code: item.item_code, matched_by: how, ...(score ? { match_score: score + '%' } : {}),
        qty, rate, unit: item.unit, expiry_date: expiry,
      });
    }

    // Pet Pooja reference block (kept for cross-system reconciliation).
    const external_ref = {
      source: 'petpooja_invoice',
      store: obj.store || null,                       // { pp_id, name } from Codex
      pp_supplier_id: (obj.vendor && (obj.vendor.pp_supplier_id || obj.vendor.supplier_id)) || null,
      invoice_no: invoiceNo,
      lines: lineMap,
    };

    // Confirm + lock (external_ref stored in the audit trail for reconciliation).
    await trx('inward_entries').where({ id: entry.id }).update({ status: 'locked', locked_at: new Date() });
    await logAudit({ table_name: 'inward_entries', record_id: entry.id, action: 'LOCK', user_id: admin.id, old_value: { status: 'draft' }, new_value: { status: 'locked', via: 'invoice_intake', external_ref } }, trx);
    summary.reconciliation = external_ref;

    summary.items_matched = counters.matched;
    summary.items_created = counters.created;
    summary.inward_id = entry.id;
    summary.vendor_id = vendor.id;
    summary.status = dryRun ? 'dry_run_ok' : 'entered_and_locked';

    if (dryRun) await trx.rollback(); else await trx.commit();
    return summary;
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

module.exports = { ingestInvoice };
