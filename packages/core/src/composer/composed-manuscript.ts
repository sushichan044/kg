import type { NamespacedId } from "../namespaced-id";
import type { ParsedManuscript } from "../parser/parsed-manuscript";

/**
 * パース済みの原稿をコンポーザーが配置した結果。
 * 生成したコンポーザーと配置に使った設定を一緒に持ち、結果だけで完結するようにする。
 */
export type ComposedManuscript<TSettings = unknown, TLayout = unknown> = Readonly<{
  composerId: NamespacedId;
  parsed: ParsedManuscript;
  settings: TSettings;
  layout: TLayout;
}>;
