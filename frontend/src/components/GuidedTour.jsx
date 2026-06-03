import React, { useState } from 'react';

const STEPS = [
  {
    title: '👋 Welcome to Book Ends Store',
    description: "This system tracks your store's stock end-to-end — purchases coming in, items going out, with batch and expiry tracking. Here's a quick tour.",
    position: 'center'
  },
  {
    title: '📦 Item Master',
    description: 'All your products live here, each with its own code and barcode. Add a new product, or scan a barcode to pull up its live stock instantly.',
    target: 'nav-items',
    position: 'bottom'
  },
  {
    title: '🔍 Barcode Scanner',
    description: 'Open the Scan page and click the input box. Point your barcode reader at any product — it reads the code automatically and updates stock. New products can be linked or created on the spot.',
    target: 'nav-scan',
    position: 'bottom'
  },
  {
    title: '📥 Inward (Purchases)',
    description: 'When new stock arrives, record it from the supplier invoice: Inward → add each item with quantity & rate → Confirm (this creates batches with expiry dates) → Lock to finalise. Locked entries cannot be edited.',
    target: 'nav-inward',
    position: 'bottom'
  },
  {
    title: '📤 Outward (Stock out)',
    description: 'When stock leaves or is used: Outward → add items → Confirm. The system automatically takes the oldest batch first (FIFO) so nothing expires on the shelf.',
    target: 'nav-outward',
    position: 'bottom'
  },
  {
    title: '⚠️ Reports & Alerts',
    description: 'Reports give you Expiry Alerts (red/amber/green), Low Stock warnings, Dead Stock, and current stock value. The nightly job refreshes these automatically.',
    target: 'nav-reports',
    position: 'bottom'
  },
  {
    title: '👥 User Management',
    description: 'As Admin you can create staff accounts — Purchase, Warehouse, Sales and View-only roles. Each role sees only what it needs. Manage them under Users.',
    target: 'nav-users',
    position: 'bottom'
  },
  {
    title: "✅ You're ready!",
    description: 'Your catalogue is already loaded. Try the Scan page, check Reports for expiry alerts, and record your first purchase via Inward.',
    position: 'center'
  }
];

const TOTAL = STEPS.length;

const styles = {
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 9000,
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  card: {
    position: 'fixed',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '480px',
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    padding: '24px',
    zIndex: 9001,
    fontFamily: 'inherit'
  },
  cardCenter: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '480px',
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    padding: '24px',
    zIndex: 9001,
    fontFamily: 'inherit'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  stepLabel: {
    fontSize: '12px',
    color: '#888',
    fontWeight: '500'
  },
  skipBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '2px 4px',
    textDecoration: 'underline'
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: '8px',
    lineHeight: '1.4'
  },
  description: {
    fontSize: '14px',
    color: '#555',
    lineHeight: '1.6',
    marginBottom: '20px'
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dots: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center'
  },
  dot: (active) => ({
    width: active ? '10px' : '8px',
    height: active ? '10px' : '8px',
    borderRadius: '50%',
    background: active ? 'var(--primary)' : 'transparent',
    border: active ? '2px solid var(--primary)' : '2px solid var(--border-strong)',
    transition: 'all 0.2s'
  }),
  btnGroup: {
    display: 'flex',
    gap: '8px'
  },
  prevBtn: {
    padding: '8px 20px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    background: '#f5f5f5',
    color: '#444',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  nextBtn: {
    padding: '8px 20px',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--primary)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  arrow: {
    position: 'fixed',
    bottom: '152px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '10px solid transparent',
    borderRight: '10px solid transparent',
    borderBottom: '12px solid #fff',
    filter: 'drop-shadow(0 -2px 2px rgba(0,0,0,0.08))',
    zIndex: 9001
  }
};

export default function GuidedTour({ onDone }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === TOTAL - 1;
  const isCentered = current.position === 'center';

  function handleNext() {
    if (isLast) {
      onDone();
    } else {
      setStep(s => s + 1);
    }
  }

  function handlePrev() {
    if (step > 0) setStep(s => s - 1);
  }

  const cardStyle = isCentered ? styles.cardCenter : styles.card;

  return (
    <>
      {isCentered && <div style={styles.backdrop} onClick={() => {}} />}
      {!isCentered && <div style={styles.arrow} />}
      <div style={cardStyle}>
        <div style={styles.header}>
          <span style={styles.stepLabel}>Step {step + 1} of {TOTAL}</span>
          <button style={styles.skipBtn} onClick={onDone}>Skip</button>
        </div>

        <div style={styles.title}>{current.title}</div>
        <div style={styles.description}>{current.description}</div>

        <div style={styles.footer}>
          <div style={styles.dots}>
            {STEPS.map((_, i) => (
              <span key={i} style={styles.dot(i === step)} />
            ))}
          </div>
          <div style={styles.btnGroup}>
            {!isFirst && (
              <button style={styles.prevBtn} onClick={handlePrev}>
                &larr; Previous
              </button>
            )}
            <button style={styles.nextBtn} onClick={handleNext}>
              {isLast ? 'Get Started' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
