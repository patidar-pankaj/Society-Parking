import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

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
