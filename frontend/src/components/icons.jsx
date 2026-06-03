import React from 'react';

/*
 * Hand-built stroke icon set (Lucide/Heroicons style) — consistent 24px grid,
 * round caps/joins, currentColor stroke. No external dependency.
 */

const ICONS = {
  dashboard: <><rect x="3" y="3" width="7.5" height="9" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.6" /><rect x="13.5" y="12" width="7.5" height="9" rx="1.6" /><rect x="3" y="15.5" width="7.5" height="5.5" rx="1.6" /></>,
  catalog: <><rect x="3" y="3" width="7" height="7" rx="1.6" /><rect x="14" y="3" width="7" height="7" rx="1.6" /><rect x="3" y="14" width="7" height="7" rx="1.6" /><rect x="14" y="14" width="7" height="7" rx="1.6" /></>,
  scan: <><path d="M3 7V5.5A2.5 2.5 0 0 1 5.5 3H7" /><path d="M17 3h1.5A2.5 2.5 0 0 1 21 5.5V7" /><path d="M21 17v1.5a2.5 2.5 0 0 1-2.5 2.5H17" /><path d="M7 21H5.5A2.5 2.5 0 0 1 3 18.5V17" /><path d="M3 12h18" /></>,
  items: <><path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7Z" /><path d="m3 8.5 9 5.5 9-5.5" /><path d="M12 14v7" /></>,
  batches: <><path d="m12 2.5 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 16.5 9 5 9-5" /></>,
  transfer: <><path d="m16 3 5 4-5 4" /><path d="M21 7H7" /><path d="m8 21-5-4 5-4" /><path d="M3 17h14" /></>,
  expiry: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  po: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2.6a.6.6 0 0 1 .6-.6h4.8a.6.6 0 0 1 .6.6V4" /><path d="M9 11h6" /><path d="M9 15h4" /></>,
  inward: <><path d="M12 3v9" /><path d="m8 9 4 4 4-4" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  outward: <><path d="M12 13V4" /><path d="m8 8 4-4 4 4" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  vendors: <><path d="M3.5 9 5 4h14l1.5 5" /><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" /><path d="M3.5 9h17" /><path d="M9.5 20v-5.5h5V20" /></>,
  customers: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19.5a6 6 0 0 1 12 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.4" /><path d="M17.5 14a6 6 0 0 1 3.5 5.5" /></>,
  locations: <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></>,
  fields: <><path d="M4 6h11" /><path d="M19 6h1" /><circle cx="17" cy="6" r="2" /><path d="M4 18h1" /><path d="M9 18h11" /><circle cx="7" cy="18" r="2" /><path d="M4 12h5" /><path d="M13 12h7" /><circle cx="11" cy="12" r="2" /></>,
  reports: <><path d="M4 3v17a1 1 0 0 0 1 1h16" /><rect x="7.5" y="11" width="3" height="6" rx="1" /><rect x="12.5" y="7.5" width="3" height="9.5" rx="1" /><rect x="17.5" y="13.5" width="3" height="3.5" rx="1" /></>,
  mis: <><path d="M4 3v17a1 1 0 0 0 1 1h16" /><path d="m7 14 3.5-4 3 2.5L20 6" /><path d="M20 10V6h-4" /></>,
  margin: <><path d="M6 18 18 6" /><circle cx="7.5" cy="7.5" r="2.3" /><circle cx="16.5" cy="16.5" r="2.3" /></>,
  epr: <><path d="M11 20.5C6.5 20 4 16.5 4 12.5 4 6.5 8 4 17 4c0 9-4 16-9 16.5Z" /><path d="M4.5 20.5c3.5-6 7-8 7-8" /></>,
  opening: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  normalize: <><path d="m14 4 6 6" /><path d="M4 21s.8-4.5 4.5-8.2C11.8 9.5 17 4 17 4l3 3s-5.5 5.2-8.8 8.5C7.5 19.2 5 20 5 20l-1 1Z" /><path d="M16 6.5 17.5 8" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19.5a6 6 0 0 1 12 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.4" /><path d="M17.5 14a6 6 0 0 1 3.5 5.5" /></>,
  audit: <><path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3L3.5 8" /><path d="M3.5 3.5V8h4.5" /><path d="M12 8v4.2l3 1.8" /></>,
  health: <><path d="M3 12h4l2 6.5L13 5l2 8h6" /></>,
  logout: <><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><path d="m15.5 16.5 4.5-4.5-4.5-4.5" /><path d="M20 12H9" /></>,
};

export function Icon({ name, size = 18, stroke = 1.8, style, className }) {
  const inner = ICONS[name] || ICONS.dashboard;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className} aria-hidden="true"
    >{inner}</svg>
  );
}

// Brand mark — a sprout/grain glyph, fitting a food & grains business.
export function BrandMark({ size = 22, color = '#fff', stroke = 1.7 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 20h10" />
      <path d="M12 20c0-4 0-7 1.5-10" />
      <path d="M9.6 9.7c1 .8 1.7 2.1 2.2 3.6-1.9.4-3.4.3-4.6-.3-1.2-.6-2.2-1.9-2.9-4 2.7-.5 4.2 0 5.3.7Z" />
      <path d="M14.2 6.2A6.7 6.7 0 0 0 13.2 10c1.8-.1 3.1-.6 4.1-1.4.9-.9 1.5-2.2 1.6-4.4-2.6.1-3.9.9-4.7 2Z" />
    </svg>
  );
}

export default Icon;
