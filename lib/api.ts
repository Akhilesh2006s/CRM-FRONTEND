export const LOCAL_API_BASE_URL = "http://localhost:5001";
export const PROD_API_BASE_URL = "https://crm-backend-production-fc85.up.railway.app";

function normalizeClientApiBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    PROD_API_BASE_URL;
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
        // Check for error, message, or details fields
        message = data?.error || data?.message || message;
        details = data?.details || null;
      } catch (_) {}
      
      // Include details in error message if available
      const errorMessage = details ? `${message}\n\n${details}` : message;
      const error = new Error(errorMessage);
      (error as any).status = res.status;
      (error as any).details = details;
      throw error;
    }

    return (await res.json()) as T;
  } catch (error: any) {
    // Handle network errors (backend not running, CORS, etc.)
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        `Cannot connect to backend server at ${API_BASE_URL}. Please make sure the backend is running.`
      );
    }
    // Re-throw other errors as-is
    throw error;
  }
}


