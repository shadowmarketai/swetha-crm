import axios from 'axios';

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('voiceflow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('voiceflow_token');
      window.location.href = '/login';
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
// VOICE CALLS API
// ============================================
export const callsAPI = {
  // Get all calls with filters
  getAll: (params) => api.get('/api/v1/calls', { params }),
  
  // Get single call details
  getById: (id) => api.get(`/api/v1/calls/${id}`),
  
  // Get call transcript
  getTranscript: (id) => api.get(`/api/v1/calls/${id}/transcript`),
  
  // Get call recording URL
  getRecording: (id) => api.get(`/api/v1/calls/${id}/recording`),
  
  // Make outbound call
  makeCall: (data) => api.post('/api/v1/calls/outbound', data),
  
  // Get call analytics
  getAnalytics: (params) => api.get('/api/v1/calls/analytics', { params }),
  
  // Get live calls
  getLiveCalls: () => api.get('/api/v1/calls/live'),
};

// ============================================
// LEADS API
// ============================================
export const leadsAPI = {
  // Get all leads with filters
  getAll: (params) => api.get('/api/v1/leads', { params }),
  
  // Get single lead
  getById: (id) => api.get(`/api/v1/leads/${id}`),
  
  // Create lead
  create: (data) => api.post('/api/v1/leads', data),
  
  // Update lead
  update: (id, data) => api.put(`/api/v1/leads/${id}`, data),
  
  // Delete lead
  delete: (id) => api.delete(`/api/v1/leads/${id}`),
  
  // Import leads from CSV
  import: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/v1/leads/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // Export leads to CSV
  export: (params) => api.get('/api/v1/leads/export', { params, responseType: 'blob' }),
  
  // Get pipeline stats
  getPipeline: () => api.get('/api/v1/leads/pipeline'),
};

// ============================================
// AI ASSISTANTS API
// ============================================
export const assistantsAPI = {
  // Get all assistants
  getAll: () => api.get('/api/v1/assistants'),
  
  // Get single assistant
  getById: (id) => api.get(`/api/v1/assistants/${id}`),
  
  // Create assistant
  create: (data) => api.post('/api/v1/assistants', data),
  
  // Update assistant
  update: (id, data) => api.put(`/api/v1/assistants/${id}`, data),
  
  // Delete assistant
  delete: (id) => api.delete(`/api/v1/assistants/${id}`),
  
  // Start/Stop assistant
  start: (id) => api.post(`/api/v1/assistants/${id}/start`),
  stop: (id) => api.post(`/api/v1/assistants/${id}/stop`),
  
  // Get assistant stats
  getStats: (id) => api.get(`/api/v1/assistants/${id}/stats`),
  
  // Get available voices
  getVoices: () => api.get('/api/v1/assistants/voices'),
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
  // Get all surveys
  getAll: () => api.get('/api/v1/surveys'),
  
  // Get single survey
  getById: (id) => api.get(`/api/v1/surveys/${id}`),
  
  // Create survey
  create: (data) => api.post('/api/v1/surveys', data),
  
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
};

// ============================================
// HELP DESK (TICKETS) API
// ============================================
export const ticketsAPI = {
  // Get all tickets
  getAll: (params) => api.get('/api/v1/tickets', { params }),
  
  // Get single ticket
  getById: (id) => api.get(`/api/v1/tickets/${id}`),
  
  // Create ticket
  create: (data) => api.post('/api/v1/tickets', data),
  
  // Update ticket
  update: (id, data) => api.put(`/api/v1/tickets/${id}`, data),
  
  // Assign ticket
  assign: (id, agentId) => api.post(`/api/v1/tickets/${id}/assign`, { agent_id: agentId }),
  
  // Change status
  updateStatus: (id, status) => api.patch(`/api/v1/tickets/${id}/status`, { status }),
  
  // Add comment
  addComment: (id, comment) => api.post(`/api/v1/tickets/${id}/comments`, { comment }),
  
  // Get ticket stats
  getStats: () => api.get('/api/v1/tickets/stats'),
};

// ============================================
// ANALYTICS API
// ============================================
export const analyticsAPI = {
  // Get dashboard stats
  getDashboard: (params) => api.get('/api/v1/analytics/dashboard', { params }),
  
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
// TTS / VOICE STUDIO API
// ============================================
export const ttsAPI = {
  // Synthesize text to speech
  synthesize: (data) => api.post('/api/v1/tts/synthesize', data),

  // Stream synthesis (returns audio/wav)
  synthesizeStream: (data) => api.post('/api/v1/tts/synthesize/stream', data, { responseType: 'blob' }),

  // Clone a voice from uploaded audio
  cloneVoice: (data) => api.post('/api/v1/tts/voices/clone', data),

  // List cloned voices
  listVoices: () => api.get('/api/v1/tts/voices'),

  // Delete a cloned voice
  deleteVoice: (voiceId) => api.delete(`/api/v1/tts/voices/${voiceId}`),

  // List available engines
  listEngines: () => api.get('/api/v1/tts/engines'),

  // Get supported languages
  listLanguages: () => api.get('/api/v1/tts/languages'),

  // Get supported emotions
  listEmotions: () => api.get('/api/v1/tts/emotions'),

  // Health check
  health: () => api.get('/api/v1/tts/health'),
};

// ============================================
// INTEGRATIONS API
// ============================================
export const integrationsAPI = {
  // Get all integrations
  getAll: () => api.get('/api/v1/integrations'),
  
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
// WHITE LABEL API (for agencies)
// ============================================
export const whiteLabelAPI = {
  // Get white label settings
  getSettings: () => api.get('/api/v1/whitelabel'),
  
  // Update white label settings
  updateSettings: (data) => api.put('/api/v1/whitelabel', data),
  
  // Get sub-accounts
  getSubAccounts: () => api.get('/api/v1/whitelabel/accounts'),
  
  // Create sub-account
  createSubAccount: (data) => api.post('/api/v1/whitelabel/accounts', data),
  
  // Update sub-account (activate/deactivate)
  updateAccount: (id, data) => api.put(`/api/v1/whitelabel/accounts/${id}`, data),

  // Update branding
  updateBranding: (data) => api.put('/api/v1/whitelabel/branding', data),

  // Get commission stats
  getCommissions: () => api.get('/api/v1/whitelabel/commissions'),
};

// ============================================
// Industry Templates API
// ============================================
export const industryAPI = {
  getAll: () => api.get('/api/v1/industries'),
  get: (id) => api.get(`/api/v1/industries/${id}`),
  apply: (id) => api.post(`/api/v1/industries/${id}/apply`),
  getLeadFields: (id) => api.get(`/api/v1/industries/${id}/lead-fields`),
  getPipeline: (id) => api.get(`/api/v1/industries/${id}/pipeline`),
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

export default api;
