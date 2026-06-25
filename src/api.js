const BASE = import.meta.env.VITE_API_URL || 'https://logistics-crm-backend.onrender.com/api';

let token = localStorage.getItem('crm_token') || '';

export function setToken(t) {
  token = t;
  localStorage.setItem('crm_token', t);
}

export function getToken() { return token; }

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Auth
export const login = (login, password) => req('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) });

// Dashboard
export const getDashboard = (period) => req(`/dashboard?period=${period || 'month'}`);
export const getDashboardGoals = (period) => req(`/dashboard/goals?period=${period || 'month'}`);

// Orders
export const getOrders = (params = {}) => req('/orders?' + new URLSearchParams(params));
export const getOrder = (id) => req(`/orders/${id}`);
export const createOrder = (data) => req('/orders', { method: 'POST', body: JSON.stringify(data) });
export const updateOrder = (id, data) => req(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteOrder = (id) => req(`/orders/${id}`, { method: 'DELETE' });

// Clients
export const getClients = (search) => req('/clients' + (search ? `?search=${search}` : ''));
export const getClient = (id) => req(`/clients/${id}`);
export const createClient = (data) => req('/clients', { method: 'POST', body: JSON.stringify(data) });
export const updateClient = (id, data) => req(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteClient = (id) => req(`/clients/${id}`, { method: 'DELETE' });

// Carriers
export const getCarriers = (search) => req('/carriers' + (search ? `?search=${search}` : ''));
export const getCarrier = (id) => req(`/carriers/${id}`);
export const createCarrier = (data) => req('/carriers', { method: 'POST', body: JSON.stringify(data) });
export const updateCarrier = (id, data) => req(`/carriers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteCarrier = (id) => req(`/carriers/${id}`, { method: 'DELETE' });

// Tasks
export const getTasks = () => req('/tasks');
export const createTask = (data) => req('/tasks', { method: 'POST', body: JSON.stringify(data) });
export const updateTask = (id, data) => req(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteTask = (id) => req(`/tasks/${id}`, { method: 'DELETE' });

// Leads
export const getLeads = (params = {}) => req('/leads?' + new URLSearchParams(params));
export const getLead = (id) => req(`/leads/${id}`);
export const createLead = (data) => req('/leads', { method: 'POST', body: JSON.stringify(data) });
export const updateLead = (id, data) => req(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteLead = (id) => req(`/leads/${id}`, { method: 'DELETE' });
export const addCallNote = (id, text) => req(`/leads/${id}/call_notes`, { method: 'POST', body: JSON.stringify({ text }) });

// Finance
export const getPaymentsIn = (params = {}) => req('/payments/in?' + new URLSearchParams(params));
export const getPaymentsOut = (params = {}) => req('/payments/out?' + new URLSearchParams(params));
export const createPaymentIn = (data) => req('/payments/in', { method: 'POST', body: JSON.stringify(data) });
export const createPaymentOut = (data) => req('/payments/out', { method: 'POST', body: JSON.stringify(data) });
export const deletePaymentIn = (id) => req(`/payments/in/${id}`, { method: 'DELETE' });
export const deletePaymentOut = (id) => req(`/payments/out/${id}`, { method: 'DELETE' });

// Reconciliation
export const generateReconciliation = (data) => req('/reconciliation/generate', { method: 'POST', body: JSON.stringify(data) });
export const getReconciliationHistory = (params = {}) => req('/reconciliation/history?' + new URLSearchParams(params));

// Document generation
export const generateClientDoc = (orderId) => req(`/orders/${orderId}/generate_client_doc`, { method: 'POST' });
export const generateCarrierDoc = (orderId) => req(`/orders/${orderId}/generate_carrier_doc`, { method: 'POST' });
export const generateAct = (orderId) => req(`/orders/${orderId}/generate_act`, { method: 'POST' });
export const generateAllActs = (clientId) => req(`/clients/${clientId}/generate_acts`, { method: 'POST' });

// Google Tasks
export const createGoogleTask = (data) => req('/google/tasks', { method: 'POST', body: JSON.stringify(data) });

// Google Calendar
export const createCalendarEvent = (data) => req('/google/calendar/event', { method: 'POST', body: JSON.stringify(data) });

// Google Sheets sync
export const syncToSheets = () => req('/sheets/sync', { method: 'POST' });

// Trash
export const getTrash = () => req('/trash');
export const restoreTrash = (collection, itemId) => req(`/trash/restore/${collection}/${itemId}`, { method: 'POST' });

// Duplicate order
export const duplicateOrder = (orderId) => req(`/orders/${orderId}/duplicate`, { method: 'POST' });
