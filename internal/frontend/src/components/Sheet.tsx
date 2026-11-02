import { useEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";

export type MobileSheet = "files" | "settings" | "diagnostics" | null;

type SheetProps = Readonly<{
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}>;

export function Sheet({ open, title, children, onClose }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const dismissBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) event.currentTarget.close();
  };

  return (
    <dialog
      ref={ref}
      className="mobile-sheet"
      aria-label={title}
      onClose={onClose}
      onClick={dismissBackdrop}
    >
      <header className="mobile-sheet__header">
        <h2>{title}</h2>
        <button type="button" aria-label={`${title}を閉じる`} onClick={() => ref.current?.close()}>
          閉じる
        </button>
      </header>
      <div className="mobile-sheet__body">{children}</div>
    </dialog>
  );
}
