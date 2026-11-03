import { Dialog } from "@base-ui/react/dialog";
import { Command } from "cmdk";
import { useEffect } from "react";

import { Modal } from "./Modal";
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
    <Modal open={open} onOpenChange={onOpenChange} title="ファイルを開く" className="file-switcher">
      {open && (
        <Command label="ファイル名を検索" loop>
          <Command.Input placeholder="ファイル名を検索…" aria-label="ファイル名を検索" />
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
            <Dialog.Close>閉じる Esc</Dialog.Close>
          </div>
        </Command>
      )}
    </Modal>
  );
}
