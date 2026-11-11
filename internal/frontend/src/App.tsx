import { TypographyProvider } from "@sushichan044/kg-viewer";
import { startTransition, Suspense, useDeferredValue, useReducer, useState } from "react";
import {
  useLoaderData,
  useNavigate,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router";

import { FileSwitcher } from "./components/FileSwitcher";
import { Sidebar } from "./components/Sidebar";
import { SettingsPanel } from "./components/ViewerControls";
import { loadManuscriptPreferences, saveManuscriptPreferences } from "./lib/storage";
import { manuscriptReducer } from "./manuscript";
import type { ManuscriptAction, ManuscriptState } from "./manuscript";
import { ManuscriptView, TypographyLoading } from "./ManuscriptView";
import { FILE_QUERY_PARAM, searchWithFile } from "./workspace";
import type { Workspace } from "./workspace";

function initialManuscriptState(): ManuscriptState {
  return {
    preferences: loadManuscriptPreferences(),
    activeDiagnosticId: null,
  };
}

export function App() {
  const workspace = useLoaderData<Workspace>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const highlightedPath =
    navigation.location === undefined
      ? (workspace.document?.file.path ?? null)
      : new URLSearchParams(navigation.location.search).get(FILE_QUERY_PARAM);
  const [manuscript, dispatch] = useReducer(manuscriptReducer, undefined, initialManuscriptState);
  // 書体と組版結果は同じ遅延値から作る
  // 片方だけ新しい設定になると、NovelViewer は書体と組版設定の食い違いとしてエラーを表示する
  const composition = useDeferredValue(manuscript.preferences.composition);
  const notation = useDeferredValue(manuscript.preferences.notation);
  // SSE による再検証では navigation は idle のままなので、表示中の原稿は古い扱いにならない
  const pending =
    navigation.state === "loading" ||
    composition !== manuscript.preferences.composition ||
    notation !== manuscript.preferences.notation;
  const [preferenceStatus, setPreferenceStatus] = useState("");
  const status = workspace.status !== "" ? workspace.status : preferenceStatus;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fileSwitcherOpen, setFileSwitcherOpen] = useState(false);

  const commitPreferenceAction = (action: ManuscriptAction) => {
    const next = manuscriptReducer(manuscript, action);
    dispatch(action);
    if (!saveManuscriptPreferences(next.preferences))
      setPreferenceStatus("設定を保存できませんでした");
  };

  const clearDiagnostic = () => {
    dispatch({ kind: "diagnostic.select", id: null });
  };

  const selectFile = (path: string) => {
    clearDiagnostic();
    // Transition が移動の完了まで続くよう、navigate の Promise を返す
    startTransition(() =>
      navigate({ search: searchWithFile(searchParams, path) }, { replace: true }),
    );
  };

  const renderSettings = (idPrefix: string) => (
    <SettingsPanel
      idPrefix={idPrefix}
      onSpreadChange={(spread) => {
        commitPreferenceAction({ kind: "spread.replace", spread });
      }}
      onStartPageSideChange={(startPageSide) => {
        commitPreferenceAction({ kind: "start-page-side.replace", startPageSide });
      }}
      notation={manuscript.preferences.notation}
      composition={manuscript.preferences.composition}
      spread={manuscript.preferences.spread}
      startPageSide={manuscript.preferences.startPageSide}
      showGrid={manuscript.preferences.showGrid}
      status={status}
      onNotationChange={(notation) => {
        commitPreferenceAction({ kind: "notation.replace", notation });
      }}
      onCompositionChange={(composition) => {
        commitPreferenceAction({ kind: "composition.replace", composition });
      }}
      onGridChange={(showGrid) => {
        commitPreferenceAction({ kind: "grid-visibility.replace", showGrid });
      }}
    />
  );

  return (
    <TypographyProvider>
      <div className="app" data-sidebar={sidebarOpen ? "open" : "closed"}>
        <a className="skip-link visually-hidden" href="#preview">
          プレビューへスキップ
        </a>
        <Sidebar files={workspace.files} selectedPath={highlightedPath} onSelect={clearDiagnostic}>
          {renderSettings("desktop-")}
        </Sidebar>

        <main
          id="preview"
          className="preview"
          tabIndex={-1}
          aria-label="プレビュー"
          aria-busy={pending}
          data-pending={pending ? "" : undefined}
        >
          {workspace.document === null ? null : workspace.document.kind === "failed" ? (
            <div className="preview__failure preview__failure--content" role="alert">
              <p>本文を取得できませんでした</p>
              <button
                type="button"
                onClick={() => {
                  startTransition(() => revalidator.revalidate());
                }}
              >
                再読み込み
              </button>{" "}
              <button
                type="button"
                onClick={() => {
                  setFileSwitcherOpen(true);
                }}
              >
                ファイルを選ぶ
              </button>
            </div>
          ) : (
            <Suspense fallback={<TypographyLoading />}>
              <ManuscriptView
                file={workspace.document.file}
                source={workspace.document.source}
                manuscript={manuscript}
                composition={composition}
                notation={notation}
                pending={pending}
                sidebarOpen={sidebarOpen}
                onSidebarToggle={() => {
                  setSidebarOpen((open) => !open);
                }}
                onFilesOpen={() => {
                  setFileSwitcherOpen(true);
                }}
                onDiagnosticSelect={(id) => {
                  dispatch({ kind: "diagnostic.select", id });
                }}
                onPreferenceAction={commitPreferenceAction}
                renderSettings={renderSettings}
              />
            </Suspense>
          )}
        </main>

        <FileSwitcher
          open={fileSwitcherOpen}
          onOpenChange={setFileSwitcherOpen}
          files={workspace.files}
          selectedPath={highlightedPath}
          onSelect={selectFile}
        />
      </div>
    </TypographyProvider>
  );
}
