const API_BASE = "/api";

/**
 * Direct admin API URL — bypasses Next.js rewrite proxy for large uploads.
 * The proxy has a ~10MB body size limit that cannot be configured.
 */
function getDirectApiUrl(path: string): string {
  if (typeof window !== "undefined") {
    const base =
      process.env.NEXT_PUBLIC_ADMIN_API_URL ||
      `${window.location.protocol}//${window.location.hostname}:3001/api`;
    return `${base}${path}`;
  }
  return `/api${path}`;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("tgs3_token") : null;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (
    options.body &&
    typeof options.body === "string" &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("tgs3_token");
      window.location.href = "/login";
    }
    throw new ApiError(401, "Unauthorized");
  }

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.message || text;
    } catch {}
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;

  return res.json();
}

export const api = {
  // Admin
  login: (username: string, password: string) =>
    request<{ token: string }>("/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  me: () => request<{ authenticated: boolean }>("/admin/me"),

  // Telegram
  getTelegramStatus: () =>
    request<{
      connected: boolean;
      phoneNumber?: string;
      username?: string;
      firstName?: string;
      lastName?: string;
    }>("/telegram/status"),

  sendCode: (apiId: number, apiHash: string, phoneNumber: string) =>
    request<{ phoneCodeHash: string }>("/telegram/send-code", {
      method: "POST",
      body: JSON.stringify({ apiId, apiHash, phoneNumber }),
    }),

  verifyCode: (phoneNumber: string, code: string, phoneCodeHash: string) =>
    request<{ success: boolean; need2FA?: boolean }>("/telegram/verify-code", {
      method: "POST",
      body: JSON.stringify({ phoneNumber, code, phoneCodeHash }),
    }),

  verify2FA: (password: string) =>
    request<{ success: boolean }>("/telegram/verify-2fa", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  disconnectTelegram: () =>
    request<{ success: boolean }>("/telegram/disconnect", {
      method: "DELETE",
    }),

  // Keys
  listKeys: () =>
    request<any[]>("/keys"),

  createKey: (name: string) =>
    request<{ id: string; name: string; accessKeyId: string; secretAccessKey: string }>(
      "/keys",
      { method: "POST", body: JSON.stringify({ name }) },
    ),

  updateKey: (id: string, data: { name?: string; isActive?: boolean }) =>
    request<any>(`/keys/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteKey: (id: string) =>
    request<{ deleted: boolean }>(`/keys/${id}`, { method: "DELETE" }),

  // Buckets
  listBuckets: () =>
    request<any[]>("/buckets"),

  createBucket: (name: string) =>
    request<any>("/buckets", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  deleteBucket: (name: string, force = false) =>
    request<{ deleted: boolean }>(`/buckets/${name}${force ? "?force=true" : ""}`, { method: "DELETE" }),

  // Objects
  getStats: () =>
    request<{ totalBuckets: number; totalObjects: number; totalSize: number }>(
      "/objects/stats",
    ),

  listObjects: (
    bucket: string,
    prefix = "",
    delimiter = "/",
  ) =>
    request<any>(`/objects/${bucket}?prefix=${encodeURIComponent(prefix)}&delimiter=${encodeURIComponent(delimiter)}`),

  uploadObject: async (
    bucket: string,
    key: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<{ etag: string; size: number }> => {
    // Phase 1: Send file to server (0-49%)
    const { uploadId } = await new Promise<{ uploadId: string }>(
      (resolve, reject) => {
        const formData = new FormData();
        formData.append("file", file);

        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("tgs3_token")
            : null;
        const url = getDirectApiUrl(
          `/objects/${bucket}/upload?key=${encodeURIComponent(key)}`,
        );

        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            // Phase 1: 0-49%
            onProgress(Math.round((e.loaded / e.total) * 49));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            let message = "Upload failed";
            try {
              const json = JSON.parse(xhr.responseText);
              message = json.message || message;
            } catch {}
            reject(new ApiError(xhr.status, message));
          }
        };

        xhr.onerror = () => reject(new ApiError(0, "Network error"));
        xhr.send(formData);
      },
    );

    // Phase 2: Poll server→Telegram progress (50-100%)
    if (onProgress) onProgress(50);
    const progressUrl = getDirectApiUrl(
      `/objects/upload-progress/${uploadId}`,
    );
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("tgs3_token")
        : null;
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    while (true) {
      await new Promise((r) => setTimeout(r, 500));
      const res = await fetch(progressUrl, { headers });
      const data = await res.json();

      if (data.phase === "done") {
        if (onProgress) onProgress(100);
        return data.result;
      }
      if (data.phase === "error") {
        throw new ApiError(500, data.error || "Upload failed");
      }
      if (data.phase === "uploading" && onProgress) {
        // Map server progress (0-100) to display range (50-99)
        onProgress(50 + Math.round(data.percent * 0.5));
      }
    }
  },

  deleteObject: (bucket: string, key: string) =>
    request<{ deleted: boolean }>(`/objects/${bucket}/${key}`, {
      method: "DELETE",
    }),
};
