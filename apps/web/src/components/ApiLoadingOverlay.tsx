import "../styles/apiLoadingOverlay.css";
import { useApiLoading } from "../loading";

export const ApiLoadingOverlay = () => {
  const loading = useApiLoading();

  if (!loading) {
    return null;
  }

  return (
    <div
      className="screenLoader"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="spinner large" />
      <p className="loadingTitle">...</p>
    </div>
  );
};
