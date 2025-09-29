import React from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import { ExtensionPopup } from "./popux";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ExtensionPopup />
  </React.StrictMode>
);
