export default function Icon({ name, size = 18, ...props }) {
  const paths = {
    window: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M7 5.5h.1M10 5.5h.1"/></>,
    roll: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3"/></>,
    history: <><path d="M3 5v5h5M3 10a9 9 0 1 1 2 8M12 7v6l4 2"/></>,
    settings: <><path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3" fill="currentColor"/><circle cx="16" cy="17" r="3" fill="currentColor"/></>,
    arrow: <path d="M4 12h16m-5-5 5 5-5 5"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/></>,
    chevron: <path d="m9 5 7 7-7 7"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
