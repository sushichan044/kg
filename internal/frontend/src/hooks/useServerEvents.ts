import { useEffect, useEffectEvent } from "react";
import * as v from "valibot";

export type ServerEventHandlers = Readonly<{
  // onCatalogChanged は、ファイル一覧を取得し直すべきときに呼ばれる。
  onCatalogChanged: () => void;
  // onFileChanged は、内容が変わったファイルの ID を渡して呼ばれる。
  onFileChanged: (id: string) => void;
}>;

const StartedEventSchema = v.object({ pid: v.number() });
const FileChangedEventSchema = v.object({ id: v.string() });

/**
 * SSE のペイロードはネットワークから届いたただのテキストなので、
 * 宣言された形を信用せずにパースする。
 */
function parseEvent<TSchema extends v.GenericSchema>(
  schema: TSchema,
  data: string,
): v.InferOutput<TSchema> | undefined {
  try {
    const result = v.safeParse(schema, JSON.parse(data));
    return result.success ? result.output : undefined;
  } catch {
    return undefined;
  }
}

// useServerEvents はサーバーの SSE ストリームを購読する。
// サーバープロセスが入れ替わると（`started` イベントの PID が新しくなると）ページを再読み込みする。
// これにより、バイナリーを再ビルドするとブラウザーが自動で更新される。
export function useServerEvents(handlers: ServerEventHandlers): void {
  const onCatalogChanged = useEffectEvent(() => {
    handlers.onCatalogChanged();
  });
  const onFileChanged = useEffectEvent((id: string) => {
    handlers.onFileChanged(id);
  });

  useEffect(() => {
    const source = new EventSource("/_/events");
    let knownPID: string | null = null;

    source.addEventListener("started", (e) => {
      const started = parseEvent(StartedEventSchema, e.data);
      if (started === undefined) return;
      const id = String(started.pid);
      if (knownPID !== null && knownPID !== id) {
        window.location.reload();

        return;
      }
      knownPID = id;
    });

    source.addEventListener("update", () => {
      onCatalogChanged();
    });

    source.addEventListener("file-changed", (e) => {
      const changed = parseEvent(FileChangedEventSchema, e.data);
      if (changed !== undefined) onFileChanged(changed.id);
    });

    return () => {
      source.close();
    };
  }, []);
}
