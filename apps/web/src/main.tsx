import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import { HomePage } from "./pages/HomePage";
import { CreateGroupPage } from "./pages/CreateGroupPage";
import { GroupPage } from "./pages/GroupPage";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/new" element={<CreateGroupPage />} />
        <Route path="/g/:slug" element={<GroupPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
