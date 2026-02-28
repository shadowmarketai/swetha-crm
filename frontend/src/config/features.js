/**
 * VoiceFlow Feature Configuration v3.0
 * Auto Dialer merged into Voice AI module
 *
 * WORKFLOW: Marketing (Acquire) → CRM (Manage) → Voice AI (Call & Convert) → Appointments (Book)
 * Automation orchestrates | Inbox handles messaging | Reports provides analytics
 */

export const defaultFeatures = {
  modules: {
    crm: { enabled: true, name: 'CRM', icon: 'Users', description: 'Lead & customer management' },
    voiceAI: { enabled: true, name: 'Voice AI', icon: 'Mic', description: 'AI calling + Auto Dialer' },
    marketing: { enabled: true, name: 'Marketing', icon: 'Megaphone', description: 'Funnels, pages, campaigns' },
    appointments: { enabled: true, name: 'Appointments', icon: 'Calendar', description: 'Booking & scheduling' },
    automation: { enabled: true, name: 'Automation', icon: 'Zap', description: 'Workflow builder' },
    inbox: { enabled: true, name: 'Inbox', icon: 'MessageSquare', description: 'Unified messaging' },
    surveys: { enabled: true, name: 'Surveys', icon: 'ClipboardList', description: 'Feedback forms' },
    helpdesk: { enabled: true, name: 'Help Desk', icon: 'Headphones', description: 'Support tickets' },
    reports: { enabled: true, name: 'Reports', icon: 'BarChart3', description: 'Analytics & insights' },
    whiteLabel: { enabled: true, name: 'White Label', icon: 'Palette', description: 'Reseller branding portal' },
    templates: { enabled: true, name: 'Templates', icon: 'Layout', description: 'Industry template library' },
  },
  regional: {
    languages: ['en', 'hi', 'ta'],
    dialects: { tamil: ['kongu', 'chennai', 'madurai', 'tirunelveli'] },
    genZSupport: true,
    emotionDetection: true,
  },
};

// Presets for different business types
export const presets = {
  crmOnly: {
    crm: true, voiceAI: false, marketing: false, appointments: true,
    automation: false, inbox: true, surveys: true, helpdesk: true, reports: true,
    whiteLabel: false, templates: true
  },
  voiceOnly: {
    crm: true, voiceAI: true, marketing: false, appointments: true,
    automation: true, inbox: false, surveys: false, helpdesk: false, reports: true,
    whiteLabel: false, templates: false
  },
  callCenter: {
    crm: true, voiceAI: true, marketing: false, appointments: true,
    automation: true, inbox: true, surveys: true, helpdesk: true, reports: true,
    whiteLabel: false, templates: true
  },
  marketingAgency: {
    crm: true, voiceAI: false, marketing: true, appointments: true,
    automation: true, inbox: true, surveys: true, helpdesk: false, reports: true,
    whiteLabel: true, templates: true
  },
  enterprise: {
    crm: true, voiceAI: true, marketing: true, appointments: true,
    automation: true, inbox: true, surveys: true, helpdesk: true, reports: true,
    whiteLabel: true, templates: true
  },
};

export function applyPreset(features, presetName) {
  const preset = presets[presetName]
  if (!preset) return features
  const updated = { ...features, modules: { ...features.modules } }
  Object.entries(preset).forEach(([key, enabled]) => {
    if (updated.modules[key]) updated.modules[key] = { ...updated.modules[key], enabled }
  })
  return updated
}

export function getTenantFeatures(tenantId) {
  // In production, fetch from API based on tenant
  return defaultFeatures;
}

export function isModuleEnabled(features, moduleName) {
  return features?.modules?.[moduleName]?.enabled ?? false;
}

export function getEnabledModules(features) {
  return Object.entries(features?.modules || {})
    .filter(([_, config]) => config.enabled)
    .map(([key, config]) => ({ id: key, ...config }));
}
