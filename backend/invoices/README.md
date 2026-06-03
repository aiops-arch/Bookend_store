# Invoice Folder Import

Put daily invoice spreadsheets in `invoices/inbox`.

Supported file types: `.xlsx`, `.xls`, `.csv`.

Required columns:
- `vendor`
- `invoice_no`
- `invoice_date`
- `item`
- `category`
- `sub_category`
- `qty`
- `rate`

Optional columns:
- `item_code`
- `barcode`
- `unit`
- `expiry_date`

Use only these top-level categories:
- `Food Item`
- `Packing`
- `Housekeeping`

Commands:
- Preview only: `npm run invoices:dry-run`
- Import as draft inward entries: `npm run invoices:import`
- Import and add stock batches: `npm run invoices:confirm`
- Import, add stock batches, and lock for reports: `npm run invoices:lock`

For the one-month Petpooja parallel run, use dry-run first, then `npm run invoices:lock` once the preview looks correct.
