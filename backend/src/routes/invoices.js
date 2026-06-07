/**
 * Invoice intake over HTTP - direct Book Ends entry for invoice values.
 *
 *   POST /api/invoices/ingest   { vendor, invoice_no, invoice_date, lines:[...] }
 *
 * Codex reads the invoice and sends the Pet Pooja-compatible values here
 * without changing Pet Pooja. This system maps each line to the catalogue
 * (by name, with Pet Pooja ids kept for reconciliation), creates the inward
 * entry, and confirms + locks it. Idempotent on (vendor, invoice_no).
 *
 * Auth: an admin/purchase/warehouse JWT, OR an X-Ingest-Key header matching
 * the INGEST_API_KEY env var (handy for automation).
 */
'use strict';

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { ingestInvoice } = require('../services/invoiceIngest');

const router = express.Router();

function ingestAuth(req, res, next) {
  const expected = process.env.INGEST_API_KEY;
  if (expected && req.get('X-Ingest-Key') === expected) return next();
  // Otherwise require a normal staff login.
  return authenticate(req, res, () => authorize('admin', 'purchase', 'warehouse')(req, res, next));
}

// POST /api/invoices/ingest - enter one invoice (auto confirm + lock).
// Pass ?dryRun=true to validate/preview without writing.
router.post('/ingest', ingestAuth, async (req, res) => {
  try {
    const summary = await ingestInvoice(req.body || {}, { dryRun: req.query.dryRun === 'true' });
    const code = summary.status === 'skipped_duplicate' ? 200 : 201;
    res.status(code).json({ success: true, data: summary });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
