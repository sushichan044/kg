import { createBrowserRouter, Outlet, useRevalidator, useRouteLoaderData } from "react-router";

import { App } from "./App";
import { useServerEvents } from "./hooks/useServerEvents";
import { loadWorkspace, WORKSPACE_ROUTE_ID } from "./workspace";
import type { Workspace } from "./workspace";

// 一覧の取得に失敗すると、子のルートは App の代わりに ErrorBoundary を描画する
// そのあいだも一覧の変更で読み直して復帰できるよう、購読は子ではなく親に置く
function WorkspaceEvents() {
  const revalidator = useRevalidator();
  const selectedId = useRouteLoaderData<Workspace>(WORKSPACE_ROUTE_ID)?.document?.file.id;

  useServerEvents({
    onCatalogChanged: () => {
      void revalidator.revalidate();
    },
    onFileChanged: (id) => {
      if (id === selectedId) void revalidator.revalidate();
    },
  });

  return <Outlet />;
}

function WorkspaceLoading() {
  return (
    <div className="workspace-status">
      <p className="preview__loading">読み込み中…</p>
    </div>
  );
}

function WorkspaceError() {
  const revalidator = useRevalidator();
  return (
    <div className="workspace-status">
      <div className="preview__failure" role="alert">
        <p>ファイル一覧を取得できませんでした</p>
        <button
          type="button"
          onClick={() => {
            void revalidator.revalidate();
          }}
        >
          再読み込み
        </button>
      </div>
    </div>
  );
}

export function createAppRouter() {
  return createBrowserRouter([
    {
      path: "/",
      Component: WorkspaceEvents,
      children: [
        {
          id: WORKSPACE_ROUTE_ID,
          index: true,
          loader: ({ request }) => loadWorkspace(request),
          Component: App,
          HydrateFallback: WorkspaceLoading,
          ErrorBoundary: WorkspaceError,
        },
      ],
    },
  ]);
}
