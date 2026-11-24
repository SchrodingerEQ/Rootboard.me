/**
 * CSS values that follow the theme's shape block (manifest v2,
 * docs/decisions/0026). Each one is the app's own value times a theme
 * multiplier set on `:root` by the theme engine, so Default (both at 1)
 * renders exactly the pixels it did before shape tokens existed.
 *
 * Use these for the corners of cards, cells, panels, dialogs and fields,
 * and for the blur of card shadows. Pills (999) and circles (50%) stay
 * round and do not use them; nothing here may change a size.
 */

/** A corner radius of `px` at Default, scaled by the theme's `radiusScale`. */
export function themeRadius(px: number): string {
  return `calc(${px}px * var(--rb-radius-scale))`;
}

/** A drop shadow whose blur is scaled by the theme's `shadowSoftness`;
 *  `colorToken` is one of the `--rb-shadow-*` colour tokens. */
export function themeShadow(offsetY: number, blur: number, colorToken: string): string {
  return `0 ${offsetY}px calc(${blur}px * var(--rb-shadow-softness)) var(${colorToken})`;
}
