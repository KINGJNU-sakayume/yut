// Original goblin (도깨비) mask drawn with simple SVG shapes. Centered on (0,0), ~8 units tall.

export function GoblinMask({ boss = false, dim = false }: { boss?: boolean; dim?: boolean }) {
  const horn = boss ? '#e8c46a' : '#ecdcc0'
  const face = boss ? '#7d160f' : '#a8261c'
  return (
    <g opacity={dim ? 0.55 : 1}>
      <path d="M-2.5,-2.2 L-3.9,-5.6 L-1.2,-3.1 Z" fill={horn} stroke="#2a0e08" strokeWidth="0.35" strokeLinejoin="round" />
      <path d="M2.5,-2.2 L3.9,-5.6 L1.2,-3.1 Z" fill={horn} stroke="#2a0e08" strokeWidth="0.35" strokeLinejoin="round" />
      {boss && <path d="M-0.6,-3.3 L0,-5.1 L0.6,-3.3 Z" fill={horn} stroke="#2a0e08" strokeWidth="0.3" />}
      <ellipse cx="0" cy="0" rx="3.5" ry="3.7" fill={face} stroke="#2a0e08" strokeWidth="0.45" />
      <path d="M-3.1,-1.2 Q0,-2.4 3.1,-1.2" fill="none" stroke={boss ? '#e8c46a' : '#3b0d08'} strokeWidth="0.45" />
      <path d="M-2.5,-1.55 L-0.55,-0.85" stroke="#1b0d08" strokeWidth="0.55" strokeLinecap="round" />
      <path d="M2.5,-1.55 L0.55,-0.85" stroke="#1b0d08" strokeWidth="0.55" strokeLinecap="round" />
      <circle cx="-1.35" cy="-0.15" r="0.8" fill="#f6e7b0" />
      <circle cx="1.35" cy="-0.15" r="0.8" fill="#f6e7b0" />
      <circle cx="-1.2" cy="-0.05" r="0.38" fill="#1b0d08" />
      <circle cx="1.2" cy="-0.05" r="0.38" fill="#1b0d08" />
      <path d="M-0.55,0.7 Q0,1.35 0.55,0.7" fill="none" stroke="#2a0e08" strokeWidth="0.35" />
      <path d="M-1.9,1.65 Q0,3.0 1.9,1.65 Z" fill="#2a0806" />
      <path d="M-1.15,1.85 L-0.85,2.6 L-0.5,2.0 Z" fill="#fff8e8" />
      <path d="M1.15,1.85 L0.85,2.6 L0.5,2.0 Z" fill="#fff8e8" />
    </g>
  )
}
