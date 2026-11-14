import { createSearchParams, replace } from "react-router";

import { fetchContent, fetchFiles } from "./lib/api";
import type { FileEntry } from "./lib/api";
import { loadAppState, saveAppState } from "./lib/storage";

export const WORKSPACE_ROUTE_ID = "workspace";
export const FILE_QUERY_PARAM = "file";

type WorkspaceDocument =
  | Readonly<{ kind: "loaded"; file: FileEntry; source: string }>
  | Readonly<{ kind: "failed"; file: FileEntry }>;

export type Workspace = Readonly<{
  files: readonly FileEntry[];
  // null は一覧が空で、開けるファイルが無いことを表す
  document: WorkspaceDocument | null;
  // 選択の保存に失敗したときだけ入る
  status: string;
}>;

export function searchWithFile(params: URLSearchParams, path: string): string {
  const next = createSearchParams(params);
  next.set(FILE_QUERY_PARAM, path);
  return `?${next.toString()}`;
}

function resolveSelectedFile(
  files: readonly FileEntry[],
  requestedPath: string | null,
): FileEntry | null {
  const preferredPath =
    requestedPath === null || requestedPath === "" ? loadAppState().selectedPath : requestedPath;
  return files.find((file) => file.path === preferredPath) ?? files[0] ?? null;
}

export async function loadWorkspace(request: Request): Promise<Workspace | Response> {
  // 一覧を取得できないときは例外のまま投げ、ルートの ErrorBoundary に表示を任せる
  const files = await fetchFiles();
  // 中断された読み込みの結果はルーターが捨てるので、古い一覧で選択を保存しないようここで止める
  request.signal.throwIfAborted();

  const url = new URL(request.url);
  const requestedPath = url.searchParams.get(FILE_QUERY_PARAM);
  const selected = resolveSelectedFile(files, requestedPath);
  if (requestedPath !== (selected?.path ?? null)) {
    if (selected === null) url.searchParams.delete(FILE_QUERY_PARAM);
    else url.searchParams.set(FILE_QUERY_PARAM, selected.path);
    return replace(`${url.pathname}${url.search}`);
  }

  const status = saveAppState({ version: 1, selectedPath: selected?.path ?? null })
    ? ""
    : "選択状態を保存できませんでした";
  if (selected === null) return { files, document: null, status };
  try {
    return {
      files,
      document: { kind: "loaded", file: selected, source: await fetchContent(selected.id) },
      status,
    };
  } catch {
    return { files, document: { kind: "failed", file: selected }, status };
  }
}
