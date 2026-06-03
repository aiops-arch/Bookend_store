/**
 * External product-database lookup. Turns a bare barcode into real product
 * facts so a brand-new item can be catalogued with zero typing.
 *
 * Primary source: Open Food Facts (free, no API key, strong food/grocery
 * coverage incl. India). Designed so other sources (UPCitemdb, GS1 Datakart)
 * can be slotted in behind the same return shape later.
 */
'use strict';

const OFF_BASE = process.env.OFF_BASE_URL || 'https://world.openfoodfacts.org';
const UA = 'FG-Inventory/1.0 (https://kgirdharlal.com; ketanbheda@kgirdharlal.com)';
const TIMEOUT_MS = 6000;

async function fetchJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Look a barcode up. `candidates` are the lookup keys from the parser (EAN-13,
// GTIN forms…). Returns a normalised product or { found: false }.
async function lookupProduct(candidates) {
  const tried = new Set();
  for (const code of candidates) {
    // Open Food Facts is keyed on EAN-13/UPC numeric codes.
    if (!/^\d{8,14}$/.test(code) || tried.has(code)) continue;
    tried.add(code);
    const fields = 'product_name,product_name_en,generic_name,brands,quantity,categories,categories_tags,image_url,countries,nutriscore_grade,labels';
    const j = await fetchJson(`${OFF_BASE}/api/v2/product/${code}.json?fields=${fields}`);
    if (j && j.status === 1 && j.product) {
      const p = j.product;
      const name = (p.product_name_en || p.product_name || p.generic_name || '').trim();
      if (!name) continue;
      return {
        found: true,
        source: 'OpenFoodFacts',
        barcode: code,
        name,
        brand: (p.brands || '').split(',')[0].trim() || null,
        quantity: p.quantity || null,
        categories_text: p.categories || null,
        categories_tags: p.categories_tags || [],
        image_url: p.image_url || null,
        raw: p,
      };
    }
  }
  return { found: false };
}

module.exports = { lookupProduct };
