"use client";

const DEFAULT_API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

const normalizeApiBase = (value) => (value || DEFAULT_API).trim().replace(/\/+$/, "");
const canUseStorage = () => typeof window !== "undefined" && typeof localStorage !== "undefined";

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

export const getPartnerCreds = () => ({
  apiKey: canUseStorage() ? localStorage.getItem("partner_api_key") || "" : "",
  apiSecret: canUseStorage() ? localStorage.getItem("partner_api_secret") || "" : ""
});

export const getPartnerName = () => (canUseStorage() ? localStorage.getItem("partner_name") || "" : "");

export const hasPartnerCreds = () => {
  const { apiKey, apiSecret } = getPartnerCreds();
  return Boolean(apiKey && apiSecret);
};

export const setPartnerCreds = ({ apiKey, apiSecret }) => {
  if (!canUseStorage()) return;
  localStorage.setItem("partner_api_key", apiKey.trim());
  localStorage.setItem("partner_api_secret", apiSecret.trim());
};

export const setPartnerName = (name) => {
  if (!canUseStorage()) return;
  const safeName = String(name || "").trim();
  if (!safeName) {
    localStorage.removeItem("partner_name");
    return;
  }
  localStorage.setItem("partner_name", safeName);
};

export const clearPartnerCreds = () => {
  if (!canUseStorage()) return;
  localStorage.removeItem("partner_api_key");
  localStorage.removeItem("partner_api_secret");
  localStorage.removeItem("partner_name");
};

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.reason || data.error || "Request failed");
    error.code = data.code || null;
    error.details = data.details || null;
    error.providerResponse = data.providerResponse || null;
    throw error;
  }
  return data;
}

export async function request(path, options = {}) {
  const response = await fetch(buildRequestUrl(path), options);
  return parseResponse(response);
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(secret, payload) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(sig);
}

export async function signedRequest({ method, path, body = {}, apiKey, apiSecret }) {
  const methodUpper = method.toUpperCase();
  const timestamp = Date.now().toString();
  const url = new URL(buildRequestUrl(path));
  const canonicalPath = `${url.pathname}${url.search}`;
  const payloadBody = methodUpper === "GET" ? {} : body || {};
  const payload = `${timestamp}${methodUpper}${canonicalPath}${JSON.stringify(payloadBody)}`;
  const signature = await hmacSha256(apiSecret, payload);

  const response = await fetch(url.toString(), {
    method: methodUpper,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-timestamp": timestamp,
      "x-signature": signature
    },
    body: methodUpper === "GET" ? undefined : JSON.stringify(payloadBody)
  });

  return parseResponse(response);
}
