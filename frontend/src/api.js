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

export const getUsersByType = async (tipo) => {
  const response = await api.get('/users', {
    headers: getAuthHeaders(),
    params: { tipo },
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

export const createRepasse = async (formData) => {
  const response = await api.post('/transactions', formData, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getTransactions = async () => {
  const response = await api.get('/transactions', {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const updateRepasse = async (transactionId, formData) => {
  const response = await api.patch(`/transactions/${transactionId}`, formData, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getMyTransactions = async () => {
  const response = await api.get('/my-transactions', {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const uploadNotasFiscais = async (transactionId, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('notas_fiscais', file));

  const response = await api.patch(`/transactions/${transactionId}/upload-nf`, formData, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const changeTransactionStatus = async (transactionId, status) => {
  const response = await api.patch(`/transactions/${transactionId}/change-status`, { status }, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const rejectTransaction = async (transactionId) => {
  const response = await api.patch(`/transactions/${transactionId}/reject`, null, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const approvePaymentBatch = async (transactionIds, files) => {
  const formData = new FormData();
  formData.append('transaction_ids', JSON.stringify(transactionIds));
  files.forEach((file) => formData.append('comprovantes', file));

  const response = await api.patch('/transactions/batch/approve-payment', formData, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const finalizeTransactionsBatch = async (transactionIds) => {
  const response = await api.patch(
    '/transactions/batch/finalize',
    { transaction_ids: transactionIds },
    { headers: getAuthHeaders() }
  );
  return response.data;
};

export const removeTransactionFile = async (transactionId, fileType, filePath) => {
  const response = await api.delete(`/transactions/${transactionId}/files`, {
    headers: getAuthHeaders(),
    data: { file_type: fileType, file_path: filePath },
  });
  return response.data;
};

const buildDownloadPath = (filePath) => {
  const normalized = String(filePath || '').replace(/^\/+/, '');
  const encoded = normalized.split('/').map(encodeURIComponent).join('/');
  return `/download/${encoded}`;
};

export const downloadFile = async (filePath) => {
  const response = await api.get(buildDownloadPath(filePath), {
    headers: getAuthHeaders(),
    responseType: 'blob',
  });
  return response.data;
};

export default api;
