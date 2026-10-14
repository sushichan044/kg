import type { ReactNode } from "react";

import type { FileEntry } from "../lib/api";

export type FilePanelProps = Readonly<{
  files: readonly FileEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}>;

export function FilePanel({ files, selectedId, onSelect }: FilePanelProps) {
  return (
    <nav className="files" aria-label="ファイル">
      <ul className="file-list">
        {files.map((file) => (
          <li key={file.id}>
            <button
              type="button"
              className="file-list__item"
              aria-current={file.id === selectedId ? "page" : undefined}
              onClick={() => {
                onSelect(file.id);
              }}
            >
              {file.path}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export type SidebarProps = FilePanelProps &
  Readonly<{
    children?: ReactNode;
    status?: string;
  }>;

export function Sidebar({ files, selectedId, onSelect, status, children }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand__name">kg</span>
      </div>
      <FilePanel files={files} selectedId={selectedId} onSelect={onSelect} />
      {children}
      {children === null && status && (
        <p className="status" role="status">
          {status}
        </p>
      )}
    </aside>
  );
}
