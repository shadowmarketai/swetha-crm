import axios from 'axios';
import toast from 'react-hot-toast';

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Resolve a server-relative media path (e.g. "/renders/foo.png") into an absolute URL
// so <img src=…> works correctly under both dev (Vite at :5173) and bundled-SPA modes.
export const mediaUrl = (path) => {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('swetha_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors with user-facing toasts
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/register');
    const isSilent = error.config?._silent;

    if (error.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem('swetha_token');
      localStorage.removeItem('swetha_user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Show toast for server errors unless caller opted out with _silent
    if (!isSilent && !isAuthCall && error.response) {
      const status = error.response.status;
      const msg = error.response.data?.detail
        || error.response.data?.message
        || error.response.data?.error;
      if (status === 403) {
        toast.error(msg || 'You don\u2019t have permission for this action');
      } else if (status === 404) {
        // skip — callers handle 404 contextually
      } else if (status === 422) {
        toast.error(msg || 'Validation error — check your input');
      } else if (status >= 500) {
        toast.error(msg || 'Server error — please try again later');
      }
    }

    // Network error (no response at all)
    if (!isSilent && !error.response && error.code !== 'ERR_CANCELED') {
      toast.error('Network error — check your connection');
    }

    return Promise.reject(error);
  }
);

// ============================================
// AUTH API
// ============================================
export const authAPI = {
  login: (credentials) => api.post('/api/v1/auth/login', credentials),
  register: (data) => api.post('/api/v1/auth/register', data),
  logout: () => api.post('/api/v1/auth/logout'),
  getProfile: () => api.get('/api/v1/auth/me'),
};

// ============================================
// VOICEFLOW INTEGRATION API
// ============================================
// Push leads to the external VoiceFlow SaaS, list/fetch the conversations +
// recordings it produces. Recording media stays on VoiceFlow's CDN — we only
// store URLs in the CRM.
export const voiceflowAPI = {
  pushLead: (leadId, agentId) =>
    api.post(`/api/v1/voiceflow/leads/${leadId}/push`, null, {
      params: agentId ? { agent_id: agentId } : undefined,
    }),
  listConversationsForLead: (leadId) =>
    api.get(`/api/v1/voiceflow/leads/${leadId}/conversations`),
  getConversation: (conversationId) =>
    api.get(`/api/v1/voiceflow/conversations/${conversationId}`),
};

// ============================================
// LEADS API
// ============================================
export const leadsAPI = {
  // Get all leads with filters
  getAll: (params) => api.get('/api/v1/crm-leads', { params }),

  // Get single lead
  getById: (id) => api.get(`/api/v1/crm-leads/${id}`),

  // Create lead
  create: (data) => api.post('/api/v1/crm-leads', data),

  // Update lead
  update: (id, data) => api.put(`/api/v1/crm-leads/${id}`, data),

  // Delete lead
  delete: (id) => api.delete(`/api/v1/crm-leads/${id}`),
  
  // Import leads from CSV
  import: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/v1/crm-leads/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // Export leads to CSV
  export: (params) => api.get('/api/v1/crm-leads/export', { params, responseType: 'blob' }),
  
  // Get pipeline stats
  getPipeline: () => api.get('/api/v1/crm-leads/pipeline'),
};

// ============================================
// CAMPAIGNS (AUTO-DIALER) API
// ============================================
export const campaignsAPI = {
  // Get all campaigns
  getAll: (params) => api.get('/api/v1/campaigns', { params }),

  // Get single campaign
  getById: (id) => api.get(`/api/v1/campaigns/${id}`),

  // Create campaign
  create: (data) => api.post('/api/v1/campaigns', data),

  // Update campaign
  update: (id, data) => api.put(`/api/v1/campaigns/${id}`, data),

  // Delete campaign
  delete: (id) => api.delete(`/api/v1/campaigns/${id}`),

  // Campaign controls
  start: (id) => api.post(`/api/v1/campaigns/${id}/start`),
  pause: (id) => api.post(`/api/v1/campaigns/${id}/pause`),
  resume: (id) => api.post(`/api/v1/campaigns/${id}/resume`),
  stop: (id) => api.post(`/api/v1/campaigns/${id}/stop`),

  // Get campaign stats
  getStats: (id) => api.get(`/api/v1/campaigns/${id}/stats`),

  // Upload contacts
  uploadContacts: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/api/v1/campaigns/${id}/contacts`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ============================================
// SURVEYS API
// ============================================
export const surveysAPI = {
  // NOTE: trailing slash is REQUIRED on the collection routes — without it,
  // the legacy `/api/v1/surveys` router (which expects `name` instead of `title`)
  // intercepts the request and returns a 422.
  getAll: () => api.get('/api/v1/surveys/'),

  // Get single survey
  getById: (id) => api.get(`/api/v1/surveys/${id}`),

  // Create survey
  create: (data) => api.post('/api/v1/surveys/', data),
  
  // Update survey
  update: (id, data) => api.put(`/api/v1/surveys/${id}`, data),
  
  // Delete survey
  delete: (id) => api.delete(`/api/v1/surveys/${id}`),
  
  // Get survey responses
  getResponses: (id, params) => api.get(`/api/v1/surveys/${id}/responses`, { params }),
  
  // Get survey analytics
  getAnalytics: (id) => api.get(`/api/v1/surveys/${id}/analytics`),
  
  // Get shareable link
  getShareLink: (id) => api.get(`/api/v1/surveys/${id}/share`),

  // Publish a draft/paused survey (status → active)
  publish: (id) => api.post(`/api/v1/surveys/${id}/publish`),

  // ── Public (unauthenticated) endpoints used by the share link page.
  //    Use raw axios so the 401-redirect interceptor never fires for anonymous users.
  getPublicBySlug: (slug) =>
    axios.get(`${API_BASE_URL}/api/v1/public/surveys/${slug}`),
  submitPublicResponse: (slug, data) =>
    axios.post(`${API_BASE_URL}/api/v1/public/surveys/${slug}/responses`, data),
};

// ============================================
// HELP DESK (TICKETS) API
// ============================================
// Backend prefix is /api/v1/helpdesk (helpdesk.py router)
export const ticketsAPI = {
  // Paginated list with filters: { page, page_size, status, priority, category, assigned_to, search }
  getAll: (params) => api.get('/api/v1/helpdesk/tickets', { params }),

  // Single ticket with replies thread
  getById: (id) => api.get(`/api/v1/helpdesk/tickets/${id}`),

  // Create ticket
  create: (data) => api.post('/api/v1/helpdesk/tickets', data),

  // Update ticket (status, priority, category, assignee, internal_notes…)
  update: (id, data) => api.put(`/api/v1/helpdesk/tickets/${id}`, data),

  // Reply (public message or internal note)
  // body: { body, is_internal, sender_type: 'agent' | 'customer', sender_name?, sender_email?, attachments? }
  addReply: (id, body) => api.post(`/api/v1/helpdesk/tickets/${id}/reply`, body),

  // Mark resolved
  resolve: (id, resolution_notes) =>
    api.post(`/api/v1/helpdesk/tickets/${id}/resolve`, null, { params: { resolution_notes } }),

  // Dashboard stats
  getDashboard: () => api.get('/api/v1/helpdesk/dashboard'),

  // ── Convenience helpers (compose into update) ──
  updateStatus: (id, status) => api.put(`/api/v1/helpdesk/tickets/${id}`, { status }),
  updatePriority: (id, priority) => api.put(`/api/v1/helpdesk/tickets/${id}`, { priority }),
  assign: (id, agentId) => api.put(`/api/v1/helpdesk/tickets/${id}`, { assigned_to: agentId }),
};

// ============================================
// ANALYTICS API
// ============================================
export const analyticsAPI = {
  // Get dashboard stats
  getDashboard: (params) => api.get('/api/v1/dashboard', { params, _silent: true }),
  
  // Get call volume
  getCallVolume: (params) => api.get('/api/v1/analytics/calls/volume', { params }),
  
  // Get emotion analytics
  getEmotions: (params) => api.get('/api/v1/analytics/emotions', { params }),
  
  // Get dialect/language analytics
  getDialects: (params) => api.get('/api/v1/analytics/dialects', { params }),
  
  // Get conversion analytics
  getConversions: (params) => api.get('/api/v1/analytics/conversions', { params }),
  
  // Get hourly distribution
  getHourlyDistribution: (params) => api.get('/api/v1/analytics/hourly', { params }),
  
  // Export report
  exportReport: (params) => api.get('/api/v1/analytics/export', { params, responseType: 'blob' }),
};

// ============================================
// INTEGRATIONS API
// ============================================
export const integrationsAPI = {
  // Get all integrations
  getAll: () => api.get('/api/v1/integrations', { _silent: true }),
  
  // Connect integration
  connect: (provider, data) => api.post(`/api/v1/integrations/${provider}/connect`, data),
  
  // Disconnect integration
  disconnect: (provider) => api.delete(`/api/v1/integrations/${provider}`),
  
  // Get integration status
  getStatus: (provider) => api.get(`/api/v1/integrations/${provider}/status`),
  
  // Test integration
  test: (provider) => api.post(`/api/v1/integrations/${provider}/test`),
  
  // Sync data
  sync: (provider) => api.post(`/api/v1/integrations/${provider}/sync`),
};

// ============================================
// SETTINGS API
// ============================================
export const settingsAPI = {
  // Get settings
  get: () => api.get('/api/v1/settings'),
  
  // Update settings
  update: (data) => api.put('/api/v1/settings', data),
  
  // Get billing info
  getBilling: () => api.get('/api/v1/settings/billing'),
  
  // Update billing
  updateBilling: (data) => api.put('/api/v1/settings/billing', data),
  
  // Get API keys
  getApiKeys: () => api.get('/api/v1/settings/api-keys'),
  
  // Create API key
  createApiKey: (name) => api.post('/api/v1/settings/api-keys', { name }),
  
  // Delete API key
  deleteApiKey: (id) => api.delete(`/api/v1/settings/api-keys/${id}`),
  
  // Get webhooks
  getWebhooks: () => api.get('/api/v1/settings/webhooks'),
  
  // Create webhook
  createWebhook: (data) => api.post('/api/v1/settings/webhooks', data),
  
  // Delete webhook
  deleteWebhook: (id) => api.delete(`/api/v1/settings/webhooks/${id}`),
};

// ============================================
// AI QUOTATION API
// ============================================
export const aiQuoteAPI = {
  voiceToQuote: (text, autoCalc = true) => api.post('/api/v1/ai-quote/voice', { text, auto_calculate: autoCalc }),
  photoToQuote: (file, context = '') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('context', context);
    formData.append('auto_calculate', 'true');
    return api.post('/api/v1/ai-quote/photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getRates: (weeksAhead = 2) => api.get('/api/v1/ai-quote/rates', { params: { weeks_ahead: weeksAhead } }),
  getMarketPosition: (totalAmount, floorArea) => api.post('/api/v1/ai-quote/market', { total_amount: totalAmount, floor_area: floorArea }),
};

// ============================================
// PEB QUOTATION API
// ============================================
export const quotationAPI = {
  calculate: (data) => api.post('/api/v1/quotations/calculate', data),
  create: (data) => api.post('/api/v1/quotations', data),
  getAll: (params) => api.get('/api/v1/quotations', { params }),
  get: (id) => api.get(`/api/v1/quotations/${id}`),
  update: (id, data) => api.put(`/api/v1/quotations/${id}`, data),
  delete: (id) => api.delete(`/api/v1/quotations/${id}`),
  generatePdf: (id) => api.post(`/api/v1/quotations/${id}/pdf`, {}, { responseType: 'blob' }),
  downloadPdf: (id) => api.get(`/api/v1/quotations/${id}/pdf`, { responseType: 'blob' }),
  revise: (id) => api.post(`/api/v1/quotations/${id}/revise`),
  changeStatus: (id, status) => api.patch(`/api/v1/quotations/${id}/status`, { status }),
  getLogs: (id) => api.get(`/api/v1/quotations/${id}/logs`),
  getStats: () => api.get('/api/v1/quotations/stats'),
  getByLead: (leadId) => api.get(`/api/v1/quotations/by-lead/${leadId}`),

  // ── AI photoreal render (Gemini 2.5 Flash Image) ──
  // Image generation can take 30–60 sec for 3 angles, so we use a longer timeout.
  previewAIRender: (payload) =>
    api.post('/api/v1/quotations/ai-render/preview', payload, { timeout: 180000 }),
  generateAIRender: (quotationId, payload) =>
    api.post(`/api/v1/quotations/${quotationId}/ai-render`, payload, { timeout: 180000 }),
  upscaleAIRender: (renderUrl, scale = 2) =>
    api.post('/api/v1/quotations/ai-render/upscale', { render_url: renderUrl, scale }, { timeout: 60000 }),
};

// ============================================
// TENDENT QUOTATION ENGINE (templates, intake, portal, offers)
// ============================================
export const quotationTemplateAPI = {
  list: (params) => api.get('/api/v1/quotation-templates', { params }),
  get: (id) => api.get(`/api/v1/quotation-templates/${id}`),
  create: (data) => api.post('/api/v1/quotation-templates', data),
  update: (id, data) => api.put(`/api/v1/quotation-templates/${id}`, data),
  delete: (id) => api.delete(`/api/v1/quotation-templates/${id}`),
  calc: (templateId, formData) =>
    api.post('/api/v1/quotation-templates/calc', { template_id: templateId, form_data: formData }),
  generateToken: (quotationId, expiresInDays = 30) =>
    api.post(`/api/v1/quotation-templates/tokens/${quotationId}`, null, { params: { expires_in_days: expiresInDays } }),
  revokeTokens: (quotationId) =>
    api.post(`/api/v1/quotation-templates/tokens/${quotationId}/revoke`),
  listOffers: (quotationId) => api.get(`/api/v1/quotations/${quotationId}/offers`),
  decideOffer: (quotationId, offerId, action, body = {}) =>
    api.post(`/api/v1/quotations/${quotationId}/offers/${offerId}/decide`, { action, ...body }),
};

// ─── Public quotation APIs (no auth) ───
// Call with `api` but without Authorization header — uses axios instance defaults.
export const quotationPublicAPI = {
  getIntakeTemplate: (tenantSlug, templateSlug) =>
    api.get(`/api/v1/public/intake/${tenantSlug}/${templateSlug}`),
  submitIntake: (tenantSlug, templateSlug, data) =>
    api.post(`/api/v1/public/intake/${tenantSlug}/${templateSlug}`, data),
  viewQuote: (token) => api.get(`/api/v1/public/quote/${token}`),
  acceptQuote: (token) => api.post(`/api/v1/public/quote/${token}/accept`),
  rejectQuote: (token) => api.post(`/api/v1/public/quote/${token}/reject`),
  proposeOffer: (token, proposedAmount, clientMessage) =>
    api.post(`/api/v1/public/quote/${token}/offer`, {
      proposed_amount: proposedAmount,
      client_message: clientMessage,
    }),
  askQuestion: (token, message) =>
    api.post(`/api/v1/public/quote/${token}/ask`, { message }),
};

// ============================================
// MESSAGING API (WhatsApp / SMS / Email)
// ============================================
export const whatsappAPI = {
  send: (data) => api.post('/api/v1/whatsapp/send', data),
  sendTemplate: (data) => api.post('/api/v1/whatsapp/template', data),
  sendBulk: (data) => api.post('/api/v1/whatsapp/bulk', data),
  getTemplates: () => api.get('/api/v1/whatsapp/templates'),
  getStatus: (messageId) => api.get(`/api/v1/whatsapp/status/${messageId}`),
};

export const smsAPI = {
  send: (data) => api.post('/api/v1/sms/send', data),
  sendCampaign: (data) => api.post('/api/v1/sms/campaign', data),
  checkDND: (phone) => api.get(`/api/v1/sms/dnd/${phone}`),
  getTemplates: () => api.get('/api/v1/sms/templates'),
};

export const emailAPI = {
  send: (data) => api.post('/api/v1/email/send', data),
  sendCampaign: (data) => api.post('/api/v1/email/campaign', data),
  getTemplates: () => api.get('/api/v1/email/templates'),
};

// ============================================
// UNIFIED INBOX API
// ============================================
export const inboxAPI = {
  // Connections
  listConnections: () => api.get('/api/v1/inbox/connections'),
  createConnection: (data) => api.post('/api/v1/inbox/connections', data),
  updateConnection: (id, data) => api.put(`/api/v1/inbox/connections/${id}`, data),
  deleteConnection: (id) => api.delete(`/api/v1/inbox/connections/${id}`),
  testConnection: (id) => api.post(`/api/v1/inbox/connections/${id}/test`),

  // Baileys (WhatsApp Web) QR
  getBaileysQR: (id) => api.get(`/api/v1/inbox/connections/${id}/baileys/qr`),

  // Email IMAP poll
  pollEmail: (id, limit = 30) =>
    api.post(`/api/v1/inbox/connections/${id}/email/poll`, null, { params: { limit } }),

  // Conversations + messages
  listConversations: (params) => api.get('/api/v1/inbox/conversations', { params }),
  getMessages: (conversationId) =>
    api.get(`/api/v1/inbox/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, data) =>
    api.post(`/api/v1/inbox/conversations/${conversationId}/messages`, data),
  markRead: (conversationId) =>
    api.post(`/api/v1/inbox/conversations/${conversationId}/read`),
};

// ============================================
// INTEGRATIONS API (Zapier / Slack / Sheets)
// ============================================
export const zapierAPI = {
  trigger: (data) => api.post('/api/v1/zapier/trigger', data),
  notifySlack: (data) => api.post('/api/v1/slack/notify', data),
  syncSheets: (data) => api.post('/api/v1/sheets/sync', data),
};

// ============================================
// CALL SCHEDULING API
// ============================================
export const schedulingAPI = {
  schedule: (data) => api.post('/api/v1/schedule/call', data),
  getQueue: () => api.get('/api/v1/schedule/queue'),
  cancel: (scheduleId) => api.delete(`/api/v1/schedule/${scheduleId}`),
  getWindows: () => api.get('/api/v1/schedule/windows'),
};

// ============================================
// A/B TESTING API
// ============================================
export const abTestingAPI = {
  create: (data) => api.post('/api/v1/ab-tests', data),
  getAll: () => api.get('/api/v1/ab-tests'),
  start: (id) => api.post(`/api/v1/ab-tests/${id}/start`),
  stop: (id) => api.post(`/api/v1/ab-tests/${id}/stop`),
  getResults: (id) => api.get(`/api/v1/ab-tests/${id}/results`),
};

// ============================================
// AI TRAINING API
// ============================================
export const aiTrainingAPI = {
  addData: (data) => api.post('/api/v1/ai-training/data', data),
  getData: () => api.get('/api/v1/ai-training/data'),
  triggerJob: () => api.post('/api/v1/ai-training/train'),
};

// ============================================
// SENTIMENT & ANALYTICS API
// ============================================
export const sentimentAPI = {
  getTrends: (params) => api.get('/api/v1/sentiment/trends', { params }),
  getSummary: () => api.get('/api/v1/sentiment/summary'),
  getCompetitorMentions: () => api.get('/api/v1/competitor/mentions'),
};

// ============================================
// RECORDINGS API
// ============================================
export const recordingsAPI = {
  get: (callId) => api.get(`/api/v1/recordings/${callId}`),
  download: (callId) => api.get(`/api/v1/recordings/${callId}/download`, { responseType: 'blob' }),
};

// ============================================
// FEATURE FLAGS API
// ============================================
export const featuresAPI = {
  getAll: () => api.get('/api/v1/features'),
  get: (key) => api.get(`/api/v1/features/${key}`),
};

// ============================================
// USERS / ADMIN API
// ============================================
export const usersAPI = {
  getAll: (params) => api.get('/api/v1/users', { params }),
  getById: (id) => api.get(`/api/v1/users/${id}`),
  updateRole: (id, role) => api.put(`/api/v1/users/${id}/role`, { role }),
  updateStatus: (id, is_active) => api.put(`/api/v1/users/${id}/status`, { is_active }),
  invite: (data) => api.post('/api/v1/users/invite', data),
  remove: (id) => api.delete(`/api/v1/users/${id}`),
  getPermissions: () => api.get('/api/v1/auth/permissions'),
};

// ============================================
// CRM COMPANIES API
// ============================================
export const companiesAPI = {
  getAll: (params) => api.get('/api/v1/crm-companies', { params }),
  getById: (id) => api.get(`/api/v1/crm-companies/${id}`),
  create: (data) => api.post('/api/v1/crm-companies', data),
  update: (id, data) => api.put(`/api/v1/crm-companies/${id}`, data),
  delete: (id) => api.delete(`/api/v1/crm-companies/${id}`),
};

// ============================================
// CRM CONTACTS API
// ============================================
export const contactsAPI = {
  getAll: (params) => api.get('/api/v1/crm-contacts', { params }),
  getById: (id) => api.get(`/api/v1/crm-contacts/${id}`),
  create: (data) => api.post('/api/v1/crm-contacts', data),
  update: (id, data) => api.put(`/api/v1/crm-contacts/${id}`, data),
  delete: (id) => api.delete(`/api/v1/crm-contacts/${id}`),
};

// ============================================
// CRM DEALS API
// ============================================
export const dealsAPI = {
  getAll: (params) => api.get('/api/v1/crm-deals', { params }),
  getById: (id) => api.get(`/api/v1/crm-deals/${id}`),
  create: (data) => api.post('/api/v1/crm-deals', data),
  update: (id, data) => api.put(`/api/v1/crm-deals/${id}`, data),
  delete: (id) => api.delete(`/api/v1/crm-deals/${id}`),
};

// ============================================
// CRM ACTIVITIES API
// ============================================
export const activitiesAPI = {
  getAll: (params) => api.get('/api/v1/crm-activities', { params }),
  create: (data) => api.post('/api/v1/crm-activities', data),
};

export default api;
