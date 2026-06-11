# Inventory Management System — Audit Report
**Date:** June 11, 2026 | **Auditor:** Claude (Cowork) | **Project:** Food & Grains IMS (K Girdharlal)

---

## 1. Project Structure

```
Store_KG/
├── backend/
│   ├── src/
│   │   ├── app.js              Express app, all route mounts
│   │   ├── server.js           HTTP listener, starts cron
│   │   ├── config/db.js        Knex + pg (Neon serverless pool)
│   │   ├── middleware/auth.js  JWT authenticate + authorize
│   │   ├── routes/             21 route files
│   │   ├── services/           barcode, audit, normalize, AI classify
│   │   ├── jobs/nightly.js     node-cron intelligence job (02:00 daily)
│   │   └── db/                 schema.sql, seed.sql, migration scripts
│   ├── scripts/                seed, migrate, smoke tests
│   └── tests/                  barcode.test.js, normalize.test.js
├── frontend/
│   └── src/
│       ├── App.jsx             Router + ProtectedRoute
│       ├── pages/              33 page components
│       ├── components/         Sidebar, Nav, ItemForm, etc.
│       ├── api/client.js       Axios instance
│       └── utils/exportToExcel.js
├── api/index.js                Vercel-compatible thin wrapper
├── epr_schema.sql              EPR compliance schema (bonus)
├── docker-compose.yml
├── render.yaml
└── deploy.sh
```

---

## 2. Stack — Spec vs Actual

| Spec | Actual |
|------|--------|
| Node.js + Express | Node.js + Express 4.x ✅ |
| PostgreSQL | PostgreSQL via Knex 3 + pg 8 on Neon ✅ |
| React + Vite | React 18 + Vite 5 + Tailwind 4 ✅ |
| JWT + role middleware | jsonwebtoken + bcrypt, custom middleware ✅ |
| SheetJS (Excel) | xlsx 0.18.5 (backend + frontend) ✅ |
| node-cron | node-cron 3 ✅ |
| — | Recharts 3 (charts, not in spec — added) |
| — | Cloudinary (image storage, not in spec — added) |
| — | bwip-js EAN-13 barcode generation |

---

## 3. Phase Assessment

### Phase 1 — COMPLETE ✅ (Weeks 1–4)
- Item Master CRUD with auto `FG-NNNN` item codes and EAN-13 barcode generation
- Barcode generate / scan / label print (EAN-13 + QR, label sheet HTML, PNG endpoints)
- User auth + all 5 roles (Admin, Purchase, Warehouse, Sales, View-only) with JWT + role middleware
- `GET /api/items/scan/:barcode` returning item + live stock

### Phase 2 — COMPLETE ✅ (Weeks 5–8)
- **Inward flow:** PO → draft → add lines (manual + Excel import) → confirm (creates batches transactionally) → lock
- **Outward flow:** draft → add lines (FIFO stock check) → confirm (FIFO deduction with `SELECT FOR UPDATE`) → lock (challan `CH-YYYYMMDD-NNNN` with advisory lock) → challan print
- FIFO is mandatory; `fifoPick()` matches spec exactly including `INSUFFICIENT_STOCK` error

### Phase 3 — SUBSTANTIALLY COMPLETE ✅ (Weeks 9–12)
- Expiry alerts with RAG colour
- Low-stock alerts using dynamic ROP (z=1.65 formula from spec)
- Dead stock report
- Margin / shrinkage / P&L per item
- Vendor history with monthly spend chart
- MIS dashboard with 6-month trends
- Excel export (items, stock, inward, outward) with category totals
- Intelligence cron: risk score, ROP, expired batch marking, avg velocity — all 4 jobs from spec
- Intelligence command-center dashboard (goes beyond spec: velocity leaders, demand trend, stockout risk classification, AI insights engine)

### Phase 4 — NOT STARTED ❌ (Weeks 13–16)
- UAT with Prachi — not done
- Deploy config exists (`render.yaml`, `docker-compose.prod.yml`, `deploy.sh`) but not finalised
- Training materials — not present
- Pet Pooja API integration — not started (listed as optional in spec)

---

## 4. What IS Built — Full Feature List

### Backend API (21 route files)

| Route | Features |
|-------|----------|
| `/auth` | Login, change-password, admin reset; in-memory rate limiter (5 attempts / 15 min) |
| `/categories` | CRUD categories + sub-categories (with shelf_life_days) |
| `/items` | Full CRUD, paginated search, filter by category/location/tag; barcode scan; Excel bulk-import with row-level error reporting; bulk template download; label/QR PNG; printable label sheet; clone; bulk-patch; alias management; photo upload (Cloudinary or local); vendor-item price mapping; audit history; toggle active |
| `/vendors` | CRUD |
| `/customers` | CRUD |
| `/purchase-orders` | List, create, detail with linked inward entries, status transitions (open→received→closed) |
| `/inward` | Draft, add/edit/delete lines, Excel import, confirm (batch creation, transactional), lock; opening-stock bulk import with dry-run preview |
| `/outward` | Draft, add/delete lines (FIFO stock check), confirm (FIFO deduction), lock (challan generation with advisory lock), challan print HTML |
| `/batches` | List / view batches per item |
| `/stock-transfers` | Manual stock adjustments: transfer_in/out, damage, sample, correction |
| `/barcode` | Advanced barcode brain: parse (symbology detection), resolve (primary + alias lookup), enrich (external lookup + AI classify), learn (teach unknown → item), create-item, scan-to-add-stock, scan-to-deduct-FIFO, unmapped scan queue |
| `/reports` | Expiry alerts (RAG), low-stock (ROP), dead-stock, expired-batches, margin/P&L, vendor-history, Excel export, MIS dashboard (6-month summary, category breakdown, top items, KPIs), stock-audit print, manual nightly trigger |
| `/intelligence` | Command center: KPIs, velocity leaders (top 15 SKUs), demand trend, days-remaining, stockout risk, activity feed, category snapshot, AI insights |
| `/users` | Full CRUD (admin only), deactivation-only delete, self-protection rules |
| `/audit-log` | Queryable with filters |
| `/normalize` | Bulk item name normalization using 500+ alias dictionary |
| `/locations` | Hierarchical storage locations |
| `/tags` | Item tagging |
| `/custom-fields` | User-defined item attributes |
| `/system` | Health + system info |
| `/invoices` | Invoice ingest (file watcher integration) |

### Backend Services
- `barcode.js` — EAN-13 generation (GS1 India prefix 890 + padded item_id + check digit)
- `audit.js` — `logAudit()` on every write with old+new JSONB
- `normalize.js` — 500+ Hindi/English aliases for 100+ canonical items across all categories
- `barcodeParser.js` — GS1-128, EAN-13/8, QR, internal format detection
- `scanResolver.js` — primary barcode → alias → item resolution chain
- `productLookup.js` — external product lookup (Open Food Facts / UPC databases)
- `aiClassify.js` — AI-assisted item classification

### Frontend Pages (33 total)
Login, Dashboard (command center + KPI strip + velocity leaders + AI insights + charts), Items, ItemDetail, Inward, InwardDetail, Outward, OutwardDetail, Challan (print view), PurchaseOrders, PurchaseOrderDetail, Vendors, Customers, Scan, Reports, MISDashboard, ExpiryAlerts, MarginReport, BatchViewer, StockTransfer, Users, AuditLog, Locations, CustomFields, Catalog, OpeningStock, BulkNormalize, Profile, SystemHealth, EPRDashboard (bonus).

### Intelligence Cron (nightly 02:00) — all 4 spec jobs
1. Rolling 30-day `avg_daily_consumption` recalculation from locked outward lines
2. Expired batch marking (`expired_qty`, `expired_at`, `qty_remaining = 0`)
3. Risk score per batch (timeRisk × 0.5 + volumeRisk × 0.5, stored in `batches.risk_score`)
4. Dynamic ROP per item (z=1.65, stored in `items.rop_kg`)

---

## 5. What is MISSING / Gaps

### Schema Management Gap (HIGH RISK)
`schema.sql` is out of sync with production by at least **7 tables** and **several columns**. A fresh deployment will fail.

Missing from `schema.sql`:
- Tables: `locations`, `tags`, `item_tags`, `item_photos`, `unmapped_scans`, `custom_field_defs`, `item_custom_values`
- Columns: `inward_lines.source_name`, `items.location_id`, `batches.location_id`, `purchase_orders.notes`

There is no migration runner (no Knex migrations, no Flyway). Schema evolution has been done ad-hoc via manual SQL on Neon.

**Fix needed:** Consolidate schema into a single authoritative `schema.sql` or adopt Knex migrations.

### Functional Gaps
- **PO line items:** `purchase_orders` only stores a header. No `po_lines` table means you can't pre-fill what items/quantities were ordered on a PO before goods receipt.
- **Reversal entries:** CLAUDE.md rule 4 requires post-lock corrections via a new reversal row, not UPDATE. No explicit reversal entry UI/API exists — only the `stock-transfers` workaround.
- **Challan layout:** Hardcoded company name is "FG Inventory — Food & Grains", not "K Girdharlal". No logo. Confirm correct format with Prachi.
- **Open questions from spec still unresolved:** Excel import column schema, PO approval flow, customer master fields, vendor master fields, challan layout.
- **Pet Pooja API:** Not started (expected — listed as Phase 3/4 optional).

---

## 6. Code Quality Issues

### 🔴 Critical — Security
- **`.env` is committed to git.** It contains the live Neon `DATABASE_URL` (with password) and `JWT_SECRET` in plaintext. This must be rotated and removed from version control immediately.
- `ALLOWED_ORIGINS=*` means CORS is open to all origins. Production should restrict this to the actual domain.

### 🟡 Medium
- **In-memory rate limiter** (`_loginAttempts` Map in `auth.js`) resets on server restart and won't work across multiple server instances. Safe for single-instance Render deploy, but fragile.
- **Non-transactional `nextItemCode()`** — reads last `item_code` then increments without a lock. Under concurrent inserts this could error on the `UNIQUE` constraint (data-safe, but user-unfriendly). Use `SELECT MAX + FOR UPDATE` or a sequence.
- **Audit trail bug in barcode outward:** `audit_log` records `old_value: { qty_remaining: 'previous' }` — a literal string, not the actual previous value. Barcode-scan outward audit trail is incomplete.
- **Nightly cron job 0** fires `Promise.all` of one `UPDATE` per item — could be slow for large catalogs. A single `UPDATE ... FROM` CTE would be more efficient.

### 🟢 Minor
- `EPRDashboard.jsx` (1,405 lines) is entirely outside spec — India Plastic Waste Management Rules 2022 tracker. Useful bonus but scope-creep.
- `FeaturesShowcase.jsx` is a marketing/demo page unlikely to be needed in production.
- `BulkNormalize.jsx` / `Catalog.jsx` are internal normalization tools — useful but outside core spec.

---

## 7. Summary Scorecard

| Area | Status | Notes |
|------|--------|-------|
| Phase 1 — Auth + Item Master + Barcode | ✅ Complete | Solid |
| Phase 2 — Inward / Outward / FIFO | ✅ Complete | FIFO correct, challan generation works |
| Phase 3 — Reports + Intelligence + Cron | ✅ ~90% complete | All spec jobs done; minor audit bug |
| Phase 4 — UAT + Deploy | ❌ Not started | Deploy config ready but not finalised |
| Schema management | 🔴 Risk | 7 tables missing from schema.sql |
| Security | 🔴 Critical | .env credentials in git |
| PO line items | 🟡 Gap | No po_lines table |
| Reversal entries | 🟡 Gap | No explicit mechanism |
| Challan company name/logo | 🟡 Gap | Wrong company name, no logo |
| Code quality | 🟡 Medium | Rate limiter, audit bug, nextItemCode race |

---

## 8. Immediate Actions Recommended

1. **Rotate credentials NOW** — change Neon database password and JWT secret; add `.env` to `.gitignore` and remove it from git history
2. **Fix `schema.sql`** — add all 7 missing tables and missing columns; or generate a clean schema dump from the live Neon DB (`pg_dump --schema-only`)
3. **Fix challan company name** — replace "FG Inventory — Food & Grains" with "K Girdharlal" and add logo
4. **Fix audit trail bug** — capture actual `qty_remaining` value before decrement in barcode outward route
5. **Resolve open questions with Prachi** before Phase 4 begins (see Section 5)
6. **Begin Phase 4** — schedule UAT sessions, prepare training materials
