import type { ManuscriptDiagnostic } from "@sushichan044/kg-core";
import { useEffect, useId, useRef } from "react";
import type { CSSProperties, RefCallback } from "react";

import { DiagnosticMessage } from "./DiagnosticMessage";

let supportReady: Promise<void> | undefined;

function ensurePopoverSupport() {
  supportReady ??= (async () => {
    if (!("popover" in HTMLElement.prototype)) await import("@oddbird/popover-polyfill");
    if (!("interestForElement" in HTMLButtonElement.prototype)) await import("interestfor");
  })();
  return supportReady;
}

type DiagnosticMarkerProps = Readonly<{
  diagnostic: ManuscriptDiagnostic;
  style: CSSProperties;
  register: RefCallback<HTMLButtonElement>;
  onSelect?: (diagnostic: ManuscriptDiagnostic) => void;
}>;

export function DiagnosticMarker({ diagnostic, style, register, onSelect }: DiagnosticMarkerProps) {
  const id = useId();
  const popupRef = useRef<HTMLDivElement>(null);
  const anchor = `--kgv-diagnostic-${id.replaceAll(":", "")}`;

  useEffect(() => {
    void ensurePopoverSupport().then(() => {
      const popup = popupRef.current;
      if (popup !== null && popup.popover !== "hint") popup.popover = "auto";
    });
  }, []);

  return (
    <>
      <button
        ref={register}
        type="button"
        className="kgv-diagnostic-trigger"
        style={{ ...style, anchorName: anchor }}
        {...{ interestfor: id }}
        popoverTarget={id}
        aria-label={`${diagnostic.location.start.line}行${diagnostic.location.start.column}列: ${diagnostic.message}`}
        onClick={() => {
          onSelect?.(diagnostic);
        }}
      />
      <div
        ref={popupRef}
        id={id}
        popover="hint"
        className="kgv-diagnostic-popover"
        style={{ positionAnchor: anchor }}
      >
        <DiagnosticMessage diagnostic={diagnostic} />
      </div>
    </>
  );
}
