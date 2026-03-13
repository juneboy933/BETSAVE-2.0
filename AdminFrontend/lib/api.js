"use client";

const DEFAULT_API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
const DEFAULT_ADMIN_MODE = "live";
const ADMIN_SESSION_FLAG = "admin_session_active";
const ADMIN_RATE_LIMIT_BACKOFF_MS = 30000;
let adminDashboardToken = ""; // in-memory only; browser session auth relies on httpOnly cookies
let adminDashboardRateLimitedUntil = 0;
const canUseStorage = () => typeof window !== "undefined" && typeof localStorage !== "undefined";
const canUseSessionStorage = () => typeof window !== "undefined" && typeof sessionStorage !== "undefined";
const normalizeApiBase = (value) => String(value || DEFAULT_API).trim().replace(/\/+$/, "");

const buildRequestUrl = (path) => {
  const safePath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
  return `${normalizeApiBase(getApiBase())}${safePath}`;
};

export const getApiBase = () =>
  normalizeApiBase((canUseStorage() ? localStorage.getItem("admin_api_base") : null) || DEFAULT_API);
export const setApiBase = (value) => {
  if (!canUseStorage()) return;
  localStorage.setItem("admin_api_base", normalizeApiBase(value));
};
export const getAdminToken = () => adminDashboardToken;
export const setAdminToken = (token) => {
  adminDashboardToken = String(token || "").trim();
  markAdminSessionActive();
};
export const markAdminSessionActive = () => {
  if (!canUseSessionStorage()) return;
  sessionStorage.setItem(ADMIN_SESSION_FLAG, "1");
};
export const hasAdminToken = () =>
  Boolean(getAdminToken()) || (canUseSessionStorage() && sessionStorage.getItem(ADMIN_SESSION_FLAG) === "1");
export const getAdminOperatingMode = () => {
  const mode = (canUseStorage() ? localStorage.getItem("admin_operating_mode") : null) || DEFAULT_ADMIN_MODE;
  return String(mode).trim().toLowerCase() === "demo" ? "demo" : "live";
};
export const setAdminOperatingMode = (mode) => {
  if (!canUseStorage()) return;
  const normalized = String(mode || "").trim().toLowerCase() === "demo" ? "demo" : "live";
  localStorage.setItem("admin_operating_mode", normalized);
};
export const clearAdminToken = () => {
  adminDashboardToken = "";
  if (canUseSessionStorage()) {
    sessionStorage.removeItem(ADMIN_SESSION_FLAG);
  }
  if (canUseStorage()) {
    localStorage.removeItem("admin_operating_mode");
  }
};

const withAdminOperatingMode = (path) => {
  const normalizedPath = String(path || "");
  if (!normalizedPath.startsWith("/api/v1/dashboard/admin/")) {
    return normalizedPath;
  }

  const mode = getAdminOperatingMode();
  if (normalizedPath.includes("operatingMode=")) {
    return normalizedPath;
  }

  return normalizedPath.includes("?")
    ? `${normalizedPath}&operatingMode=${encodeURIComponent(mode)}`
    : `${normalizedPath}?operatingMode=${encodeURIComponent(mode)}`;
};

const isAdminDashboardRequest = (path) => String(path || "").startsWith("/api/v1/dashboard/admin/");

const sanitizeHeaders = (headers) => {
  const normalizedHeaders = new Headers(headers || {});
  normalizedHeaders.delete("x-admin-token");
  return normalizedHeaders;
};

export async function request(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const resolvedPath = method === "GET" ? withAdminOperatingMode(path) : String(path || "");
  const isDashboardRequest = isAdminDashboardRequest(resolvedPath || path);

  if (isDashboardRequest && adminDashboardRateLimitedUntil > Date.now()) {
    const retryInSeconds = Math.max(1, Math.ceil((adminDashboardRateLimitedUntil - Date.now()) / 1000));
    const error = new Error(`Rate limit active. Retry in ${retryInSeconds}s`);
    error.status = 429;
    throw error;
  }

  const response = await fetch(buildRequestUrl(resolvedPath), {
    credentials: "include",
    ...options,
    headers: sanitizeHeaders(options.headers)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429 && isDashboardRequest) {
      const retryAfterSeconds = Number(response.headers.get("retry-after")) || (ADMIN_RATE_LIMIT_BACKOFF_MS / 1000);
      adminDashboardRateLimitedUntil = Date.now() + (retryAfterSeconds * 1000);
    }
    const error = new Error(data.reason || data.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  if (isDashboardRequest) {
    adminDashboardRateLimitedUntil = 0;
  }
  return data;
}
