import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

const getAdminToken = () => localStorage.getItem('fluxoguard_admin_token');

const getAuthHeaders = () => {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getUsers = async () => {
  const response = await api.get('/users', {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const createTransaction = async (data) => {
  const response = await api.post('/transactions', data);
  return response.data;
};

export const authMe = async (token) => {
  const response = await api.get('/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const registerAdmin = async (payload) => {
  const response = await api.post('/admin/register', payload, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const login = async ({ identifier, code }) => {
  const response = await api.post('/auth/login', { identifier, code });
  return response.data;
};

export const updateUserActive = async (userId, isActive) => {
  const response = await api.patch(
    `/users/${userId}/active`,
    { is_active: isActive },
    { headers: getAuthHeaders() }
  );
  return response.data;
};

export const updateUser = async (userId, payload) => {
  const response = await api.patch(`/users/${userId}`, payload, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export default api;
