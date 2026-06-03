import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { safeUser } from '../lib/safeUser';
import client from '../api/client';
import { Icon, BrandMark } from './icons';

// ---------------------------------------------------------------------------
// Navigation structure
// ---------------------------------------------------------------------------

const sections = [
  {
    label: 'OVERVIEW',
    links: [
      { label: 'Dashboard',  path: '/',           icon: 'dashboard' },
      { label: 'Catalog',    path: '/catalog',     icon: 'catalog' },
      { label: 'Scan',       path: '/items/scan',  icon: 'scan' },
    ],
  },
  {
    label: 'INVENTORY',
    links: [
      { label: 'Items',          path: '/items',           icon: 'items',  exact: true },
      { label: 'Batches',        path: '/batches',          icon: 'batches' },
      { label: 'Stock Transfers',path: '/stock-transfers',  icon: 'transfer' },
      { label: 'Expiry Alerts',  path: '/expiry-alerts',    icon: 'expiry', badge: true },
    ],
  },
  {
    label: 'TRANSACTIONS',
    links: [
      { label: 'Purchase Orders', path: '/purchase-orders', icon: 'po' },
      { label: 'Inward',          path: '/inward',           icon: 'inward' },
      { label: 'Outward',         path: '/outward',          icon: 'outward' },
    ],
  },
  {
    label: 'MASTER DATA',
    links: [
      { label: 'Vendors',       path: '/vendors',       icon: 'vendors' },
      { label: 'Customers',     path: '/customers',     icon: 'customers' },
      { label: 'Locations',     path: '/locations',     icon: 'locations' },
      { label: 'Custom Fields', path: '/custom-fields', icon: 'fields', adminOnly: true },
    ],
  },
  {
    label: 'ANALYTICS',
    links: [
      { label: 'Reports',       path: '/reports',        icon: 'reports' },
      { label: 'MIS Dashboard', path: '/mis-dashboard',  icon: 'mis' },
      { label: 'Margin Report', path: '/margin-report',  icon: 'margin' },
      { label: 'EPR Compliance', path: '/epr',           icon: 'epr' },
    ],
  },
  {
    label: 'ADMIN',
    adminSection: true,
    links: [
      { label: 'Opening Stock', path: '/opening-stock',  icon: 'opening', adminOnly: true },
      { label: 'Normalize',     path: '/normalize',       icon: 'normalize', adminOnly: true },
      { label: 'Users',         path: '/users',           icon: 'users', adminOnly: true },
      { label: 'Audit Log',     path: '/audit-log',       icon: 'audit', adminOnly: true },
      { label: 'System Health', path: '/system-health',   icon: 'health', adminOnly: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// Style constants — all inline, no external CSS
// ---------------------------------------------------------------------------

const ACCENT        = '#C79A4B';
const ACCENT_BG     = 'rgba(199,154,75,0.14)';
const ACCENT_DARK   = '#231d10';
const SIDEBAR_BG    = '#19211C';
const DIVIDER       = '1px solid rgba(255,255,255,0.07)';

const s = {
  sidebar: {
    position: 'fixed',
    left: 0,
    top: 0,
    width: 'var(--sidebar-w, 220px)',
    height: '100vh',
    background: SIDEBAR_BG,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 200,
    boxShadow: '2px 0 16px rgba(0,0,0,0.18)',
    fontFamily: 'inherit',
  },

  // ---- Logo ----
  logoArea: {
    height: '56px',
    minHeight: '56px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    borderBottom: DIVIDER,
    flexShrink: 0,
  },
  logoBox: {
    width: '44px',
    height: '44px',
    background: '#1F6F54',
    color: '#E7C988',
    border: '1px solid rgba(199,154,75,0.55)',
    boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.04)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontWeight: 700,
    fontSize: '23px',
    letterSpacing: '0.5px',
    flexShrink: 0,
    userSelect: 'none',
  },
  logoText: {
    color: '#fff',
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: '18px',
    fontWeight: 600,
    marginLeft: '11px',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
  },

  // ---- Nav scroll area ----
  navScroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '8px 0',
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(255,255,255,0.12) transparent',
  },

  // ---- Section label ----
  sectionLabel: {
    color: '#475569',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '14px 16px 5px',
    userSelect: 'none',
  },

  // ---- Link base ----
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '7px 16px',
    margin: '1px 0',
    cursor: 'pointer',
    border: 'none',
    borderLeft: '3px solid transparent',
    background: 'transparent',
    width: '100%',
    textAlign: 'left',
    color: 'rgba(255,255,255,0.60)',
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: 1.4,
    transition: 'color 0.15s ease, background 0.15s ease, border-color 0.15s ease',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    borderRadius: '0',
  },
  linkHover: {
    color: 'rgba(255,255,255,0.88)',
    background: 'rgba(255,255,255,0.06)',
    borderLeftColor: 'transparent',
  },
  linkActive: {
    color: '#fff',
    background: ACCENT_BG,
    borderLeftColor: ACCENT,
  },

  // ---- Icon ----
  icon: {
    fontSize: '14px',
    lineHeight: 1,
    width: '16px',
    textAlign: 'center',
    flexShrink: 0,
    opacity: 0.85,
  },

  // ---- Badge ----
  badge: {
    marginLeft: 'auto',
    background: '#EF4444',
    color: '#fff',
    fontSize: '10px',
    borderRadius: '10px',
    padding: '1px 6px',
    lineHeight: '14px',
    fontWeight: 600,
    flexShrink: 0,
  },

  // ---- Section divider ----
  sectionDivider: {
    height: '1px',
    background: 'rgba(255,255,255,0.07)',
    margin: '6px 0',
  },

  // ---- User area ----
  userArea: {
    flexShrink: 0,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '60px',
  },
  avatar: {
    width: '30px',
    height: '30px',
    minWidth: '30px',
    borderRadius: '50%',
    background: ACCENT,
    color: ACCENT_DARK,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
    userSelect: 'none',
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  userName: {
    color: '#fff',
    fontSize: '13px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  roleChip: {
    display: 'inline-block',
    fontSize: '10px',
    textTransform: 'uppercase',
    background: 'rgba(245,158,11,0.25)',
    color: ACCENT,
    borderRadius: '3px',
    padding: '1px 5px',
    letterSpacing: '0.04em',
    fontWeight: 600,
    alignSelf: 'flex-start',
  },
  logoutBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: '#fff',
    borderRadius: '4px',
    fontSize: '11px',
    padding: '4px 8px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 500,
    flexShrink: 0,
    transition: 'background 0.15s ease',
    whiteSpace: 'nowrap',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isLinkActive(path, exact, pathname) {
  if (exact || path === '/') return pathname === path;
  return pathname.startsWith(path);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NavLink({ link, isActive, lowStockCount, onClick }) {
  const [hovered, setHovered] = useState(false);

  const computedStyle = {
    ...s.link,
    ...(isActive ? s.linkActive : hovered ? s.linkHover : {}),
  };

  return (
    <button
      style={computedStyle}
      onClick={() => onClick(link.path)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={link.label}
    >
      <span style={{ ...s.icon, opacity: isActive ? 1 : 0.78, transform: hovered && !isActive ? 'translateX(2px)' : 'none', transition: 'transform .16s ease, opacity .16s ease' }}>
        <Icon name={link.icon} size={17} stroke={isActive ? 2 : 1.7} />
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {link.label}
      </span>
      {link.badge && lowStockCount > 0 && (
        <span style={s.badge}>{lowStockCount > 99 ? '99+' : lowStockCount}</span>
      )}
    </button>
  );
}

function LogoutButton({ onClick }) {
  const [hovered, setHovered] = useState(false);
  const style = {
    ...s.logoutBtn,
    background: hovered ? 'rgba(239,68,68,0.20)' : 'rgba(255,255,255,0.15)',
  };
  return (
    <button
      style={style}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      Out
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Sidebar() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const user       = safeUser();
  const [lowStockCount, setLowStockCount] = useState(0);

  const fetchLowStockCount = useCallback(async (signal) => {
    try {
      const res = await client.get('/system/low-stock-count', { signal });
      setLowStockCount(res.data?.count ?? 0);
    } catch (_) {
      // Silent degradation — badge stays hidden on error
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchLowStockCount(controller.signal);
    const timer = setInterval(() => fetchLowStockCount(controller.signal), 300_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [fetchLowStockCount]);

  function handleLogout() {
    localStorage.removeItem('fg_token');
    localStorage.removeItem('fg_user');
    navigate('/login');
  }

  const isAdmin = user.role === 'admin';

  return (
    <aside style={s.sidebar} aria-label="Main navigation">

      {/* ---- Logo ---- */}
      <div style={s.logoArea}>
        <div style={s.logoBox}>BE</div>
        <div style={{ marginLeft: '11px', lineHeight: 1.1 }}>
          <span style={{ ...s.logoText, marginLeft: 0, display: 'block' }}>Book Ends</span>
          <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.45)', marginTop: '2px', letterSpacing: '0.02em' }}>Store · Surat</div>
        </div>
      </div>

      {/* ---- Scrollable nav ---- */}
      <nav style={s.navScroll}>
        {sections.map((section, sIdx) => {
          // Hide admin-only sections from non-admins
          if (section.adminSection && !isAdmin) return null;

          const visibleLinks = section.links.filter(
            (l) => !l.adminOnly || isAdmin
          );
          if (visibleLinks.length === 0) return null;

          return (
            <React.Fragment key={section.label}>
              {sIdx > 0 && <div style={s.sectionDivider} />}
              <div style={s.sectionLabel}>{section.label}</div>
              {visibleLinks.map((link) => (
                <NavLink
                  key={link.path}
                  link={link}
                  isActive={isLinkActive(link.path, link.exact, location.pathname)}
                  lowStockCount={lowStockCount}
                  onClick={(path) => navigate(path)}
                />
              ))}
            </React.Fragment>
          );
        })}
      </nav>

      {/* ---- User area ---- */}
      <div style={s.userArea}>
        <div
          style={s.avatar}
          title={user.name || 'User'}
        >
          {getInitials(user.name)}
        </div>
        <div style={s.userInfo}>
          <span style={s.userName}>{user.name || 'Unknown'}</span>
          {user.role && <span style={s.roleChip}>{user.role}</span>}
        </div>
        <LogoutButton onClick={handleLogout} />
      </div>

    </aside>
  );
}
