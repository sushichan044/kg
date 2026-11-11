import { createBrowserRouter } from "react-router";

import { App } from "./App";
import { loadWorkspace, WORKSPACE_ROUTE_ID } from "./workspace";
import type { Workspace } from "./workspace";

// 子の loader が終わるまで親の App を描画させるには、子に HydrateFallback が要る
// 無いと初回の読み込み中はルート全体が描画されず、SSE の購読と書体の読み込みが遅れる
function WorkspaceFallback() {
  return null;
}

export function createAppRouter() {
  let committed: Workspace | undefined;
  const router = createBrowserRouter([
    {
      path: "/",
      Component: App,
      children: [
        {
          id: WORKSPACE_ROUTE_ID,
          index: true,
          loader: ({ request }) => loadWorkspace(request, committed),
          HydrateFallback: WorkspaceFallback,
        },
      ],
    },
  ]);
  // 初回の読み込みは createBrowserRouter の中で始まるので、loader から router を参照できない
  // 取得に失敗したときに返す直前の結果は、反映された state から写しておく
  router.subscribe((state) => {
    committed = state.loaderData[WORKSPACE_ROUTE_ID];
  });
  return router;
}
