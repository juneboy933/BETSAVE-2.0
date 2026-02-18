"use client";

const DEFAULT_API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

export const getApiBase = () => localStorage.getItem("admin_api_base") || DEFAULT_API;
export const setApiBase = (value) => localStorage.setItem("admin_api_base", value.trim());
export const getAdminToken = () => localStorage.getItem("admin_dashboard_token") || "";
export const setAdminToken = (token) => localStorage.setItem("admin_dashboard_token", token.trim());
export const hasAdminToken = () => Boolean(getAdminToken());
export const clearAdminToken = () => localStorage.removeItem("admin_dashboard_token");

export async function request(path, options = {}) {
  const response = await fetch(`${getApiBase()}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.reason || data.error || "Request failed");
  return data;
}
