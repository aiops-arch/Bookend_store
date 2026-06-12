import React, { useState, useEffect, useCallback } from 'react';
import Nav from '../components/Nav';
import client from '../api/client';

// ─── Transfer locations ───────────────────────────────────────────────────────
const LOCATIONS = [
  'Surat Store',
  'Family Kawas PG',
  'Surat Bakery',
  'Surat Prep Kitchen',
  'Capiche Vesu',
  'Capiche Piplod',
  'Aiko Surat',
  'R&D Department',
  'Bookends Mobile',
];

const REASON_OPTIONS = [
  { value: 'transfer_out', label: 'Transfer Out' },
  { value: 'transfer_in',  label: 'Transfer In' },
  { value: 'damage',       label: 'Damage' },
  { value: 'sample',       label: 'Sample' },
  { value: 'correction',   label: 'Correction' },
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const C = {
  page:    { minHeight: '100vh', background: 'var(--bg)' },
  wrap:    { padding: '24px 28px' },
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title:   { margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-1)' },
  sub:     { fontSize: '13px', color: 'var(--text-3)', marginTop: '3px' },
  btnGreen:{ padding: '8px 18px', background: '#00b140', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' },
  btnOut:  { padding: '8px 18px', background: 'transparent', color: '#00b140', border: '1px solid #00b140', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' },
  btnGrey: { padding: '8px 14px', background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '13px' },
  // filter bar
  filterWrap:{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' },
  filterGroup:{ display: 'flex', flexDirection: 'column', gap: '4px' },
  filterLabel:{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase' },
  input:   { padding: '7px 10px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', fontSize: '13px', outline: 'none', minWidth: '120px', background: 'var(--surface)', color: 'var(--text-1)' },
  select:  { padding: '7px 10px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', fontSize: '13px', outline: 'none', background: 'var(--surface)', color: 'var(--text-1)', minWidth: '140px' },
  btnSearch:{ padding: '7px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: '600', fontSize: '13px', alignSelf: 'flex-end' },
  btnClear:{ padding: '7px 14px', background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '13px', alignSelf: 'flex-end' },
  // table
  tableWrap:{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th:      { background: '#f8fafc', padding: '11px 14px', textAlign: 'left', fontWeight: '600', fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' },
  td:      { padding: '11px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text-2)', verticalAlign: 'middle', whiteSpace: 'nowrap' },
  // modal / form overlay
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
  modal:   { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 32px', width: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' },
  modalTitle:{ margin: '0 0 20px', fontSize: '17px', fontWeight: '700', color: 'var(--text-1)' },
  fg:      { marginBottom: '14px' },
  label:   { display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '5px' },
  minput:  { width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', fontSize: '13px', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-1)' },
  mselect: { width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', fontSize: '13px', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-1)' },
  row2:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  btnRow:  { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '22px' },
  saveBtn: { padding: '9px 22px', background: '#00b140', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: '700', fontSize: '13px' },
  cancelBtn:{ padding: '9px 18px', background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '13px' },
  err:     { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '13px', marginBottom: '12px' },
  ok:      { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '13px', marginBottom: '12px' },
  empty:   { padding: '48px', textAlign: 'center', color: 'var(--text-4)', fontSize: '14px' },
  pgBar:   { display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', marginTop: '14px' },
  pgInfo:  { fontSize: '13px', color: 'var(--text-3)' },
};

// ─── Reason Badge ─────────────────────────────────────────────────────────────
const REASON_BADGE = {
  transfer_out: { bg: '#eff6ff', color: '#1d4ed8' },
  transfer_in:  { bg: '#f0fdf4', color: '#15803d' },
  damage:       { bg: '#fef2f2', color: '#dc2626' },
  sample:       { bg: '#faf5ff', color: '#7c3aed' },
  correction:   { bg: '#fffbeb', color: '#b45309' },
};

function ReasonBadge({ reason }) {
  const s = REASON_BADGE[reason] || { bg: '#f8fafc', color: '#64748b' };
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', textTransform: 'capitalize' }}>
      {reason ? reason.replace('_', ' ') : '-'}
    </span>
  );
}

function fmtDate(d) { return d ? String(d).slice(0, 10) : '-'; }

// ─── New Transfer Modal ───────────────────────────────────────────────────────
function NewTransferModal({ onClose, onSaved }) {
  const [items, setItems]           = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [itemId, setItemId]         = useState('');
  const [batches, setBatches]       = useState([]);
  const [batchId, setBatchId]       = useState('');
  const [qty, setQty]               = useState('');
  const [reason, setReason]         = useState('transfer_out');
  const [fromLoc, setFromLoc]       = useState('Surat Store');
  const [toLoc, setToLoc]           = useState('Family Kawas PG');
  const [notes, setNotes]           = useState('');
  const [refNo, setRefNo]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      client.get('/items', { params: itemSearch ? { search: itemSearch } : {} })
        .then(r => setItems(r.data.data || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [itemSearch]);

  useEffect(() => {
    setBatchId(''); setBatches([]);
    if (!itemId) return;
    client.get(`/items/${itemId}/batches`).then(r => setBatches(r.data.data || [])).catch(() => {});
  }, [itemId]);

  async function handleSave() {
    setErr('');
    if (!itemId) return setErr('Select an item.');
    if (!batchId) return setErr('Select a batch.');
    if (!qty || isNaN(Number(qty)) || Number(qty) === 0) return setErr('Enter a valid qty (negative = deduct).');
    if (!fromLoc) return setErr('Select From location.');
    if (!toLoc) return setErr('Select To location.');
    setSaving(true);
    try {
      await client.post('/stock-transfers', {
        itemId: Number(itemId), batchId: Number(batchId), qty: Number(qty),
        reason, fromLocation: fromLoc, toLocation: toLoc,
        notes: notes || undefined, referenceNo: refNo || undefined
      });
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.error || 'Save failed.');
    } finally { setSaving(false); }
  }

  return (
    <div style={C.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={C.modal}>
        <h2 style={C.modalTitle}>Add Transfer</h2>
        {err && <div style={C.err}>{err}</div>}

        <div style={C.fg}>
          <label style={C.label}>Item *</label>
          <input style={C.minput} placeholder="Search by code or name..."
            value={itemSearch}
            onChange={e => { setItemSearch(e.target.value); setItemId(''); }} />
          {itemSearch && !itemId && items.length > 0 && (
            <div style={{ border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--surface)', maxHeight: '180px', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', position: 'absolute', zIndex: 10, width: '456px' }}>
              {items.slice(0, 20).map(it => (
                <div key={it.id}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-dim)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
                  onClick={() => { setItemId(String(it.id)); setItemSearch(`${it.item_code} — ${it.variant_grade || it.sub_category_name}`); }}>
                  <strong>{it.item_code}</strong> — {it.variant_grade || it.sub_category_name}
                  <span style={{ color: 'var(--text-4)', marginLeft: '8px', fontSize: '11px' }}>Stock: {parseFloat(it.live_stock_kg || 0).toFixed(2)} {it.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={C.fg}>
          <label style={C.label}>Batch *</label>
          {!itemId
            ? <div style={{ ...C.mselect, color: 'var(--text-4)' }}>Select an item first</div>
            : <select style={C.mselect} value={batchId} onChange={e => setBatchId(e.target.value)}>
                <option value="">-- Select batch --</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    Batch #{b.id} | Received: {fmtDate(b.receipt_date)} | Expiry: {fmtDate(b.expiry_date)} | Qty: {parseFloat(b.qty_remaining).toFixed(2)}
                  </option>
                ))}
              </select>
          }
        </div>

        <div style={{ ...C.row2, marginBottom: '14px' }}>
          <div>
            <label style={C.label}>From Location *</label>
            <select style={C.mselect} value={fromLoc} onChange={e => setFromLoc(e.target.value)}>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={C.label}>To Location *</label>
            <select style={C.mselect} value={toLoc} onChange={e => setToLoc(e.target.value)}>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div style={{ ...C.row2, marginBottom: '14px' }}>
          <div>
            <label style={C.label}>Qty * <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>(negative = deduct)</span></label>
            <input type="number" step="0.01" style={C.minput} value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. -10 or 10" />
          </div>
          <div>
            <label style={C.label}>Reason</label>
            <select style={C.mselect} value={reason} onChange={e => setReason(e.target.value)}>
              {REASON_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        <div style={C.fg}>
          <label style={C.label}>Challan / Reference No.</label>
          <input style={C.minput} value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="Optional" />
        </div>

        <div style={C.fg}>
          <label style={C.label}>Notes</label>
          <textarea style={{ ...C.minput, resize: 'vertical', minHeight: '64px' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional..." />
        </div>

        <div style={C.btnRow}>
          <button style={C.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={C.saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Transfer'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StockTransfer() {
  const [showModal, setShowModal] = useState(false);
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [page, setPage]           = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [saved, setSaved]         = useState('');

  // Filters
  const [fFrom, setFFrom]         = useState('');
  const [fTo, setFTo]             = useState('');
  const [fFromLoc, setFFromLoc]   = useState('');
  const [fToLoc, setFToLoc]       = useState('');
  const [fReason, setFReason]     = useState('');

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params = { page: pg, limit: 25 };
      if (fFrom) params.from = fFrom;
      if (fTo)   params.to   = fTo;
      if (fFromLoc) params.fromLocation = fFromLoc;
      if (fToLoc)   params.toLocation   = fToLoc;
      const res = await client.get('/stock-transfers', { params });
      let data = res.data.data || [];
      if (fReason) data = data.filter(r => r.reason === fReason);
      setRows(data);
      setPagination(res.data.pagination || { total: 0, pages: 1 });
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [fFrom, fTo, fFromLoc, fToLoc, fReason]);

  useEffect(() => { load(page); }, [load, page]);

  function handleSearch() { setPage(1); load(1); }
  function clearFilters() {
    setFFrom(''); setFTo(''); setFFromLoc(''); setFToLoc(''); setFReason('');
    setPage(1);
  }

  function handleSaved() {
    setShowModal(false);
    setSaved('Transfer saved successfully!');
    setTimeout(() => setSaved(''), 3000);
    setPage(1);
    load(1);
  }

  return (
    <div style={C.page}>
      <Nav />
      <div style={C.wrap}>
        {/* Header */}
        <div style={C.header}>
          <div>
            <h1 style={C.title}>Transfer</h1>
            <p style={C.sub}>Record stock movements between locations</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={C.btnGreen} onClick={() => setShowModal(true)}>+ Create New</button>
          </div>
        </div>

        {saved && <div style={C.ok}>{saved}</div>}

        {/* Filter Bar */}
        <div style={C.filterWrap}>
          <div style={C.filterGroup}>
            <span style={C.filterLabel}>Start Date</span>
            <input type="date" style={C.input} value={fFrom} onChange={e => setFFrom(e.target.value)} />
          </div>
          <div style={C.filterGroup}>
            <span style={C.filterLabel}>End Date</span>
            <input type="date" style={C.input} value={fTo} onChange={e => setFTo(e.target.value)} />
          </div>
          <div style={C.filterGroup}>
            <span style={C.filterLabel}>From Location</span>
            <select style={C.select} value={fFromLoc} onChange={e => setFFromLoc(e.target.value)}>
              <option value="">All</option>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div style={C.filterGroup}>
            <span style={C.filterLabel}>To Location</span>
            <select style={C.select} value={fToLoc} onChange={e => setFToLoc(e.target.value)}>
              <option value="">All</option>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div style={C.filterGroup}>
            <span style={C.filterLabel}>Type</span>
            <select style={C.select} value={fReason} onChange={e => setFReason(e.target.value)}>
              <option value="">All</option>
              {REASON_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button style={C.btnSearch} onClick={handleSearch}>Search</button>
          <button style={C.btnClear} onClick={clearFilters}>Clear</button>
        </div>

        {/* Table */}
        <div style={C.tableWrap}>
          {loading
            ? <div style={C.empty}>Loading...</div>
            : rows.length === 0
              ? <div style={C.empty}>No transfer records found.</div>
              : (
                <table style={C.table}>
                  <thead>
                    <tr>
                      <th style={C.th}>Transfer Date</th>
                      <th style={C.th}>From</th>
                      <th style={C.th}>To</th>
                      <th style={C.th}>Item</th>
                      <th style={C.th}>Batch #</th>
                      <th style={C.th} title="Positive = stock added, Negative = stock deducted">Qty</th>
                      <th style={C.th}>Type</th>
                      <th style={C.th}>Challan / Ref</th>
                      <th style={C.th}>Notes</th>
                      <th style={C.th}>Created By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const numQty = parseFloat(r.qty);
                      return (
                        <tr key={r.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                          <td style={C.td}>{fmtDate(r.created_at)}</td>
                          <td style={C.td}>
                            <span style={{ fontWeight: '600', color: 'var(--text-1)' }}>{r.from_location || '—'}</span>
                          </td>
                          <td style={C.td}>
                            <span style={{ fontWeight: '600', color: 'var(--text-1)' }}>{r.to_location || '—'}</span>
                          </td>
                          <td style={C.td}>
                            <div style={{ fontWeight: '600', fontFamily: 'monospace', fontSize: '12px' }}>{r.item_code}</div>
                            <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>{r.item_name || ''}</div>
                          </td>
                          <td style={C.td}>#{r.batch_id}</td>
                          <td style={C.td}>
                            <span style={{ fontWeight: '700', color: numQty >= 0 ? '#15803d' : '#dc2626', fontSize: '14px' }}>
                              {numQty >= 0 ? '+' : ''}{numQty.toFixed(2)}
                            </span>
                          </td>
                          <td style={C.td}><ReasonBadge reason={r.reason} /></td>
                          <td style={C.td}>{r.reference_no || '—'}</td>
                          <td style={C.td} title={r.notes || ''} style={{ ...C.td, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.notes || '—'}</td>
                          <td style={C.td}>{r.created_by_name || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
          }
        </div>

        {/* Pagination */}
        {!loading && pagination.pages > 1 && (
          <div style={C.pgBar}>
            <span style={C.pgInfo}>Page {page} of {pagination.pages} ({pagination.total} total)</span>
            <button style={C.btnGrey} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <button style={C.btnGrey} disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>

      {showModal && <NewTransferModal onClose={() => setShowModal(false)} onSaved={handleSaved} />}
    </div>
  );
}
