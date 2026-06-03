/**
 * Universal barcode parser — pure, dependency-free.
 *
 * Real-world barcodes are "too random" because retailers, scales, and
 * suppliers all encode differently. This module figures out what a scanned
 * string actually is and extracts everything it can:
 *
 *   - GS1-128 / GS1 DataMatrix / GS1 QR element strings  → Application
 *     Identifiers: GTIN(01), batch/lot(10), expiry(17), production date(11),
 *     net weight(310n/320n), price(392n/393n/390n), serial(21), count(30/37)...
 *   - Weight / price-embedded EAN-13 (GS1 prefix 02 and 20-29, "in-store" /
 *     restricted distribution) → embedded item code + weight or price.
 *   - Standard EAN-13 / UPC-A / EAN-8 / ITF-14 (GTIN-14) with checksum
 *     validation and GS1 country prefix detection.
 *   - Our own printed labels (890 + item-id EAN-13, or FG-xxxx codes).
 *   - Anything else (Code 128 / alphanumeric / unknown) → passthrough so the
 *     caller can capture it for one-tap learning.
 *
 * parseBarcode(raw) never throws — worst case it returns kind 'unknown' with
 * the raw value as a lookup key.
 */
'use strict';

const GS = '\x1d'; // FNC1 / group separator inside GS1 element strings

// GS1 prefix → country / issuing org (enough for a human-readable hint).
const GS1_PREFIX = [
  [0, 19, 'UPC-A (USA/Canada)'], [30, 39, 'USA drugs (NDC)'], [50, 59, 'Coupons'],
  [60, 139, 'USA/Canada'], [300, 379, 'France'], [380, 380, 'Bulgaria'],
  [383, 383, 'Slovenia'], [385, 385, 'Croatia'], [387, 387, 'Bosnia'],
  [400, 440, 'Germany'], [450, 459, 'Japan'], [460, 469, 'Russia'],
  [471, 471, 'Taiwan'], [474, 474, 'Estonia'], [480, 480, 'Philippines'],
  [489, 489, 'Hong Kong'], [490, 499, 'Japan'], [500, 509, 'United Kingdom'],
  [520, 521, 'Greece'], [528, 528, 'Lebanon'], [529, 529, 'Cyprus'],
  [535, 535, 'Malta'], [539, 539, 'Ireland'], [540, 549, 'Belgium/Luxembourg'],
  [560, 560, 'Portugal'], [569, 569, 'Iceland'], [570, 579, 'Denmark'],
  [590, 590, 'Poland'], [594, 594, 'Romania'], [599, 599, 'Hungary'],
  [600, 601, 'South Africa'], [609, 609, 'Mauritius'], [611, 611, 'Morocco'],
  [613, 613, 'Algeria'], [619, 619, 'Tunisia'], [621, 621, 'Syria'],
  [622, 622, 'Egypt'], [625, 625, 'Jordan'], [626, 626, 'Iran'],
  [628, 628, 'Saudi Arabia'], [629, 629, 'UAE'], [640, 649, 'Finland'],
  [690, 699, 'China'], [700, 709, 'Norway'], [729, 729, 'Israel'],
  [730, 739, 'Sweden'], [740, 745, 'Central America'], [754, 755, 'Canada'],
  [759, 759, 'Venezuela'], [760, 769, 'Switzerland'], [770, 771, 'Colombia'],
  [773, 773, 'Uruguay'], [775, 775, 'Peru'], [777, 777, 'Bolivia'],
  [778, 779, 'Argentina'], [780, 780, 'Chile'], [784, 784, 'Paraguay'],
  [786, 786, 'Ecuador'], [789, 790, 'Brazil'], [800, 839, 'Italy'],
  [840, 849, 'Spain'], [850, 850, 'Cuba'], [858, 858, 'Slovakia'],
  [859, 859, 'Czech Republic'], [860, 860, 'Serbia'], [865, 865, 'Mongolia'],
  [867, 867, 'North Korea'], [868, 869, 'Turkey'], [870, 879, 'Netherlands'],
  [880, 880, 'South Korea'], [884, 884, 'Cambodia'], [885, 885, 'Thailand'],
  [888, 888, 'Singapore'], [890, 890, 'India'], [893, 893, 'Vietnam'],
  [896, 896, 'Pakistan'], [899, 899, 'Indonesia'], [900, 919, 'Austria'],
  [930, 939, 'Australia'], [940, 949, 'New Zealand'], [955, 955, 'Malaysia'],
  [958, 958, 'Macau'],
];

function countryForPrefix(ean13) {
  const p3 = parseInt(ean13.slice(0, 3), 10);
  for (const [lo, hi, name] of GS1_PREFIX) if (p3 >= lo && p3 <= hi) return name;
  return null;
}

// ── checksum helpers ────────────────────────────────────────────────────────

// Standard GS1 mod-10 checksum (EAN-13, UPC-A, EAN-8, GTIN-14). The check
// digit is the last char; weights alternate 3/1 from the right.
function gs1CheckValid(digits) {
  if (!/^\d+$/.test(digits)) return false;
  const arr = digits.split('').map(Number);
  const check = arr.pop();
  let sum = 0;
  for (let i = arr.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += arr[i] * w;
  return (10 - (sum % 10)) % 10 === check;
}

// ── GS1 Application Identifier table ─────────────────────────────────────────
// dataLen: fixed digit count, or null for variable (terminated by GS / end).

const AI_FIXED = {
  '00': 18, '01': 14, '02': 14, '03': 14, '04': 16,
  '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6, '18': 6, '19': 6,
  '20': 2,
};
const AI_VAR = new Set([
  '10', '21', '22', '235', '240', '241', '242', '243', '250', '251', '253', '254', '255',
  '30', '37', '90', '91', '92', '93', '94', '95', '96', '97', '98', '99',
  '400', '401', '402', '403', '410', '411', '412', '413', '414', '415', '416', '417',
  '420', '421', '422', '423', '424', '425', '426', '427',
  '7001', '7002', '7003', '7004', '8001', '8002', '8003', '8004', '8005', '8006',
  '8008', '8010', '8011', '8017', '8018', '8020', '8200', '710', '711', '712', '713', '714',
]);

const AI_TITLE = {
  '00': 'SSCC', '01': 'GTIN', '02': 'GTIN (contained)', '10': 'Batch/Lot',
  '11': 'Production date', '12': 'Due date', '13': 'Packaging date',
  '15': 'Best before', '16': 'Sell by', '17': 'Expiry', '20': 'Variant',
  '21': 'Serial', '22': 'Consumer product variant', '30': 'Count', '37': 'Count (trade)',
  '240': 'Additional ID', '241': 'Customer part no', '8005': 'Price per unit',
};

// Resolve the AI starting at `s[pos]`. Returns {ai, dataLen, decimal, kind} or null.
function resolveAi(s, pos) {
  const c4 = s.substr(pos, 4);
  // Decimal measure families: 31nn-36nn (metric/imperial weight, length, volume…)
  if (/^3[1-6]\d\d$/.test(c4)) {
    const fam = c4.slice(0, 3);
    const kindByFam = {
      '310': { kind: 'net_weight', unit: 'kg' }, '311': { kind: 'length', unit: 'm' },
      '320': { kind: 'net_weight', unit: 'lb' }, '315': { kind: 'volume', unit: 'l' },
      '316': { kind: 'volume', unit: 'm3' }, '350': { kind: 'area', unit: 'm2' },
      '360': { kind: 'volume', unit: 'l' },
    };
    const meta = kindByFam[fam] || { kind: 'measure', unit: null };
    return { ai: c4, dataLen: 6, decimal: parseInt(c4[3], 10), ...meta };
  }
  // Amount / price families: 39nn (amount payable / price, optional currency)
  if (/^39[0-5]\d$/.test(c4)) {
    const fam = c4.slice(0, 3);
    const kind = (fam === '390' || fam === '391') ? 'amount_payable' : 'price';
    const withCurrency = (fam === '391' || fam === '393' || fam === '395');
    return { ai: c4, dataLen: null, decimal: parseInt(c4[3], 10), kind, withCurrency };
  }
  // 4-digit variable AIs (8xxx, 7xxx)
  if (AI_VAR.has(c4)) return { ai: c4, dataLen: null, kind: AI_TITLE[c4] || 'data' };
  // 3-digit AIs
  const c3 = s.substr(pos, 3);
  if (AI_VAR.has(c3)) return { ai: c3, dataLen: null, kind: AI_TITLE[c3] || 'data' };
  // 2-digit fixed / variable AIs
  const c2 = s.substr(pos, 2);
  if (AI_FIXED[c2] != null) return { ai: c2, dataLen: AI_FIXED[c2], kind: AI_TITLE[c2] || 'data' };
  if (AI_VAR.has(c2)) return { ai: c2, dataLen: null, kind: AI_TITLE[c2] || 'data' };
  return null;
}

// Parse a YYMMDD GS1 date → ISO yyyy-mm-dd. DD=00 means "end of month".
function gs1Date(yymmdd) {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = parseInt(yymmdd.slice(2, 4), 10);
  let dd = parseInt(yymmdd.slice(4, 6), 10);
  if (mm < 1 || mm > 12) return null;
  // GS1 rule of thumb: a 2-digit year maps to the nearest 50-year window.
  const year = 2000 + yy;
  if (dd === 0) dd = new Date(Date.UTC(year, mm, 0)).getUTCDate(); // last day of month
  if (dd < 1 || dd > 31) return null;
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

// Walk a GS1 element string and return a map of ai → {value, ...meta}.
function parseGs1Elements(s) {
  const out = {};
  let i = 0;
  let guard = 0;
  while (i < s.length && guard++ < 64) {
    while (s[i] === GS) i++;
    if (i >= s.length) break;
    const def = resolveAi(s, i);
    if (!def) break; // can't recognise the next AI — stop cleanly
    i += def.ai.length;
    let value;
    if (def.dataLen != null) {
      value = s.substr(i, def.dataLen);
      i += def.dataLen;
    } else {
      const gsAt = s.indexOf(GS, i);
      if (gsAt === -1) { value = s.substr(i); i = s.length; }
      else { value = s.substring(i, gsAt); i = gsAt + 1; }
    }
    out[def.ai] = { value, def };
  }
  return out;
}

// ── public entry point ───────────────────────────────────────────────────────

function emptyExtracted() {
  return {
    gtin: null, batch: null, serial: null,
    expiry: null, production_date: null, best_before: null, packaging_date: null,
    net_weight: null, price: null, amount_payable: null, count: null,
    embedded_item_code: null, embedded_value: null,
    gs1: null,
  };
}

function parseBarcode(raw) {
  const result = {
    raw: raw == null ? '' : String(raw),
    clean: '',
    symbology: 'UNKNOWN',
    kind: 'unknown',        // standard_product | weight_embedded | price_embedded | gs1 | internal | unknown
    valid_checksum: null,
    country: null,
    confidence: 0,
    lookup_keys: [],
    extracted: emptyExtracted(),
    notes: [],
  };

  // 1. Normalise. Strip leading scanner symbology identifiers (]C1, ]e0, ]d2, ]Q3…)
  let s = result.raw.trim();
  let hadSymbologyId = false;
  const symMatch = s.match(/^\][A-Za-z]\d/);
  if (symMatch) { hadSymbologyId = true; s = s.slice(3); }
  // Normalise common textual GS representations to the real GS byte.
  s = s.replace(/<GS>|\{GS\}|\\x1d|\\u001d/gi, GS);
  result.clean = s.replace(new RegExp(GS, 'g'), '␝'); // visible form for display

  if (!s) { result.notes.push('empty input'); return result; }

  const addKey = (k) => { if (k && !result.lookup_keys.includes(k)) result.lookup_keys.push(k); };

  // 2. GS1 element string? Either a symbology id said so, or it contains a GS
  //    byte, or it begins with a recognisable AI like (01)/(17)/(10).
  const looksGs1 = hadSymbologyId || s.includes(GS) || /^\(\d{2,4}\)/.test(s) ||
    /^01\d{14}/.test(s) || /^(00)\d{18}/.test(s);

  if (looksGs1) {
    // Support human/parenthesised form "(01)0890...(10)LOT5(3103)001250".
    // Insert a GS before every AI marker so variable-length fields terminate at
    // the next element instead of greedily swallowing it.
    let stream = s;
    if (s.includes('(')) stream = s.replace(/\((\d{2,4})\)/g, (_, ai) => GS + ai).replace(/^\x1d/, '');
    const ais = parseGs1Elements(stream);
    if (Object.keys(ais).length) {
      result.symbology = hadSymbologyId && symMatch[0] === ']d2' ? 'GS1-DataMatrix'
        : hadSymbologyId && symMatch[0] === ']Q3' ? 'GS1-QR'
        : 'GS1-128';
      result.kind = 'gs1';
      result.extracted.gs1 = {};
      let conf = 60;
      for (const [ai, { value, def }] of Object.entries(ais)) {
        result.extracted.gs1[ai] = value;
        switch (def.kind) {
          case 'GTIN': case 'GTIN (contained)': {
            const gtin = value.padStart(14, '0');
            result.extracted.gtin = gtin;
            result.valid_checksum = gs1CheckValid(gtin.slice(1)); // GTIN-14 carries its own check digit
            // Expose every GTIN form as a lookup key.
            const ean13 = gtin.slice(1);
            addKey(gtin); addKey(ean13); addKey(ean13.replace(/^0+/, ''));
            result.country = countryForPrefix(ean13);
            conf += 30;
            break;
          }
          case 'Batch/Lot': result.extracted.batch = value; conf += 3; break;
          case 'Serial': result.extracted.serial = value; break;
          case 'Expiry': result.extracted.expiry = gs1Date(value); conf += 3; break;
          case 'Production date': result.extracted.production_date = gs1Date(value); break;
          case 'Best before': result.extracted.best_before = gs1Date(value); break;
          case 'Packaging date': result.extracted.packaging_date = gs1Date(value); break;
          case 'net_weight': {
            const v = parseInt(value, 10) / Math.pow(10, def.decimal || 0);
            result.extracted.net_weight = { value: v, unit: def.unit };
            conf += 2; break;
          }
          case 'price': {
            let amount = value, currency = null;
            if (def.withCurrency && value.length > 3) {
              currency = value.slice(0, 3); amount = value.slice(3);
            }
            result.extracted.price = {
              value: parseInt(amount, 10) / Math.pow(10, def.decimal || 0),
              currency_code: currency,
            };
            break;
          }
          case 'amount_payable': {
            let amount = value, currency = null;
            if (def.withCurrency && value.length > 3) { currency = value.slice(0, 3); amount = value.slice(3); }
            result.extracted.amount_payable = {
              value: parseInt(amount, 10) / Math.pow(10, def.decimal || 0),
              currency_code: currency,
            };
            break;
          }
          case 'Count': case 'Count (trade)':
            result.extracted.count = parseInt(value, 10); break;
          default: break;
        }
      }
      addKey(s);
      result.confidence = Math.min(100, conf);
      if (!result.extracted.gtin) result.notes.push('GS1 string without a GTIN (01) element');
      return result;
    }
    result.notes.push('looked like GS1 but no AIs parsed; falling back');
  }

  // 3. Pure-digit symbologies (EAN/UPC/GTIN).
  if (/^\d+$/.test(s)) {
    addKey(s);
    const len = s.length;

    if (len === 13) {
      result.symbology = 'EAN-13';
      result.valid_checksum = gs1CheckValid(s);
      result.country = countryForPrefix(s);
      const p2 = s.slice(0, 2);

      // Restricted distribution / in-store: prefix 02 or 20-29 → weight/price embedded.
      if (p2 === '02' || (p2[0] === '2')) {
        const embeddedItem = s.slice(1, 7);   // 6-digit in-store item reference
        const embeddedVal = s.slice(7, 12);   // 5-digit measure/price field
        const valNum = parseInt(embeddedVal, 10);
        result.extracted.embedded_item_code = embeddedItem;
        result.extracted.embedded_value = valNum;
        addKey(embeddedItem);
        addKey(s.slice(0, 7)); // prefix+item, ignoring the variable tail
        // 20-24 commonly = price-embedded, 25-29 = weight-embedded (retailer-specific).
        const secondDigit = parseInt(p2[1], 10);
        if (p2 === '02' || secondDigit >= 5) {
          result.kind = 'weight_embedded';
          result.extracted.net_weight = { value: valNum / 1000, unit: 'kg', assumed: true };
          result.notes.push('weight-embedded EAN: tail interpreted as grams (retailer-specific)');
        } else {
          result.kind = 'price_embedded';
          result.extracted.price = { value: valNum / 100, currency_code: null, assumed: true };
          result.notes.push('price-embedded EAN: tail interpreted as price (retailer-specific)');
        }
        result.confidence = result.valid_checksum ? 70 : 45;
        return result;
      }

      // NOTE: our own printed labels use the 890 prefix too (890 = India's GS1
      // code), so they are structurally identical to real Indian products and
      // cannot be told apart by shape. We therefore do NOT guess an item id
      // from the digits — our labels are stored in items.barcode and resolve by
      // direct lookup like any other barcode. This avoids misreading real 890
      // products (Amul, etc.) as internal labels.
      result.kind = 'standard_product';
      result.extracted.gtin = '0' + s; // GTIN-14
      addKey('0' + s);
      result.confidence = result.valid_checksum ? 85 : 55;
      if (!result.valid_checksum) result.notes.push('EAN-13 checksum mismatch');
      return result;
    }

    if (len === 12) {
      result.symbology = 'UPC-A';
      result.valid_checksum = gs1CheckValid(s);
      const ean13 = '0' + s;
      result.country = countryForPrefix(ean13);
      result.kind = 'standard_product';
      result.extracted.gtin = '00' + s;
      addKey(ean13); addKey('00' + s);
      result.confidence = result.valid_checksum ? 85 : 55;
      if (!result.valid_checksum) result.notes.push('UPC-A checksum mismatch');
      return result;
    }

    if (len === 8) {
      result.symbology = 'EAN-8';
      result.valid_checksum = gs1CheckValid(s);
      result.kind = 'standard_product';
      result.confidence = result.valid_checksum ? 80 : 50;
      if (!result.valid_checksum) result.notes.push('EAN-8 checksum mismatch');
      return result;
    }

    if (len === 14) {
      result.symbology = 'ITF-14';
      result.valid_checksum = gs1CheckValid(s);
      result.kind = 'standard_product';
      result.extracted.gtin = s;
      addKey(s); addKey(s.slice(1)); addKey(s.replace(/^0+/, ''));
      result.confidence = result.valid_checksum ? 82 : 50;
      if (!result.valid_checksum) result.notes.push('ITF-14/GTIN-14 checksum mismatch');
      return result;
    }

    // Some other numeric length — could be a GS1 string without AIs, or an
    // internal numeric SKU. Treat as internal so the catalog/alias can resolve it.
    result.symbology = 'NUMERIC';
    result.kind = 'internal';
    result.confidence = 30;
    result.notes.push(`unrecognised numeric length (${len})`);
    return result;
  }

  // 4. Alphanumeric — Code 128 / our FG item codes / vendor SKUs / unknown.
  addKey(s);
  if (/^FG-?\d+$/i.test(s)) {
    result.symbology = 'CODE-128';
    result.kind = 'internal';
    result.extracted.embedded_item_code = s.toUpperCase();
    result.confidence = 60;
    result.notes.push('matches our internal item-code style');
    return result;
  }
  result.symbology = 'CODE-128';
  result.kind = 'unknown';
  result.confidence = 20;
  result.notes.push('alphanumeric code — no structure recognised; capture for learning');
  return result;
}

module.exports = { parseBarcode, gs1CheckValid, gs1Date, parseGs1Elements, countryForPrefix };
