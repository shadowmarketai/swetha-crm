/**
 * VoiceFlow App - Complete Modular White-Label Platform
 *
 * WORKFLOW: Marketing → CRM → Voice AI → Appointments
 * Automation orchestrates | Inbox for messaging | Reports for analytics
 * Auto Dialer merged into Voice AI module (9 modules total)
 */

import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import DashboardLayout from './layouts/DashboardLayout'
import ProtectedRoute from './components/ProtectedRoute'
import RoleGatedRoute from './components/RoleGatedRoute'
import { defaultFeatures, isModuleEnabled } from './config/features'

// Eager-load Login (first paint)
import Login from './pages/Login'

// Config
const features = defaultFeatures

// ── CRM Module ──
const CRMDashboard = lazy(() => import('./modules/crm/Dashboard'))
const LeadsPage = lazy(() => import('./modules/crm/LeadsPage'))
const CompaniesPage = lazy(() => import('./modules/crm/SubPages').then(m => ({ default: m.CompaniesPage })))
const ContactsPage = lazy(() => import('./modules/crm/SubPages').then(m => ({ default: m.ContactsPage })))
const DealsPage = lazy(() => import('./modules/crm/SubPages').then(m => ({ default: m.DealsPage })))
const ActivitiesPage = lazy(() => import('./modules/crm/SubPages').then(m => ({ default: m.ActivitiesPage })))
const TasksPage = lazy(() => import('./modules/crm/CRMSubPages2').then(m => ({ default: m.TasksPage })))
const NotesPage = lazy(() => import('./modules/crm/CRMSubPages2').then(m => ({ default: m.NotesPage })))
const ProductsPage = lazy(() => import('./modules/crm/CRMSubPages2').then(m => ({ default: m.ProductsPage })))
const VendorsPage = lazy(() => import('./modules/crm/CRMSubPages2').then(m => ({ default: m.VendorsPage })))
const CRMSettingsPage = lazy(() => import('./modules/crm/CRMSettings').then(m => ({ default: m.CRMSettingsPage })))
const CRMIntegrationsPage = lazy(() => import('./modules/crm/CRMSettings').then(m => ({ default: m.CRMIntegrationsPage })))
const LeadSourcesPage = lazy(() => import('./modules/crm/LeadSourcesPage'))

// ── Voice AI Module (includes Auto Dialer) ──
const VoiceAIDashboard = lazy(() => import('./modules/voice-ai/Dashboard'))
const LiveCallsPage = lazy(() => import('./modules/voice-ai/LiveCalls'))
const AIAgentsPage = lazy(() => import('./modules/voice-ai/AIAgents'))
const CampaignsPage = lazy(() => import('./modules/voice-ai/Campaigns'))
const ContactListsPage = lazy(() => import('./modules/voice-ai/ContactLists'))
const CallLogsPage = lazy(() => import('./modules/voice-ai/CallLogs'))
const RecordingsPage = lazy(() => import('./modules/voice-ai/Recordings'))
const VoiceStudioPage = lazy(() => import('./modules/voice-ai/VoiceStudio'))
const VoiceAnalyticsPage = lazy(() => import('./modules/voice-ai/Analytics'))

// ── Marketing Module ──
const MarketingDashboard = lazy(() => import('./modules/marketing/Pages').then(m => ({ default: m.MarketingDashboard })))
const FunnelsPage = lazy(() => import('./modules/marketing/Pages').then(m => ({ default: m.FunnelsPage })))
const LandingPagesPage = lazy(() => import('./modules/marketing/Pages').then(m => ({ default: m.LandingPagesPage })))
const EmailCampaignsPage = lazy(() => import('./modules/marketing/Pages').then(m => ({ default: m.EmailCampaignsPage })))
const WhatsAppPage = lazy(() => import('./modules/marketing/Pages').then(m => ({ default: m.WhatsAppPage })))
const SMSPage = lazy(() => import('./modules/marketing/Pages').then(m => ({ default: m.SMSPage })))
const MarketingFormsPage = lazy(() => import('./modules/marketing/Pages').then(m => ({ default: m.FormsPage })))
const FunnelBuilder = lazy(() => import('./modules/marketing/FunnelBuilder'))
const LandingPageBuilder = lazy(() => import('./modules/marketing/LandingPageBuilder'))

// ── Other Modules - Dashboards ──
const AppointmentsDashboard = lazy(() => import('./modules/other/Pages').then(m => ({ default: m.AppointmentsDashboard })))
const AutomationDashboard = lazy(() => import('./modules/other/Pages').then(m => ({ default: m.AutomationDashboard })))
const InboxDashboard = lazy(() => import('./modules/other/Pages').then(m => ({ default: m.InboxDashboard })))
const SurveysDashboard = lazy(() => import('./modules/other/Pages').then(m => ({ default: m.SurveysDashboard })))
const HelpdeskDashboard = lazy(() => import('./modules/other/Pages').then(m => ({ default: m.HelpdeskDashboard })))
const ReportsDashboard = lazy(() => import('./modules/other/Pages').then(m => ({ default: m.ReportsDashboard })))
const WorkflowBuilder = lazy(() => import('./modules/other/WorkflowBuilder'))
const WhiteLabelPage = lazy(() => import('./modules/other/WhiteLabelPage'))
const IndustryTemplatesPage = lazy(() => import('./modules/other/IndustryTemplatesPage'))

// ── Appointments SubPages ──
const BookingsPage = lazy(() => import('./modules/other/AppointmentsSubPages').then(m => ({ default: m.BookingsPage })))
const AvailabilityPage = lazy(() => import('./modules/other/AppointmentsSubPages').then(m => ({ default: m.AvailabilityPage })))
const ServicesPage = lazy(() => import('./modules/other/AppointmentsSubPages').then(m => ({ default: m.ServicesPage })))
const BookingPagesPage = lazy(() => import('./modules/other/AppointmentsSubPages').then(m => ({ default: m.BookingPagesPage })))

// ── Automation SubPages ──
const AutomationTemplatesPage = lazy(() => import('./modules/other/AutomationSubPages').then(m => ({ default: m.AutomationTemplatesPage })))
const TriggersPage = lazy(() => import('./modules/other/AutomationSubPages').then(m => ({ default: m.TriggersPage })))
const AutomationLogsPage = lazy(() => import('./modules/other/AutomationSubPages').then(m => ({ default: m.AutomationLogsPage })))

// ── Inbox SubPages ──
const WhatsAppInboxPage = lazy(() => import('./modules/other/InboxSubPages').then(m => ({ default: m.WhatsAppInboxPage })))
const SMSInboxPage = lazy(() => import('./modules/other/InboxSubPages').then(m => ({ default: m.SMSInboxPage })))
const EmailInboxPage = lazy(() => import('./modules/other/InboxSubPages').then(m => ({ default: m.EmailInboxPage })))

// ── Surveys SubPages ──
const SurveyFormsPage = lazy(() => import('./modules/other/SurveysSubPages').then(m => ({ default: m.FormsPage })))
const ResponsesPage = lazy(() => import('./modules/other/SurveysSubPages').then(m => ({ default: m.ResponsesPage })))

// ── Helpdesk SubPages ──
const TicketsPage = lazy(() => import('./modules/other/HelpdeskSubPages').then(m => ({ default: m.TicketsPage })))
const HelpdeskAgentsPage = lazy(() => import('./modules/other/HelpdeskSubPages').then(m => ({ default: m.HelpdeskAgentsPage })))
const KnowledgeBasePage = lazy(() => import('./modules/other/HelpdeskSubPages').then(m => ({ default: m.KnowledgeBasePage })))

// ── Reports SubPages ──
const SalesReportPage = lazy(() => import('./modules/other/ReportsSubPages').then(m => ({ default: m.SalesReportPage })))
const CallsReportPage = lazy(() => import('./modules/other/ReportsSubPages').then(m => ({ default: m.CallsReportPage })))
const MarketingReportPage = lazy(() => import('./modules/other/ReportsSubPages').then(m => ({ default: m.MarketingReportPage })))
const CustomReportPage = lazy(() => import('./modules/other/ReportsSubPages').then(m => ({ default: m.CustomReportPage })))

// ── Settings (Global) ──
const Settings = lazy(() => import('./pages/Settings'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const S = ({ children }) => <Suspense fallback={<PageLoader />}>{children}</Suspense>

function App() {
  return (
    <>
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
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* Default redirect to CRM */}
          <Route index element={<Navigate to="/crm" replace />} />

          {/* ═══ CRM Module ═══ */}
          {isModuleEnabled(features, 'crm') && (
            <>
              <Route path="crm" element={<RoleGatedRoute module="crm"><S><CRMDashboard /></S></RoleGatedRoute>} />
              <Route path="crm/leads" element={<RoleGatedRoute module="crm"><S><LeadsPage /></S></RoleGatedRoute>} />
              <Route path="crm/companies" element={<RoleGatedRoute module="crm"><S><CompaniesPage /></S></RoleGatedRoute>} />
              <Route path="crm/contacts" element={<RoleGatedRoute module="crm"><S><ContactsPage /></S></RoleGatedRoute>} />
              <Route path="crm/deals" element={<RoleGatedRoute module="crm"><S><DealsPage /></S></RoleGatedRoute>} />
              <Route path="crm/activities" element={<RoleGatedRoute module="crm"><S><ActivitiesPage /></S></RoleGatedRoute>} />
              <Route path="crm/tasks" element={<RoleGatedRoute module="crm"><S><TasksPage /></S></RoleGatedRoute>} />
              <Route path="crm/notes" element={<RoleGatedRoute module="crm"><S><NotesPage /></S></RoleGatedRoute>} />
              <Route path="crm/products" element={<RoleGatedRoute module="crm"><S><ProductsPage /></S></RoleGatedRoute>} />
              <Route path="crm/vendors" element={<RoleGatedRoute module="crm"><S><VendorsPage /></S></RoleGatedRoute>} />
              <Route path="crm/settings" element={<RoleGatedRoute module="crm"><S><CRMSettingsPage /></S></RoleGatedRoute>} />
              <Route path="crm/integrations" element={<RoleGatedRoute module="crm"><S><CRMIntegrationsPage /></S></RoleGatedRoute>} />
              <Route path="crm/lead-sources" element={<RoleGatedRoute module="crm"><S><LeadSourcesPage /></S></RoleGatedRoute>} />
            </>
          )}

          {/* ═══ Voice AI Module (includes Auto Dialer) ═══ */}
          {isModuleEnabled(features, 'voiceAI') && (
            <>
              <Route path="voice" element={<RoleGatedRoute module="voiceAI"><S><VoiceAIDashboard /></S></RoleGatedRoute>} />
              <Route path="voice/live-calls" element={<RoleGatedRoute module="voiceAI"><S><LiveCallsPage /></S></RoleGatedRoute>} />
              <Route path="voice/agents" element={<RoleGatedRoute module="voiceAI"><S><AIAgentsPage /></S></RoleGatedRoute>} />
              <Route path="voice/campaigns" element={<RoleGatedRoute module="voiceAI"><S><CampaignsPage /></S></RoleGatedRoute>} />
              <Route path="voice/contact-lists" element={<RoleGatedRoute module="voiceAI"><S><ContactListsPage /></S></RoleGatedRoute>} />
              <Route path="voice/call-logs" element={<RoleGatedRoute module="voiceAI"><S><CallLogsPage /></S></RoleGatedRoute>} />
              <Route path="voice/recordings" element={<RoleGatedRoute module="voiceAI"><S><RecordingsPage /></S></RoleGatedRoute>} />
              <Route path="voice/studio" element={<RoleGatedRoute module="voiceAI"><S><VoiceStudioPage /></S></RoleGatedRoute>} />
              <Route path="voice/analytics" element={<RoleGatedRoute module="voiceAI"><S><VoiceAnalyticsPage /></S></RoleGatedRoute>} />
            </>
          )}

          {/* ═══ Marketing Module ═══ */}
          {isModuleEnabled(features, 'marketing') && (
            <>
              <Route path="marketing" element={<RoleGatedRoute module="marketing"><S><MarketingDashboard /></S></RoleGatedRoute>} />
              <Route path="marketing/funnels" element={<RoleGatedRoute module="marketing"><S><FunnelsPage /></S></RoleGatedRoute>} />
              <Route path="marketing/landing-pages" element={<RoleGatedRoute module="marketing"><S><LandingPagesPage /></S></RoleGatedRoute>} />
              <Route path="marketing/email" element={<RoleGatedRoute module="marketing"><S><EmailCampaignsPage /></S></RoleGatedRoute>} />
              <Route path="marketing/whatsapp" element={<RoleGatedRoute module="marketing"><S><WhatsAppPage /></S></RoleGatedRoute>} />
              <Route path="marketing/sms" element={<RoleGatedRoute module="marketing"><S><SMSPage /></S></RoleGatedRoute>} />
              <Route path="marketing/forms" element={<RoleGatedRoute module="marketing"><S><MarketingFormsPage /></S></RoleGatedRoute>} />
              <Route path="marketing/funnels/builder" element={<RoleGatedRoute module="marketing"><S><FunnelBuilder /></S></RoleGatedRoute>} />
              <Route path="marketing/funnels/builder/:id" element={<RoleGatedRoute module="marketing"><S><FunnelBuilder /></S></RoleGatedRoute>} />
              <Route path="marketing/landing-pages/builder" element={<RoleGatedRoute module="marketing"><S><LandingPageBuilder /></S></RoleGatedRoute>} />
              <Route path="marketing/landing-pages/builder/:id" element={<RoleGatedRoute module="marketing"><S><LandingPageBuilder /></S></RoleGatedRoute>} />
            </>
          )}

          {/* ═══ Appointments Module ═══ */}
          {isModuleEnabled(features, 'appointments') && (
            <>
              <Route path="appointments" element={<RoleGatedRoute module="appointments"><S><AppointmentsDashboard /></S></RoleGatedRoute>} />
              <Route path="appointments/bookings" element={<RoleGatedRoute module="appointments"><S><BookingsPage /></S></RoleGatedRoute>} />
              <Route path="appointments/availability" element={<RoleGatedRoute module="appointments"><S><AvailabilityPage /></S></RoleGatedRoute>} />
              <Route path="appointments/services" element={<RoleGatedRoute module="appointments"><S><ServicesPage /></S></RoleGatedRoute>} />
              <Route path="appointments/pages" element={<RoleGatedRoute module="appointments"><S><BookingPagesPage /></S></RoleGatedRoute>} />
            </>
          )}

          {/* ═══ Automation Module ═══ */}
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

          {/* ═══ Inbox Module ═══ */}
          {isModuleEnabled(features, 'inbox') && (
            <>
              <Route path="inbox" element={<RoleGatedRoute module="inbox"><S><InboxDashboard /></S></RoleGatedRoute>} />
              <Route path="inbox/whatsapp" element={<RoleGatedRoute module="inbox"><S><WhatsAppInboxPage /></S></RoleGatedRoute>} />
              <Route path="inbox/sms" element={<RoleGatedRoute module="inbox"><S><SMSInboxPage /></S></RoleGatedRoute>} />
              <Route path="inbox/email" element={<RoleGatedRoute module="inbox"><S><EmailInboxPage /></S></RoleGatedRoute>} />
            </>
          )}

          {/* ═══ Surveys Module ═══ */}
          {isModuleEnabled(features, 'surveys') && (
            <>
              <Route path="surveys" element={<RoleGatedRoute module="surveys"><S><SurveysDashboard /></S></RoleGatedRoute>} />
              <Route path="surveys/forms" element={<RoleGatedRoute module="surveys"><S><SurveyFormsPage /></S></RoleGatedRoute>} />
              <Route path="surveys/responses" element={<RoleGatedRoute module="surveys"><S><ResponsesPage /></S></RoleGatedRoute>} />
            </>
          )}

          {/* ═══ Help Desk Module ═══ */}
          {isModuleEnabled(features, 'helpdesk') && (
            <>
              <Route path="helpdesk" element={<RoleGatedRoute module="helpdesk"><S><HelpdeskDashboard /></S></RoleGatedRoute>} />
              <Route path="helpdesk/tickets" element={<RoleGatedRoute module="helpdesk"><S><TicketsPage /></S></RoleGatedRoute>} />
              <Route path="helpdesk/agents" element={<RoleGatedRoute module="helpdesk"><S><HelpdeskAgentsPage /></S></RoleGatedRoute>} />
              <Route path="helpdesk/kb" element={<RoleGatedRoute module="helpdesk"><S><KnowledgeBasePage /></S></RoleGatedRoute>} />
            </>
          )}

          {/* ═══ Reports Module ═══ */}
          {isModuleEnabled(features, 'reports') && (
            <>
              <Route path="reports" element={<RoleGatedRoute module="analytics"><S><ReportsDashboard /></S></RoleGatedRoute>} />
              <Route path="reports/sales" element={<RoleGatedRoute module="analytics"><S><SalesReportPage /></S></RoleGatedRoute>} />
              <Route path="reports/calls" element={<RoleGatedRoute module="analytics"><S><CallsReportPage /></S></RoleGatedRoute>} />
              <Route path="reports/marketing" element={<RoleGatedRoute module="analytics"><S><MarketingReportPage /></S></RoleGatedRoute>} />
              <Route path="reports/custom" element={<RoleGatedRoute module="analytics"><S><CustomReportPage /></S></RoleGatedRoute>} />
            </>
          )}

          {/* ═══ White Label Module ═══ */}
          {isModuleEnabled(features, 'whiteLabel') && (
            <Route path="white-label" element={<RoleGatedRoute module="whiteLabel"><S><WhiteLabelPage /></S></RoleGatedRoute>} />
          )}

          {/* ═══ Templates Module ═══ */}
          {isModuleEnabled(features, 'templates') && (
            <Route path="templates" element={<S><IndustryTemplatesPage /></S>} />
          )}

          {/* ═══ Settings (Global) ═══ */}
          <Route path="settings" element={<S><Settings /></S>} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/crm" replace />} />
      </Routes>
    </>
  )
}

export default App
