/**
 * DashboardLayout — Tendent CRM
 * Modern SaaS shell (Linear / Vercel inspired)
 *  • Collapsible left sidebar with module groups
 *  • Sticky workspace header with breadcrumbs, search, ⌘K, profile
 *  • Tenant-brand aware (CSS vars: --brand-primary / --brand-secondary / --brand-accent)
 *  • Fully responsive (mobile drawer + bottom-tab fallback)
 */

import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import GlobalSearch from '../components/GlobalSearch';
import NotificationsPanel from '../components/NotificationsPanel';
import ErrorBoundary from '../components/ErrorBoundary';
import { getEnabledModules } from '../config/features';
import { defaultTheme } from '../config/theme';
import { defaultFeatures } from '../config/features';
import { usePermissions } from '../hooks/usePermissions';
import {
  Users, Mic, Phone, ClipboardList, Headphones, Megaphone, BarChart3, Calendar,
  Zap, MessageSquare, Activity, Settings, Search, Moon, Sun, Menu, X, LogOut,
  User, Building2, HelpCircle, ChevronDown, ChevronsLeft, ChevronsRight, FileText,
  Shield, Command, Sparkles,
} from 'lucide-react';

const iconMap = {
  Users, Mic, Phone, ClipboardList, Headphones, Megaphone, BarChart3, Calendar,
  Zap, MessageSquare, Activity, FileText,
};

const moduleRoutes = {
  crm: {
    path: '/crm',
    subNav: [
      { path: '/crm', label: 'Dashboard' },
      { path: '/crm/leads', label: 'Leads' },
      { path: '/crm/deals', label: 'Deals' },
      { path: '/crm/activities', label: 'Activities' },
      { path: '/crm/tasks', label: 'Tasks' },
      { path: '/crm/lead-sources', label: 'Lead Sources' },
      { path: '/crm/settings', label: 'Settings' },
    ],
  },
  quotation: {
    path: '/quotation',
    subNav: [
      { path: '/quotation', label: 'Dashboard' },
      { path: '/quotation/new', label: 'New Quote' },
      { path: '/quotation/templates', label: 'Templates' },
      { path: '/quotation/3d', label: '3D View' },
      { path: '/quotation/drawings', label: 'Drawings' },
      { path: '/quotation/pricing', label: 'Pricing' },
      { path: '/quotation/ai-image', label: 'AI Render' },
      { path: '/quotation/history', label: 'History' },
    ],
  },
  appointments: {
    path: '/appointments',
    subNav: [
      { path: '/appointments', label: 'Appointments' },
      { path: '/appointments/setup', label: 'Setup' },
    ],
  },
  automation: {
    path: '/automation',
    subNav: [
      { path: '/automation', label: 'Workflows' },
      { path: '/automation/templates', label: 'Templates' },
      { path: '/automation/triggers', label: 'Triggers' },
      { path: '/automation/logs', label: 'Logs' },
      { path: '/automation/builder', label: 'Builder' },
    ],
  },
  inbox: {
    path: '/inbox',
    subNav: [
      { path: '/inbox/whatsapp', label: 'WhatsApp' },
      { path: '/inbox/sms', label: 'SMS' },
      { path: '/inbox/email', label: 'Email' },
    ],
  },
  surveys: { path: '/surveys', subNav: [{ path: '/surveys', label: 'Surveys' }] },
  helpdesk: { path: '/helpdesk/tickets', subNav: [{ path: '/helpdesk/tickets', label: 'Tickets' }] },
  reports: {
    path: '/reports',
    subNav: [
      { path: '/reports', label: 'Overview' },
      { path: '/reports/sales', label: 'Sales' },
      { path: '/reports/calls', label: 'Calls' },
      { path: '/reports/custom', label: 'Custom' },
    ],
  },
};

export const AppContext = createContext();
export const useApp = () => useContext(AppContext);

const cn = (...c) => c.filter(Boolean).join(' ');

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('swetha_dark_mode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('tendent_sidebar_collapsed') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const features = defaultFeatures;
  const theme = defaultTheme;
  const { canAccess } = usePermissions();
  const enabledModules = getEnabledModules(features).filter((mod) => canAccess(mod.id));

  const currentModuleId = useMemo(
    () => Object.keys(moduleRoutes).find((id) => location.pathname.startsWith(moduleRoutes[id].path)) || enabledModules[0]?.id,
    [location.pathname, enabledModules]
  );
  const currentModule = enabledModules.find((m) => m.id === currentModuleId);
  const currentSubNav = moduleRoutes[currentModuleId]?.subNav || [];
  const currentSubItem = currentSubNav.find((s) => s.path === location.pathname);

  // ── Swetha Structures branding (single-company mode) ──────
  const brandName = 'Swetha Structures';
  const brandTagline = 'PEB Works & Industrial Buildings';
  const brandLogo = '';
  const brandPrimary = '#D97706';  // amber/orange — Swetha brand
  const brandSecondary = '#1e3a5f'; // dark blue
  const brandAccent = '#f59e0b';    // warm amber
  const brandFont = 'Inter';

  // ── Effects ────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('swetha_dark_mode', darkMode);
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('tendent_sidebar_collapsed', collapsed);
  }, [collapsed]);

  useEffect(() => {
    if (brandName) document.title = brandName;
  }, [brandName]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', brandPrimary);
    root.style.setProperty('--brand-secondary', brandSecondary);
    root.style.setProperty('--brand-accent', brandAccent);
    root.style.setProperty('--brand-font', brandFont);
  }, [brandPrimary, brandSecondary, brandAccent, brandFont]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === '[' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (userMenuOpen) {
      const handler = () => setUserMenuOpen(false);
      setTimeout(() => document.addEventListener('click', handler), 0);
      return () => document.removeEventListener('click', handler);
    }
  }, [userMenuOpen]);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const initials =
    user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  // ── Sidebar item ───────────────────────────────────────────
  const SidebarItem = ({ mod }) => {
    const Icon = iconMap[mod.icon] || Users;
    const route = moduleRoutes[mod.id];
    if (!route) return null;
    const isActive = location.pathname.startsWith(route.path);
    return (
      <Link
        to={route.path}
        title={collapsed ? mod.name : undefined}
        className={cn(
          'group relative flex items-center gap-3 rounded-xl text-sm font-semibold transition-all duration-200',
          collapsed ? 'justify-center h-11 w-11 mx-auto' : 'h-10 px-3',
          isActive
            ? 'text-white shadow-lg'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60 hover:shadow-sm'
        )}
        style={
          isActive
            ? {
                background:
                  'linear-gradient(135deg, var(--brand-primary), color-mix(in oklab, var(--brand-primary) 60%, var(--brand-accent, var(--brand-primary))))',
                boxShadow: '0 8px 20px -6px color-mix(in oklab, var(--brand-primary) 60%, transparent)',
              }
            : undefined
        }
      >
        <Icon className="w-[18px] h-[18px] flex-shrink-0 relative z-10" strokeWidth={isActive ? 2.6 : 2.2} />
        {!collapsed && <span className="truncate relative z-10">{mod.name}</span>}
        {isActive && !collapsed && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/90 relative z-10" />
        )}
      </Link>
    );
  };

  // ── Sidebar component ──────────────────────────────────────
  const Sidebar = ({ mobile = false }) => (
    <aside
      className={cn(
        'flex flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800',
        mobile ? 'w-72 h-full' : cn('hidden lg:flex h-screen sticky top-0', collapsed ? 'w-[72px]' : 'w-64'),
        'transition-[width] duration-200 ease-out'
      )}
    >
      {/* Brand */}
      <div className={cn('flex items-center h-16 border-b border-slate-100 dark:border-slate-800', collapsed && !mobile ? 'justify-center px-2' : 'px-5 gap-3')}>
        <Link to="/" className="flex items-center gap-3 min-w-0" title={brandTagline}>
          {brandLogo ? (
            <img src={brandLogo} alt={brandName} className="w-9 h-9 rounded-xl object-contain bg-white shadow-sm" />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${brandPrimary}, ${brandAccent})`,
              }}
            >
              <Building2 className="w-[18px] h-[18px] text-white" strokeWidth={2.4} />
            </div>
          )}
          {(!collapsed || mobile) && (
            <div className="min-w-0">
              <div className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white truncate" style={{ fontFamily: brandFont }}>
                {brandName}
              </div>
              {brandTagline && <div className="text-[11px] text-slate-500 truncate">{brandTagline}</div>}
            </div>
          )}
        </Link>
      </div>

      {/* Quick search trigger */}
      {(!collapsed || mobile) && (
        <div className="px-3 pt-4">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 h-9 px-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-sm text-slate-500 hover:border-slate-300 dark:hover:border-slate-700 transition"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono text-slate-400 bg-white dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </button>
        </div>
      )}
      {collapsed && !mobile && (
        <div className="px-2 pt-4 flex justify-center">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Search ⌘K"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modules */}
      <nav className={cn('flex-1 overflow-y-auto py-4 space-y-1', collapsed && !mobile ? 'px-2' : 'px-3')}>
        {(!collapsed || mobile) && (
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </div>
        )}
        {enabledModules.map((mod) => <SidebarItem key={mod.id} mod={mod} />)}
      </nav>

      {/* Footer */}
      <div className={cn('border-t border-slate-100 dark:border-slate-800 py-3', collapsed && !mobile ? 'px-2' : 'px-3')}>
        <Link
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition',
            collapsed && !mobile ? 'justify-center h-10 w-10 mx-auto' : 'h-9 px-3'
          )}
        >
          <Settings className="w-[18px] h-[18px]" />
          {(!collapsed || mobile) && <span>Settings</span>}
        </Link>
        {!mobile && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'mt-1 flex items-center gap-3 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition',
              collapsed ? 'justify-center h-10 w-10 mx-auto' : 'h-9 px-3 w-full'
            )}
          >
            {collapsed ? <ChevronsRight className="w-[18px] h-[18px]" /> : <ChevronsLeft className="w-[18px] h-[18px]" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <AppContext.Provider value={{ darkMode, setDarkMode, features, theme, user }}>
      <div className={cn('min-h-screen', darkMode && 'dark')} style={{ fontFamily: brandFont }}>
        <div className="relative min-h-screen text-slate-900 dark:text-slate-100 flex bg-[#f6f7fb] dark:bg-slate-950">
          <div className="relative flex w-full">
          {/* Desktop Sidebar */}
          <Sidebar />

          {/* Mobile Drawer */}
          {mobileOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
              <div className="absolute left-0 top-0 bottom-0 animate-in slide-in-from-left">
                <Sidebar mobile />
              </div>
            </div>
          )}

          {/* Main column */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between h-16 px-4 lg:px-6">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setMobileOpen(true)}
                    className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                  {/* Breadcrumbs */}
                  <nav className="flex items-center gap-2 text-sm min-w-0">
                    {currentModule && (
                      <>
                        <span className="text-slate-400 hidden sm:inline">{currentModule.name}</span>
                        <span className="text-slate-300 hidden sm:inline">/</span>
                      </>
                    )}
                    <span className="font-semibold text-slate-900 dark:text-white truncate">
                      {currentSubItem?.label || currentModule?.name || 'Dashboard'}
                    </span>
                  </nav>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSearchOpen(true)}
                    className="hidden md:flex items-center gap-2 h-9 px-3 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Search className="w-4 h-4" />
                    <kbd className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      ⌘K
                    </kbd>
                  </button>
                  <button
                    onClick={() => setSearchOpen(true)}
                    className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Search className="w-5 h-5 text-slate-500" />
                  </button>
                  <NotificationsPanel />
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Toggle theme"
                  >
                    {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-500" />}
                  </button>

                  <div className="relative ml-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setUserMenuOpen(!userMenuOpen); }}
                      className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                        style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandAccent})` }}
                      >
                        {initials}
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                    </button>
                    {userMenuOpen && (
                      <div
                        className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">{user?.name || 'User'}</p>
                          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                          <span
                            className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                            style={{
                              background: `color-mix(in oklab, ${brandPrimary} 12%, transparent)`,
                              color: brandPrimary,
                            }}
                          >
                            {user?.role || 'user'}
                          </span>
                        </div>
                        {[
                          { icon: User, label: 'Profile', path: '/settings' },
                          { icon: Building2, label: 'Workspace', path: '/settings' },
                          { icon: HelpCircle, label: 'Help & Support', path: '/helpdesk' },
                          { icon: Shield, label: 'Contact Platform Support', path: '/platform-support' },
                        ].map((item) => (
                          <Link
                            key={item.label}
                            to={item.path}
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <item.icon className="w-4 h-4 text-slate-400" />
                            {item.label}
                          </Link>
                        ))}
                        <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                          <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sub Navigation Tabs */}
              {currentSubNav.length > 1 && (
                <div className="px-4 lg:px-6 overflow-x-auto scrollbar-hide border-t border-slate-100 dark:border-slate-800/60">
                  <nav className="flex items-center gap-1 h-11 min-w-max">
                    {currentSubNav.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={cn(
                            'relative px-3 h-11 inline-flex items-center text-sm font-medium whitespace-nowrap transition-colors',
                            isActive
                              ? 'text-slate-900 dark:text-white'
                              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                          )}
                        >
                          {item.label}
                          {isActive && (
                            <span
                              className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full"
                              style={{ backgroundColor: 'var(--brand-primary)' }}
                            />
                          )}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              )}
            </header>

            {/* Main */}
            <main className="flex-1 px-4 lg:px-6 py-6 lg:py-8">
              <div className="max-w-[1600px] mx-auto w-full">
                <ErrorBoundary>
                  <Outlet />
                </ErrorBoundary>
              </div>
            </main>

            {/* Footer */}
            <footer className="px-6 py-4 border-t border-slate-100/80 dark:border-slate-800 text-center text-xs text-slate-400">
              &copy; 2026 {brandName}. Crafted with care.
            </footer>
          </div>
          </div>
        </div>

        <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    </AppContext.Provider>
  );
}
