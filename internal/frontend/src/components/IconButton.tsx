import { Tooltip } from "@base-ui/react/tooltip";
import type { ComponentProps } from "react";

type IconButtonProps = Omit<ComponentProps<"button">, "aria-label"> & {
  label: string;
  shortcut?: string;
};

export function IconButton({ label, shortcut, children, className, ...props }: IconButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<button type="button" {...props} />}
        className={["icon-button", className].filter(Boolean).join(" ")}
        aria-label={label}
        delay={400}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner className="toolbar-tooltip-positioner" sideOffset={6}>
          <Tooltip.Popup className="toolbar-tooltip" role="tooltip">
            {label}
            {shortcut && <kbd>{shortcut}</kbd>}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
