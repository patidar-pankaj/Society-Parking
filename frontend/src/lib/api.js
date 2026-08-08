import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ssp_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const VALID_FLATS = (() => {
  const flats = [];
  for (let floor = 1; floor <= 5; floor++) {
    for (let unit = 1; unit <= 12; unit++) {
      flats.push(`${floor}${String(unit).padStart(2, "0")}`);
    }
  }
  return flats;
})();

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export async function listVehicles(search = "") {
  const params = search ? { search } : {};
  const { data } = await api.get("/vehicles", { params });
  return data;
}

export async function createVehicle(payload) {
  const { data } = await api.post("/vehicles", payload);
  return data;
}

export async function updateVehicle(id, payload) {
  const { data } = await api.put(`/vehicles/${id}`, payload);
  return data;
}

export async function deleteVehicle(id) {
  await api.delete(`/vehicles/${id}`);
}

export async function getStats() {
  const { data } = await api.get("/stats");
  return data;
}
