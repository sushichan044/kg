import { Command } from "cmdk";
import { useEffect, useRef } from "react";

import type { FilePanelProps } from "./Sidebar";

type FileSwitcherProps = FilePanelProps &
  Readonly<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }>;

export function FileSwitcher({
  files,
  selectedId,
  onSelect,
  open,
  onOpenChange,
}: FileSwitcherProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        event.repeat ||
        event.altKey ||
        event.key.toLowerCase() !== "k" ||
        !(event.metaKey || event.ctrlKey)
      )
        return;
      event.preventDefault();
      onOpenChange(!open);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <dialog
      ref={dialogRef}
      className="file-switcher"
      aria-label="ファイルを開く"
      onClose={() => {
        onOpenChange(false);
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          event.currentTarget.close();
      }}
    >
      {open && (
        <Command label="ファイル名を検索" loop>
          <Command.Input autoFocus placeholder="ファイル名を検索…" aria-label="ファイル名を検索" />
          <Command.List label="ファイルの候補">
            <Command.Empty>一致するファイルがありません</Command.Empty>
            {files.map((file) => (
              <Command.Item
                key={file.id}
                value={file.path}
                onSelect={() => {
                  onSelect(file.id);
                  onOpenChange(false);
                }}
              >
                <span>{file.path}</span>
                {file.id === selectedId && <span className="file-current">表示中</span>}
              </Command.Item>
            ))}
          </Command.List>
          <div className="command-footer">
            <span>↑ ↓ 選択</span>
            <span>Enter 開く</span>
            <button
              type="button"
              onClick={() => {
                dialogRef.current?.close();
              }}
            >
              閉じる Esc
            </button>
          </div>
        </Command>
      )}
    </dialog>
  );
}
