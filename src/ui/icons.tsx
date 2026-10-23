// Small inline icon set (Material-style 24px grid), coloured with currentColor.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const CarIcon = (p: P) => (
  <Svg {...p}>
    <path d="M18.9 6c-.2-.6-.8-1-1.4-1h-11c-.7 0-1.2.4-1.4 1L3 12v8c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-1h12v1c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-8l-2.1-6zM6.9 7h10.3l1.1 3.2H5.7L6.9 7zM6.5 16a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
  </Svg>
);

export const TrainIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 2c-4 0-8 .5-8 4v9.5A3.5 3.5 0 0 0 7.5 19L6 20.5v.5h2.2l2-2h3.6l2 2H18v-.5L16.5 19a3.5 3.5 0 0 0 3.5-3.5V6c0-3.5-3.6-4-8-4zM7.5 17a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM11 10H6V6h5v4zm2 0V6h5v4h-5zm3.5 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
  </Svg>
);

export const BusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 16c0 .9.4 1.7 1 2.2V20c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-1h8v1c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-1.8c.6-.5 1-1.3 1-2.2V6c0-3.5-3.6-4-8-4S4 2.5 4 6v10zm3.5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm1.5-6H6V6h12v5z" />
  </Svg>
);

export const GasIcon = (p: P) => (
  <Svg {...p}>
    <path d="m19.8 7.2-3.7-3.7-1 1.1 2.1 2.1A2.5 2.5 0 0 0 18.5 12c.4 0 .7-.1 1-.2v7.2a1 1 0 0 1-2 0v-4.5c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6.5c-1.1 0-2 .9-2 2v16h10v-7.5H16V19a2.5 2.5 0 0 0 5 0V9.5c0-.7-.3-1.3-.7-1.8l-.5-.5zM12.5 10h-6V5h6v5zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
  </Svg>
);

export const PersonIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z" />
  </Svg>
);

export const InfoIcon = (p: P) => (
  <Svg {...p}>
    <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />
  </Svg>
);

export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
  </Svg>
);

export const ChevronIcon = ({ up, ...p }: P & { up?: boolean }) => (
  <Svg {...p} style={{ transform: up ? "rotate(180deg)" : undefined, transition: "transform .15s" }}>
    <path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z" />
  </Svg>
);

export const MinimizeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 19h12v2H6z" />
  </Svg>
);

export const MoreIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
  </Svg>
);

export const GearIcon = (p: P) => (
  <Svg {...p}>
    <path d="M19.1 12.9a7 7 0 0 0 0-1.8l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.6-.9L14.8 3h-4l-.4 2.6c-.6.2-1.1.5-1.6.9l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 1.8l-2 1.6 2 3.4 2.4-1c.5.4 1 .7 1.6.9l.4 2.6h4l.4-2.6c.6-.2 1.1-.5 1.6-.9l2.4 1 2-3.4-2.1-1.6zM12.8 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />
  </Svg>
);

/** The Triway mark: one start, three ways. Matches assets/icon.svg. */
export function Logo({ size = 24 }: { size?: number }) {
  const id = `tw-g-${size}`;
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12b5b0" />
          <stop offset="1" stopColor="#1a73e8" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="120" height="120" rx="28" fill={`url(#${id})`} />
      <g fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round">
        <path d="M64 98V70M64 70C64 52 36 54 36 36M64 70V34M64 70C64 52 92 54 92 36" />
      </g>
      <g fill="#fff">
        <circle cx="36" cy="32" r="9" />
        <circle cx="64" cy="30" r="9" />
        <circle cx="92" cy="32" r="9" />
        <circle cx="64" cy="100" r="11" />
      </g>
      <circle cx="64" cy="100" r="5" fill="#1a73e8" />
    </svg>
  );
}
