/**
 * Swetha Structures CRM - Feature Configuration
 * CRM + Automation + Quotation for Swetha Structures.
 *
 * Voice AI is no longer a CRM module — VoiceFlow is a separate SaaS.
 * Lead detail page surfaces VoiceFlow conversations + recordings via the
 * /api/v1/voiceflow/* endpoints.
 */

export const defaultFeatures = {
  productName: 'Swetha CRM',
  modules: {
    crm: { enabled: true, name: 'CRM', icon: 'Users', description: 'Lead & customer management' },
    quotation: { enabled: true, name: 'Quotation', icon: 'ClipboardList', description: 'PEB quotation system' },
    appointments: { enabled: true, name: 'Appointments', icon: 'Calendar', description: 'Booking & scheduling' },
    automation: { enabled: true, name: 'Automation', icon: 'Zap', description: 'Workflow builder' },
    inbox: { enabled: true, name: 'Inbox', icon: 'MessageSquare', description: 'Unified messaging' },
    surveys: { enabled: true, name: 'Surveys', icon: 'ClipboardList', description: 'Feedback forms' },
    helpdesk: { enabled: true, name: 'Help Desk', icon: 'Headphones', description: 'Support tickets' },
    reports: { enabled: true, name: 'Reports', icon: 'BarChart3', description: 'Analytics & insights' },
    marketing: { enabled: false, name: 'Marketing', icon: 'Megaphone', description: 'Disabled' },
    whiteLabel: { enabled: false, name: 'White Label', icon: 'Palette', description: 'Disabled' },
    templates: { enabled: false, name: 'Templates', icon: 'Layout', description: 'Disabled' },
  },
  regional: {
    languages: ['en', 'hi', 'ta'],
  },
  // External VoiceFlow SaaS integration. Lead push + webhook callback are
  // wired through the backend; the UI just renders the resulting conversations
  // on each lead's detail page.
  voiceflowIntegration: {
    enabled: true,
  },
};

export function isModuleEnabled(features, moduleName) {
  return features?.modules?.[moduleName]?.enabled ?? false;
}

export function getEnabledModules(features) {
  return Object.entries(features?.modules || {})
    .filter(([_, config]) => config.enabled)
    .map(([key, config]) => ({ id: key, ...config }));
}

export function getTenantFeatures(tenantId) {
  return defaultFeatures;
}
