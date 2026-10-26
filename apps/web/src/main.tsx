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
import { LoginPage } from "./pages/LoginPage";
import { SubscriptionsPage } from "./pages/SubscriptionsPage";
import { ApiLoadingOverlay } from "./components/ApiLoadingOverlay";

const App = () => (
  <BrowserRouter>
    <ApiLoadingOverlay />
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/new" element={<CreateGroupPage />} />
      <Route path="/join" element={<JoinGroupPage />} />
      <Route path="/my-groups" element={<MyGroupsPage />} />
      <Route path="/subscriptions" element={<SubscriptionsPage />} />
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