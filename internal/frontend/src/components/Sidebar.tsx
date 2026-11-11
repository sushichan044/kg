import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";

import type { FileEntry } from "../lib/api";
import { searchWithFile } from "../workspace";

export type FilePanelProps = Readonly<{
  files: readonly FileEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}>;

export function FilePanel({ files, selectedPath, onSelect }: FilePanelProps) {
  const [searchParams] = useSearchParams();
  return (
    <nav className="files" aria-label="ファイル">
      <ul className="file-list">
        {files.map((file) => (
          <li key={file.id}>
            <Link
              replace
              to={{ search: searchWithFile(searchParams, file.path) }}
              className="file-list__item"
              aria-label={file.path}
              title={file.path}
              aria-current={file.path === selectedPath ? "page" : undefined}
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
            </Link>
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

export function Sidebar({ files, selectedPath, onSelect, children }: SidebarProps) {
  return (
    <aside className="sidebar" id="workspace-sidebar" aria-label="ワークスペース">
      <div className="brand">
        <span className="brand__name">kg</span>
      </div>
      <details className="sidebar-files" open>
        <summary>
          ファイル <span>{files.length}</span>
        </summary>
        <FilePanel files={files} selectedPath={selectedPath} onSelect={onSelect} />
      </details>
      {children}
    </aside>
  );
}
