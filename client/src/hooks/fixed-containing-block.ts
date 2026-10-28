/** The subset of computed style that can make an ancestor the containing block for `position: fixed`. */
export interface ContainingBlockStyle {
  transform?: string;
  translate?: string;
  scale?: string;
  rotate?: string;
  perspective?: string;
  filter?: string;
  backdropFilter?: string;
  webkitBackdropFilter?: string;
  contain?: string;
  willChange?: string;
}

const isSet = (value: string | undefined): boolean => !!value && value !== "none";

/**
 * True when an element with this computed style establishes a containing block for fixed
 * descendants. Besides `transform`, the individual `translate` / `scale` / `rotate`
 * properties count too: Tailwind v4's `translate-x-[-50%]` sets `translate:` (not
 * `transform:`), which is how the centred Dialog becomes a containing block.
 */
export function establishesFixedContainingBlock(style: ContainingBlockStyle): boolean {
  return (
    isSet(style.transform) ||
    isSet(style.translate) ||
    isSet(style.scale) ||
    isSet(style.rotate) ||
    isSet(style.perspective) ||
    isSet(style.filter) ||
    isSet(style.backdropFilter) ||
    isSet(style.webkitBackdropFilter) ||
    /paint|layout|strict|content/.test(style.contain ?? "") ||
    /transform|perspective|filter|translate|scale|rotate/.test(style.willChange ?? "")
  );
}
