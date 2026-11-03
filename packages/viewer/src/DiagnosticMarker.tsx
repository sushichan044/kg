import type { ManuscriptDiagnostic } from "@sushichan044/kg-core";
import type { CSSProperties, RefCallback, RefObject } from "react";

import { DiagnosticHover } from "./DiagnosticHover";

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
    <DiagnosticHover diagnostics={[diagnostic]} container={container}>
      <button
        type="button"
        ref={register}
        className="kgv-diagnostic-trigger"
        style={style}
        aria-label={`${diagnostic.location.start.line}行${diagnostic.location.start.column}列: ${diagnostic.message}`}
        onClick={() => onSelect?.(diagnostic)}
      />
    </DiagnosticHover>
  );
}
