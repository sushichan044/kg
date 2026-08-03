import { useEffect, useRef } from "react";
import * as v from "valibot";

export type ServerEventHandlers = Readonly<{
  // onCatalogChanged fires when the file list should be refetched.
  onCatalogChanged: () => void;
  // onFileChanged fires with the ID of a file whose content changed.
  onFileChanged: (id: string) => void;
}>;

const StartedEventSchema = v.object({ pid: v.number() });
const FileChangedEventSchema = v.object({ id: v.string() });

/**
 * SSE payloads are text off the wire; parse them rather than trusting their declared shape.
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

// useServerEvents subscribes to the server's SSE stream. It reloads the page
// when the server process is replaced (a new PID in the `started` event), so a
// rebuilt binary refreshes the browser automatically.
export function useServerEvents(handlers: ServerEventHandlers): void {
  const ref = useRef(handlers);

  useEffect(() => {
    ref.current = handlers;
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
      ref.current.onCatalogChanged();
    });

    source.addEventListener("file-changed", (e) => {
      const changed = parseEvent(FileChangedEventSchema, e.data);
      if (changed !== undefined) ref.current.onFileChanged(changed.id);
    });

    return () => {
      source.close();
    };
  }, []);
}
