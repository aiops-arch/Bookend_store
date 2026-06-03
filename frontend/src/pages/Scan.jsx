import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import Nav from '../components/Nav';
import FoodPhoto from '../components/FoodPhoto';

/*
 * POS-style scan screen with three modes:
 *  - SETUP   : one-time bonding. Scan a product → tap its catalogue item →
 *              barcode linked forever (no stock movement). Do this once per
 *              product and it stops asking to link.
 *  - INWARD  : scan to ADD stock.
 *  - OUTWARD : scan to REMOVE stock (FIFO).
 * Hardware barcode reader types into the box and sends Enter.
 */

const PRIMARY = '#2E6F8E';  // calm teal-blue for SETUP mode (distinct from green inward)

const styles = {
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' },
  body: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 24px 60px' },
  shell: { width: '100%', maxWidth: '640px' },

  modeRow: { display: 'flex', gap: '8px', marginBottom: '18px' },
  modeBtn: (active, color) => ({
    flex: 1, padding: '14px 8px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
    border: active ? `2px solid ${color}` : '1px solid var(--border)',
    background: active ? `${color}1a` : 'var(--surface)',
    color: active ? color : 'var(--text-3)',
    fontWeight: 700, fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
    transition: 'all .12s ease', textAlign: 'center',
  }),
  modeSub: { fontSize: '10px', fontWeight: 500, opacity: 0.85 },

  scanBox: (color) => ({
    background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 32px',
    boxShadow: 'var(--shadow-sm)', border: `2px solid ${color}`,
    width: '100%', textAlign: 'center', boxSizing: 'border-box',
  }),
  scanTitle: { fontSize: '15px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '4px' },
  scanHint: { fontSize: '12px', color: 'var(--text-4)', marginBottom: '18px' },
  scanInput: {
    width: '100%', padding: '16px', fontSize: '20px', border: '2px solid var(--border-strong)',
    borderRadius: 'var(--radius)', textAlign: 'center', letterSpacing: '1px', boxSizing: 'border-box', outline: 'none',
  },
  optsRow: { display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'flex-end', flexWrap: 'wrap' },
  field: { flex: 1, minWidth: '90px', textAlign: 'left' },
  label: { display: 'block', fontSize: '10px', fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' },
  input: {
    width: '100%', padding: '9px 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)',
    fontSize: '14px', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-1)', outline: 'none',
  },

  resultCard: (color, err) => ({
    background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '20px 22px',
    boxShadow: 'var(--shadow-sm)', marginTop: '18px', width: '100%', boxSizing: 'border-box',
    border: `1px solid ${err ? 'var(--danger)' : color}55`, borderLeft: `5px solid ${err ? 'var(--danger)' : color}`,
  }),
  rcHead: { display: 'flex', gap: '14px', alignItems: 'flex-start' },
  rcName: { fontSize: '17px', fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.25 },
  rcCode: { fontFamily: 'monospace', fontSize: '12px', background: 'var(--surface-2)', padding: '2px 7px', borderRadius: 'var(--radius)', color: 'var(--text-3)' },
  delta: (color) => ({ fontSize: '26px', fontWeight: 800, color, whiteSpace: 'nowrap' }),
  stockLine: { fontSize: '13px', color: 'var(--text-3)', marginTop: '2px' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' },
  chip: (c) => ({
    fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '20px',
    background: c === 'ai' ? 'rgba(139,92,246,0.14)' : c === 'gs1' ? 'rgba(59,130,246,0.14)' : 'var(--surface-2)',
    color: c === 'ai' ? '#7C3AED' : c === 'gs1' ? '#2563EB' : 'var(--text-3)',
  }),

  feedTitle: { fontSize: '12px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '26px 0 10px' },
  feedRow: (err) => ({
    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', marginBottom: '6px',
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    borderLeft: `4px solid ${err ? 'var(--danger)' : 'var(--border)'}`,
  }),
  feedTag: (color, err) => ({ fontSize: '15px', fontWeight: 800, width: '64px', textAlign: 'right', flexShrink: 0, color: err ? 'var(--danger)' : color }),

  teachCard: (color) => ({
    background: 'var(--surface)', border: `2px dashed ${color}`, borderRadius: 'var(--radius-lg)',
    padding: '24px', width: '100%', marginTop: '18px', boxSizing: 'border-box',
  }),
  teachTitle: { fontSize: '15px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '4px' },
  teachSub: { fontSize: '13px', color: 'var(--text-3)', marginBottom: '14px' },
  barcodeChip: { display: 'inline-block', padding: '5px 12px', borderRadius: '20px', background: 'var(--primary-dim)', color: 'var(--primary)', fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, marginBottom: '14px' },
  select: { width: '100%', padding: '9px 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', fontSize: '14px', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-1)', marginTop: '10px' },
  btnRow: { display: 'flex', gap: '10px', marginTop: '16px' },
  btnPrimary: { padding: '10px 22px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { padding: '10px 16px', background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', fontSize: '13px', cursor: 'pointer' },
};

const MODES = {
  setup:   { color: PRIMARY,         label: '🔗 SETUP',   sub: 'Link barcodes (1-time)' },
  inward:  { color: 'var(--success)',label: '↙ INWARD',   sub: 'Scan to ADD stock' },
  outward: { color: '#C8902A',       label: '↗ OUTWARD',  sub: 'Scan to REMOVE stock' },
};

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

let _eid = 0;

export default function Scan() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('setup');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('');
  const [expiry, setExpiry] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const [feed, setFeed] = useState([]);
  const [unknown, setUnknown] = useState(null);   // { raw, qty, setup }

  const [allItems, setAllItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [learning, setLearning] = useState(false);
  const [learnMsg, setLearnMsg] = useState(null);

  // create-new-product (for items not in the catalogue at all)
  const [categories, setCategories] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newUnit, setNewUnit] = useState('pcs');

  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const focusScan = useCallback(() => setTimeout(() => inputRef.current?.focus(), 30), []);

  useEffect(() => { focusScan(); }, [mode, focusScan]);

  useEffect(() => {
    if (unknown && allItems.length === 0) {
      client.get('/items', { params: { active: 'all' } }).then(r => setAllItems(r.data.data || [])).catch(() => {});
    }
    if (unknown && categories.length === 0) {
      client.get('/categories').then(r => setCategories(r.data.data || [])).catch(() => {});
    }
  }, [unknown, allItems.length, categories.length]);

  // Reset the create-form whenever a fresh unknown barcode appears.
  useEffect(() => {
    if (unknown) { setCreating(false); setNewName(itemSearch || ''); setNewCat(''); setNewUnit('pcs'); }
  }, [unknown]); // eslint-disable-line

  const color = MODES[mode].color;

  function pushFeed(ev) {
    setFeed(f => [{ id: ++_eid, ts: new Date(), ...ev }, ...f].slice(0, 50));
  }

  // SETUP: just resolve + (un)known. No stock movement.
  async function runSetup(barcode) {
    setBusy(true);
    try {
      const res = await client.post('/barcode/resolve', { raw: barcode });
      const d = res.data.data;
      if (d.item) {
        pushFeed({ mode, kind: 'known', item: d.item, note: `Already linked${d.matched_via === 'alias' ? ' (learned)' : d.matched_via === 'internal_label' ? ' (own label)' : ''}` });
      } else {
        setUnknown({ raw: d.parsed?.raw || barcode, setup: true });
        setSelectedItemId(''); setItemSearch(''); setLearnMsg(null);
      }
    } catch (err) {
      pushFeed({ err: true, mode, note: err.response?.data?.error || err.message });
    } finally {
      setBusy(false); setValue(''); focusScan();
    }
  }

  async function runMove(barcode, useQty) {
    const q = parseFloat(useQty);
    setBusy(true);
    try {
      const path = mode === 'inward' ? '/barcode/inward' : '/barcode/outward';
      const payload = mode === 'inward'
        ? { raw: barcode, qty: q, ...(rate ? { rate: parseFloat(rate) } : {}), ...(expiry ? { expiry } : {}) }
        : { raw: barcode, qty: q };
      const res = await client.post(path, payload);
      const d = res.data.data;
      const ex = d.parsed?.extracted || {};
      const badges = [];
      if (d.auto_created) badges.push({ c: 'ai', t: `✨ Auto-created · ${d.enrichment?.product?.source || 'online'}` });
      if (d.matched_via === 'alias') badges.push({ c: '', t: 'learned barcode' });
      if (d.matched_via === 'internal_label') badges.push({ c: '', t: 'own label' });
      if (d.parsed?.symbology?.startsWith('GS1')) badges.push({ c: 'gs1', t: d.parsed.symbology });
      if (ex.batch) badges.push({ c: 'gs1', t: `batch ${ex.batch}` });
      if (ex.expiry) badges.push({ c: 'gs1', t: `exp ${fmtDate(ex.expiry)}` });
      if (ex.net_weight && !ex.net_weight.assumed) badges.push({ c: 'gs1', t: `${ex.net_weight.value} ${ex.net_weight.unit}` });
      if (mode === 'outward' && d.picks) badges.push({ c: '', t: `FIFO · ${d.picks.length} batch${d.picks.length > 1 ? 'es' : ''}` });

      pushFeed({ mode, kind: 'move', item: d.item, delta: mode === 'inward' ? d.added_qty : d.removed_qty, newStock: d.new_stock, badges, action: d.action });
      setUnknown(null); setLearnMsg(null);
    } catch (err) {
      const r = err.response;
      if (r?.status === 404 && r.data?.error === 'UNKNOWN_BARCODE') {
        setUnknown({ raw: r.data.data?.parsed?.raw || barcode, qty: useQty });
        setSelectedItemId(''); setItemSearch(''); setLearnMsg(null);
        pushFeed({ err: true, mode, unknownRaw: barcode, note: 'Unknown — link it below' });
      } else if (r?.status === 409 && String(r.data?.error).startsWith('INSUFFICIENT_STOCK')) {
        const dd = r.data.data || {};
        pushFeed({ err: true, mode, item: dd.item, note: `Not enough stock — need ${dd.requested}, have ${dd.available} ${dd.item?.unit || ''}` });
      } else {
        pushFeed({ err: true, mode, note: r?.data?.error || err.message });
      }
    } finally {
      setBusy(false); setValue(''); focusScan();
    }
  }

  // Route a finished barcode to the right action.
  function submit(bc) {
    const code = (bc != null ? bc : value).trim();
    if (!code || busy) return;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (mode === 'setup') return runSetup(code);
    if (!qty || parseFloat(qty) <= 0) { pushFeed({ err: true, mode, note: 'Set a quantity greater than 0' }); return; }
    runMove(code, qty);
  }

  // Works with ANY scanner: most send Enter (handled below); those that don't
  // type the whole code in a rapid burst — so we auto-submit shortly after the
  // typing stops. Manual typists can also just click "Go".
  function onChange(e) {
    const v = e.target.value;
    setValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    const code = v.trim();
    if (code.length >= 4) {
      timerRef.current = setTimeout(() => submit(code), 140);
    }
  }

  function onScanKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); submit(value); }
  }

  async function linkItem() {
    if (!selectedItemId) { setLearnMsg({ ok: false, t: 'Select an item first' }); return; }
    setLearning(true); setLearnMsg(null);
    const chosen = allItems.find(i => String(i.id) === String(selectedItemId));
    try {
      await client.post('/barcode/learn', { raw: unknown.raw, item_id: Number(selectedItemId) });
      if (unknown.setup) {
        pushFeed({ mode, kind: 'linked', item: chosen, note: `Linked → ${chosen?.item_code}` });
        setUnknown(null); focusScan();
      } else {
        const pendingQty = unknown.qty;
        setUnknown(null);
        await runMove(unknown.raw, pendingQty);
      }
    } catch (err) {
      setLearnMsg({ ok: false, t: err.response?.data?.error || 'Could not link barcode' });
    } finally {
      setLearning(false);
    }
  }

  // Create a brand-new product and bond this barcode to it.
  async function createNewProduct() {
    if (!newName.trim()) { setLearnMsg({ ok: false, t: 'Type a product name first' }); return; }
    setLearning(true); setLearnMsg(null);
    try {
      const res = await client.post('/barcode/create-item', {
        raw: unknown.raw, item_name: newName.trim(), category: newCat || 'Others', unit: newUnit,
      });
      const item = res.data.data.item;
      if (unknown.setup) {
        pushFeed({ mode, kind: 'linked', item, note: `Created ${item.item_code}` });
        setUnknown(null); focusScan();
      } else {
        const pendingQty = unknown.qty;
        setUnknown(null);
        await runMove(unknown.raw, pendingQty);
      }
    } catch (err) {
      setLearnMsg({ ok: false, t: err.response?.data?.error || 'Could not create product' });
    } finally {
      setLearning(false);
    }
  }

  const filtered = allItems.filter(it => {
    const q = itemSearch.toLowerCase();
    if (!q) return true;
    return (it.item_code || '').toLowerCase().includes(q)
      || (it.variant_grade || '').toLowerCase().includes(q)
      || (it.sub_category_name || '').toLowerCase().includes(q);
  }).slice(0, 50);

  const latest = feed[0];
  const bondedCount = feed.filter(f => f.kind === 'linked').length;
  const moveCount = feed.filter(f => f.kind === 'move').length;

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.body}>
        <div style={styles.shell}>

          {/* Mode toggle */}
          <div style={styles.modeRow}>
            {['setup', 'inward', 'outward'].map(m => (
              <div key={m} style={styles.modeBtn(mode === m, MODES[m].color)} onClick={() => { setMode(m); setUnknown(null); }}>
                <span>{MODES[m].label}</span><span style={styles.modeSub}>{MODES[m].sub}</span>
              </div>
            ))}
          </div>

          {/* Scan box */}
          <div style={styles.scanBox(color)}>
            <p style={styles.scanTitle}>
              {mode === 'setup' ? 'One-time setup — link each product to your catalogue'
                : mode === 'inward' ? 'Scan items coming IN' : 'Scan items going OUT'}
            </p>
            <p style={styles.scanHint}>
              {mode === 'setup'
                ? 'Scan a product, pick the matching item once. After that it just says "entered" on every scan.'
                : `Click the box, then scan. Each scan ${mode === 'inward' ? 'adds' : 'removes'} the quantity below.`}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                ref={inputRef} style={{ ...styles.scanInput, flex: 1 }} type="text" value={value}
                onChange={onChange} onKeyDown={onScanKey}
                onBlur={() => { if (!unknown) focusScan(); }}
                placeholder={busy ? 'Working…' : 'Scan or type barcode…'} autoComplete="off" autoFocus
              />
              <button style={{ ...styles.btnPrimary, padding: '0 22px', fontSize: '15px', background: color }} onClick={() => submit(value)} disabled={busy}>Go</button>
            </div>
            {mode !== 'setup' && (
              <div style={styles.optsRow}>
                <div style={{ ...styles.field, maxWidth: '110px' }}>
                  <label style={styles.label}>Quantity</label>
                  <input style={styles.input} type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)} />
                </div>
                {mode === 'inward' && (
                  <>
                    <div style={styles.field}>
                      <label style={styles.label}>Rate ₹ (optional)</label>
                      <input style={styles.input} type="number" min="0" step="any" value={rate} onChange={e => setRate(e.target.value)} placeholder="purchase rate" />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Expiry (optional)</label>
                      <input style={styles.input} type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Latest result */}
          {latest && !latest.unknownRaw && (
            <div style={styles.resultCard(MODES[latest.mode].color, latest.err)}>
              {latest.err ? (
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--danger)' }}>{latest.item ? latest.item.variant_grade : 'Scan blocked'}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '4px' }}>{latest.note}</div>
                </div>
              ) : (
                <>
                  <div style={styles.rcHead}>
                    <FoodPhoto item={latest.item} size={64} radius={10} style={{ border: '1px solid var(--border)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.rcName}>{latest.item.variant_grade || latest.item.sub_category_name}</div>
                      <div style={{ marginTop: '5px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={styles.rcCode}>{latest.item.item_code}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-4)' }}>{latest.item.category_name}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {latest.kind === 'move' ? (
                        <>
                          <div style={styles.delta(MODES[latest.mode].color)}>{latest.mode === 'inward' ? '+' : '−'}{latest.delta}</div>
                          <div style={styles.stockLine}>now <b>{latest.newStock}</b> {latest.item.unit}</div>
                        </>
                      ) : (
                        <div style={{ ...styles.delta(MODES[latest.mode].color), fontSize: '20px' }}>{latest.kind === 'linked' ? '🔗 linked' : '✓ linked'}</div>
                      )}
                    </div>
                  </div>
                  {latest.badges?.length > 0 && (
                    <div style={styles.chips}>{latest.badges.map((b, i) => <span key={i} style={styles.chip(b.c)}>{b.t}</span>)}</div>
                  )}
                  <div style={{ marginTop: '14px' }}>
                    <button style={styles.btnSecondary} onClick={() => navigate('/items/' + latest.item.id)}>View item →</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Link card (used by SETUP, and by INWARD/OUTWARD when truly unknown) */}
          {unknown && (
            <div style={styles.teachCard(color)}>
              <div style={styles.teachTitle}>{unknown.setup ? 'Link this barcode to an item' : 'New / unrecognised barcode'}</div>
              <div style={styles.teachSub}>
                {unknown.setup
                  ? 'Pick the product this barcode belongs to. Done once — then every scan resolves instantly.'
                  : 'Not in your catalogue and not found online. Link it once; future scans resolve automatically.'}
              </div>
              <div style={styles.barcodeChip}>{unknown.raw}</div>
              <label style={styles.label}>Find the item</label>
              <input style={styles.input} value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Type item name, code or category…" autoFocus />
              {filtered.length > 0 && (
                <select style={styles.select} size={Math.min(filtered.length, 8)} value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} onDoubleClick={linkItem}>
                  <option value="">— select item —</option>
                  {filtered.map(it => (
                    <option key={it.id} value={it.id}>{it.item_code} · {it.variant_grade || it.sub_category_name}</option>
                  ))}
                </select>
              )}
              {learnMsg && <div style={{ marginTop: '10px', fontSize: '13px', color: learnMsg.ok ? 'var(--success)' : 'var(--danger)' }}>{learnMsg.t}</div>}
              {!creating && (
                <div style={styles.btnRow}>
                  <button style={styles.btnPrimary} onClick={linkItem} disabled={learning || !selectedItemId}>
                    {learning ? 'Linking…' : unknown.setup ? 'Link this barcode' : `Link & ${mode === 'inward' ? 'add' : 'remove'} ${unknown.qty}`}
                  </button>
                  <button style={styles.btnSecondary} onClick={() => { setUnknown(null); focusScan(); }}>Skip</button>
                </div>
              )}

              {/* Brand-new product (not in the catalogue at all) */}
              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px dashed var(--border)' }}>
                {!creating ? (
                  <button style={{ ...styles.btnSecondary, width: '100%' }} onClick={() => setCreating(true)}>
                    ➕ This product is new — create it
                  </button>
                ) : (
                  <div>
                    <label style={styles.label}>New product name</label>
                    <input style={styles.input} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Diet Coke 330ml" autoFocus />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Category</label>
                        <select style={{ ...styles.input }} value={newCat} onChange={e => setNewCat(e.target.value)}>
                          <option value="">Others</option>
                          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      <div style={{ width: '120px' }}>
                        <label style={styles.label}>Unit</label>
                        <select style={{ ...styles.input }} value={newUnit} onChange={e => setNewUnit(e.target.value)}>
                          {['pcs', 'kg', 'liter', 'pack', 'box', 'tin'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={styles.btnRow}>
                      <button style={styles.btnPrimary} onClick={createNewProduct} disabled={learning || !newName.trim()}>
                        {learning ? 'Creating…' : unknown.setup ? 'Create & link' : `Create & ${mode === 'inward' ? 'add' : 'remove'} ${unknown.qty}`}
                      </button>
                      <button style={styles.btnSecondary} onClick={() => setCreating(false)}>Back</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Session feed */}
          {feed.length > 0 && (
            <>
              <div style={styles.feedTitle}>
                This session · {mode === 'setup' ? `${bondedCount} linked` : `${moveCount} movements`}
              </div>
              {feed.map(ev => (
                <div key={ev.id} style={styles.feedRow(ev.err)}>
                  <span style={styles.feedTag(MODES[ev.mode].color, ev.err)}>
                    {ev.err ? '!' : ev.kind === 'move' ? (ev.mode === 'inward' ? '+' : '−') + ev.delta : ev.kind === 'linked' ? '🔗' : '✓'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ev.item ? (ev.item.variant_grade || ev.item.sub_category_name) : (ev.unknownRaw || 'Error')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-4)' }}>
                      {ev.err ? ev.note : ev.kind === 'move' ? `${ev.item.item_code} · now ${ev.newStock} ${ev.item.unit}${ev.action === 'AUTO_CREATED_AND_STOCKED' ? ' · auto-created' : ''}` : `${ev.item.item_code} · ${ev.note}`}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-4)', flexShrink: 0 }}>
                    {ev.ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
