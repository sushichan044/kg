import structural from "./structural.css?inline";
import theme from "./theme.css?inline";

/**
 * The structural stylesheet as text, for injecting into documents a `<link>` cannot reach — a
 * sandboxed iframe, a shadow root, or a server-rendered `<style>`.
 */
export const structuralStyles: string = structural;

/**
 * The default theme as text. Pair it with {@link structuralStyles} to reproduce the built-in look,
 * or leave it out and style the documented contract instead.
 */
export const themeStyles: string = theme;
