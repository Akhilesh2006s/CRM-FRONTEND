/** Local dev default — must match `backend/server.js` (`PORT` defaults to 5000). */
export const LOCAL_API_BASE_URL = "http://localhost:5000";
export const PROD_API_BASE_URL = "https://crm-backend-production-fc85.up.railway.app";

/**
 * Resolve API origin: env override → local in dev → production on Vercel.
 * On macOS, if AirPlay blocks port 5000, set NEXT_PUBLIC_API_BASE_URL=http://localhost:5001
 * and run the backend with PORT=5001.
 */
function normalizeClientApiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (fromEnv) {
    try {
      const u = new URL(fromEnv);
      const isLocalHost =
        u.hostname === "localhost" || u.hostname === "127.0.0.1";
      if (process.env.NODE_ENV === "production" && isLocalHost) {
        return PROD_API_BASE_URL;
      }
    } catch {
      if (
        process.env.NODE_ENV === "production" &&
        (fromEnv.includes("localhost") || fromEnv.includes("127.0.0.1"))
      ) {
        return PROD_API_BASE_URL;
      }
    }
    return fromEnv;
  }
  if (process.env.NODE_ENV === "production") {
    return PROD_API_BASE_URL;
  }
  return LOCAL_API_BASE_URL;
}

export const API_BASE_URL = normalizeClientApiBase();

/** Origin for static `/uploads` (served by Express, same host as API). */
function uploadsApiOrigin(): string {
  return API_BASE_URL.replace(/\/$/, "");
}

/**
 * Files under /uploads are served by the API (Express static), not the Next.js app.
 * Rewrites `/uploads` paths to the configured API origin.
 */
export function resolveUploadUrl(url: string | null | undefined): string {
  if (url == null || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }
  if (trimmed.startsWith("uploads/")) {
    return `${uploadsApiOrigin()}/${trimmed}`;
  }
  if (trimmed.startsWith("/uploads/")) {
    return `${uploadsApiOrigin()}${trimmed}`;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const u = new URL(trimmed);
      if (u.pathname.startsWith("/uploads/")) {
        return `${uploadsApiOrigin()}${u.pathname}${u.search}${u.hash}`;
      }
    } catch {
      return trimmed;
    }
    return trimmed;
  }
  if (/^po-\d+-\d+\.[a-z0-9]+$/i.test(trimmed)) {
    return `${uploadsApiOrigin()}/uploads/po/${trimmed}`;
  }
  return trimmed;
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
