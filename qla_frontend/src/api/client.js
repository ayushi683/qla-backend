const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function getToken() {
  return localStorage.getItem("qla_token");
}

async function request(path, { method = "GET", body, headers = {}, isFormData = false } = {}) {
  const token = getToken();
  const finalHeaders = { ...headers };
  if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  if (!isFormData && body !== undefined) finalHeaders["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem("qla_token");
    localStorage.removeItem("qla_user");
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(detail);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res;
}

export const api = {
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password } }),
  me: () => request("/api/auth/me"),
  caseCommunication: (caseId) => request(`/api/cases/${caseId}/communication`),
  reviewQueue: () => request("/api/review-queue"),
  reviewQueueCases: () => request("/api/review-queue-cases"),
  cases: () => request("/api/cases"),
  caseDetail: (id) => request(`/api/cases/${id}`),

  listUsers: () => request("/api/users"),
  createUser: (payload) => request("/api/users", { method: "POST", body: payload }),
  updateUser: (userId, payload) => request(`/api/users/${userId}`, { method: "PATCH", body: payload }),
  deleteUser: (userId) => request(`/api/users/${userId}`, { method: "DELETE" }),

  approve: (recId) => request(`/api/recommendations/${recId}/approve`, { method: "POST" }),
  reject: (recId) => request(`/api/recommendations/${recId}/reject`, { method: "POST" }),
  edit: (recId, payload) =>
    request(`/api/recommendations/${recId}/edit`, { method: "POST", body: payload }),
  pickAlternative: (lineItemId, recId) =>
    request(`/api/line-items/${lineItemId}/pick/${recId}`, { method: "POST" }),

  quotationDetail: (caseId) => request(`/api/cases/${caseId}/quotation`),
  generateQuotation: (caseId) => request(`/api/cases/${caseId}/quotation/generate`, { method: "POST" }),
  updateQuotationLine: (caseId, lineItemId, payload) =>
    request(`/api/cases/${caseId}/quotation/lines/${lineItemId}`, { method: "PATCH", body: payload }),
  caseRevisions: (caseId) => request(`/api/cases/${caseId}/revisions`),
  updateDraftEmail: (caseId, payload) =>
    request(`/api/cases/${caseId}/quotation/email`, { method: "PATCH", body: payload }),
  markQuotationSent: (caseId) => request(`/api/cases/${caseId}/quotation/email/send`, { method: "POST" }),
  quotationDownloadUrl: (filename) => {
    const token = getToken();
    return `${API_BASE}/api/quotations/download/${encodeURIComponent(filename)}?_t=${token ? "1" : "0"}`;
  },

  getPricing: (caseId) => request(`/api/cases/${caseId}/pricing`),
  runAiMatch: (caseId) => request(`/api/cases/${caseId}/run-ai-match`, { method: "POST" }),
  bulkAiMatch: (caseIds) => request("/api/cases/bulk-ai-match", { method: "POST", body: { case_ids: caseIds } }),
  getInsights: () => request("/api/insights"),
  savePricing: (caseId, payload) => request(`/api/cases/${caseId}/pricing`, { method: "PUT", body: payload }),

  caseDocuments: (caseId) => request(`/api/cases/${caseId}/documents`),
  enquiryEmail: (caseId) => request(`/api/cases/${caseId}/enquiry-email`),
  documentDownloadUrl: (documentId) => `${API_BASE}/api/documents/download/${documentId}`,

  // Fetches a file with the auth header and returns an in-memory blob URL,
  // for showing inside our own modal (instead of a new browser tab).
  getViewUrl: async (path) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
    const blob = await res.blob();
    return window.URL.createObjectURL(blob);
  },

  downloadBlob: async (path, suggestedFilename) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};

export { getToken };