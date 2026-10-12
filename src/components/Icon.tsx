// Small stroke icon set (24px grid), drawn inline so the app needs no icon font or network fetch.
const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  issues: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  megaphone: 'M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1ZM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12',
  more: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  filter: 'M4 5h16l-6 8v5l-4 2v-7L4 5Z',
  chevronRight: 'm9 6 6 6-6 6',
  chevronLeft: 'm15 6-6 6 6 6',
  chevronDown: 'm6 9 6 6 6-6',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'm5 12.5 4.5 4.5L19 7',
  archive: 'M4 7h16v3H4zM5 10v9h14v-9M10 14h4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  alert: 'M12 4 2.5 20h19L12 4ZM12 10v4.5M12 17.5h.01',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  chat: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  chart: 'M4 20h16M7 16v-5M12 16V7M17 16v-8',
  planner: 'M9 6h11M9 12h11M9 18h11M3.5 6l1.5 1.5L7 5M3.5 12l1.5 1.5L7 11M3.5 18l1.5 1.5L7 17',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.6 1.2-2 3.5-1.9-.7a7 7 0 0 1-1.8 1L15 20.5h-4l-.3-2a7 7 0 0 1-1.8-1l-1.9.7-2-3.5 1.6-1.2a7 7 0 0 1 0-3L5 9.3l2-3.5 1.9.7a7 7 0 0 1 1.8-1L11 3.5h4l.3 2a7 7 0 0 1 1.8 1l1.9-.7 2 3.5-1.6 1.2a7 7 0 0 1 0 3Z',
  shield: 'M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3ZM9 12l2 2 4-4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01',
  flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6.5 6.5 0 0 1 3.5 6',
  repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
  print: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
  template: 'M4 4h16v5H4zM4 13h7v7H4zM15 13h5M15 17h5',
  sort: 'M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3',
  note: 'M5 4h14v12l-4 4H5zM15 20v-4h4M8 9h8M8 13h5'
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className, label }: { name: IconName; size?: number; className?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
