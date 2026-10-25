import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const TOKEN_KEY = "sw_token";

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function apiError(e, fallback = "Something failed on our side. Try again in a moment.") {
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
  if (detail?.msg) return detail.msg;
  if (e?.message === "Network Error")
  return "Can't reach the Wastrix server. Check your connection.";
  return fallback;
}

export const PRIORITY_META = {
  critical: { label: "Critical", color: "#E11D48", glyph: "!!", rank: 0, note: "Immediate health or safety threat" },
  high: { label: "High", color: "#EA580C", glyph: "!", rank: 1, note: "Blocks passage or sits near homes and food" },
  medium: { label: "Medium", color: "#F59E0B", glyph: "•", rank: 2, note: "Noticeable pile, odour and nuisance" },
  low: { label: "Low", color: "#3B82F6", glyph: "·", rank: 3, note: "Scattered litter, no hazard" },
};

export const STATUS_META = {
  reported: { label: "Reported", color: "#475569" },
  "in-progress": { label: "In progress", color: "#3B82F6" },
  resolved: { label: "Resolved", color: "#10B981" },
};

export function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} d ago`;
}
