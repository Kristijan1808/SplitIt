import {syncBills} from "./offlineBills";
const uploadPending=()=>{void syncBills().catch(()=>{})};
window.addEventListener("online",uploadPending);
window.addEventListener("focus",uploadPending);
uploadPending();
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import "./styles/fineLine.css";
import {AppFrame} from "./components/AppFrame";
import {SettingsPage} from "./pages/SettingsPage";
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
    <AppFrame><ApiLoadingOverlay />
    <Routes>
      <Route path="/settings" element={<SettingsPage/>}/>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/new" element={<CreateGroupPage />} />
      <Route path="/join" element={<JoinGroupPage />} />
      <Route path="/my-groups" element={<MyGroupsPage />} />
      <Route path="/subscriptions" element={<SubscriptionsPage />} />
      <Route path="/g/:slug" element={<GroupPage />} />
      <Route path="/g/:slug/add-expense" element={<GroupAddExpensePage />} />
    </Routes></AppFrame>
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
import "./styles/desktopReceiptLayout.css";
