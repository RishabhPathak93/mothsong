// The Mothsong sigil — a small luminous moth. Original mark, drawn as SVG.
export default function MothMark({ size = 26, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="mothGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef3d0" />
          <stop offset="100%" stopColor="#f5c26b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mothWing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e88fa0" />
          <stop offset="100%" stopColor="#f5c26b" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#mothGlow)" opacity="0.7" />
      <path d="M16 16 C8 6 2 8 3 14 C4 19 11 18 16 16Z" fill="url(#mothWing)" opacity="0.92" />
      <path d="M16 16 C24 6 30 8 29 14 C28 19 21 18 16 16Z" fill="url(#mothWing)" opacity="0.92" />
      <path d="M16 16 C10 20 6 20 6 24 C7 27 13 24 16 16Z" fill="url(#mothWing)" opacity="0.66" />
      <path d="M16 16 C22 20 26 20 26 24 C25 27 19 24 16 16Z" fill="url(#mothWing)" opacity="0.66" />
      <ellipse cx="16" cy="16" rx="2.1" ry="5.4" fill="#241b45" />
      <ellipse cx="16" cy="14.5" rx="1" ry="2.2" fill="#fef3d0" />
      <path d="M15 11 C13 7 12 6 13 5" stroke="#e88fa0" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M17 11 C19 7 20 6 19 5" stroke="#e88fa0" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}
