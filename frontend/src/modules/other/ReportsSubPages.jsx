import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { analyticsAPI } from '../../services/api';
import { Download, TrendingUp, DollarSign, Phone, Users, Target, BarChart3 } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  PageHeader,
  Stat,
  Card,
  CardHeader,
  CardBody,
  DataTable,
  Button,
  Badge,
  Select,
  Skeleton,
  EmptyState,
} from '../../components/ui/primitives';

// ==================== SALES REPORT PAGE ====================
export function SalesReportPage() {
  const [stats, setStats] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [topDeals, setTopDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    analyticsAPI.getDashboard({ period: '30d' }).then(res => {
      if (cancelled) return;
      const d = res.data;
      if (d) {
        setStats([
          { label: 'Total Revenue', value: d.total_revenue ? `\u20B9${(d.total_revenue / 100000).toFixed(1)}L` : '\u20B90', change: d.revenue_change || '-', changeType: 'up', icon: DollarSign, accent: '#10b981', accentTo: '#059669' },
          { label: 'Deals Closed', value: d.deals_closed?.toString() || '0', change: d.deals_change || '-', changeType: 'up', icon: Target, accent: '#6366f1', accentTo: '#4f46e5' },
          { label: 'Pipeline Value', value: d.pipeline_value ? `\u20B9${(d.pipeline_value / 100000).toFixed(1)}L` : '\u20B90', change: d.pipeline_change || '-', changeType: 'up', icon: TrendingUp, accent: '#a855f7', accentTo: '#9333ea' },
          { label: 'Conversion Rate', value: d.conversion_rate ? `${d.conversion_rate}%` : '0%', change: d.conversion_change || '-', changeType: 'up', icon: BarChart3, accent: '#f59e0b', accentTo: '#d97706' },
        ]);
        if (d.revenue_trend && Array.isArray(d.revenue_trend)) {
          setChartData(d.revenue_trend);
        }
        if (d.top_deals && Array.isArray(d.top_deals)) {
          setTopDeals(d.top_deals.map((deal, i) => ({ id: deal.id ?? i, ...deal })));
        }
      }
    }).catch(() => {
      toast.error('Failed to load sales report');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const topDealsColumns = [
    { key: 'name', header: 'Deal', render: (row) => <span className="font-medium text-slate-900 dark:text-white">{row.name}</span> },
    { key: 'value', header: 'Value', render: (row) => <Badge tone="success">{row.value}</Badge> },
    { key: 'agent', header: 'Agent' },
    { key: 'date', header: 'Date' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Report"
        subtitle="Revenue and deals performance"
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={Download}
            onClick={() => toast.success('Sales report exported')}
          >
            Export
          </Button>
        }
      />

      {stats.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No sales data"
          description="Sales data will appear here once deals are recorded."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <Stat
                key={i}
                label={s.label}
                value={s.value}
                change={s.change}
                changeType={s.changeType}
                icon={s.icon}
                accent={s.accent}
                accentTo={s.accentTo}
              />
            ))}
          </div>

          {chartData.length > 0 && (
            <Card>
              <CardHeader title="Revenue Trend" />
              <CardBody>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `\u20B9${v / 100000}L`} />
                      <Tooltip formatter={v => [`\u20B9${(v / 100000).toFixed(1)}L`, 'Revenue']} />
                      <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          )}

          {topDeals.length > 0 && (
            <Card>
              <CardHeader title="Top Deals" />
              <DataTable columns={topDealsColumns} rows={topDeals} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ==================== CALLS REPORT PAGE ====================
export function CallsReportPage() {
  const [stats, setCallStats] = useState([]);
  const [agentData, setAgentData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    analyticsAPI.getCallVolume({ period: '30d' }).then(res => {
      if (cancelled) return;
      const d = res.data;
      if (d) {
        setCallStats([
          { label: 'Total Calls', value: d.total_calls?.toLocaleString() || '0', change: d.calls_change || '-', changeType: 'up', icon: Phone, accent: '#3b82f6', accentTo: '#2563eb' },
          { label: 'Avg Duration', value: d.avg_duration || '0m 0s', change: d.duration_change || '-', changeType: 'up', icon: BarChart3, accent: '#a855f7', accentTo: '#9333ea' },
          { label: 'Success Rate', value: d.success_rate ? `${d.success_rate}%` : '0%', change: d.success_change || '-', changeType: 'up', icon: Target, accent: '#10b981', accentTo: '#059669' },
          { label: 'AI Calls', value: d.ai_calls?.toLocaleString() || '0', change: d.ai_change || '-', changeType: 'up', icon: TrendingUp, accent: '#6366f1', accentTo: '#4f46e5' },
        ]);
        if (d.by_agent && Array.isArray(d.by_agent)) {
          setAgentData(d.by_agent.map((a, i) => ({ id: a.id ?? i, ...a })));
        }
        if (d.daily && Array.isArray(d.daily)) {
          setChartData(d.daily);
        }
      }
    }).catch(() => {
      toast.error('Failed to load call reports');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const callsByAgentColumns = [
    { key: 'agent', header: 'Agent', render: (row) => <span className="font-medium text-slate-900 dark:text-white">{row.agent}</span> },
    { key: 'calls', header: 'Total Calls', render: (row) => (row.calls ?? 0).toLocaleString() },
    {
      key: 'success',
      header: 'Success Rate',
      render: (row) => (
        <Badge tone={(row.success ?? 0) >= 80 ? 'success' : 'warning'}>
          {row.success ?? 0}%
        </Badge>
      ),
    },
    { key: 'avgDuration', header: 'Avg Duration' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Call Reports"
        subtitle="Call volume and performance analytics"
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={Download}
            onClick={() => toast.success('Call report exported')}
          >
            Export
          </Button>
        }
      />

      {stats.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="No call data"
          description="Call analytics will appear here once calls are made."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <Stat
                key={i}
                label={s.label}
                value={s.value}
                change={s.change}
                changeType={s.changeType}
                icon={s.icon}
                accent={s.accent}
                accentTo={s.accentTo}
              />
            ))}
          </div>

          {chartData.length > 0 && (
            <Card>
              <CardHeader title="Calls This Week" />
              <CardBody>
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
              </CardBody>
            </Card>
          )}

          {agentData.length > 0 && (
            <Card>
              <CardHeader title="Calls by Agent" />
              <DataTable columns={callsByAgentColumns} rows={agentData} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ==================== MARKETING REPORT PAGE ====================
export function MarketingReportPage() {
  const [stats, setStats] = useState([]);
  const [channelData, setChannelData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    analyticsAPI.getConversions({ period: '30d' }).then(res => {
      if (cancelled) return;
      const d = res.data;
      if (d) {
        setStats([
          { label: 'Leads Generated', value: d.leads_generated?.toLocaleString() || '0', change: d.leads_change || '-', changeType: 'up', icon: Users, accent: '#6366f1', accentTo: '#4f46e5' },
          { label: 'Cost per Lead', value: d.cost_per_lead ? `\u20B9${d.cost_per_lead}` : '\u20B90', change: d.cpl_change || '-', changeType: 'down', icon: DollarSign, accent: '#10b981', accentTo: '#059669' },
          { label: 'Campaign ROI', value: d.campaign_roi ? `${d.campaign_roi}%` : '0%', change: d.roi_change || '-', changeType: 'up', icon: TrendingUp, accent: '#a855f7', accentTo: '#9333ea' },
          { label: 'Active Campaigns', value: d.active_campaigns?.toString() || '0', change: d.campaigns_change || '-', changeType: 'up', icon: Target, accent: '#f59e0b', accentTo: '#d97706' },
        ]);
        if (d.channels && Array.isArray(d.channels)) {
          setChannelData(d.channels.map((c, i) => ({ id: c.id ?? i, ...c })));
        }
        if (d.trend && Array.isArray(d.trend)) {
          setChartData(d.trend);
        }
      }
    }).catch(() => {
      toast.error('Failed to load marketing report');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const channelColumns = [
    { key: 'channel', header: 'Channel', render: (row) => <span className="font-medium text-slate-900 dark:text-white">{row.channel}</span> },
    { key: 'leads', header: 'Leads', render: (row) => (row.leads ?? 0).toLocaleString() },
    { key: 'spend', header: 'Spend' },
    { key: 'cpl', header: 'CPL' },
    { key: 'roi', header: 'ROI', render: (row) => <Badge tone="success">{row.roi}</Badge> },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Report"
        subtitle="Campaign performance and ROI"
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={Download}
            onClick={() => toast.success('Marketing report exported')}
          >
            Export
          </Button>
        }
      />

      {stats.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No marketing data"
          description="Marketing analytics will appear here once campaigns are running."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <Stat
                key={i}
                label={s.label}
                value={s.value}
                change={s.change}
                changeType={s.changeType}
                icon={s.icon}
                accent={s.accent}
                accentTo={s.accentTo}
              />
            ))}
          </div>

          {chartData.length > 0 && (
            <Card>
              <CardHeader title="Lead Generation Trend" />
              <CardBody>
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
              </CardBody>
            </Card>
          )}

          {channelData.length > 0 && (
            <Card>
              <CardHeader title="Channel Breakdown" />
              <DataTable columns={channelColumns} rows={channelData} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ==================== CUSTOM REPORT PAGE ====================
export function CustomReportPage() {
  const [metric1, setMetric1] = useState('revenue');
  const [metric2, setMetric2] = useState('leads');
  const [dateRange, setDateRange] = useState('30d');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const metricOptions = [
    { value: 'revenue', label: 'Revenue' },
    { value: 'leads', label: 'Leads' },
    { value: 'calls', label: 'Calls' },
    { value: 'conversion', label: 'Conversion Rate' },
    { value: 'tickets', label: 'Support Tickets' },
    { value: 'campaigns', label: 'Campaign Clicks' },
  ];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    analyticsAPI.getDashboard({ period: dateRange, metrics: `${metric1},${metric2}` }).then(res => {
      if (cancelled) return;
      const d = res.data;
      if (d?.custom_report && Array.isArray(d.custom_report)) {
        setData(d.custom_report.map((row, i) => ({ id: row.id ?? i, ...row })));
      } else if (d?.periods && Array.isArray(d.periods)) {
        setData(d.periods.map((row, i) => ({ id: row.id ?? i, ...row })));
      } else {
        setData([]);
      }
    }).catch(() => {
      toast.error('Failed to load custom report');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dateRange, metric1, metric2]);

  const metric1Label = metricOptions.find(m => m.value === metric1)?.label;
  const metric2Label = metricOptions.find(m => m.value === metric2)?.label;

  const dataTableColumns = [
    { key: 'period', header: 'Period', render: (row) => <span className="font-medium text-slate-900 dark:text-white">{row.period}</span> },
    {
      key: metric1,
      header: metric1Label,
      render: (row) => typeof row[metric1] === 'number' ? row[metric1].toLocaleString() : row[metric1] ?? '-',
    },
    {
      key: metric2,
      header: metric2Label,
      render: (row) => typeof row[metric2] === 'number' ? row[metric2].toLocaleString() : row[metric2] ?? '-',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom Report"
        subtitle="Build custom reports with your chosen metrics"
      />

      <Card>
        <CardHeader title="Report Builder" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Primary Metric
              </label>
              <Select
                value={metric1}
                onChange={e => setMetric1(e.target.value)}
                className="w-full"
              >
                {metricOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Secondary Metric
              </label>
              <Select
                value={metric2}
                onChange={e => setMetric2(e.target.value)}
                className="w-full"
              >
                {metricOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Date Range
              </label>
              <Select
                value={dateRange}
                onChange={e => setDateRange(e.target.value)}
                className="w-full"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </Select>
            </div>
          </div>

          {loading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : data.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No data available"
              description="Select metrics and a date range to generate your custom report."
            />
          ) : (
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
          )}
        </CardBody>
      </Card>

      {!loading && data.length > 0 && (
        <Card>
          <CardHeader title="Data Table" />
          <DataTable columns={dataTableColumns} rows={data} />
        </Card>
      )}
    </div>
  );
}
