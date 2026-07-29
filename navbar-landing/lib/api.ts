/** Local dev API — must match `backend/.env` PORT (5001 avoids macOS AirPlay on :5000). */
export const LOCAL_API_BASE_URL = "http://localhost:5001";
export const PROD_API_BASE_URL = "https://crm-backend-production-fc85.up.railway.app";

function isBrowserDevProxy(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "production") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

/**
 * Never call localhost:5000 from the browser for the CRM API.
 * macOS AirPlay Receiver often binds :5000 and returns 403 without CORS headers.
 */
function normalizeClientApiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  const raw =
    fromEnv ||
    (process.env.NODE_ENV === "production" ? PROD_API_BASE_URL : LOCAL_API_BASE_URL);

  try {
    const u = new URL(raw);
    const port = u.port || (u.protocol === "https:" ? "443" : "80");
    const isLocalHost = u.hostname === "localhost" || u.hostname === "127.0.0.1";

    if (process.env.NODE_ENV === "production" && isLocalHost) {
      return PROD_API_BASE_URL;
    }

    if (isLocalHost && port === "5000") {
      return LOCAL_API_BASE_URL;
    }
  } catch {
    if (
      process.env.NODE_ENV === "production" &&
      (raw.includes("localhost") || raw.includes("127.0.0.1"))
    ) {
      return PROD_API_BASE_URL;
    }
    if (raw.includes("localhost:5000") || raw.includes("127.0.0.1:5000")) {
      return LOCAL_API_BASE_URL;
    }
  }
  return raw;
}

export const API_BASE_URL = normalizeClientApiBase();

function stripAirPlayPort(url: string): string {
  return url
    .replace(/^http:\/\/localhost:5000(?=\/|$)/, LOCAL_API_BASE_URL)
    .replace(/^http:\/\/127\.0\.0\.1:5000(?=\/|$)/, LOCAL_API_BASE_URL)
    .replace(/localhost:5000/g, "localhost:5001")
    .replace(/127\.0\.0\.1:5000/g, "127.0.0.1:5001");
}

function uploadsApiOrigin(): string {
  if (isBrowserDevProxy()) return "";
  const base = API_BASE_URL.replace(/\/$/, "");
  if (
    base.includes(":5000") &&
    (base.includes("localhost") || base.includes("127.0.0.1"))
  ) {
    return LOCAL_API_BASE_URL;
  }
  return base;
}

export function apiFetchUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const apiPath = p.startsWith("/api") ? p : `/api${p}`;

  if (isBrowserDevProxy()) {
    return apiPath;
  }

  const base = normalizeClientApiBase().replace(/\/$/, "");
  return stripAirPlayPort(`${base}${apiPath}`);
}

export function resolveUploadUrl(url: string | null | undefined): string {
  if (url == null || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }
  if (trimmed.startsWith("uploads/")) {
    const origin = uploadsApiOrigin();
    return origin ? stripAirPlayPort(`${origin}/${trimmed}`) : `/${trimmed}`;
  }
  if (trimmed.startsWith("/uploads/")) {
    const origin = uploadsApiOrigin();
    return origin ? stripAirPlayPort(`${origin}${trimmed}`) : trimmed;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const u = new URL(trimmed);
      if (u.pathname.startsWith("/uploads/")) {
        const port = u.port || (u.protocol === "https:" ? "443" : "80");
        const isBadLocal5000 =
          (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
          port === "5000";
        if (isBadLocal5000 || isBrowserDevProxy()) {
          return `${u.pathname}${u.search}${u.hash}`;
        }
        return stripAirPlayPort(
          `${uploadsApiOrigin()}${u.pathname}${u.search}${u.hash}`
        );
      }
    } catch {
      return stripAirPlayPort(trimmed);
    }
    return stripAirPlayPort(trimmed);
  }
  if (/^po-\d+-\d+\.[a-z0-9]+$/i.test(trimmed)) {
    const origin = uploadsApiOrigin();
    const path = `/uploads/po/${trimmed}`;
    return origin ? stripAirPlayPort(`${origin}${path}`) : path;
  }
  return stripAirPlayPort(trimmed);
}

export function poFileApiUrl(poPathOrUrl: string | null | undefined): string | null {
  if (poPathOrUrl == null || typeof poPathOrUrl !== "string") return null;
  const trimmed = poPathOrUrl.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return null;
  }
  let filename = "";
  const slashUploads = /\/uploads\/po\/([^?#]+)/i.exec(trimmed);
  if (slashUploads) {
    filename = slashUploads[1];
  } else if (trimmed.startsWith("/uploads/po/")) {
    filename = trimmed.slice("/uploads/po/".length).split("?")[0];
  } else if (/^uploads\/po\//i.test(trimmed)) {
    filename = trimmed.replace(/^uploads\/po\//i, "").split("?")[0];
  } else if (/^po-\d+-\d+\.[a-z0-9]+$/i.test(trimmed)) {
    filename = trimmed.split("?")[0];
  } else {
    return null;
  }
  if (!filename || !/^[a-zA-Z0-9._-]+$/.test(filename)) return null;
  const pathParam = `po/${filename}`;
  if (isBrowserDevProxy()) {
    return `/api/dc/po-file?path=${encodeURIComponent(pathParam)}`;
  }
  const base = API_BASE_URL.replace(/\/$/, "");
  return stripAirPlayPort(
    `${base}/api/dc/po-file?path=${encodeURIComponent(pathParam)}`
  );
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const url = apiFetchUrl(path);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      let message = "Request failed";
      let details = null;
      try {
        const data = await res.json();
        message = data?.error || data?.message || message;
        details = data?.details || null;
      } catch (_) {}

      const errorMessage = details ? `${message}\n\n${details}` : message;
      const error = new Error(errorMessage);
      (error as any).status = res.status;
      (error as any).details = details;
      throw error;
    }

    return (await res.json()) as T;
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        `Cannot connect to backend (${url}). Start API: cd navbar-landing/backend && npm run dev — then restart Next (rm -rf .next && npm run dev).`
      );
    }
    throw error;
  }
}
