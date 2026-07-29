import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

import "@sushichan044/kg-viewer/styles.css";
import "./styles/index.css";

const root = document.querySelector("#root");
if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
