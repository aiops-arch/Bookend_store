import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import Nav from '../components/Nav';
import { safeUser } from '../lib/safeUser';

/* ── Inline SVG icons ───────────────────────────────────────────── */
const Icon = {
  Plus: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  Scan: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
      <line x1="7" y1="12" x2="7" y2="12.01" strokeWidth="3"/>
      <line x1="12" y1="9" x2="12" y2="15" strokeWidth="2"/>
      <line x1="17" y1="12" x2="17" y2="12.01" strokeWidth="3"/>
    </svg>
  ),
  Download: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7,10 12,15 17,10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6,9 12,15 18,9"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Edit: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  MoreVert: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.5"/>
      <circle cx="12" cy="12" r="1.5"/>
      <circle cx="12" cy="19" r="1.5"/>
    </svg>
  ),
  Info: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="8.01" strokeWidth="3"/>
      <line x1="12" y1="12" x2="12" y2="16"/>
    </svg>
  ),
};

/* ── Status config — mirrors PetPooja style ─────────────────────── */
const STATUS_CFG = {
  draft:     { label: 'Draft',     color: '#6b7280', bg: '#f3f4f6' },
  confirmed: { label: 'Confirmed', color: '#7c3aed', bg: '#ede9fe' },
  locked:    { label: 'Saved',     color: '#059669', bg: '#ecfdf5' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span style={{
      fontSize: '11.5px', fontWeight: '600',
      color: cfg.color, background: cfg.bg,
      padding: '3px 9px', borderRadius: '4px',
      display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

/* ── KPI summary card ───────────────────────────────────────────── */
function KpiCard({ label, value, loading }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '16px 20px',
    }}>
      <p style={{
        margin: '0 0 10px', fontSize: '12px', color: '#6b7280',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <span style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: '#94a3b8', flexShrink: 0, display: 'inline-block',
        }}/>
        {label}
        <span style={{ color: '#cbd5e1', marginLeft: '2px', display: 'flex', alignItems: 'center' }}>
          <Icon.Info />
        </span>
      </p>
      <p style={{
        margin: 0, fontSize: '22px', fontWeight: '700',
        color: '#111827', letterSpacing: '-0.5px',
      }}>
        {loading ? <span style={{ color: '#d1d5db' }}>—</span> : value}
      </p>
    </div>
  );
}

/* ── helpers ────────────────────────────────────────────────────── */
function fmtINR(val) {
  if (val == null || val === '' || isNaN(Number(val))) return '—';
  return '₹ ' + Number(val).toLocaleString('en-IN', {
    minimumFractionDigits: 3, maximumFractionDigits: 3,
  });
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── pagination button ──────────────────────────────────────────── */
function PagBtn({ children, onClick, disabled, active }) {
  return (
    <button disabled={disabled} onClick={onClick} style={{
      padding: '5px 10px', minWidth: '34px',
      borderRadius: '6px', border: '1px solid #e5e7eb',
      background: active ? '#00b140' : '#fff',
      color: active ? '#fff' : '#374151',
      fontWeight: active ? '600' : '400',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      fontSize: '13px',
    }}>
      {children}
    </button>
  );
}

/* ── action icon button ─────────────────────────────────────────── */
function ActionBtn({ children, onClick, color, title }) {
  const [hov, setHov] = useState(false);
  return (
    <button title={title} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: '28px', height: '28px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${hov ? '#d1d5db' : '#e5e7eb'}`,
        borderRadius: '5px',
        background: hov ? '#f9fafb' : '#fff',
        cursor: 'pointer', color: color || '#6b7280',
      }}>
      {children}
    </button>
  );
}

/* ── table row ──────────────────────────────────────────────────── */
function TableRow({ entry: e, idx, onView }) {
  const [hov, setHov] = useState(false);
  const base = idx % 2 === 0 ? '#fff' : '#fafafa';
  return (
    <tr
      style={{ borderBottom: '1px solid #f3f4f6', background: hov ? '#f0fdf4' : base }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <td style={{ padding: '11px 14px', fontWeight: '500', color: '#111827', whiteSpace: 'nowrap' }}>
        {e.vendor_name || '—'}
      </td>
      <td style={{ padding: '11px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
        {fmtDate(e.invoice_date)}
      </td>
      <td style={{ padding: '11px 14px', color: '#374151', fontFamily: 'monospace', fontSize: '12px' }}>
        {e.invoice_no || '—'}
      </td>
      <td style={{ padding: '11px 14px', color: '#374151' }}>
        {e.po_reference || '—'}
      </td>
      <td style={{ padding: '11px 14px', color: '#111827', fontWeight: '600', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {e.total_amount != null && Number(e.total_amount) > 0
          ? Number(e.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 3 })
          : '—'}
      </td>
      <td style={{ padding: '11px 14px', color: '#374151', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {e.gst_amount != null && Number(e.gst_amount) > 0
          ? Number(e.gst_amount).toLocaleString('en-IN', { minimumFractionDigits: 3 })
          : '0.000'}
      </td>
      <td style={{ padding: '11px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
        {e.created_by_name || '—'}
      </td>
      <td style={{ padding: '11px 14px' }}>
        <StatusBadge status={e.status} />
      </td>
      <td style={{ padding: '11px 14px' }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          <ActionBtn title="View / Edit" color="#6b7280" onClick={onView}>
            <Icon.Edit />
          </ActionBtn>
          <ActionBtn title="More options" color="#6b7280">
            <Icon.MoreVert />
          </ActionBtn>
        </div>
      </td>
    </tr>
  );
}

/* ── MAIN COMPONENT ─────────────────────────────────────────────── */
export default function Inward() {
  const navigate = useNavigate();
  const user     = safeUser();

  const [entries,      setEntries]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [page,         setPage]         = useState(1);
  const [pagination,   setPagination]   = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [invoiceSearch,setInvoiceSearch]= useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [stats,        setStats]        = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [vendors,      setVendors]      = useState([]);
  const [openPos,      setOpenPos]      = useState([]);
  const [showForm,     setShowForm]     = useState(false);
  const [exportOpen,   setExportOpen]   = useState(false);
  const [form, setForm] = useState({ po_id: '', vendor_id: '', invoice_no: '', invoice_date: '' });

  const canWrite  = ['admin', 'purchase', 'warehouse'].includes(user?.role);
  const debRef    = useRef(null);
  const exportRef = useRef(null);

  function buildParams() {
    const p = {};
    if (statusFilter)  p.status    = statusFilter;
    if (vendorFilter)  p.vendor_id = vendorFilter;
    if (invoiceSearch) p.search    = invoiceSearch;
    if (dateFrom)      p.date_from = dateFrom;
    if (dateTo)        p.date_to   = dateTo;
    return p;
  }

  async function fetchEntries(pg = 1) {
    setLoading(true);
    try {
      const res = await client.get('/inward', { params: { ...buildParams(), page: pg, limit: 50 } });
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
    } catch (err) { console.error('Stats fetch failed:', err); setStats(null); }
    finally { setStatsLoading(false); }
  }

  // Load vendors & open POs once
  useEffect(() => {
    const ctrl = new AbortController();
    client.get('/vendors', { signal: ctrl.signal }).then(r => setVendors(r.data.data || [])).catch(() => {});
    client.get('/purchase-orders', { params: { status: 'open' }, signal: ctrl.signal }).then(r => setOpenPos(r.data.data || [])).catch(() => {});
    return () => ctrl.abort();
  }, []);

  // Debounced re-fetch on filter change
  useEffect(() => {
    setPage(1);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => { fetchEntries(1); fetchStats(); }, 300);
    return () => clearTimeout(debRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, vendorFilter, invoiceSearch, dateFrom, dateTo]);

  // Close export dropdown on outside click
  useEffect(() => {
    function h(e) { if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false); }
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
      navigate(`/inward/${res.data.data.id}`);
    } catch (err) { alert(err.response?.data?.error || 'Create failed'); }
  }

  function handleClear() {
    setDateFrom(''); setDateTo(''); setVendorFilter('');
    setInvoiceSearch