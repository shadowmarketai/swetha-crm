/**
 * DashboardLayout - Clean Horizontal Navigation
 * Based on voiceflow-modular MainLayout
 * No nested sidebars - Modular & White-label Ready
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import GlobalSearch from '../components/GlobalSearch';
import NotificationsPanel from '../components/NotificationsPanel';
import ErrorBoundary from '../components/ErrorBoundary';
import { getEnabledModules, isModuleEnabled } from '../config/features';
import { defaultTheme } from '../config/theme';
import { defaultFeatures } from '../config/features';
import { usePermissions } from '../hooks/usePermissions';
import {
  Users, Mic, Phone, ClipboardList, Headphones, Megaphone, BarChart3, Calendar, Zap, MessageSquare, Activity,
  Settings, Bell, Search, Moon, Sun, Menu, X, LogOut, User, Building2, HelpCircle, ChevronDown,
  Palette, Layout,
} from 'lucide-react';

const iconMap = { Users, Mic, Phone, ClipboardList, Headphones, Megaphone, BarChart3, Calendar, Zap, MessageSquare, Activity, Palette, Layout };
const moduleRoutes = {
  crm: {
    path: '/crm',
    subNav: [
      { path: '/crm', label: 'Dashboard' },
      { path: '/crm/leads', label: 'Leads' },
      { path: '/crm/companies', label: 'Companies' },
      { path: '/crm/contacts', label: 'Contacts' },
      { path: '/crm/deals', label: 'Deals' },
      { path: '/crm/activities', label: 'Activities' },
      { path: '/crm/tasks', label: 'Tasks' },
      { path: '/crm/notes', label: 'Notes' },
      { path: '/crm/products', label: 'Products' },
      { path: '/crm/vendors', label: 'Vendors' },
      { path: '/crm/integrations', label: 'Integrations' },
      { path: '/crm/lead-sources', label: 'Lead Sources' },
      { path: '/crm/settings', label: 'Settings' },
    ]
  },
  voiceAI: {
    path: '/voice',
    subNav: [
      { path: '/voice', label: 'Dashboard' },
      { path: '/voice/live-calls', label: 'Live Calls' },
      { path: '/voice/agents', label: 'AI Agents' },
      { path: '/voice/campaigns', label: 'Campaigns' },
      { path: '/voice/contact-lists', label: 'Contact Lists' },
      { path: '/voice/call-logs', label: 'Call History' },
      { path: '/voice/recordings', label: 'Recordings' },
      { path: '/voice/studio', label: 'Voice Studio' },
      { path: '/voice/analytics', label: 'Analytics' },
    ]
  },
  marketing: {
    path: '/marketing',
    subNav: [
      { path: '/marketing', label: 'Dashboard' },
      { path: '/marketing/funnels', label: 'Funnels' },
      { path: '/marketing/landing-pages', label: 'Landing Pages' },
      { path: '/marketing/email', label: 'Email' },
      { path: '/marketing/whatsapp', label: 'WhatsApp' },
      { path: '/marketing/sms', label: 'SMS' },
      { path: '/marketing/forms', label: 'Forms' },
      { path: '/marketing/funnel-builder', label: 'Funnel Builder' },
      { path: '/marketing/page-builder', label: 'Page Builder' },
    ]
  },
  appointments: {
    path: '/appointments',
    subNav: [
      { path: '/appointments', label: 'Calendar' },
      { path: '/appointments/bookings', label: 'Bookings' },
      { path: '/appointments/availability', label: 'Availability' },
      { path: '/appointments/services', label: 'Services' },
      { path: '/appointments/pages', label: 'Booking Pages' },
    ]
  },
  automation: {
    path: '/automation',
    subNav: [
      { path: '/automation', label: 'Workflows' },
      { path: '/automation/templates', label: 'Templates' },
      { path: '/automation/triggers', label: 'Triggers' },
      { path: '/automation/logs', label: 'Logs' },
      { path: '/automation/builder', label: 'Builder' },
    ]
  },
  inbox: {
    path: '/inbox',
    subNav: [
      { path: '/inbox', label: 'All Messages' },
      { path: '/inbox/whatsapp', label: 'WhatsApp' },
      { path: '/inbox/sms', label: 'SMS' },
      { path: '/inbox/email', label: 'Email' },
    ]
  },
  surveys: {
    path: '/surveys',
    subNav: [
      { path: '/surveys', label: 'Dashboard' },
      { path: '/surveys/forms', label: 'Forms' },
      { path: '/surveys/responses', label: 'Responses' },
    ]
  },
  helpdesk: {
    path: '/helpdesk',
    subNav: [
      { path: '/helpdesk', label: 'Dashboard' },
      { path: '/helpdesk/tickets', label: 'Tickets' },
      { path: '/helpdesk/agents', label: 'Agents' },
      { path: '/helpdesk/kb', label: 'Knowledge Base' },
    ]
  },
  reports: {
    path: '/reports',
    subNav: [
      { path: '/reports', label: 'Overview' },
      { path: '/reports/sales', label: 'Sales' },
      { path: '/reports/calls', label: 'Calls' },
      { path: '/reports/marketing', label: 'Marketing' },
      { path: '/reports/custom', label: 'Custom' },
    ]
  },
  whiteLabel: {
    path: '/white-label',
    subNav: [
      { path: '/white-label', label: 'White Label' },
    ]
  },
  templates: {
    path: '/templates',
    subNav: [
      { path: '/templates', label: 'Industry Templates' },
    ]
  },
};

export const AppContext = createContext();
export const useApp = () => useContext(AppContext);

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('voiceflow_dark_mode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const features = defaultFeatures;
  const theme = defaultTheme;
  const { canAccess } = usePermissions();
  const enabledModules = getEnabledModules(features).filter(mod => canAccess(mod.id));
  const currentModuleId = Object.keys(moduleRoutes).find(id => location.pathname.startsWith(moduleRoutes[id].path)) || enabledModules[0]?.id;
  const currentSubNav = moduleRoutes[currentModuleId]?.subNav || [];

  // Persist dark mode & sync to <html> for portals/modals
  useEffect(() => {
    localStorage.setItem('voiceflow_dark_mode', darkMode);
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Global Cmd/Ctrl+K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    if (userMenuOpen) {
      const handler = () => setUserMenuOpen(false);
      setTimeout(() => document.addEventListener('click', handler), 0);
      return () => document.removeEventListener('click', handler);
    }
  }, [userMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <AppContext.Provider value={{ darkMode, setDarkMode, features, theme, user }}>
      <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
          {/* Top Header */}
          <header className="sticky top-0 z-50 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-4 h-14">
              <div className="flex items-center gap-6">
                <Link to="/" className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Mic className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-lg text-slate-900 dark:text-white hidden sm:block">{theme.brand.name}</span>
                </Link>
                {/* Module Tabs - Desktop */}
                <nav className="hidden lg:flex items-center gap-1">
                  {enabledModules.map(mod => {
                    const Icon = iconMap[mod.icon] || Users;
                    const route = moduleRoutes[mod.id];
                    if (!route) return null;
                    const isActive = location.pathname.startsWith(route.path);
                    return (
                      <Link key={mod.id} to={route.path} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}>
                        <Icon className="w-4 h-4" />{mod.name}
                      </Link>
                    );
                  })}
                </nav>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSearchOpen(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  <Search className="w-5 h-5 text-slate-500" />
                </button>
                <NotificationsPanel />
                <button onClick={() => setDarkMode(!darkMode)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">{darkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-500" />}</button>
                <Link to="/settings" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><Settings className="w-5 h-5 text-slate-500" /></Link>
                <div className="relative ml-2">
                  <button onClick={(e) => { e.stopPropagation(); setUserMenuOpen(!userMenuOpen); }} className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg p-1.5">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">{initials}</div>
                    <ChevronDown className="w-4 h-4 text-slate-500 hidden sm:block" />
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50" onClick={e => e.stopPropagation()}>
                      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                        <p className="font-medium text-slate-900 dark:text-white">{user?.name || 'User'}</p>
                        <p className="text-sm text-slate-500">{user?.email}</p>
                        <p className="text-xs text-indigo-500 capitalize mt-0.5">{user?.role || 'user'}</p>
                      </div>
                      {[{ icon: User, label: 'Profile', path: '/settings' }, { icon: Building2, label: 'Company', path: '/settings' }, { icon: HelpCircle, label: 'Help', path: '/helpdesk' }].map(item => (
                        <Link key={item.label} to={item.path} onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                          <item.icon className="w-4 h-4" />{item.label}
                        </Link>
                      ))}
                      <div className="border-t border-slate-100 dark:border-slate-700 mt-2 pt-2">
                        <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <LogOut className="w-4 h-4" />Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2">{mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
              </div>
            </div>

            {/* Sub Navigation */}
            {currentSubNav.length > 0 && (
              <div className="border-t border-slate-100 dark:border-slate-700/50 px-4 overflow-x-auto scrollbar-hide">
                <nav className="flex items-center gap-1 h-11">
                  {currentSubNav.map(item => (
                    <Link key={item.path} to={item.path} className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      location.pathname === item.path ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}>{item.label}</Link>
                  ))}
                </nav>
              </div>
            )}

            {/* Mobile Menu */}
            {mobileMenuOpen && (
              <div className="lg:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 space-y-1">
                {enabledModules.map(mod => {
                  const Icon = iconMap[mod.icon] || Users;
                  const route = moduleRoutes[mod.id];
                  if (!route) return null;
                  return (
                    <Link key={mod.id} to={route.path} onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                      location.pathname.startsWith(route.path) ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700' : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      <Icon className="w-5 h-5" />{mod.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </header>

          {/* Main Content */}
          <main className="flex-1 p-4 md:p-6">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>

          {/* Footer */}
          <footer className="py-4 px-6 border-t border-slate-200 dark:border-slate-700 text-center text-sm text-slate-500">
            © 2026 {theme.brand.name} by ShadowMarket. All rights reserved.
          </footer>
        </div>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </AppContext.Provider>
  );
}
