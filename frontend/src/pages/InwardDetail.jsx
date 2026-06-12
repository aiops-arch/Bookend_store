import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import Nav from '../components/Nav';
import { safeUser } from '../lib/safeUser';

const S = {
  page: { minHeight: '100vh', background: 'var(--bg)' },
  content: { padding: '24px 28px', maxWidth: '1300px', margin: '0 auto' },
  backBtn: { padding: '6px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' },
  card: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', marginBottom: '16px' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  cardTitle: { margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-1)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' },
  fl: { fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  fv: { fontSize: '14px', fontWeight: '600', color: 'var(--text-1)', marginTop: '2px' },
  actionRow: { display: 'flex', gap: '10px', marginTop: '16px' },
  confirmBtn: { padding: '7px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  lockBtn: { padding: '7px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--success)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  addLineBtn: { padding: '7px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  importBtn: { padding: '7px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px' },
  tableWrap: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', overflow: 'auto', marginBottom: '16px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { background: 'var(--surface-2)', padding: '10px 12px', textAlign: 'left', fontWeight: '600', fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-2)', verticalAlign: 'middle' },
  deleteBtn: { padding: '3px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--danger-dim)', cursor: 'pointer', fontSize: '11px', background: 'var(--danger-dim)', color: 'var(--danger)' },
  empty: { padding: '40px', textAlign: 'center', color: 'var(--text-4)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 32px', width: '620px', boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { margin: '0 0 20px', fontSize: '16px', fontWeight: '700', color: 'var(--text-1)' },
  formGroup: { marginBottom: '14px' },
  label: { display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '5px' },
  input: { width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', fontSize: '13px', color: 'var(--text-1)', background: 'var(--surface)', boxSizing: 'border-box' },
  btnRow: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' },
  saveBtn: { padding: '8px 20px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  cancelBtn: { padding: '8px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px' },
  lockedBadge: { background: 'var(--success-dim)', color: 'var(--success)', padding: '4px 14px', borderRadius: '12px', fontSize: '13px', fontWeight: '800', letterSpacing: '1px' },
  // totals panel
  totalsCard: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', marginBottom: '16px' },
  totalsTitle: { margin: '0 0 14px', fontSize: '15px', fontWeight: '700', color: 'var(--text-1)' },
  totalsRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' },
  totalsLabel: { fontSize: '13px', color: 'var(--text-2)' },
  totalsValue: { fontSize: '13px', fontWeight: '600', color: 'var(--text-1)' },
  grandRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 0' },
  grandLabel: { fontSize: '15px', fontWeight: '700', color: 'var(--text-1)' },
  grandValue: { fontSize: '17px', fontWeight: '800', color: 'var(--primary)' },
  // extra charge section
  chargeSection: { marginBottom: '12px' },
  chargeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
  chargeBody: { border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 var(--radius) var(--radius)', padding: '14px', background: 'var(--surface)' },
  chargeGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', alignItems: 'end' },
  chargeInput: { width: '100%', padding: '7px 10px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', fontSize: '13px', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-1)' },
  chargeLabel: { fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', marginBottom: '4px', display: 'block' },
  saveChrg: { padding: '7px 14px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
};

const statusStyle = {
  draft:     { background: 'rgba(100,116,139,0.1)', color: 'var(--text-3)' },
  confirmed: { background: 'var(--primary-dim)',    color: 'var(--primary)' },
  locked:    { background: 'var(--success-dim)',    color: 'var(--success)' },
};

function StatusBadge({ status }) {
  const st = statusStyle[status] || statusStyle.draft;
  return (
    <span style={{ ...st, padding: '3px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: '700' }}>
      {status.toUpperCase()}
    </span>
  );
}

function fmt(n) { return parseFloat(n || 0).toFixed(2); }
function fmtCur(n) { return '₹ ' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }

// ─── Extra Charge Row ─────────────────────────────────────────────────────────
function ChargeRow({ title, data, onChange, onSave, isDraft, saving }) {
  const [open, setOpen] = useState(false);
  const hasData = data.amount && parseFloat(data.amount) > 0;

  return (
    <div style={S.chargeSection}>
      <div style={{ ...S.chargeHeader, background: hasData ? '#f0fdf4' : 'var(--surface-2)' }} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: hasData ? 'var(--success)' : 'var(--text-2)' }}>
          + {title}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {hasData && <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: '700' }}>{fmtCur(data.amount)}</span>}
          <span style={{ fontSize: '18px', color: 'var(--text-3)' }}>{open ? '▲' : '▼'}</span>
        </span>
      </div>
      {open && (
        <div style={S.chargeBody}>
          <div style={{ display: 'grid', gridTemplateColumns: data.nameEditable ? '2fr 1fr 1fr 1fr auto' : '2fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
            {data.nameEditable && (
              <div>
                <span style={S.chargeLabel}>Charge Name</span>
                <input style={S.chargeInput} value={data.name || ''} onChange={e => onChange('name', e.target.value)} disabled={!isDraft} placeholder="e.g. Labour charge" />
              </div>
            )}
            <div>
              <span style={S.chargeLabel}>Amount (₹)</span>
              <input type="number" step="0.01" style={S.chargeInput} value={data.amount || ''} onChange={e => onChange('amount', e.target.value)} disabled={!isDraft} placeholder="0.00" />
            </div>
            <div>
              <span style={S.chargeLabel}>CGST %</span>
              <input type="number" step="0.01" style={S.chargeInput} value={data.cgst || ''} onChange={e => onChange('cgst', e.target.value)} disabled={!isDraft} placeholder="0" />
            </div>
            <div>
              <span style={S.chargeLabel}>SGST %</span>
              <input type="number" step="0.01" style={S.chargeInput} value={data.sgst || ''} onChange={e => onChange('sgst', e.target.value)} disabled={!isDraft} placeholder="0" />
            </div>
            {isDraft && (
              <div>
                <button style={S.saveChrg} onClick={onSave} disabled={saving}>{saving ? '...' : 'Save'}</button>
              </div>
            )}
          </div>
          {data.amount && parseFloat(data.amount) > 0 && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-3)' }}>
              Tax: {fmtCur((parseFloat(data.amount) * ((parseFloat(data.cgst || 0) + parseFloat(data.sgst || 0)) / 100)))} &nbsp;|&nbsp;
              Total incl. tax: {fmtCur(parseFloat(data.amount) * (1 + (parseFloat(data.cgst || 0) + parseFloat(data.sgst || 0)) / 100))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const emptyLine = { item_id: '', qty: '', rate: '', expiry_date: '', cgst_pct: '', sgst_pct: '', igst_pct: '' };
const emptyCharges = {
  packaging: { amount: '', cgst: '', sgst: '' },
  courier:   { amount: '', cgst: '', sgst: '' },
  other:     { name: '', amount: '', cgst: '', sgst: '', nameEditable: true },
};

export default function InwardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = safeUser();
  const [entry, setEntry]         = useState(null);
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAddLine, setShowAddLine] = useState(false);
  const [lineForm, setLineForm]   = useState(emptyLine);
  const [saving, setSaving]       = useState(false);
  const [chargeSaving, setChargeSaving] = useState(false);

  const isDraft  = entry?.status === 'draft';
  const canWrite = ['admin', 'purchase', 'warehouse'].includes(user.role);
  const fileInputRef = useRef(null);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);

  // Extra charges state (hydrated from entry.extra_charges)
  const [charges, setCharges] = useState(emptyCharges);

  async function fetchEntry() {
    try {
      const res = await client.get(`/inward/${id}`);
      const data = res.data.data;
      setEntry(data);
      // Hydrate extra charges from saved JSON
      if (data.extra_charges && typeof data.extra_charges === 'object' && Object.keys(data.extra_charges).length > 0) {
        setCharges(prev => ({
          packaging: { amount: '', cgst: '', sgst: '', ...data.extra_charges.packaging },
          courier:   { amount: '', cgst: '', sgst: '', ...data.extra_charges.courier },
          other:     { name: '', amount: '', cgst: '', sgst: '', nameEditable: true, ...data.extra_charges.other },
        }));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchEntry(); }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    client.get('/items', { signal: controller.signal }).then(r => setItems(r.data.data || [])).catch(() => {});
    return () => controller.abort();
  }, []);

  async function handleAddLine() {
    if (!lineForm.item_id || !lineForm.qty || !lineForm.rate) return alert('Item, Qty and Rate are required');
    setSaving(true);
    try {
      await client.post(`/inward/${id}/lines`, {
        item_id: lineForm.item_id,
        qty: parseFloat(lineForm.qty),
        rate: parseFloat(lineForm.rate),
        expiry_date: lineForm.expiry_date || null,
        cgst_pct: parseFloat(lineForm.cgst_pct) || 0,
        sgst_pct: parseFloat(lineForm.sgst_pct) || 0,
        igst_pct: parseFloat(lineForm.igst_pct) || 0,
      });
      setShowAddLine(false);
      setLineForm(emptyLine);
      fetchEntry();
    } catch (err) {
      alert(err.response?.data?.error || 'Add line failed');
    } finally { setSaving(false); }
  }

  async function handleDeleteLine(lineId) {
    if (!window.confirm('Delete this line?')) return;
    try {
      await client.delete(`/inward/${id}/lines/${lineId}`);
      fetchEntry();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  }

  async function handleConfirm() {
    if (!window.confirm('Confirm this inward entry? Batches will be created.')) return;
    try {
      await client.post(`/inward/${id}/confirm`);
      fetchEntry();
    } catch (err) { alert(err.response?.data?.error || 'Confirm failed'); }
  }

  async function handleLock() {
    if (!window.confirm('Lock this entry? It cannot be edited after locking.')) return;
    try {
      await client.post(`/inward/${id}/lock`);
      fetchEntry();
    } catch (err) { alert(err.response?.data?.error || 'Lock failed'); }
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await client.post(`/inward/${id}/import`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(res.data.data);
      fetchEntry();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || 'Import failed' });
    } finally { setImporting(false); e.target.value = ''; }
  }

  async function saveCharges() {
    setChargeSaving(true);
    try {
      await client.put(`/inward/${id}/extra-charges`, { extra_charges: charges });
      fetchEntry();
    } catch (err) { alert(err.response?.data?.error || 'Save charges failed'); }
    finally { setChargeSaving(false); }
  }

  function updateCharge(type, field, val) {
    setCharges(prev => ({ ...prev, [type]: { ...prev[type], [field]: val } }));
  }

  // ─── Totals calculation ───────────────────────────────────────────────────
  const lines = entry?.lines || [];

  const linesSubTotal = lines.reduce((s, l) => s + parseFloat(l.qty) * parseFloat(l.rate), 0);
  const linesGst = lines.reduce((s, l) => {
    const base = parseFloat(l.qty) * parseFloat(l.rate);
    const gstPct = (parseFloat(l.cgst_pct || 0) + parseFloat(l.sgst_pct || 0) + parseFloat(l.igst_pct || 0));
    return s + base * gstPct / 100;
  }, 0);

  function chargeTotal(c) {
    const amt = parseFloat(c.amount || 0);
    const gst = (parseFloat(c.cgst || 0) + parseFloat(c.sgst || 0)) / 100;
    return amt + amt * gst;
  }
  const packagingTotal = chargeTotal(charges.packaging);
  const courierTotal   = chargeTotal(charges.courier);
  const otherTotal     = chargeTotal(charges.other);
  const grandTotal     = linesSubTotal + linesGst + packagingTotal + courierTotal + otherTotal;

  if (loading) return <div style={S.page}><Nav /><div style={S.content}><p>Loading…</p></div></div>;
  if (!entry) return <div style={S.page}><Nav /><div style={S.content}><p>Entry not found.</p></div></div>;

  return (
    <div style={S.page}>
      <Nav />
      <div style={S.content}>
        <button style={S.backBtn} onClick={() => navigate('/inward')}>← Back to Purchase List</button>

        {/* Header card */}
        <div style={S.card}>
          <div style={S.cardHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={S.cardTitle}>Purchase Entry #{entry.id}</h2>
              <StatusBadge status={entry.status} />
            </div>
            {entry.status === 'locked' && <span style={S.lockedBadge}>LOCKED</span>}
          </div>
          <div style={S.grid}>
            <div><div style={S.fl}>Vendor</div><div style={S.fv}>{entry.vendor_name}</div></div>
            <div><div style={S.fl}>Invoice No.</div><div style={S.fv}>{entry.invoice_no || '—'}</div></div>
            <div><div style={S.fl}>Invoice Date</div><div style={S.fv}>{entry.invoice_date ? String(entry.invoice_date).slice(0,10) : '—'}</div></div>
            <div><div style={S.fl}>Created By</div><div style={S.fv}>{entry.created_by_name}</div></div>
          </div>
          {isDraft && canWrite && (
            <div style={S.actionRow}>
              <button style={S.confirmBtn} onClick={handleConfirm}>✓ Confirm Entry</button>
              <button style={S.addLineBtn} onClick={() => setShowAddLine(true)}>+ Add Item</button>
              <button style={S.importBtn} onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? 'Importing…' : '📥 Import Excel'}
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
            </div>
          )}
          {entry.status === 'confirmed' && canWrite && (
            <div style={S.actionRow}>
              <button style={S.lockBtn} onClick={handleLock}>🔒 Lock Entry</button>
            </div>
          )}
          {importResult && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: importResult.error ? '#fef2f2' : '#f0fdf4', borderRadius: 'var(--radius)', fontSize: '13px', color: importResult.error ? '#dc2626' : '#15803d' }}>
              {importResult.error ? importResult.error : `✅ Imported ${importResult.imported} rows. Skipped ${importResult.skipped}.`}
              {importResult.errors?.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: '16px' }}>
                  {importResult.errors.map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Lines table */}
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Item Code</th>
                <th style={S.th}>Item Name</th>
                <th style={S.th}>Qty</th>
                <th style={S.th}>Rate (₹)</th>
                <th style={S.th}>Amount (₹)</th>
                <th style={S.th}>CGST %</th>
                <th style={S.th}>SGST %</th>
                <th style={S.th}>IGST %</th>
                <th style={S.th}>Tax (₹)</th>
                <th style={S.th}>Total (₹)</th>
                <th style={S.th}>Expiry</th>
                <th style={S.th}>Batch</th>
                {isDraft && canWrite && <th style={S.th}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {lines.length === 0
                ? <tr><td colSpan={isDraft && canWrite ? 13 : 12} style={S.empty}>No items added yet.</td></tr>
                : lines.map(l => {
                    const base = parseFloat(l.qty) * parseFloat(l.rate);
                    const cgst = parseFloat(l.cgst_pct || 0);
                    const sgst = parseFloat(l.sgst_pct || 0);
                    const igst = parseFloat(l.igst_pct || 0);
                    const tax  = base * (cgst + sgst + igst) / 100;
                    return (
                      <tr key={l.id}>
                        <td style={S.td}><span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{l.item_code}</span></td>
                        <td style={S.td}>{l.item_name || l.item_grade || '—'}</td>
                        <td style={S.td}>{fmt(l.qty)} {l.unit || 'kg'}</td>
                        <td style={S.td}>{fmtCur(l.rate)}</td>
                        <td style={S.td}>{fmtCur(base)}</td>
                        <td style={S.td}>{cgst > 0 ? cgst + '%' : '—'}</td>
                        <td style={S.td}>{sgst > 0 ? sgst + '%' : '—'}</td>
                        <td style={S.td}>{igst > 0 ? igst + '%' : '—'}</td>
                        <td style={S.td}>{fmtCur(tax)}</td>
                        <td style={S.td}><strong>{fmtCur(base + tax)}</strong></td>
                        <td style={S.td}>{l.expiry_date ? String(l.expiry_date).slice(0,10) : '—'}</td>
                        <td style={S.td}>{l.batch_id ? `#${l.batch_id}` : '—'}</td>
                        {isDraft && canWrite && (
                          <td style={S.td}>
                            <button style={S.deleteBtn} onClick={() => handleDeleteLine(l.id)}>Delete</button>
                          </td>
                        )}
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>

        {/* Totals + Extra Charges */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px' }}>
          {/* Extra Charges */}
          <div style={S.card}>
            <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '700', color: 'var(--text-1)' }}>Additional Charges</h3>
            <ChargeRow
              title="Packaging Charge"
              data={charges.packaging}
              onChange={(f, v) => updateCharge('packaging', f, v)}
              onSave={saveCharges}
              isDraft={isDraft && canWrite}
              saving={chargeSaving}
            />
            <ChargeRow
              title="Courier / Delivery Charge"
              data={charges.courier}
              onChange={(f, v) => updateCharge('courier', f, v)}
              onSave={saveCharges}
              isDraft={isDraft && canWrite}
              saving={chargeSaving}
            />
            <ChargeRow
              title="Add Other Charge"
              data={{ ...charges.other, nameEditable: true }}
              onChange={(f, v) => updateCharge('other', f, v)}
              onSave={saveCharges}
              isDraft={isDraft && canWrite}
              saving={chargeSaving}
            />
          </div>

          {/* Bill Summary */}
          <div style={S.totalsCard}>
            <h3 style={S.totalsTitle}>Bill Summary</h3>
            <div style={S.totalsRow}>
              <span style={S.totalsLabel}>Sub Total</span>
              <span style={S.totalsValue}>{fmtCur(linesSubTotal)}</span>
            </div>
            <div style={S.totalsRow}>
              <span style={S.totalsLabel}>GST on Items</span>
              <span style={S.totalsValue}>{fmtCur(linesGst)}</span>
            </div>
            {packagingTotal > 0 && (
              <div style={S.totalsRow}>
                <span style={S.totalsLabel}>Packaging Charge</span>
                <span style={S.totalsValue}>{fmtCur(packagingTotal)}</span>
              </div>
            )}
            {courierTotal > 0 && (
              <div style={S.totalsRow}>
                <span style={S.totalsLabel}>Courier / Delivery</span>
                <span style={S.totalsValue}>{fmtCur(courierTotal)}</span>
              </div>
            )}
            {otherTotal > 0 && (
              <div style={S.totalsRow}>
                <span style={S.totalsLabel}>{charges.other.name || 'Other Charge'}</span>
                <span style={S.totalsValue}>{fmtCur(otherTotal)}</span>
              </div>
            )}
            <div style={S.grandRow}>
              <span style={S.grandLabel}>Grand Total</span>
              <span style={S.grandValue}>{fmtCur(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Add Line Modal */}
        {showAddLine && (
          <div style={S.overlay}>
            <div style={S.modal}>
              <h2 style={S.modalTitle}>Add Item to Entry</h2>
              <div style={S.formGroup}>
                <label style={S.label}>Item *</label>
                <select style={{ ...S.input }} value={lineForm.item_id} onChange={e => setLineForm(f => ({ ...f, item_id: e.target.value }))}>
                  <option value="">-- Select item --</option>
                  {items.map(it => <option key={it.id} value={it.id}>{it.item_code} — {it.variant_grade || it.sub_category_name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={S.formGroup}>
                  <label style={S.label}>Qty (kg) *</label>
                  <input type="number" step="0.01" style={S.input} value={lineForm.qty} onChange={e => setLineForm(f => ({ ...f, qty: e.target.value }))} />
                </div>
                <div style={S.formGroup}>
                  <label style={S.label}>Rate (₹/kg) *</label>
                  <input type="number" step="0.01" style={S.input} value={lineForm.rate} onChange={e => setLineForm(f => ({ ...f, rate: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div style={S.formGroup}>
                  <label style={S.label}>CGST %</label>
                  <input type="number" step="0.01" style={S.input} value={lineForm.cgst_pct} onChange={e => setLineForm(f => ({ ...f, cgst_pct: e.target.value }))} placeholder="e.g. 2.5" />
                </div>
                <div style={S.formGroup}>
                  <label style={S.label}>SGST %</label>
                  <input type="number" step="0.01" style={S.input} value={lineForm.sgst_pct} onChange={e => setLineForm(f => ({ ...f, sgst_pct: e.target.value }))} placeholder="e.g. 2.5" />
                </div>
                <div style={S.formGroup}>
                  <label style={S.label}>IGST %</label>
                  <input type="number" step="0.01" style={S.input} value={lineForm.igst_pct} onChange={e => setLineForm(f => ({ ...f, igst_pct: e.target.value }))} placeholder="e.g. 5" />
                </div>
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>Expiry Date</label>
                <input type="date" style={S.input} value={lineForm.expiry_date} onChange={e => setLineForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
              {lineForm.qty && lineForm.rate && (
                <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: 'var(--text-2)' }}>
                  Amount: {fmtCur(parseFloat(lineForm.qty || 0) * parseFloat(lineForm.rate || 0))}
                  {' | '}Tax: {fmtCur(parseFloat(lineForm.qty || 0) * parseFloat(lineForm.rate || 0) * ((parseFloat(lineForm.cgst_pct || 0) + parseFloat(lineForm.sgst_pct || 0) + parseFloat(lineForm.igst_pct || 0)) / 100))}
                  {' | '}
                  <strong>Total: {fmtCur(parseFloat(lineForm.qty || 0) * parseFloat(lineForm.rate || 0) * (1 + (parseFloat(lineForm.cgst_pct || 0) + parseFloat(lineForm.sgst_pct || 0) + parseFloat(lineForm.igst_pct || 0)) / 100))}</strong>
                </div>
              )}
              <div style={S.btnRow}>
                <button style={S.cancelBtn} onClick={() => { setShowAddLine(false); setLineForm(emptyLine); }}>Cancel</button>
                <button style={S.saveBtn} onClick={handleAddLine} disabled={saving}>{saving ? 'Saving…' : 'Add Item'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
