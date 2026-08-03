import type { NamespacedId } from "../namespaced-id";
import type { ParsedManuscript } from "../parser/parsed-manuscript";

/**
 * A parsed manuscript placed by a composer, kept together with the composer that produced it and
 * the settings it was placed under, so the result is self-contained.
 */
export type ComposedManuscript<TSettings = unknown, TLayout = unknown> = Readonly<{
  composerId: NamespacedId;
  parsed: ParsedManuscript;
  settings: TSettings;
  layout: TLayout;
}>;
