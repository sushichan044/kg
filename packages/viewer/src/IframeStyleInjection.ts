import { structuralStyles } from "./styleSheets";

/**
 * Which stylesheets `IframeIsolation` injects into the isolated document.
 *
 * The viewer needs the structural stylesheet to lay out its grid, so `structural` injects it before
 * any consumer CSS. Use `custom` to take over injection entirely, for example to serve a
 * preprocessed bundle that already includes it.
 */
export type IframeStyleInjection =
  | Readonly<{ kind: "structural"; css?: string | readonly string[] }>
  | Readonly<{ kind: "custom"; css: string | readonly string[] }>;

function cssTexts(css: string | readonly string[] | undefined): readonly string[] {
  if (css === undefined) return [];
  return typeof css === "string" ? [css] : css;
}

export const IframeStyleInjection = {
  defaults: { kind: "structural" } as const satisfies IframeStyleInjection,

  /**
   * Resolves the injection into the CSS text to inject, structural rules first so consumer CSS
   * overrides them.
   */
  toCssText: (injection: IframeStyleInjection): string => {
    switch (injection.kind) {
      case "structural": {
        return [structuralStyles, ...cssTexts(injection.css)].join("\n");
      }
      case "custom": {
        return cssTexts(injection.css).join("\n");
      }
    }
  },
} as const;
