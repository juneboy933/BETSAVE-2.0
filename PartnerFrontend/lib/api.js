"use client";

const DEFAULT_API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
const PARTNER_SESSION_FLAG = "partner_session_active";
const PARTNER_RATE_LIMIT_BACKOFF_MS = 30000;
let partnerDashboardRateLimitedUntil = 0;

const normalizeApiBase = (value) => (value || DEFAULT_API).trim().replace(/\/+$/, "");
const canUseStorage = () => typeof window !== "undefined" && typeof localStorage !== "undefined";
const canUseSessionStorage = () => typeof window !== "undefined" && typeof sessionStorage !== "undefined";

function buildRequestUrl(path) {
  const base = normalizeApiBase(getApiBase());
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${safePath}`;
}

export const getApiBase = () =>
  normalizeApiBase((canUseStorage() ? localStorage.getItem("partner_api_base") : null) || DEFAULT_API);
export const setApiBase = (value) => {
  if (!canUseStorage()) return;
  localStorage.setItem("partner_api_base", normalizeApiBase(value));
};

let partnerToken = "";

export const setPartnerToken = (token) => {
  partnerToken = "";
  markPartnerSessionActive();
};
export const markPartnerSessionActive = () => {
  if (!canUseSessionStorage()) return;
  sessionStorage.setItem(PARTNER_SESSION_FLAG, "1");
};
export const getPartnerToken = () => partnerToken;
export const hasPartnerSession = () =>
  Boolean(getPartnerToken()) || (canUseSessionStorage() && sessionStorage.getItem(PARTNER_SESSION_FLAG) === "1");

const isPartnerDashboardRequest = (path) => {
  const normalizedPath = String(path || "");
  return normalizedPath.startsWith("/api/v1/dashboard/partner/") || normalizedPath.startsWith("/api/v1/partners/mode");
};

const sanitizePartnerHeaders = (headers) => {
  const normalizedHeaders = new Headers(headers || {});
  normalizedHeaders.delete("Authorization");
  normalizedHeaders.delete("x-api-key");
  normalizedHeaders.delete("x-signature");
  normalizedHeaders.delete("x-timestamp");
  return normalizedHeaders;
};

// wrapper for dashboard requests using bearer token
export async function partnerRequest(path, options = {}) {
  const isDashboardRequest = isPartnerDashboardRequest(path);

  if (isDashboardRequest && partnerDashboardRateLimitedUntil > Date.now()) {
    const retryInSeconds = Math.max(1, Math.ceil((partnerDashboardRateLimitedUntil - Date.now()) / 1000));
    const error = new Error(`Rate limit active. Retry in ${retryInSeconds}s`);
    error.status = 429;
    throw error;
  }

  const response = await fetch(buildRequestUrl(path), {
    credentials: "include",
    ...options,
    headers: sanitizePartnerHeaders(options.headers)
  });
  return parseResponse(response, { isDashboardRequest, response });
}

export const getPartnerName = () => (canUseStorage() ? localStorage.getItem("partner_name") || "" : "");
export const getPartnerOperatingMode = () => (canUseStorage() ? localStorage.getItem("partner_operating_mode") || "demo" : "demo");

export const setPartnerName = (name) => {
  if (!canUseStorage()) return;
  const safeName = String(name || "").trim();
  if (!safeName) {
    localStorage.removeItem("partner_name");
    return;
  }
  localStorage.setItem("partner_name", safeName);
};

export const setPartnerOperatingMode = (mode) => {
  if (!canUseStorage()) return;
  const normalized = String(mode || "").trim().toLowerCase();
  localStorage.setItem("partner_operating_mode", normalized === "live" ? "live" : "demo");
};

export const clearPartnerCreds = () => {
  partnerToken = "";
  if (canUseSessionStorage()) {
    sessionStorage.removeItem(PARTNER_SESSION_FLAG);
  }
  if (!canUseStorage()) return;
  localStorage.removeItem("partner_name");
  localStorage.removeItem("partner_operating_mode");
};

async function parseResponse(response, context = {}) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429 && context.isDashboardRequest) {
      const retryAfterSeconds = Number(response.headers.get("retry-after")) || (PARTNER_RATE_LIMIT_BACKOFF_MS / 1000);
      partnerDashboardRateLimitedUntil = Date.now() + (retryAfterSeconds * 1000);
    }
    const error = new Error(data.reason || data.error || "Request failed");
    error.code = data.code || null;
    error.details = data.details || null;
    error.provider = data.provider || null;
    error.status = response.status;
    throw error;
  }
  if (context.isDashboardRequest) {
    partnerDashboardRateLimitedUntil = 0;
  }
  return data;
}

export async function request(path, options = {}) {
  const response = await fetch(buildRequestUrl(path), {
    credentials: "include",
    ...options
  });
  return parseResponse(response);
}

// Partner authentication endpoints
export async function registerPartnerAuth({ name, email, password, webhookUrl }) {
  const result = await request("/api/v1/partners/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      webhookUrl: webhookUrl?.trim() || ""
    })
  });

  setPartnerToken("");

  // Store partner info
  if (result.partner?.name) {
    setPartnerName(result.partner.name);
  }
  if (result.partner?.operatingMode) {
    setPartnerOperatingMode(result.partner.operatingMode);
  }

  // Return credentials object for display
  return {
    ...result,
    credentials: result.apiCredentials ? {
      apiKey: result.apiCredentials.apiKey,
      apiSecret: result.apiCredentials.apiSecret,
      operatingMode: result.partner?.operatingMode || "demo"
    } : null
  };
}

export async function loginPartnerAuth({ email, password }) {
  const result = await request("/api/v1/partners/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password
    })
  });

  setPartnerToken("");

  // Store partner info if returned
  if (result.partner?.name) {
    setPartnerName(result.partner.name);
  }
  if (result.partner?.operatingMode) {
    setPartnerOperatingMode(result.partner.operatingMode);
  }

  return result;
}
