import { useEffect, useRef } from "react";

export interface ServerEventHandlers {
  // onCatalogChanged fires when the file list should be refetched.
  onCatalogChanged: () => void;
  // onFileChanged fires with the ID of a file whose content changed.
  onFileChanged: (id: string) => void;
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
      const { pid } = JSON.parse(e.data) as { pid: number };
      const id = String(pid);
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
      const { id } = JSON.parse(e.data) as { id: string };
      ref.current.onFileChanged(id);
    });

    return () => {
      source.close();
    };
  }, []);
}
