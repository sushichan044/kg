import type { ReactNode } from "react";

import type { FileEntry } from "../lib/api";

export type FilePanelProps = Readonly<{
  files: readonly FileEntry[];
  selectedId: string | null;
  onSelect: (path: string) => void;
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
              aria-label={file.path}
              title={file.path}
              aria-current={file.id === selectedId ? "page" : undefined}
              onClick={() => {
                onSelect(file.path);
              }}
            >
              <span className="file-name">{file.path.split("/").at(-1)}</span>
              {file.path.includes("/") ? (
                <span className="file-directory">
                  {file.path.slice(0, file.path.lastIndexOf("/"))}
                </span>
              ) : null}
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
  }>;

export function Sidebar({ files, selectedId, onSelect, children }: SidebarProps) {
  return (
    <aside className="sidebar" id="workspace-sidebar" aria-label="ワークスペース">
      <div className="brand">
        <span className="brand__name">kg</span>
      </div>
      <details className="sidebar-files" open>
        <summary>
          ファイル <span>{files.length}</span>
        </summary>
        <FilePanel files={files} selectedId={selectedId} onSelect={onSelect} />
      </details>
      {children}
    </aside>
  );
}
