import "../styles/apiLoadingOverlay.css";
import { useApiLoading } from "../loading";
import { useToastNotification } from "../notifications";

export const ApiLoadingOverlay = () => {
  const loading = useApiLoading();
  const toast = useToastNotification();

  if (!loading && !toast) {
    return null;
  }

  return (
    <>
      {loading && (
        <div
          className="screenLoader"
          role="status"
          aria-live="polite"
          aria-label="Loading"
        >
          <div className="spinner large" />
          <p className="loadingTitle">...</p>
        </div>
      )}
      {toast && (
        <div key={toast.id} className="toastError" role="alert" aria-live="assertive">
          {toast.message}
        </div>
      )}
    </>
  );
};
