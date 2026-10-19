import { createUniqueId } from "solid-js";

/**
 * The göl band: a strip of octagonal motifs from Turkmen carpets, in garnet with white and silver.
 * It is the site's single ornament: the top of every page, and the app icon.
 */
export default function GolBand() {
  const id = `gol-${createUniqueId()}`;
  return (
    <svg class="block h-3.5 w-full text-garnet" aria-hidden="true">
      <defs>
        <pattern id={id} width="28" height="14" patternUnits="userSpaceOnUse">
          <rect width="28" height="14" fill="currentColor" />
          <path d="M8 1.5h12l4.5 3v5L20 12.5H8l-4.5-3v-5z" fill="none" class="stroke-white" stroke-width="1" />
          <path d="M14 4l3.5 3-3.5 3-3.5-3z" class="fill-white" />
          <circle cx="0" cy="7" r="1.2" class="fill-silver" />
          <circle cx="28" cy="7" r="1.2" class="fill-silver" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
