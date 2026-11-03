interface IconProps {
  size?: number;
}

function Svg({
  size = 16,
  children,
  className,
}: IconProps & { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export function PlayIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M3 2.2c0-.9 1-1.4 1.7-.9l9 5.8c.6.4.6 1.3 0 1.7l-9 5.8c-.7.5-1.7 0-1.7-.9V2.2z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function PauseIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3" y="2" width="4" height="12" rx="1" fill="currentColor" />
      <rect x="9" y="2" width="4" height="12" rx="1" fill="currentColor" />
    </Svg>
  );
}

export function PrevIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="2" y="2" width="2" height="12" fill="currentColor" />
      <path
        d="M13 2.6c0-.8-.9-1.2-1.5-.8l-7 5.4c-.5.4-.5 1.2 0 1.6l7 5.4c.6.4 1.5 0 1.5-.8V2.6z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function NextIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="12" y="2" width="2" height="12" fill="currentColor" />
      <path
        d="M3 2.6c0-.8.9-1.2 1.5-.8l7 5.4c.5.4.5 1.2 0 1.6l-7 5.4c-.6.4-1.5 0-1.5-.8V2.6z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function VolumeIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M2 6h2.5L8 3v10L4.5 10H2V6z" fill="currentColor" />
      <path
        d="M10.5 5.5a3.5 3.5 0 0 1 0 5"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function QueueIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M2 4h9M2 8h9M2 12h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M11.5 9.6v4.2l3-2.1-3-2.1z" fill="currentColor" />
    </Svg>
  );
}

export function CloseIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M3.5 3.5l9 9M12.5 3.5l-9 9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export function SpinnerIcon({ size }: IconProps) {
  return (
    <Svg size={size} className="spinner">
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="28 10"
      />
    </Svg>
  );
}

/** The product mark: one cycle of a sine wave. */
export function WaveMark({ size = 22 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 12"
      width={size}
      height={size / 2}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M1 6c2.5-6 5-6 7.5 0s5 6 7.5 0 5-6 7.5 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
