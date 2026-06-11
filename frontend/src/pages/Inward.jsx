import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import Nav from '../components/Nav';
import { safeUser } from '../lib/safeUser';

const Icon = {
  Plus: () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>),
  Scan: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="7" y2="12.01" strokeWidth="3"/><line x1="12" y1="9" x2="12" y2="15" strokeWidth="2"/><line x1="17" y1="12" x2="17" y2="12.01" strokeWidth="3"/></svg>),
  Download: () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>),
  ChevronDown: () => (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6,9 12,15 18,9"/></svg>),
  Calendar: () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  Edit: () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  MoreVert: () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>),
  Info: () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8.01" strokeWidth="3"/><line x1="12" y1="12" x2="12" y2="16"/></svg>),
};

const STATUS_CFG = {
  draft:     { label: 'Draft',     color: '#6b7280', bg: '#f3f4f6' },
  confirmed: { label: 'Confirmed', color: '#7c3aed', bg: '#ede9fe' },
  locked:    { label: 'Saved',     color: '#059669', bg: '#ecfdf5' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span style={{ fontSize: '11.5px', fontWeight: '600', color: cfg.color, background: cfg.bg, padding: '3px 9px', borderRadius: '4px', display: 'inline-block', whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

function KpiCard({ label, value, loading }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px 20px' }}>
      <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#94a3b8', flexShrink: 0, display: 'inline-block' }}/>
        {label}
        <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center' }}><Icon.Info /></span>
      </p>
      <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#111827', letterSpacing: '-0.5px' }}>
        {loading ? <span style={{ color: '#d1d5db' }}>—</span> : value}
      </p>
    </div>
  );
}

function fmtINR(val) {
  if (val == null || val === '' || isNaN(Number(val))) return '—';
  return '₹ ' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function PagBtn({ children, onClick, disabled, active }) {
  return (
    <button disabled={disabled} onClick={onClick} style={{ padding: '5px 10px', minWidth: '34px', borderRadius: '6px', border: '1px solid #e5e7eb', background: active ? '#00b140' : '#fff', color: active ? '#fff' : '#374151', fontWeight: active ? '600' : '400', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, fontSize: '13px' }}>
      {children}
    </button>
  );
}

function ActionBtn({ children, onClick, title }) {
  const [hov, setHov] = useState(false);
  return (
    <button title={title} onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', borderRadius: '5px', background: hov ? '#f9fafb' : '#fff', cursor: 'pointer', color: '#6b7280' }}>
      {children}
    </button>
  );
}

function TableRow({ entry: e, idx, onView }) {
  const [hov, setHov] = useState(false);
  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6', background: hov ? '#f0fdf4' : (idx % 2 === 0 ? '#fff' : '#fafafa') }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <td style={{ padding: '11px 14px', fontWeight: '500', color: '#111827', whiteSpace: 'nowrap' }}>{e.vendor_name || '—'}</td>
      <td style={{ padding: '11px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{fmtDate(e.invoice_date)}</td>
      <td style={{ padding: '11px 14px', color: '#374151', fontFamily: 'monospace', fontSize: '12px' }}>{e.invoice_no || '—'}</td>
      <td style={{ padding: '11px 14px', color: '#374151' }}>{e.po_reference || '—'}</td>
      <td style={{ padding: '11px 14px', color: '#111827', fontWeight: '600', textAlign: 'right' }}>
        {e.total_amount != null && Number(e.total_amount) > 0
          ? Number(e.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 3 })
          : '—'}
      </td>
      <td style={{ padding: '11px 14px', color: '#374151', textAlign: 'right' }}>
        {e.gst_amount != null && Number(e.gst_amount) > 0
          ? Number(e.gst_amount).toLocaleString('en-IN', { minimumFractionDigits: 3 })
          : '0.000'}
      </td>
      <td style={{ padding: '11px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{e.created_by_name || '—'}</td>
      <td style={{ padding: '11px 14px' }}><StatusBadge status={e.status} /></td>
      <td style={{ padding: '11px 14px' }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          <ActionBtn title="View / Edit" onClick={onView}><Icon.Edit /></ActionBtn>
          <ActionBtn title="More"><Icon.MoreVert /></ActionBtn>
        </div>
      </td>
    </tr>
  );
}

export default function Inward() {
  const navigate = useNavigate();
  const user = safeUser();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [openPos, setOpenPos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [form, setForm] = useState({ po_id: '', vendor_id: '', invoice_no: '', invoice_date: '' });
  const canWrite = ['admin', 'purchase', 'warehouse'].includes(user && user.role);
  const debRef = useRef(null);
  const exportRef = useRef(null);

  function buildParams() {
    const p = {};
    if (statusFilter) p.status = statusFilter;
    if (vendorFilter) p.vendor_id = vendorFilter;
    if (invoiceSearch) p.search = invoiceSearch;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }

  async function fetchEntries(pg) {
    setLoading(true);
    try {
      const res = await client.get('/inward', { params: { ...buildParams(), page: pg || 1, limit: 50 } });
      setEntries(res.data.data || []);
      setPagination(res.data.pagination || null);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function fetchStats() {
    setStatsLoading(true);
    try {
      const res = await client.get('/inward/stats', { params: buildParams() });
      setStats(res.data.data);
    } catch (err) { setStats(null); }
    finally { setStatsLoading(false); }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    client.get('/vendors', { signal: ctrl.signal }).then(r => setVendors(r.data.data || [])).catch(() => {});
    client.get('/purchase-orders', { params: { status: 'open' }, signal: ctrl.signal }).then(r => setOpenPos(r.data.data || [])).catch(() => {});
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    setPage(1);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => { fetchEntries(1); fetchStats(); }, 300);
    return () => clearTimeout(debRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, vendorFilter, invoiceSearch, dateFrom, dateTo]);

  useEffect(() => {
    const h = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  async function handleCreate() {
    if (!form.vendor_id) return alert('Vendor is required');
    try {
      const payload = { vendor_id: form.vendor_id, invoice_no: form.invoice_no, invoice_date: form.invoice_date || null };
      if (form.po_id) payload.po_id = form.po_id;
      const res = await client.post('/inward', payload);
      setShowForm(false);
      setForm({ po_id: '', vendor_id: '', invoice_no: '', invoice_date: '' });
      navigate('/inward/' + res.data.data.id);
    } catch (err) { alert((err.response && err.response.data && err.response.data.error) || 'Create failed'); }
  }

  function handleClear() {
    setDateFrom('');
    setDateTo('');
    setVendorFilter('');
    setInvoiceSearch('');
    setStatusFilter('');
  }

  const inp = { height: '34px', padding: '0 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', color: '#374151', background: '#fff', outline: 'none', boxSizing: 'border-box' };
  const COLS = ['From', 'Invoice Date', 'Invoice Number', 'PO Reference No.', 'Total', 'GST', 'Created By', 'Status', 'Action'];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6f8' }}>
      <Nav />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>Purchase List</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => navigate('/scan')} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', border: '1.5px solid #00b140', borderRadius: '6px', background: '#f0fdf4', color: '#00b140', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              <Icon.Scan /> Scan &amp; Purchase
            </button>
            <div style={{ position: 'relative' }} ref={exportRef}>
              <button onClick={() => setExportOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>
                <Icon.Download /> Export <Icon.ChevronDown />
              </button>
              {exportOpen && (
                <div style={{ position: 'absolute', top: '42px', right: 0, zIndex: 100, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '150px', overflow: 'hidden' }}>
                  {['Excel', 'CSV', 'Print'].map(opt => (
                    <button key={opt} style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', border: 'none', background: 'none', fontSize: '13px', color: '#374151', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                      onClick={() => setExportOpen(false)}>{opt}</button>
                  ))}
                </div>
              )}
            </div>
            {canWrite && (
              <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 16px', border: 'none', borderRadius: '6px', background: '#00b140', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                <Icon.Plus /> Create New
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '20px 28px', flex: 1 }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none', display: 'flex' }}><Icon.Calendar /></span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inp, paddingLeft: '30px', width: '148px' }} />
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none', display: 'flex' }}><Icon.Calendar /></span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inp, paddingLeft: '30px', width: '148px' }} />
            </div>
            <select value={vendorFilter} onChange={e => setVendorFilter(e.target.value)} style={{ ...inp, width: '170px' }}>
              <option value="">All Vendors</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <input value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} placeholder="Invoice No." style={{ ...inp, width: '148px' }} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: '148px' }}>
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="confirmed">Confirmed</option>
              <option value="locked">Saved / Locked</option>
            </select>
            <button onClick={() => { setPage(1); fetchEntries(1); fetchStats(); }} style={{ height: '34px', padding: '0 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Search</button>
            <button onClick={handleClear} style={{ height: '34px', padding: '0 14px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>Clear</button>
          </div>

          <div style={{ display: 'flex', gap: '14px', marginBottom: '18px' }}>
            <KpiCard label="Total Purchase invoice amount recorded is" value={fmtINR(stats && stats.total_amount)} loading={statsLoading} />
            <KpiCard label="Total Outstanding Payment of" value={fmtINR(stats && stats.outstanding)} loading={statsLoading} />
            <KpiCard label="Tax (GST) paid to the seller" value={fmtINR(stats && stats.gst_amount)} loading={statsLoading} />
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {COLS.map(col => (
                      <th key={col} style={{ padding: '11px 14px', textAlign: (col === 'Total' || col === 'GST') ? 'right' : 'left', fontSize: '12px', fontWeight: '600', color: '#374151', whiteSpace: 'nowrap' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={COLS.length} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>Loading...</td></tr>}
                  {!loading && entries.length === 0 && <tr><td colSpan={COLS.length} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>No records found</td></tr>}
                  {!loading && entries.map((e, idx) => (
                    <TableRow key={e.id} entry={e} idx={idx} onView={() => navigate('/inward/' + e.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pagination && pagination.pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', fontSize: '13px', color: '#6b7280' }}>
              <span>Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <PagBtn disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchEntries(p); }}>Prev</PagBtn>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === pagination.pages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push('...'); acc.push(p); return acc; }, [])
                  .map((p, i) => p === '...'
                    ? <span key={'el' + i} style={{ padding: '0 6px', display: 'flex', alignItems: 'center' }}>...</span>
                    : <PagBtn key={p} active={p === page} onClick={() => { setPage(p); fetchEntries(p); }}>{p}</PagBtn>
                  )}
                <PagBtn disabled={page >= pagination.pages} onClick={() => { const p = page + 1; setPage(p); fetchEntries(p); }}>Next</PagBtn>
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 32px', width: '460px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 22px', fontSize: '16px', fontWeight: '700', color: '#111827' }}>New Purchase Entry</h3>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Vendor *</label>
              <select value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))} style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', color: '#374151', background: '#fff', boxSizing: 'border-box' }}>
                <option value="">Select vendor...</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Linked PO (optional)</label>
              <select value={form.po_id} onChange={e => setForm(f => ({ ...f, po_id: e.target.value }))} style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', color: '#374151', background: '#fff', boxSizing: 'border-box' }}>
                <option value="">None</option>
                {openPos.map(po => <option key={po.id} value={po.id}>PO-{String(po.id).padStart(4, '0')} — {po.vendor_name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Invoice #</label>
              <input value={form.invoice_no} onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))} style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', color: '#374151', background: '#fff', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Invoice Date</label>
              <input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', color: '#374151', background: '#fff', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '22px' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 18px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              <button onClick={handleCreate} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#00b140', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
