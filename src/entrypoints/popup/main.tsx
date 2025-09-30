import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";

import "../style.css";
import { MainPopup } from "../main-popup/MainPopup";
import JobSummarizer from "../job-summarizer/job-summarizer";
import PopupApp from "./popux";
import { ProfileOptimizer } from "../profile-optimizer/ProfileOptimizer";

const router = createHashRouter([
  {
    path: "/",
    element: <PopupApp />,
  },
  {
    path: "job-summarizer",
    element: <JobSummarizer />,
  },
  {
    path: "profile-optimizer",
    element: <ProfileOptimizer />,
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
