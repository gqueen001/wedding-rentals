import type { Color } from "../lib/types.ts";

const SWATCH: Record<Color, string> = {
  white: "#ffffff",
  ivory: "#f6f0e1",
  champagne: "#ead7b7",
  blush: "#f1d3d3",
  other: "conic-gradient(#f1d3d3, #ead7b7, #d9dce1, #f1d3d3)",
};

export default function ColorSwatch(props: { color: Color }) {
  return (
    <span
      aria-hidden="true"
      class="inline-block h-4 w-4 shrink-0 rounded-full border border-silver"
      style={{ background: SWATCH[props.color] }}
    />
  );
}
