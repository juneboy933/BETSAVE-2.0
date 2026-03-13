"use client";

export const ADMIN_DASHBOARD_POLL_INTERVAL_MS = 30000;

export const attachVisiblePolling = (task, intervalMs = ADMIN_DASHBOARD_POLL_INTERVAL_MS) => {
  if (typeof task !== "function") {
    return () => {};
  }

  const runTask = () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    task();
  };

  runTask();

  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const intervalId = window.setInterval(runTask, intervalMs);
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      task();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    window.clearInterval(intervalId);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
};
