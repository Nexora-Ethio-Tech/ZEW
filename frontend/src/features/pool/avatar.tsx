const palettes: Record<string, string[]> = {
  peach: ['#f5ded0', '#9c6349', '#3f2b24', '#d79271'],
  lavender: ['#e6def8', '#86583e', '#242421', '#8882b6'],
  blue: ['#d9e9f2', '#a56d4e', '#332620', '#76979e'],
  sand: ['#efe7cc', '#986445', '#272320', '#aea171'],
  pink: ['#f4dce8', '#a5704e', '#3b2522', '#bc84a1'],
  green: ['#e3edcc', '#a16b4f', '#343023', '#85a46f'],
};
export function Avatar({
  color = 'green',
  name,
  size = 44,
}: {
  color?: string;
  name: string;
  size?: number;
}) {
  const [background, skin, hair, shirt] = palettes[color] ?? palettes.green;
  const longHair = ['peach', 'blue', 'pink'].includes(color);
  return (
    <svg
      className="pool-avatar"
      width={size}
      height={size}
      viewBox="0 0 60 60"
      role="img"
      aria-label={`${name}, illustrated demo avatar`}
    >
      <circle cx="30" cy="30" r="30" fill={background} />
      {longHair && <path d="M15 41V25C15 4 47 5 45 28v16z" fill={hair} />}
      <path d="M9 60c0-22 11-20 21-22 11 2 21 2 21 22" fill={shirt} />
      <path d="M25 32h10v12c-5 4-10 1-10-2z" fill={skin} />
      <ellipse cx="30" cy="26" rx="12" ry="15" fill={skin} />
      <path
        d={
          longHair
            ? 'M18 25c-5-22 30-23 26 1-6-2-14-5-17-13-1 7-5 10-9 12'
            : 'M18 22C9 5 48 5 42 24l-6-9-7 4-8-1z'
        }
        fill={hair}
      />
      <path d="M24 27h1m10 0h1" stroke="#342921" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M27 34q3 3 6 0"
        stroke="#f5d8b7"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
