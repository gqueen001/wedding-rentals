import type { JSX } from "solid-js";

interface IconProps {
  class?: string;
}

function Svg(props: IconProps & { children: JSX.Element }) {
  return (
    <svg
      class={props.class ?? "h-5 w-5"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

export function HeartIcon(props: IconProps & { filled?: boolean }) {
  return (
    <Svg class={props.class}>
      <path
        d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"
        fill={props.filled ? "currentColor" : "none"}
      />
    </Svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
);

export const FilterIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M4 7h16M7 12h10M10 17h4" />
  </Svg>
);

export const PhoneIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </Svg>
);

export const ShareIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="m15 6-6 6 6 6" />
  </Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const InstagramIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none" />
  </Svg>
);

export const TikTokIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 2.6 2.4 4.4 5 4.6" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const HomeIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />
  </Svg>
);

export const GridIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <rect x="4" y="4" width="7" height="7" />
    <rect x="13" y="4" width="7" height="7" />
    <rect x="4" y="13" width="7" height="7" />
    <rect x="13" y="13" width="7" height="7" />
  </Svg>
);

export const MoreIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <circle cx="5" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="19" cy="12" r="1.4" />
  </Svg>
);

export const UserIcon = (p: IconProps) => (
  <Svg class={p.class}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Svg>
);
