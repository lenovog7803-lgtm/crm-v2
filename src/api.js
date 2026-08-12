const BASE = import.meta.env.VITE_API_URL || 'https://logistics-crm-backend.onrender.com/api';
const ROOT = BASE.replace('/api', '');

// Wake up Render on app start (free tier sleeps after 15 min)
export async function pingServer() {
  try {
    await fetch(ROOT + '/health');
  } catch (_) {}
}

let token = localStorage.getItem('crm_token') || '';

export function setToken(t) {
  token = t;
  localStorage.setItem('crm_token', t);
}

export function getToken() { return token; }

// AuthProvider registers itself here so a 401 anywhere can force a
// sign-out. A stale/expired token used to just fail every request forever
// with no visible error and no way back to the login screen short of
// manually clearing localStorage — this is what that looked like on
// mobile: an authenticated-looking shell that never loads any data.
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function req(path, options = {}, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(BASE + path, {
        ...options,
        // A hung request (slow backend, dead connection) would otherwise
        // wait forever — fetch has no default timeout of its own — and a
        // page like the manager dashboard would spin indefinitely instead
        // of ever reaching the retry/error path below.
        signal: AbortSignal.timeout(25000),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          ...options.headers,
        },
      });
      if (res.status === 401) {
        onUnauthorized?.();
        throw new Error('Сессия истекла — войдите заново');
      }
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    } catch (e) {
      // Retrying a rejected token just repeats the same 401 three times —
      // bail immediately once onUnauthorized has already fired.
      if (attempt < retries && e.message !== 'Сессия истекла — войдите заново') {
        await sleep(2000 * (attempt + 1));
      } else {
        throw e.name === 'TimeoutError' ? new Error('Сервер не отвечает — превышено время ожидания') : e;
      }
    }
  }
}

// Auth
export const login = (login, password) => req('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) });

// Dashboard
export const getDashboard = (period) => req(`/dashboard?period=${period || 'month'}`);
export const getGoals = (month) => req(`/goals?month=${month}`);
export const saveGoals = (payload) => req('/goals', { method: 'POST', body: JSON.stringify(payload) });

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
export const updateClient = (id, data) => req(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteClient = (id) => req(`/clients/${id}`, { method: 'DELETE' });

// Carriers
export const getCarriers = (search) => req('/carriers' + (search ? `?search=${search}` : ''));
export const getCarrier = (id) => req(`/carriers/${id}`);
export const createCarrier = (data) => req('/carriers', { method: 'POST', body: JSON.stringify(data) });
export const updateCarrier = (id, data) => req(`/carriers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCarrier = (id) => req(`/carriers/${id}`, { method: 'DELETE' });

// Tasks
export const getTasks = () => req('/tasks');
export const createTask = (data) => req('/tasks', { method: 'POST', body: JSON.stringify(data) });
export const updateTask = (id, data) => req(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTask = (id) => req(`/tasks/${id}`, { method: 'DELETE' });
export const assignTask = (id, userId) => req(`/tasks/${id}/assign`, { method: 'POST', body: JSON.stringify({ user_id: userId }) });

// Leads
export const getLeads = (params = {}) => req('/leads?' + new URLSearchParams(params));
export const getLead = (id) => req(`/leads/${id}`);
export const createLead = (data) => req('/leads', { method: 'POST', body: JSON.stringify(data) });
export const updateLead = (id, data) => req(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteLead = (id) => req(`/leads/${id}`, { method: 'DELETE' });
export const getCallQueue = (industry) =>
  req('/leads/queue' + (industry ? `?industry=${encodeURIComponent(industry)}` : ''));
export const logCall = (leadId, data) =>
  req(`/leads/${leadId}/call`, { method: 'POST', body: JSON.stringify(data) });
export const getCallHistory = (leadId) => req(`/leads/${leadId}/calls`);
export const convertLead = (leadId) => req(`/leads/${leadId}/convert`, { method: 'POST' });
export const getIndustries = () => req('/leads/industries');
export const getScripts = () => req('/leads/scripts');
export const saveScripts = (scripts) =>
  req('/leads/scripts', { method: 'PUT', body: JSON.stringify({ scripts }) });
export const getLeadsAnalytics = (period) => req(`/leads/analytics?period=${period || 'month'}`);
export const claimLead = (id) => req(`/leads/${id}/claim`, { method: 'POST' });

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

// Document generation — endpoint: POST /orders/{id}/docs/{kind}?regenerate=true
export const generateClientDoc  = (orderId, regen = true) => req(`/orders/${orderId}/docs/client?regenerate=${regen}`,  { method: 'POST' });
export const generateCarrierDoc = (orderId, regen = true) => req(`/orders/${orderId}/docs/carrier?regenerate=${regen}`, { method: 'POST' });
export const generateAct        = (orderId, regen = true) => req(`/orders/${orderId}/docs/act?regenerate=${regen}`,     { method: 'POST' });
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
export const purgeTrash = () => req('/trash/purge', { method: 'POST' });

// Duplicate order
export const duplicateOrder = (orderId) => req(`/orders/${orderId}/duplicate`, { method: 'POST' });
export const syncOrderDocUrls = (orderId) => req(`/orders/${orderId}/sync_doc_urls`, { method: 'POST' });

// Mark order payment (side: 'client' | 'carrier')
export const markPayment = (orderId, side, data) =>
  req(`/orders/${orderId}/mark_payment?side=${side}`, { method: 'POST', body: JSON.stringify(data) });

// Global search (Cmd+K)
export const globalSearch = (q) => req(`/search?q=${encodeURIComponent(q)}`);

// Order change history
export const getOrderHistory = (orderId) => req(`/orders/${orderId}/logs`);

// Restore a soft-deleted order (wraps the existing trash-restore endpoint)
export const restoreOrder = (id) => restoreTrash('orders', id);

// Backups (admin-only on the backend)
export const getBackups = () => req('/backup/list');
export const createBackupNow = () => req('/backup/create', { method: 'POST' });
export const restoreBackup = (id, confirmWord) =>
  req(`/backup/restore/${id}`, { method: 'POST', body: JSON.stringify({ confirm_word: confirmWord }) });

// Calls heatmap drill-down
export const getCallsByDay = (date) => req(`/leads/calls_by_day?date=${date}`);

// Admin — manager accounts (backed by the existing /users CRUD, role-scoped)
export const createManager = (data) => req('/users', { method: 'POST', body: JSON.stringify({ ...data, role: 'manager' }) });
export const getManagers = () => req('/users?role=manager');
export const getAllUsers = () => req('/users');
export const updateManager = (id, data) => req(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteManager = (id) => req(`/users/${id}`, { method: 'DELETE' });

// Admin — sessions
export const getSessions = () => req('/admin/sessions');
export const forceLogoutSession = (id) => req(`/admin/sessions/${id}/logout`, { method: 'POST' });

// Admin — manager stats
export const getManagerStats = (period) => req(`/admin/manager_stats?period=${period || 'today'}`);
export const getLeaderboard = (period) => req(`/leads/leaderboard?period=${period || 'today'}`);
export const getMyDashboard = () => req('/leads/my_dashboard');
export const getManagerStatsDetail = (id, period) => req(`/admin/manager_stats/${id}?period=${period || 'week'}`);

// Admin — notifications
export const getNotifications = () => req('/notifications');
export const markNotificationRead = (id) => req(`/notifications/${id}/read`, { method: 'POST' });
