/** Local dev default; must match `backend/server.js` when `PORT` is unset (5001 avoids macOS AirPlay on 5000). */
export const LOCAL_API_BASE_URL = "http://localhost:5001";
export const PROD_API_BASE_URL = "https://crm-backend-production-fc85.up.railway.app";

/**
 * Never use port 5000 for the API in the browser: macOS AirPlay binds :5000, so requests get 403 from the wrong service.
 * Stale .env or shell env may still set NEXT_PUBLIC_API_BASE_URL to http://localhost:5000.
 */
function normalizeClientApiBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    PROD_API_BASE_URL;
  try {
    const u = new URL(raw);
    const port = u.port || (u.protocol === "https:" ? "443" : "80");
    const isLocalHost = u.hostname === "localhost" || u.hostname === "127.0.0.1";

    // In production builds we never want localhost API origins.
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

/**
 * Origin for static `/uploads` (must never be localhost:5000 — macOS AirPlay uses 5000, not Node).
 */
function uploadsApiOrigin(): string {
  const base = API_BASE_URL.replace(/\/$/, "");
  if (
    base.includes(":5000") &&
    (base.includes("localhost") || base.includes("127.0.0.1"))
  ) {
    return LOCAL_API_BASE_URL;
  }
  return base;
}

/**
 * Files under /uploads are served by the API (Express static), not the Next.js app.
 * Rewrites stale `http://localhost:5000/uploads/...` (DB) and wrong env to LOCAL_API_BASE_URL.
 */
export function resolveUploadUrl(url: string | null | undefined): string {
  if (url == null || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }
  if (trimmed.startsWith("uploads/")) {
    return stripAirPlayPortFromUploadUrl(`${uploadsApiOrigin()}/${trimmed}`);
  }
  if (trimmed.startsWith("/uploads/")) {
    return stripAirPlayPortFromUploadUrl(`${uploadsApiOrigin()}${trimmed}`);
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const u = new URL(trimmed);
      if (u.pathname.startsWith("/uploads/")) {
        const port = u.port || (u.protocol === "https:" ? "443" : "80");
        const isBadLocal5000 =
          (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
          port === "5000";
        if (isBadLocal5000) {
          return stripAirPlayPortFromUploadUrl(
            `${LOCAL_API_BASE_URL}${u.pathname}${u.search}${u.hash}`
          );
        }
        return stripAirPlayPortFromUploadUrl(
          `${uploadsApiOrigin()}${u.pathname}${u.search}${u.hash}`
        );
      }
    } catch {
      return stripAirPlayPortFromUploadUrl(trimmed);
    }
    return stripAirPlayPortFromUploadUrl(trimmed);
  }
  if (/^po-\d+-\d+\.[a-z0-9]+$/i.test(trimmed)) {
    return stripAirPlayPortFromUploadUrl(
      `${uploadsApiOrigin()}/uploads/po/${trimmed}`
    );
  }
  return stripAirPlayPortFromUploadUrl(trimmed);
}

function stripAirPlayPortFromUploadUrl(result: string): string {
  if (!result || !result.includes("/uploads/")) return result;
  return result
    .replace(/^http:\/\/localhost:5000(?=\/)/, LOCAL_API_BASE_URL)
    .replace(/^http:\/\/127\.0\.0\.1:5000(?=\/)/, LOCAL_API_BASE_URL);
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
  const base = API_BASE_URL.replace(/\/$/, "");
  return `${base}/api/dc/po-file?path=${encodeURIComponent(pathParam)}`;
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

  try {
    const res = await fetch(`${API_BASE_URL}/api${path}`, {
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
        `Cannot connect to backend server at ${API_BASE_URL}. Please make sure the backend is running.`
      );
    }
    throw error;
  }
}
