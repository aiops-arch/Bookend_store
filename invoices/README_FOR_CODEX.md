# Invoice intake — contract for the reader (Codex)

Flow:  drop invoice (PDF/image) → **Codex reads it** → Codex writes ONE JSON file
into `invoices/inbox/` → this system's watcher maps it to the catalogue and
auto-enters it (creates an Inward entry, confirms it, and locks it — stock goes up).

## What Codex must write into `invoices/inbox/<anything>.json`

> TRIAL SCOPE: only drop **Surat Store (117185)** invoices here for now (single-store trial).

```json
{
  "store": { "pp_id": "117185", "name": "Surat Store" },   // optional — for reconciliation
  "vendor": {
    "name": "Golaka Pvt. Ltd.",     // REQUIRED (created if new)
    "pp_supplier_id": "545234",      // optional — Pet Pooja supplier id (kept for reconciliation)
    "gstin": "24ABCDE1234F1Z5",      // optional
    "contact": "9876543210"          // optional
  },
  "invoice_no": "INV-2026-00123",     // REQUIRED (used to avoid double entry)
  "invoice_date": "2026-06-03",       // optional (YYYY-MM-DD; defaults to today)
  "lines": [
    {
      "name": "Soba Noodles",                   // REQUIRED — the Pet Pooja item name
      "pp_item_id": "44232910",                 // optional — Pet Pooja item id (reconciliation)
      "qty": 24,                                // REQUIRED — number
      "rate": 250.00,                           // optional — purchase rate per unit
      "unit": "Kg",                             // optional — pcs/kg/liter/pack/box/tin
      "expiry_date": "2026-12-31",              // optional (YYYY-MM-DD)
      "category": "Food Item",                  // optional — only used if a brand-new item is created
      "item_code": "FG-0123",                   // optional — strongest match if known
      "barcode": "8901262010016"                // optional — matches catalogue/alias if known
    }
  ]
}
```

The Pet Pooja IDs (`store.pp_id`, `vendor.pp_supplier_id`, `line.pp_item_id`) are **not** used for
matching here (this system matches by name) — they're stored on the entry so you can reconcile the
two systems. Each processed invoice gets a `.result.json` in `invoices/done/` containing the full
Pet Pooja ↔ Book Ends line-by-line map (pp_item_id ↔ item_code, matched/created).

## How the pipeline matches each line to your catalogue (best first)
1. `item_code` exact → 2. `barcode` (primary or learned alias) →
3. exact item name → 4. fuzzy name match (≥60% word overlap; learns the name for next time) →
5. if nothing matches → **creates a new item** automatically (so entry never blocks).

## Notes
- Re-dropping the same `vendor + invoice_no` is **ignored** (no double stock) — safe to retry.
- Processed files move to `invoices/done/` with a `.result.json`; failures go to `invoices/failed/`.
- Names should be the **Pet Pooja-compatible names** you already use — the matcher handles the rest.
