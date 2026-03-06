"use client";

const DEFAULT_API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
const DEFAULT_ADMIN_MODE = "live";
const canUseStorage = () => typeof window !== "undefined" && typeof localStorage !== "undefined";

export const getApiBase = () => (canUseStorage() ? localStorage.getItem("admin_api_base") : null) || DEFAULT_API;
export const setApiBase = (value) => {
  if (!canUseStorage()) return;
  localStorage.setItem("admin_api_base", value.trim());
};
export const getAdminToken = () => (canUseStorage() ? localStorage.getItem("admin_dashboard_token") : null) || "";
export const setAdminToken = (token) => {
  if (!canUseStorage()) return;
  localStorage.setItem("admin_dashboard_token", token.trim());
};
export const hasAdminToken = () => Boolean(getAdminToken());
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
  if (!canUseStorage()) return;
  localStorage.removeItem("admin_dashboard_token");
  localStorage.removeItem("admin_operating_mode");
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

export async function request(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const resolvedPath = method === "GET" ? withAdminOperatingMode(path) : String(path || "");
  const response = await fetch(`${getApiBase()}${resolvedPath}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.reason || data.error || "Request failed");
  return data;
}
