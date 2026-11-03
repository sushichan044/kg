import { Popover } from "@base-ui/react/popover";
import type { ManuscriptDiagnostic } from "@sushichan044/kg-core";
import type { CSSProperties, RefCallback, RefObject } from "react";

import { DiagnosticMessage } from "./DiagnosticMessage";

type DiagnosticMarkerProps = Readonly<{
  diagnostic: ManuscriptDiagnostic;
  style: CSSProperties;
  register: RefCallback<HTMLButtonElement>;
  container: RefObject<HTMLDivElement | null>;
  onSelect?: (diagnostic: ManuscriptDiagnostic) => void;
}>;

export function DiagnosticMarker({
  diagnostic,
  style,
  register,
  container,
  onSelect,
}: DiagnosticMarkerProps) {
  return (
    <Popover.Root>
      <Popover.Trigger
        ref={register}
        className="kgv-diagnostic-trigger"
        style={style}
        openOnHover
        delay={250}
        closeDelay={400}
        aria-label={`${diagnostic.location.start.line}行${diagnostic.location.start.column}列: ${diagnostic.message}`}
        onClick={() => onSelect?.(diagnostic)}
      />
      <Popover.Portal container={container}>
        <Popover.Positioner
          className="kgv-diagnostic-positioner"
          sideOffset={4}
          align="start"
          collisionPadding={12}
        >
          <Popover.Popup className="kgv-diagnostic-popover" aria-label="診断" initialFocus={false}>
            <DiagnosticMessage diagnostic={diagnostic} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
