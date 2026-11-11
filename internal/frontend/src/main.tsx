import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";

import { createAppRouter } from "./router";

import "@sushichan044/kg-viewer/styles.css";
import "./styles/index.css";

const root = document.querySelector("#root");
if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={createAppRouter()} useTransitions />
    </StrictMode>,
  );
}
