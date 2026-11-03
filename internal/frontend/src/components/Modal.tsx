import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";

type ModalProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  className: string;
  children: ReactNode;
}>;

export function Modal({ open, onOpenChange, title, className, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal className="modal-portal">
        <Dialog.Backdrop className="modal-backdrop" />
        <Dialog.Popup className={className} aria-label={title} initialFocus>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
