import { replace } from "react-router";

import { fetchContent, fetchFiles } from "./lib/api";
import type { FileEntry } from "./lib/api";
import { loadAppState, saveAppState } from "./lib/storage";

export const WORKSPACE_ROUTE_ID = "workspace";
export const FILE_QUERY_PARAM = "file";

export type Workspace = Readonly<{
  files: readonly FileEntry[];
  selected: FileEntry | null;
  source: string;
  status: string;
}>;

const EMPTY_WORKSPACE: Workspace = { files: [], selected: null, source: "", status: "" };

function resolveSelectedFile(
  files: readonly FileEntry[],
  requestedPath: string | null,
): FileEntry | null {
  const preferredPath =
    requestedPath === null || requestedPath === "" ? loadAppState().selectedPath : requestedPath;
  return files.find((file) => file.path === preferredPath) ?? files[0] ?? null;
}

export async function loadWorkspace(
  request: Request,
  previous: Workspace | undefined,
): Promise<Workspace | Response> {
  // 取得に失敗しても例外にせず、直前の表示を残したまま状態の行で知らせる
  const failed = (status: string): Workspace => ({ ...(previous ?? EMPTY_WORKSPACE), status });

  let files: readonly FileEntry[];
  try {
    files = await fetchFiles();
  } catch {
    return failed("ファイル一覧の取得に失敗しました");
  }
  // 中断された読み込みの結果はルーターが捨てるので、古い一覧で選択を保存しないようここで止める
  if (request.signal.aborted) return failed("");

  const url = new URL(request.url);
  const requestedPath = url.searchParams.get(FILE_QUERY_PARAM);
  const selected = resolveSelectedFile(files, requestedPath);
  if (requestedPath !== (selected?.path ?? null)) {
    if (selected === null) url.searchParams.delete(FILE_QUERY_PARAM);
    else url.searchParams.set(FILE_QUERY_PARAM, selected.path);
    // loader に渡る request の URL はハッシュを落としている
    // このアプリの移動はハッシュを変えないので、いまのハッシュを引き継ぐ
    return replace(`${url.pathname}${url.search}${window.location.hash}`);
  }

  const status = saveAppState({ version: 1, selectedPath: selected?.path ?? null })
    ? ""
    : "選択状態を保存できませんでした";
  if (selected === null) return { files, selected, source: "", status };
  try {
    return { files, selected, source: await fetchContent(selected.id), status };
  } catch {
    return failed("本文の取得に失敗しました");
  }
}
