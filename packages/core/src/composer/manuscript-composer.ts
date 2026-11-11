import type * as v from "valibot";

import type { ParsedManuscript } from "../parser/parsed-manuscript";
import type { ManuscriptResult } from "../result/manuscript-result";
import type { Rejection } from "../result/rejection";

/**
 * すべてのコンポーザーが実装する契約。二つのスキーマにより、
 * core はプラグインの設定とレイアウトを実行時に検査できる。core 自身はどちらの形も調べない。
 *
 * コンポーザーが返すのはレイアウトだけだ。実行時の設定は core がすでに検証したものなので、
 * 両者が食い違うことはない。
 */
export type ManuscriptComposer<TSettings, TLayout> = Readonly<{
  id: string;
  settingsSchema: v.GenericSchema<unknown, TSettings>;
  layoutSchema: v.GenericSchema<unknown, TLayout>;
  compose: (
    manuscript: ParsedManuscript,
    settings: TSettings,
  ) => ManuscriptResult<TLayout, Rejection>;
}>;
