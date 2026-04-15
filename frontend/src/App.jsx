/**
 * Swetha Structures CRM - App Router
 *
 * WORKFLOW: CRM → Voice AI → Quotation → Appointments
 * Automation orchestrates | Inbox for messaging | Reports for analytics
 */

import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import DashboardLayout from './layouts/DashboardLayout'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import RoleGatedRoute from './components/RoleGatedRoute'
import { defaultFeatures, isModuleEnabled } from './config/features'

// Eager-load Login (first paint)
import Login from './pages/Login'

const features = defaultFeatures

// ── CRM Module ──
const CRMDashboard = lazy(() => import('./modules/crm/Dashboard'))
const LeadsPage = lazy(() => import('./modules/crm/LeadsPage'))
const LeadDetail360 = lazy(() => import('./modules/crm/LeadDetail360'))
const CompaniesPage = lazy(() => import('./modules/crm/SubPages').then(m => ({ default: m.CompaniesPage })))
const ContactsPage = lazy(() => import('./modules/crm/SubPages').then(m => ({ default: m.ContactsPage })))
const DealsPage = lazy(() => import('./modules/crm/SubPages').then(m => ({ default: m.DealsPage })))
const ActivitiesPage = lazy(() => import('./modules/crm/SubPages').then(m => ({ default: m.ActivitiesPage })))
const TasksPage = lazy(() => import('./modules/crm/CRMSubPages2').then(m => ({ default: m.TasksPage })))
const NotesPage = lazy(() => import('./modules/crm/CRMSubPages2').then(m => ({ default: m.NotesPage })))
const CRMSettingsPage = lazy(() => import('./modules/crm/CRMSettings').then(m => ({ default: m.CRMSettingsPage })))
const CRMIntegrationsPage = lazy(() => import('./modules/crm/CRMSettings').then(m => ({ default: m.CRMIntegrationsPage })))
const LeadSourcesPage = lazy(() => import('./modules/crm/LeadSourcesPage'))

// Voice AI Integration (monitoring dashboard for external platform)
const VoiceAIOverview = lazy(() => import('./modules/voice-ai/VoiceAIOverview'))
const VoiceLiveCalls = lazy(() => import('./modules/voice-ai/LiveCalls'))
const VoiceAgents = lazy(() => import('./modules/voice-ai/AIAgents'))
const VoiceCampaigns = lazy(() => import('./modules/voice-ai/Campaigns'))
const VoiceCallLogs = lazy(() => import('./modules/voice-ai/CallLogs'))
const VoiceAnalytics = lazy(() => import('./modules/voice-ai/Analytics'))

// ── Quotation Module (PEB) ──
const QuotationDashboard = lazy(() => import('./modules/quotation/QuotationDashboard'))
const AIQuote = lazy(() => import('./modules/quotation/AIQuote'))
const NewQuotation = lazy(() => import('./modules/quotation/NewQuotation'))
const QuotationHistory = lazy(() => import('./modules/quotation/QuotationHistory'))
const AuditLogs = lazy(() => import('./modules/quotation/AuditLogs'))
const Viewer3D = lazy(() => import('./modules/quotation/Viewer3D'))
const Drawings2D = lazy(() => import('./modules/quotation/Drawings2D'))
const AIImage = lazy(() => import('./modules/quotation/AIImage'))
const MaterialCost = lazy(() => import('./modules/quotation/MaterialCost'))
const TemplateStudio = lazy(() => import('./modules/quotation/TemplateStudio'))
const TemplateEditor = lazy(() => import('./modules/quotation/TemplateEditor'))
const ReviewInbox = lazy(() => import('./modules/quotation/ReviewInbox'))
const QuotationDetail = lazy(() => import('./modules/quotation/QuotationDetail'))
// Public (no-auth) pages
const PublicIntakePage = lazy(() => import('./modules/quotation/public/PublicIntakePage'))
const PublicQuotePortal = lazy(() => import('./modules/quotation/public/PublicQuotePortal'))
const PublicViewer3D = lazy(() => import('./modules/quotation/public/PublicViewer3D'))
const PublicRenderGallery = lazy(() => import('./modules/quotation/public/PublicRenderGallery'))

// ── Other Modules ──
const AppointmentsHub = lazy(() => import('./modules/appointments/AppointmentsHub'))
const AppointmentsSetup = lazy(() => import('./modules/appointments/AppointmentsSetup'))
const AutomationDashboard = lazy(() => import('./modules/other/Pages').then(m => ({ default: m.AutomationDashboard })))
const SurveysUnifiedPage = lazy(() => import('./modules/other/SurveysUnifiedPage'))
const SurveyBuilderPage = lazy(() => import('./modules/other/SurveyBuilderPage'))
const PublicSurveyPage = lazy(() => import('./modules/other/PublicSurveyPage'))
const ReportsDashboard = lazy(() => import('./modules/other/Pages').then(m => ({ default: m.ReportsDashboard })))
const WorkflowBuilder = lazy(() => import('./modules/other/WorkflowBuilder'))

// ── Sub Pages ──
const AutomationTemplatesPage = lazy(() => import('./modules/other/AutomationSubPages').then(m => ({ default: m.AutomationTemplatesPage })))
const TriggersPage = lazy(() => import('./modules/other/AutomationSubPages').then(m => ({ default: m.TriggersPage })))
const AutomationLogsPage = lazy(() => import('./modules/other/AutomationSubPages').then(m => ({ default: m.AutomationLogsPage })))
const WhatsAppInboxPage = lazy(() => import('./modules/other/InboxSubPages').then(m => ({ default: m.WhatsAppInboxPage })))
const SMSInboxPage = lazy(() => import('./modules/other/InboxSubPages').then(m => ({ default: m.SMSInboxPage })))
const EmailInboxPage = lazy(() => import('./modules/other/InboxSubPages').then(m => ({ default: m.EmailInboxPage })))
const TicketsPage = lazy(() => import('./modules/other/HelpdeskSubPages').then(m => ({ default: m.TicketsPage })))
const TicketDetailPage = lazy(() => import('./modules/other/HelpdeskSubPages').then(m => ({ default: m.TicketDetailPage })))
const TicketsKanbanPage = lazy(() => import('./modules/other/HelpdeskSubPages').then(m => ({ default: m.TicketsKanbanPage })))
const SalesReportPage = lazy(() => import('./modules/other/ReportsSubPages').then(m => ({ default: m.SalesReportPage })))
const CallsReportPage = lazy(() => import('./modules/other/ReportsSubPages').then(m => ({ default: m.CallsReportPage })))
const CustomReportPage = lazy(() => import('./modules/other/ReportsSubPages').then(m => ({ default: m.CustomReportPage })))

// ── Settings ──
const Settings = lazy(() => import('./pages/Settings'))

// ── Super Admin (Platform Console) ──

// ── Tenant: contact platform support ──

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const S = ({ children }) => <Suspense fallback={<PageLoader />}>{children}</Suspense>

function App() {
  return (
    <ErrorBoundary>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/s/:slug" element={<S><PublicSurveyPage /></S>} />

        {/* ════════════════════════════════════════════════════════
            PUBLIC — Client intake + quote portal (no auth)
            Tenant-branded, accessible by signed tokens / public slugs.
            ════════════════════════════════════════════════════════ */}
        <Route path="/intake/:tenantSlug/:templateSlug" element={<S><PublicIntakePage /></S>} />
        <Route path="/q/:token" element={<S><PublicQuotePortal /></S>} />
        <Route path="/view/:token/3d" element={<S><PublicViewer3D /></S>} />
        <Route path="/view/:token/render" element={<S><PublicRenderGallery /></S>} />


        {/* ════════════════════════════════════════════════════════
            SUPER ADMIN — Platform Console
            Completely separate layout. Super admin sees ONLY these
            routes. They are bounced away from any tenant CRM page.
            ════════════════════════════════════════════════════════ */}
        {/* ════════════════════════════════════════════════════════
            Swetha Structures CRM — single-company dashboard
            ════════════════════════════════════════════════════════ */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/crm" replace />} />

          {/* CRM Module */}
          {isModuleEnabled(features, 'crm') && (
            <>
              <Route path="crm" element={<RoleGatedRoute module="crm"><S><CRMDashboard /></S></RoleGatedRoute>} />
              <Route path="crm/leads" element={<RoleGatedRoute module="crm"><S><LeadsPage /></S></RoleGatedRoute>} />
              <Route path="crm/leads/:leadId" element={<RoleGatedRoute module="crm"><S><LeadDetail360 /></S></RoleGatedRoute>} />
              <Route path="crm/companies" element={<RoleGatedRoute module="crm"><S><CompaniesPage /></S></RoleGatedRoute>} />
              <Route path="crm/contacts" element={<RoleGatedRoute module="crm"><S><ContactsPage /></S></RoleGatedRoute>} />
              <Route path="crm/deals" element={<RoleGatedRoute module="crm"><S><DealsPage /></S></RoleGatedRoute>} />
              <Route path="crm/activities" element={<RoleGatedRoute module="crm"><S><ActivitiesPage /></S></RoleGatedRoute>} />
              <Route path="crm/tasks" element={<RoleGatedRoute module="crm"><S><TasksPage /></S></RoleGatedRoute>} />
              <Route path="crm/notes" element={<RoleGatedRoute module="crm"><S><NotesPage /></S></RoleGatedRoute>} />
              <Route path="crm/settings" element={<RoleGatedRoute module="crm"><S><CRMSettingsPage /></S></RoleGatedRoute>} />
              <Route path="crm/integrations" element={<RoleGatedRoute module="crm"><S><CRMIntegrationsPage /></S></RoleGatedRoute>} />
              <Route path="crm/lead-sources" element={<RoleGatedRoute module="crm"><S><LeadSourcesPage /></S></RoleGatedRoute>} />
            </>
          )}

          {/* Voice AI Integration (monitoring dashboard) */}
          {isModuleEnabled(features, 'voiceAI') && (
            <>
              <Route path="voice" element={<RoleGatedRoute module="voiceAI"><S><VoiceAIOverview /></S></RoleGatedRoute>} />
              <Route path="voice/live-calls" element={<RoleGatedRoute module="voiceAI"><S><VoiceLiveCalls /></S></RoleGatedRoute>} />
              <Route path="voice/agents" element={<RoleGatedRoute module="voiceAI"><S><VoiceAgents /></S></RoleGatedRoute>} />
              <Route path="voice/campaigns" element={<RoleGatedRoute module="voiceAI"><S><VoiceCampaigns /></S></RoleGatedRoute>} />
              <Route path="voice/call-logs" element={<RoleGatedRoute module="voiceAI"><S><VoiceCallLogs /></S></RoleGatedRoute>} />
              <Route path="voice/analytics" element={<RoleGatedRoute module="voiceAI"><S><VoiceAnalytics /></S></RoleGatedRoute>} />
            </>
          )}

          {/* Quotation Module (PEB) */}
          {isModuleEnabled(features, 'quotation') && (
            <>
              <Route path="quotation" element={<RoleGatedRoute module="quotation"><S><QuotationDashboard /></S></RoleGatedRoute>} />
              <Route path="quotation/ai" element={<RoleGatedRoute module="quotation"><S><AIQuote /></S></RoleGatedRoute>} />
              <Route path="quotation/new" element={<RoleGatedRoute module="quotation"><S><NewQuotation /></S></RoleGatedRoute>} />
              <Route path="quotation/3d" element={<RoleGatedRoute module="quotation"><S><Viewer3D /></S></RoleGatedRoute>} />
              <Route path="quotation/drawings" element={<RoleGatedRoute module="quotation"><S><Drawings2D /></S></RoleGatedRoute>} />
              <Route path="quotation/ai-image" element={<RoleGatedRoute module="quotation"><S><AIImage /></S></RoleGatedRoute>} />
              <Route path="quotation/history" element={<RoleGatedRoute module="quotation"><S><QuotationHistory /></S></RoleGatedRoute>} />
              <Route path="quotation/logs" element={<RoleGatedRoute module="quotation"><S><AuditLogs /></S></RoleGatedRoute>} />
              <Route path="quotation/material-cost" element={<RoleGatedRoute module="quotation"><S><MaterialCost /></S></RoleGatedRoute>} />
              <Route path="quotation/templates" element={<RoleGatedRoute module="quotation"><S><TemplateStudio /></S></RoleGatedRoute>} />
              <Route path="quotation/templates/:templateId" element={<RoleGatedRoute module="quotation"><S><TemplateEditor /></S></RoleGatedRoute>} />
              <Route path="quotation/inbox" element={<RoleGatedRoute module="quotation"><S><ReviewInbox /></S></RoleGatedRoute>} />
              <Route path="quotation/:quotationId" element={<RoleGatedRoute module="quotation"><S><QuotationDetail /></S></RoleGatedRoute>} />
            </>
          )}

          {/* Appointments — simplified to 2 sub-pages: hub + setup */}
          {isModuleEnabled(features, 'appointments') && (
            <>
              <Route path="appointments" element={<RoleGatedRoute module="appointments"><S><AppointmentsHub /></S></RoleGatedRoute>} />
              <Route path="appointments/setup" element={<RoleGatedRoute module="appointments"><S><AppointmentsSetup /></S></RoleGatedRoute>} />
            </>
          )}

          {/* Automation */}
          {isModuleEnabled(features, 'automation') && (
            <>
              <Route path="automation" element={<RoleGatedRoute module="automation"><S><AutomationDashboard /></S></RoleGatedRoute>} />
              <Route path="automation/templates" element={<RoleGatedRoute module="automation"><S><AutomationTemplatesPage /></S></RoleGatedRoute>} />
              <Route path="automation/triggers" element={<RoleGatedRoute module="automation"><S><TriggersPage /></S></RoleGatedRoute>} />
              <Route path="automation/logs" element={<RoleGatedRoute module="automation"><S><AutomationLogsPage /></S></RoleGatedRoute>} />
              <Route path="automation/builder" element={<RoleGatedRoute module="automation"><S><WorkflowBuilder /></S></RoleGatedRoute>} />
              <Route path="automation/builder/:id" element={<RoleGatedRoute module="automation"><S><WorkflowBuilder /></S></RoleGatedRoute>} />
            </>
          )}

          {/* Inbox */}
          {isModuleEnabled(features, 'inbox') && (
            <>
              <Route path="inbox" element={<Navigate to="/inbox/whatsapp" replace />} />
              <Route path="inbox/whatsapp" element={<RoleGatedRoute module="inbox"><S><WhatsAppInboxPage /></S></RoleGatedRoute>} />
              <Route path="inbox/sms" element={<RoleGatedRoute module="inbox"><S><SMSInboxPage /></S></RoleGatedRoute>} />
              <Route path="inbox/email" element={<RoleGatedRoute module="inbox"><S><EmailInboxPage /></S></RoleGatedRoute>} />
            </>
          )}

          {/* Surveys */}
          {isModuleEnabled(features, 'surveys') && (
            <>
              <Route path="surveys" element={<RoleGatedRoute module="surveys"><S><SurveysUnifiedPage initialTab="overview" /></S></RoleGatedRoute>} />
              <Route path="surveys/forms" element={<RoleGatedRoute module="surveys"><S><SurveysUnifiedPage initialTab="forms" /></S></RoleGatedRoute>} />
              <Route path="surveys/responses" element={<RoleGatedRoute module="surveys"><S><SurveysUnifiedPage initialTab="responses" /></S></RoleGatedRoute>} />
              <Route path="surveys/:id/edit" element={<RoleGatedRoute module="surveys"><S><SurveyBuilderPage /></S></RoleGatedRoute>} />
            </>
          )}

          {/* Help Desk */}
          {isModuleEnabled(features, 'helpdesk') && (
            <>
              <Route path="helpdesk" element={<Navigate to="/helpdesk/tickets" replace />} />
              <Route path="helpdesk/tickets" element={<RoleGatedRoute module="helpdesk"><S><TicketsPage /></S></RoleGatedRoute>} />
              <Route path="helpdesk/tickets/:ticketId" element={<RoleGatedRoute module="helpdesk"><S><TicketDetailPage /></S></RoleGatedRoute>} />
              <Route path="helpdesk/kanban" element={<RoleGatedRoute module="helpdesk"><S><TicketsKanbanPage /></S></RoleGatedRoute>} />
            </>
          )}

          {/* Reports */}
          {isModuleEnabled(features, 'reports') && (
            <>
              <Route path="reports" element={<RoleGatedRoute module="analytics"><S><ReportsDashboard /></S></RoleGatedRoute>} />
              <Route path="reports/sales" element={<RoleGatedRoute module="analytics"><S><SalesReportPage /></S></RoleGatedRoute>} />
              <Route path="reports/calls" element={<RoleGatedRoute module="analytics"><S><CallsReportPage /></S></RoleGatedRoute>} />
              <Route path="reports/custom" element={<RoleGatedRoute module="analytics"><S><CustomReportPage /></S></RoleGatedRoute>} />
            </>
          )}

          {/* Settings */}
          <Route path="settings" element={<S><Settings /></S>} />

          {/* Tenant: contact platform support */}
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/crm" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
