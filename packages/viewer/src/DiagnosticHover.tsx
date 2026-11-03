import { Tooltip } from "@base-ui/react/tooltip";
import type { ManuscriptDiagnostic } from "@sushichan044/kg-core";
import type { ReactElement, RefObject } from "react";

import { DiagnosticMessage } from "./DiagnosticMessage";

export function DiagnosticHover({
  diagnostics,
  container,
  children,
}: Readonly<{
  diagnostics: readonly ManuscriptDiagnostic[];
  container: RefObject<HTMLDivElement | null>;
  children: ReactElement;
}>) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} delay={250} closeDelay={400} closeOnClick={false} />
      <Tooltip.Portal container={container}>
        <Tooltip.Positioner
          className="kgv-diagnostic-positioner"
          side="left"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "none" }}
        >
          <Tooltip.Popup className="kgv-diagnostic-popover" role="tooltip" aria-label="診断">
            {diagnostics.map((diagnostic) => (
              <DiagnosticMessage key={diagnostic.id} diagnostic={diagnostic} />
            ))}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
