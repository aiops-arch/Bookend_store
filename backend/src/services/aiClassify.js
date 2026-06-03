/**
 * Turn raw product facts (from a barcode lookup) into clean catalog fields:
 * a tidy name, one of OUR existing categories, a stock unit, pack size and a
 * shelf-life estimate — with no human typing.
 *
 * Uses Claude (Anthropic API) when ANTHROPIC_API_KEY is set — it's good at
 * reading messy product text and picking the right bucket. Falls back to a
 * deterministic keyword classifier when no key is present, so the pipeline
 * works out of the box and just gets smarter once a key is added.
 */
'use strict';

const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || null;
const MODEL = process.env.CLASSIFY_MODEL || 'claude-haiku-4-5-20251001';

// quantity string ("100.0 g", "1 kg", "33 cl", "6 x 90 g") → {pack_size, unit}
function parsePackSize(q) {
  if (!q) return { pack_size: null, unit: 'pcs' };
  const s = String(q).trim().replace(/\s+/g, ' ');
  const m = s.match(/(\d+(?:\.\d+)?)\s*(kg|g|gm|gram|grams|mg|l|ltr|litre|liter|ml|cl|pcs|pieces?)/i);
  if (!m) return { pack_size: s, unit: 'pcs' };
  let val = parseFloat(m[1]);
  let u = m[2].toLowerCase();
  // Tidy the printed pack size.
  const pack_size = `${val % 1 === 0 ? val : val} ${u}`.replace('gm', 'g');
  // A packaged retail item is stocked as pieces/packs; the pack size captures the weight.
  return { pack_size, unit: 'pcs' };
}

// ── deterministic fallback ───────────────────────────────────────────────────

const KEYWORD_RULES = [
  [/(butter|cheese|paneer|milk|cream|curd|yogurt|dahi|dairy|ghee)/i, 'Dairy & Cheese'],
  [/(amul)/i, 'Amul Products'],
  [/(cola|coke|pepsi|soda|soft ?drink|cold ?drink|carbonated)/i, 'Cold Drinks'],
  [/(juice|beverage|tea|coffee|drink|water|squash|syrup|sharbat)/i, 'Beverages'],
  [/(atta|maida|flour|besan|suji|rava)/i, 'Flour'],
  [/(almond|cashew|kaju|badam|raisin|kishmish|walnut|pista|nut|dry ?fruit|anjeer|date)/i, 'Nuts & Dry Fruits'],
  [/(sauce|ketchup|mayonnaise|mayo|dressing|vinegar)/i, 'Sauce'],
  [/(masala|spice|seasoning|pepper|turmeric|haldi|chilli|jeera|cumin|garam)/i, 'Spices & Seasoning'],
  [/(\boil\b|olive oil|sunflower|mustard oil|refined oil)/i, 'Oil'],
  [/(bread|bun|bakery|cake|pastry|cookie|biscuit|rusk)/i, 'Bakery'],
  [/(canned|tin|can\b|puree|paste|preserved)/i, 'Canned'],
  [/(rice|sugar|salt|dal|pulse|lentil|grain|cereal|noodle|pasta|grocery|honey|jam)/i, 'Grocery'],
  [/(fruit|vegetable|fresh|produce|tomato|onion|potato)/i, 'Fresh Produce'],
  [/(tissue|napkin|cleaner|detergent|soap|housekeeping|sanitiz|phenyl|disinfect)/i, 'Housekeeping'],
  [/(box|container|cup|plate|wrap|foil|packing|carton|pouch|bag)\b/i, 'Packing Materials'],
  [/(paper|pen|stationery|stapler|file|marker)/i, 'Stationery'],
  [/(equipment|machine|utensil|tray|knife|tool|tongs|spoon|ladle)/i, 'Kitchen Equipment'],
];

function heuristicCategory(text, existing) {
  const hay = text.toLowerCase();
  for (const [re, cat] of KEYWORD_RULES) {
    if (re.test(hay) && existing.includes(cat)) return cat;
  }
  // Sensible generic landing spots, in order of preference.
  for (const c of ['Grocery', 'Others', 'Uncategorized']) if (existing.includes(c)) return c;
  return existing[0];
}

function heuristicClassify(product, existing) {
  const text = [product.name, product.brand, product.categories_text, (product.categories_tags || []).join(' ')]
    .filter(Boolean).join(' ');
  const { pack_size, unit } = parsePackSize(product.quantity);
  const name = product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase())
    ? `${product.brand} ${product.name}` : product.name;
  return {
    variant_grade: name.slice(0, 50),
    category: heuristicCategory(text, existing),
    unit, pack_size,
    shelf_life_days: 365,
    confidence: product.found ? 70 : 30,
    method: 'heuristic',
  };
}

// ── Claude path ──────────────────────────────────────────────────────────────

async function claudeClassify(product, existing) {
  const sys = 'You categorise retail/restaurant products into an existing inventory taxonomy. ' +
    'Respond with ONLY a JSON object, no prose. Keys: clean_name (string, <=50 chars, brand + product), ' +
    'category (MUST be exactly one of the provided categories), unit (one of: pcs, kg, liter, pack, box, tin), ' +
    'pack_size (string like "500 g" or null), shelf_life_days (integer estimate). Pick the single best category.';
  const user = `Existing categories: ${JSON.stringify(existing)}\n\nProduct facts:\n` +
    JSON.stringify({
      name: product.name, brand: product.brand, quantity: product.quantity,
      categories: product.categories_text, tags: product.categories_tags,
    }, null, 2);

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: sys,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}`);
  const j = await r.json();
  const text = (j.content || []).map(b => b.text || '').join('');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('no json in model reply');
  const out = JSON.parse(match[0]);

  let category = out.category;
  if (!existing.includes(category)) category = heuristicCategory(`${out.clean_name} ${product.categories_text || ''}`, existing);
  return {
    variant_grade: String(out.clean_name || product.name).slice(0, 50),
    category,
    unit: ['pcs', 'kg', 'liter', 'pack', 'box', 'tin'].includes(out.unit) ? out.unit : 'pcs',
    pack_size: out.pack_size || parsePackSize(product.quantity).pack_size,
    shelf_life_days: Number.isFinite(out.shelf_life_days) ? out.shelf_life_days : 365,
    confidence: 90,
    method: 'claude',
  };
}

// Public: classify a looked-up product into our catalog fields.
async function classifyItem(product, existingCategories) {
  const existing = existingCategories && existingCategories.length ? existingCategories : ['Others'];
  if (API_KEY) {
    try {
      return await claudeClassify(product, existing);
    } catch (e) {
      // Any model/network hiccup → fall back, never block a scan.
      return { ...heuristicClassify(product, existing), method: 'heuristic_fallback', note: e.message };
    }
  }
  return heuristicClassify(product, existing);
}

module.exports = { classifyItem, parsePackSize, heuristicCategory, aiEnabled: !!API_KEY };
