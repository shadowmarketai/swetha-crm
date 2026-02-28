import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, TrendingUp, DollarSign, Phone, Users, Target, BarChart3 } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ==================== SALES REPORT PAGE ====================
export function SalesReportPage() {
  const stats = [
    { label: 'Total Revenue', value: '₹24.5L', change: '+18%', icon: DollarSign, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Deals Closed', value: '142', change: '+12%', icon: Target, color: 'bg-indigo-100 text-indigo-600' },
    { label: 'Pipeline Value', value: '₹68.2L', change: '+8%', icon: TrendingUp, color: 'bg-purple-100 text-purple-600' },
    { label: 'Conversion Rate', value: '24.8%', change: '+3.2%', icon: BarChart3, color: 'bg-amber-100 text-amber-600' },
  ];

  const data = [
    { month: 'Sep', revenue: 1450000, deals: 18 }, { month: 'Oct', revenue: 1680000, deals: 22 },
    { month: 'Nov', revenue: 1920000, deals: 25 }, { month: 'Dec', revenue: 2080000, deals: 28 },
    { month: 'Jan', revenue: 2280000, deals: 32 }, { month: 'Feb', revenue: 2450000, deals: 35 },
  ];

  const topDeals = [
    { name: 'Enterprise License - Tech Solutions', value: '₹8.5L', agent: 'Amit Singh', date: '2026-02-22' },
    { name: 'Annual Plan - Rajesh Kumar', value: '₹4.2L', agent: 'Neha Patel', date: '2026-02-20' },
    { name: 'Pro Plan - StartupXYZ', value: '₹2.8L', agent: 'Ravi Kumar', date: '2026-02-18' },
    { name: 'Team Plan - Digital Agency', value: '₹1.9L', agent: 'Amit Singh', date: '2026-02-15' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sales Report</h1><p className="text-sm text-slate-500">Revenue and deals performance</p></div>
        <button onClick={() => toast.success('Sales report exported')} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"><Download className="w-4 h-4" /> Export</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${s.color}`}><s.icon className="w-5 h-5" /></div>
              <span className="text-sm font-medium text-emerald-600">{s.change}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Revenue Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${v / 100000}L`} />
              <Tooltip formatter={v => [`₹${(v / 100000).toFixed(1)}L`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700"><h3 className="font-semibold text-slate-900 dark:text-white">Top Deals</h3></div>
        <table className="w-full min-w-[500px]">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Deal</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Value</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Agent</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody>
            {topDeals.map((d, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{d.name}</td>
                <td className="py-3 px-4 text-emerald-600 font-semibold">{d.value}</td>
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{d.agent}</td>
                <td className="py-3 px-4 text-sm text-slate-500">{d.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== CALLS REPORT PAGE ====================
export function CallsReportPage() {
  const stats = [
    { label: 'Total Calls', value: '8,934', change: '+32%', icon: Phone, color: 'bg-blue-100 text-blue-600' },
    { label: 'Avg Duration', value: '4m 23s', change: '+8%', icon: BarChart3, color: 'bg-purple-100 text-purple-600' },
    { label: 'Success Rate', value: '78.4%', change: '+5%', icon: Target, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'AI Calls', value: '6,247', change: '+45%', icon: TrendingUp, color: 'bg-indigo-100 text-indigo-600' },
  ];

  const data = [
    { agent: 'Voice AI Bot', calls: 6247, success: 82, avgDuration: '3m 45s' },
    { agent: 'Amit Singh', calls: 892, success: 76, avgDuration: '5m 12s' },
    { agent: 'Neha Patel', calls: 756, success: 81, avgDuration: '4m 30s' },
    { agent: 'Ravi Kumar', calls: 623, success: 74, avgDuration: '6m 08s' },
    { agent: 'Arjun Verma', calls: 416, success: 79, avgDuration: '4m 55s' },
  ];

  const chartData = [
    { day: 'Mon', calls: 1456 }, { day: 'Tue', calls: 1678 }, { day: 'Wed', calls: 1245 },
    { day: 'Thu', calls: 1890 }, { day: 'Fri', calls: 1567 }, { day: 'Sat', calls: 654 }, { day: 'Sun', calls: 444 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Call Reports</h1><p className="text-sm text-slate-500">Call volume and performance analytics</p></div>
        <button onClick={() => toast.success('Call report exported')} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"><Download className="w-4 h-4" /> Export</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3"><div className={`p-2 rounded-lg ${s.color}`}><s.icon className="w-5 h-5" /></div><span className="text-sm font-medium text-emerald-600">{s.change}</span></div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p><p className="text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Calls This Week</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="calls" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700"><h3 className="font-semibold text-slate-900 dark:text-white">Calls by Agent</h3></div>
        <table className="w-full min-w-[500px]">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Agent</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Total Calls</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Success Rate</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Avg Duration</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{d.agent}</td>
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{d.calls.toLocaleString()}</td>
                <td className="py-3 px-4"><span className={`text-sm font-medium ${d.success >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>{d.success}%</span></td>
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{d.avgDuration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== MARKETING REPORT PAGE ====================
export function MarketingReportPage() {
  const stats = [
    { label: 'Leads Generated', value: '2,847', change: '+12%', icon: Users, color: 'bg-indigo-100 text-indigo-600' },
    { label: 'Cost per Lead', value: '₹187', change: '-8%', icon: DollarSign, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Campaign ROI', value: '340%', change: '+15%', icon: TrendingUp, color: 'bg-purple-100 text-purple-600' },
    { label: 'Active Campaigns', value: '12', change: '+3', icon: Target, color: 'bg-amber-100 text-amber-600' },
  ];

  const channelData = [
    { channel: 'Google Ads', leads: 1245, spend: '₹2.3L', cpl: '₹185', roi: '380%' },
    { channel: 'Meta Ads', leads: 892, spend: '₹1.8L', cpl: '₹202', roi: '310%' },
    { channel: 'WhatsApp', leads: 456, spend: '₹45K', cpl: '₹99', roi: '520%' },
    { channel: 'Email', leads: 254, spend: '₹12K', cpl: '₹47', roi: '890%' },
  ];

  const chartData = [
    { month: 'Sep', leads: 1450 }, { month: 'Oct', leads: 1680 },
    { month: 'Nov', leads: 1920 }, { month: 'Dec', leads: 2080 },
    { month: 'Jan', leads: 2480 }, { month: 'Feb', leads: 2847 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Marketing Report</h1><p className="text-sm text-slate-500">Campaign performance and ROI</p></div>
        <button onClick={() => toast.success('Marketing report exported')} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"><Download className="w-4 h-4" /> Export</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3"><div className={`p-2 rounded-lg ${s.color}`}><s.icon className="w-5 h-5" /></div><span className="text-sm font-medium text-emerald-600">{s.change}</span></div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p><p className="text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Lead Generation Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="leads" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700"><h3 className="font-semibold text-slate-900 dark:text-white">Channel Breakdown</h3></div>
        <table className="w-full min-w-[500px]">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Channel</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Leads</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Spend</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">CPL</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">ROI</th>
            </tr>
          </thead>
          <tbody>
            {channelData.map((d, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{d.channel}</td>
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{d.leads.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{d.spend}</td>
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{d.cpl}</td>
                <td className="py-3 px-4 text-sm font-medium text-emerald-600">{d.roi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== CUSTOM REPORT PAGE ====================
export function CustomReportPage() {
  const [metric1, setMetric1] = useState('revenue');
  const [metric2, setMetric2] = useState('leads');
  const [dateRange, setDateRange] = useState('30d');

  const metricOptions = [
    { value: 'revenue', label: 'Revenue' },
    { value: 'leads', label: 'Leads' },
    { value: 'calls', label: 'Calls' },
    { value: 'conversion', label: 'Conversion Rate' },
    { value: 'tickets', label: 'Support Tickets' },
    { value: 'campaigns', label: 'Campaign Clicks' },
  ];

  const data = [
    { period: 'Week 1', revenue: 580000, leads: 456, calls: 1890, conversion: 22, tickets: 34, campaigns: 2340 },
    { period: 'Week 2', revenue: 620000, leads: 512, calls: 2100, conversion: 24, tickets: 28, campaigns: 2560 },
    { period: 'Week 3', revenue: 590000, leads: 489, calls: 1950, conversion: 23, tickets: 31, campaigns: 2180 },
    { period: 'Week 4', revenue: 660000, leads: 534, calls: 2250, conversion: 26, tickets: 22, campaigns: 2890 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Custom Report</h1>
        <p className="text-sm text-slate-500">Build custom reports with your chosen metrics</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Primary Metric</label>
            <select value={metric1} onChange={e => setMetric1(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
              {metricOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Secondary Metric</label>
            <select value={metric2} onChange={e => setMetric2(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
              {metricOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date Range</label>
            <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey={metric1} fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey={metric2} fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">Data Table</h3>
        </div>
        <table className="w-full min-w-[400px]">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Period</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">{metricOptions.find(m => m.value === metric1)?.label}</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">{metricOptions.find(m => m.value === metric2)?.label}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{d.period}</td>
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{typeof d[metric1] === 'number' ? d[metric1].toLocaleString() : d[metric1]}</td>
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{typeof d[metric2] === 'number' ? d[metric2].toLocaleString() : d[metric2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
