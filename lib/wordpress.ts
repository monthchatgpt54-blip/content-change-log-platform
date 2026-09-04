import { env } from "cloudflare:workers";

function runtimeSecret(name: string) {
  return (env as unknown as Record<string, string | undefined>)[name];
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  const secret = runtimeSecret("APP_ENCRYPTION_KEY");
  if (!secret || secret.length < 32) {
    throw new Error("WordPress credential encryption is not configured yet.");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(value));
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(value: string) {
  const [ivValue, encryptedValue] = value.split(".");
  if (!ivValue || !encryptedValue) throw new Error("Stored WordPress credential is invalid.");
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(ivValue) }, await encryptionKey(), base64ToBytes(encryptedValue));
  return new TextDecoder().decode(decrypted);
}

function basicAuthorization(username: string, password: string) {
  return `Basic ${bytesToBase64(new TextEncoder().encode(`${username}:${password}`))}`;
}

export function safeWordPressBaseUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("WordPress connections require HTTPS.");
  const host = url.hostname.toLowerCase();
  const blocked = host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "127.0.0.1" || host === "::1" || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blocked) throw new Error("Private or local network addresses are not allowed.");
  return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
}

export async function wordpressFetch(baseUrl: string, username: string, password: string, path: string, init?: RequestInit) {
  const base = safeWordPressBaseUrl(baseUrl);
  const response = await fetch(`${base}/wp-json/wp/v2/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: basicAuthorization(username, password),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    redirect: "error",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`WordPress returned ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return response;
}

export function containsProtectedBuilderMarkup(body: string) {
  return /\[\/?(?:elementor|vc_|et_pb|fusion_|fl_builder|ux_)/i.test(body) || /data-elementor-|elementor-widget|et_pb_section/i.test(body);
}
