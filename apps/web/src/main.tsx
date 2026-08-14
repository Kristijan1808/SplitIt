import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import { HomePage } from "./pages/HomePage";
import { CreateGroupPage } from "./pages/CreateGroupPage";
import { JoinGroupPage } from "./pages/JoinGroupPage";
import { MyGroupsPage } from "./pages/MyGroupsPage";
import { GroupPage } from "./pages/GroupPage";
import { GroupAddExpensePage } from "./pages/GroupAddExpensePage";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/new" element={<CreateGroupPage />} />
      <Route path="/join" element={<JoinGroupPage />} />
      <Route path="/my-groups" element={<MyGroupsPage />} />
      <Route path="/g/:slug" element={<GroupPage />} />
      <Route path="/g/:slug/add-expense" element={<GroupAddExpensePage />} />
    </Routes>
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);