# Project Progress Log
**Food & Grains Inventory Management System — K Girdharlal**
**SRS ref:** CLAUDE.md | **Last updated:** 2026-06-11

---

> ⚠️ AGENT INSTRUCTIONS
> Read this file FIRST before doing any work.
> Update the "Last Updated" date and the relevant section EVERY TIME you build, change, or fix something.
> Keep entries concise — one line per change is enough.
> Do NOT rewrite history; always append new entries.

---

## Current Phase: Phase 3 (~90% complete) → Phase 4 pending

---

## Build Status Summary

| Area | Status | Notes |
|------|--------|-------|
| Auth + JWT + roles | ✅ Done | 5 roles, rate limiter, change-password |
| Item Master CRUD | ✅ Done | Auto item_code FG-NNNN, EAN-13, QR |
| Barcode generate/scan/print | ✅ Done | Label sheet, PNG, scan endpoint |
| Vendor CRUD | ✅ Done | |
| Customer CRUD | ✅ Done | |
| Purchase Orders | ✅ Done | Header only — no po_lines |
| Inward flow (PO→Receive→Confirm→Lock) | ✅ Done | Excel import, batch creation, dry-run preview |
| Outward flow (Draft→FIFO→Challan→Lock) | ✅ Done | Advisory lock, CH-YYYYMMDD-NNNN format |
| FIFO batch deduction | ✅ Done | SELECT FOR UPDATE, matches spec |
| Expiry alerts (RAG) | ✅ Done | |
| Low-stock alerts (dynamic ROP) | ✅ Done | z=1.65 formula |
| Dead stock report | ✅ Done | |
| Margin / P&L / shrinkage | ✅ Done | |
| Vendor history | ✅ Done | Monthly spend chart |
| MIS dashboard | ✅ Done | 6-month trends, category breakdown |
| Excel export | ✅ Done | Items, stock, inward, outward |
| Intelligence cron (nightly 02:00) | ✅ Done | All 4 spec jobs |
| Barcode brain (advanced) | ✅ Done | GS1 parse, external lookup, AI classify |
| Stock transfers | ✅ Done | damage, sample, correction, transfer |
| Audit log | ✅ Done | All writes logged with old+new JSONB |
| Locations (hierarchical) | ✅ Done | |
| Tags | ✅ Done | |
| Custom fields | ✅ Done | |
| Opening stock bulk import | ✅ Done | Dry-run preview |
| EPR compliance dashboard | ✅ Done | Bonus — outside spec |
| UAT | ❌ Not started | Phase 4 |
| Production deployment | ❌ Not started | Config exists (render.yaml, docker-compose) |
| Training materials | ❌ Not started | Phase 4 |
| Pet Pooja API | ❌ Not started | Optional, Phase 4 |
| PO line items (po_lines table) | ❌ Missing | Gap — no pre-fill of items/qty on PO |
| Reversal entries (post-lock correction) | ❌ Missing | Workaround: stock-transfers only |
| Challan company name/logo | 🔴 Bug | Shows "FG Inventory", should be "K Girdharlal" |

---

## Known Issues & Gaps

### 🔴 Critical
1. **`.env` credentials committed to git** — Neon DB password (`npg_swb28kZifXoF`) and JWT_SECRET are in source control. Must rotate both and remove from git history.
2. **`schema.sql` out of sync with production** — 7 tables missing: `locations`, `tags`, `item_tags`, `item_photos`, `unmapped_scans`, `custom_field_defs`, `item_custom_values`. Also missing columns: `inward_lines.source_name`, `items.location_id`, `batches.location_id`, `purchase_orders.notes`. Fresh deploy from `schema.sql` will fail. Fix: run `pg_dump --schema-only` from Neon to get real schema.

### 🟡 Medium
3. **Audit trail bug (barcode outward)** — `audit_log` records `old_value: { qty_remaining: 'previous' }` (literal string), not the actual before value.
4. **`nextItemCode()` race condition** — non-transactional read under concurrent inserts; UNIQUE constraint catches it but gives users an error. Fix: use a Postgres sequence.
5. **In-memory rate limiter** — resets on server restart; won't work across multiple instances.
6. **Nightly cron job 0** — fires one UPDATE per item via `Promise.all`; use a single `UPDATE ... FROM` CTE for large catalogs.

### 🟡 Open Questions (resolve with Prachi before Phase 4)
- Excel import column schema — which columns, which are mandatory?
- PO approval flow — single-person or requires approval before receipt?
- Customer master required fields
- Vendor master required fields (GSTIN, payment terms confirmed in DB but not validated)
- Challan layout — logo, correct company name, numbering format
- Pet Pooja API docs

---

## File & Folder Map (key files only)

```
backend/src/
  app.js                  Route mounts
  server.js               Startup, cron init
  config/db.js            Knex + Neon pool
  middleware/auth.js      JWT + role guard
  routes/
    auth.js
    categories.js
    items.js              Largest route file — bulk import, scan, photos
    vendors.js
    customers.js
    purchaseOrders.js
    inward.js             Confirm creates batches transactionally
    outward.js            FIFO, advisory lock, challan generation
    batches.js
    barcode.js            Barcode brain
    reports.js            All reports + MIS dashboard
    intelligence.js       Command center + AI insights
    users.js
    auditLog.js
    normalize.js
    locations.js
    tags.js
    customFields.js
    system.js
    invoices.js
    stockTransfers.js
  services/
    barcode.js            EAN-13 generation
    audit.js              logAudit()
    normalize.js          500+ alias dictionary
    barcodeParser.js      GS1-128, EAN-13/8, QR detection
    scanResolver.js       Barcode → item resolution
    productLookup.js      Open Food Facts / UPC lookup
    aiClassify.js         AI item classification
  jobs/
    nightly.js            4 cron jobs: velocity, expiry, risk score, ROP
  db/
    schema.sql            ⚠️ OUT OF SYNC — see Known Issues

frontend/src/
  App.jsx                 Router + ProtectedRoute
  api/client.js           Axios instance (baseURL from env)
  pages/                  33 pages (see Build Status table)
  components/             Sidebar, Nav, ItemForm, BarcodeScanner, etc.
  utils/exportToExcel.js
```

---

## Changelog

### 2026-06-11
- Full codebase audit completed by Claude (Cowork)
- Created this PROGRESS.md
- Created AUDIT_REPORT.md with detailed findings
- Identified .env credentials in git (CRITICAL — not yet fixed)
- Identified schema.sql out-of-sync (7 tables missing — not yet fixed)
- Identified challan company name bug (not yet fixed)
- Identified audit trail bug in barcode outward (not yet fixed)
- **backend/src/routes/inward.js**: Added `GET /api/inward/stats` endpoint — returns total_amount, outstanding, gst_amount for KPI cards (respects date/vendor/status filters); Updated `GET /api/inward` list query to return `total_amount`, `gst_amount`, `po_reference` per entry via subqueries; Added `date_from` / `date_to` filter params
- **frontend/src/pages/Inward.jsx**: Full redesign to match PetPooja Purchase List layout — sticky header with "Create New" (green) / "Scan & Purchase" / Export dropdown buttons; 3 KPI summary cards (Total Amount, Outstanding, GST/Tax); date range + vendor + invoice + status filter bar; table columns now show From / Invoice Date / Invoice Number / PO Reference / Total ₹ / GST Amount / Created By / Status / Action; status badges matching PetPooja style (Saved=green, Draft=grey, Confirmed=purple, Cancelled=red); icon-based action buttons per row

---

## Next Recommended Actions (in priority order)

1. Rotate Neon DB password + JWT secret; remove `.env` from git history
2. Generate fresh `schema.sql` via `pg_dump --schema-only` from Neon
3. Fix challan: replace company name with "K Girdharlal", add logo
4. Fix audit trail bug in `routes/barcode.js` barcode-outward handler
5. Resolve open questions with Prachi (see above)
6. Add `po_lines` table and PO line item UI for Phase 4
7. Begin Phase 4: UAT sessions with Prachi, training materials
