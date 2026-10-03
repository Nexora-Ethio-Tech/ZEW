export type IconName =
  | 'route'
  | 'rides'
  | 'bookmark'
  | 'car'
  | 'arrow'
  | 'pin'
  | 'clock'
  | 'people'
  | 'check'
  | 'close'
  | 'plus'
  | 'swap'
  | 'shield'
  | 'leaf'
  | 'help'
  | 'chevron'
  | 'sun'
  | 'menu'
  | 'wallet';
const paths: Record<IconName, React.ReactNode> = {
  wallet: (
    <>
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
      <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
      <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
    </>
  ),
  route: (
    <>
      <circle cx="5" cy="5" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M7 5h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h8" />
    </>
  ),
  rides: (
    <>
      <rect x="4" y="4" width="16" height="17" rx="3" />
      <path d="M8 2v4m8-4v4M4 10h16m-12 5h3m3 0h2" />
    </>
  ),
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
  car: (
    <>
      <path d="m5 8 2-5h10l2 5M3 9h18v9H3zM5 18v3m14-3v3M6 13h2m8 0h2" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  pin: (
    <>
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m3 11v-3a6 6 0 0 0-2-4" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  swap: (
    <>
      <path d="M8 3v18m-4-4 4 4 4-4M16 21V3m-4 4 4-4 4 4" />
    </>
  ),
  shield: (
    <>
      <path d="m12 3 8 3v6c0 6-8 10-8 10S4 18 4 12V6z" />
      <path d="m8 12 3 3 5-5" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 3C8 2 2 9 5 16s16 5 15-13Z" />
      <path d="M3 21 15 9" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
};
export function Icon({
  name,
  size = 20,
  ...props
}: { name: IconName; size?: number } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
