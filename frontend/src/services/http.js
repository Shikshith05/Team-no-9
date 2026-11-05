const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export class ApiError extends Error {
  constructor(status, data = {}) {
    const errorObj = (data && data.error) ? data.error : (data || {});
    const msg = errorObj.message || data.message || `Request failed with status ${status}`;
    super(msg);
    this.name = "ApiError";
    this.status = status;
    this.code = errorObj.code || data.code || "UNKNOWN_ERROR";
    this.fields = errorObj.fields || data.fields || [];
    this.data = data;
  }
}

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    "Accept": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let body = options.body;
  if (body && typeof body === "object" && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
    body,
  });

  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (!window.location.hash.includes("/login")) {
      window.location.hash = "#/login";
    }
  }

  let data = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, data || {});
  }

  return data;
}
