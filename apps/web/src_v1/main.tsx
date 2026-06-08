import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import { HomePage } from "./pages/HomePage";
import { CreateGroupPage } from "./pages/CreateGroupPage";
import { GroupPage } from "./pages/GroupPage";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 2500;

const App = () => {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    const checkHealth = async (currentAttempt: number) => {
      try {
        const response = await fetch(`${API_URL}/health`);

        if (response.ok) {
          if (!cancelled) setStatus("ready");
          return;
        }

        throw new Error("Server health check failed");
      } catch {
        if (cancelled) return;

        if (currentAttempt >= MAX_RETRIES) {
          setStatus("failed");
          return;
        }

        setAttempt(currentAttempt + 1);

        timeoutId = window.setTimeout(() => {
          checkHealth(currentAttempt + 1);
        }, RETRY_DELAY_MS);
      }
    }

    checkHealth(1);

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  if (status === "loading") {
    return (
      <main className="page">
        <section className="loadingScreen">
          <div className="spinner" />
          <p className="eyebrow">Starting SplitIt</p>
          <h1>Fetching data...</h1>
          <p className="muted">
            Connecting to the server. Attempt {attempt} of {MAX_RETRIES}.
          </p>
        </section>
      </main>
    );
  }

  if (status === "failed") {
    return (
      <main className="page">
        <section className="loadingScreen">
          <p className="eyebrow">Server unavailable</p>
          <h1>Sorry, server data didn’t load yet.</h1>
          <p className="muted">Try again by refreshing the page.</p>
          <button className="primaryButton" onClick={() => window.location.reload()}>
            Refresh page
          </button>
        </section>
      </main>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/new" element={<CreateGroupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/g/:slug" element={<GroupPage />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);