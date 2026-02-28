/**
 * VoiceFlow Theme Configuration
 * White-label branding per tenant
 */

export const defaultTheme = {
  brand: {
    name: 'VoiceFlow',
    tagline: 'AI-Powered Voice CRM',
    logo: null, // URL to custom logo
  },
  colors: {
    primary: { 50: '#eef2ff', 100: '#e0e7ff', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' },
    secondary: { 50: '#f0fdf4', 500: '#22c55e', 600: '#16a34a' },
  },
}

export const industryPresets = {
  healthcare:  { brand: { name: 'HealthVoice',   tagline: 'Smart Healthcare CRM' },   colors: { primary: { 500: '#14b8a6', 600: '#0d9488' } } },
  finance:     { brand: { name: 'FinanceAI',     tagline: 'Financial Services CRM' }, colors: { primary: { 500: '#3b82f6', 600: '#2563eb' } } },
  realEstate:  { brand: { name: 'PropertyVoice', tagline: 'Real Estate CRM' },        colors: { primary: { 500: '#f97316', 600: '#ea580c' } } },
  education:   { brand: { name: 'EduConnect',    tagline: 'Education Management' },   colors: { primary: { 500: '#8b5cf6', 600: '#7c3aed' } } },
  ecommerce:   { brand: { name: 'ShopVoice',     tagline: 'E-Commerce CRM' },         colors: { primary: { 500: '#ec4899', 600: '#db2777' } } },
}

export function getTenantTheme(config) {
  return { ...defaultTheme, ...config }
}
