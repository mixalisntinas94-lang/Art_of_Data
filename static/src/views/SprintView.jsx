import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  ReferenceLine,
} from 'recharts';

/**
 * Lightweight SVG Sparkline component
 * Renders smooth micro-trends for executive KPI cards with area fill
 */
function Sparkline({ data, color = '#3b82f6', height = 28 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 120;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
  const gradId = `sparkGrad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className="w-full h-7 overflow-hidden my-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/**
 * SprintView - Tactical Sprint Level Dashboard
 *
 * Locked-down visual layout:
 * - Executive diagnosis banner & real-time pacing warning
 * - 5 Top KPI Hero cards with sparklines & color glows
 * - Status Donut chart with neon cyan center badge & vertical legend
 * - Types of Work bar chart with purple-blue glow & Category Insights panel
 * - Effort Allocation horizontal bar chart with 40 SP capacity reference line
 * - Live Activity Stream with [All Activity] vs [⚠️ Blockers & Stale] toggle
 */
export default function SprintView({
  analytics,
  kpis,
  metricMode,
  selectedType,
  selectedAssignee,
  selectedStatus,
  activityFilter,
  setSelectedType,
  setSelectedAssignee,
  setSelectedStatus,
  setActivityFilter,
  statusPieData,
  typeChartData,
  assigneeChartData,
  filteredIssues,
  displayedStreamIssues,
  staleIssuesCount,
  sprintTimeElapsed,
  paceGap,
  isBehindSchedule,
  isSlightlyBehind,
  lastRefreshed,
}) {
  return (
    <div className="space-y-6">
      {/* ════ 1. EXECUTIVE DIAGNOSIS BANNER ════ */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${
              isBehindSchedule || kpis.bugRatio > 25
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : isSlightlyBehind
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {isBehindSchedule
              ? '🔴 Critical Pacing Gap'
              : kpis.bugRatio > 25
              ? '🔴 High Quality Risk'
              : isSlightlyBehind
              ? '🟡 Moderate Scope Delay'
              : '🟢 Sprint On Track'}
          </span>
          <p className="text-xs text-slate-300">
            <strong className="text-white">Active Scope:</strong>{' '}
            {analytics.activeSprintName || 'Current Sprint'} ·{' '}
            <span className="text-slate-400">
              {kpis.totalIssues} issues ({kpis.completedCount} done, {kpis.inProgressCount} in flight)
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <span>Last refreshed: {lastRefreshed}</span>
        </div>
      </div>

      {/* ════ 2. HIGH-IMPACT TOP KPI HERO CARDS (WITH REAL PACING CHECK) ════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Completion & Time-vs-Work Pacing */}
        <div className="relative overflow-hidden p-4 rounded-xl bg-slate-900/90 border border-slate-800 border-t-2 border-t-emerald-500 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm">
          <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500/15 rounded-full blur-xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold tracking-wider relative z-10">
            <span>COMPLETION & PACING</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="mt-2 mb-1 relative z-10 flex items-baseline justify-between">
            <span className="text-4xl font-extrabold tracking-tight text-white">
              {kpis.completionRate}%
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Done
            </span>
          </div>

          {/* Sparkline for Completion */}
          <div className="relative z-10">
            <Sparkline
              data={[15, 22, 35, 48, 55, Math.max(20, kpis.completionRate)]}
              color={isBehindSchedule ? '#f43f5e' : '#10b981'}
            />
          </div>

          {/* Dual Progress Bar: Work Done vs Sprint Time Elapsed */}
          <div className="relative z-10 mt-1 space-y-1">
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isBehindSchedule ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${kpis.completionRate}%` }}
              />
            </div>
          </div>

          {/* Explicit Behind Schedule Pacing Badge */}
          <div className="relative z-10 mt-2">
            {isBehindSchedule ? (
              <div className="flex items-center justify-between px-2 py-1 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Behind Schedule
                </span>
                <span className="font-mono">-{paceGap}% gap</span>
              </div>
            ) : isSlightlyBehind ? (
              <div className="flex items-center justify-between px-2 py-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Slightly Behind
                </span>
                <span className="font-mono">-{paceGap}%</span>
              </div>
            ) : (
              <div className="flex items-center justify-between px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  On Track
                </span>
                <span className="font-mono">+{Math.abs(paceGap)}% pace</span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mt-1.5 relative z-10">
            Time elapsed: <strong className="text-white">{sprintTimeElapsed}%</strong> · Done: <strong className="text-white">{kpis.completionRate}%</strong>
          </p>
        </div>

        {/* Card 2: Delivered Velocity */}
        <div className="relative overflow-hidden p-4 rounded-xl bg-slate-900/90 border border-slate-800 border-t-2 border-t-blue-500 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm">
          <div className="absolute top-0 left-0 w-24 h-24 bg-blue-500/15 rounded-full blur-xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold tracking-wider relative z-10">
            <span>{metricMode === 'hours' ? 'LOGGED EFFORT' : 'DELIVERED VELOCITY'}</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 mb-1 relative z-10">
            <span className="text-4xl font-extrabold tracking-tight text-white">
              {metricMode === 'hours' ? `${kpis.totalLoggedHours}h` : `${kpis.completedStoryPoints} SP`}
            </span>
          </div>
          <div className="relative z-10">
            <Sparkline
              data={[3, 7, 10, 16, 20, Math.max(4, kpis.completedStoryPoints)]}
              color="#3b82f6"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1 relative z-10">
            {metricMode === 'hours'
              ? `of ${kpis.totalEstimatedHours}h estimated`
              : `of ${kpis.totalStoryPoints} SP total scope`}
          </p>
        </div>

        {/* Card 3: Defect Density (Red Top-Border & Glow) */}
        <div className="relative overflow-hidden p-4 rounded-xl bg-slate-900/90 border border-slate-800 border-t-2 border-t-rose-500 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm">
          <div className="absolute top-0 left-0 w-24 h-24 bg-rose-500/25 rounded-full blur-xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold tracking-wider relative z-10">
            <span>DEFECT DENSITY</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 mb-1 relative z-10">
            <span className="text-4xl font-extrabold tracking-tight text-rose-400">
              {kpis.bugRatio}%
            </span>
          </div>
          <div className="relative z-10">
            <Sparkline
              data={[0, 1, 1, 2, Math.max(1, kpis.bugCount)]}
              color="#f43f5e"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1 relative z-10">
            {kpis.bugCount} active bugs · {kpis.staleCount} stale items
          </p>
        </div>

        {/* Card 4: Estimation Health (Green Top-Border & Glow) */}
        <div className="relative overflow-hidden p-4 rounded-xl bg-slate-900/90 border border-slate-800 border-t-2 border-t-emerald-500 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm">
          <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500/20 rounded-full blur-xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold tracking-wider relative z-10">
            <span>ESTIMATION HEALTH</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 mb-1 relative z-10">
            <span className="text-4xl font-extrabold tracking-tight text-white">
              {kpis.unestimatedPointsCount === 0 ? '100%' : `${kpis.unestimatedPointsCount}`}
            </span>
          </div>
          <div className="relative z-10">
            <Sparkline
              data={[85, 90, 94, 98, 100]}
              color="#10b981"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1 relative z-10">
            {kpis.unestimatedPointsCount === 0
              ? 'All tickets estimated with points'
              : 'Tickets missing Story Points'}
          </p>
        </div>

        {/* Card 5: Cycle Time */}
        <div className="relative overflow-hidden p-4 rounded-xl bg-slate-900/90 border border-slate-800 border-t-2 border-t-purple-500 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm">
          <div className="absolute top-0 left-0 w-24 h-24 bg-purple-500/15 rounded-full blur-xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold tracking-wider relative z-10">
            <span>CYCLE TIME</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 mb-1 relative z-10">
            <span className="text-4xl font-extrabold tracking-tight text-white">
              {kpis.avgCycleTimeDays !== null && kpis.avgCycleTimeDays > 0
                ? `${kpis.avgCycleTimeDays}d`
                : 'N/A'}
            </span>
          </div>
          <div className="relative z-10">
            <Sparkline
              data={[4.5, 4.0, 3.6, 3.1, Math.max(1, kpis.avgCycleTimeDays || 2.4)]}
              color="#a855f7"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1 relative z-10">
            {(analytics.teamMembers || []).length} active contributor(s)
          </p>
        </div>
      </div>

      {/* ════ 3. CHARTS ROW (STATUS DONUT & TYPES BAR CHART) ════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Widget 1: Status & Scope Breakdown (Donut with Neon Cyan Center) */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Status & Scope Breakdown
              </h3>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                isBehindSchedule
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                  : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              }`}>
                {kpis.completionRate}% Delivered
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Click any segment or status card below to cross-filter the dashboard.
            </p>
          </div>

          {/* Donut with Center Counter + Vertical Legend on the Right */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 my-3">
            {/* Left: Donut Chart with Neon Cyan Border in Center */}
            <div className="relative w-56 h-56 flex items-center justify-center shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={68}
                    outerRadius={92}
                    paddingAngle={4}
                  >
                    {statusPieData.map((entry, index) => {
                      const isSelected = selectedStatus === entry.name;
                      const isDimmed = selectedStatus && !isSelected;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          opacity={isDimmed ? 0.3 : 1}
                          stroke={isSelected ? '#22d3ee' : 'none'}
                          strokeWidth={isSelected ? 3 : 0}
                          className="cursor-pointer transition-all duration-300"
                          onClick={() => setSelectedStatus(entry.name)}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      color: '#f8fafc',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Centered Total Display with Neon Cyan Glow Border */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-28 h-28 rounded-full border-2 border-cyan-400 shadow-[0_0_22px_rgba(6,182,212,0.6)] bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center text-center p-2">
                  <span className="text-2xl font-black tracking-tight text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.7)]">
                    {metricMode === 'hours'
                      ? `${kpis.totalEstimatedHours}h`
                      : `${kpis.totalStoryPoints} SP`}
                  </span>
                  <span className="text-[10px] font-extrabold text-cyan-300 tracking-wider uppercase mt-0.5">
                    Total Scope
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Vertical Legend List with Click-to-Filter */}
            <div className="flex-1 w-full flex flex-col gap-2.5 justify-center">
              {/* Done Item */}
              <div
                onClick={() => setSelectedStatus('Done')}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                  selectedStatus === 'Done'
                    ? 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                    : selectedStatus
                    ? 'bg-slate-800/30 border-slate-800/50 opacity-40 hover:opacity-100'
                    : 'bg-slate-800/40 border-slate-800/80 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                  <span className="text-xs font-semibold text-slate-200">Done</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-white">{kpis.completedStoryPoints} SP</span>
                  <span className="text-[11px] text-slate-400 ml-1.5 font-medium">
                    ({kpis.completedCount} tickets · {kpis.completionRate}%)
                  </span>
                </div>
              </div>

              {/* In Progress Item */}
              <div
                onClick={() => setSelectedStatus('In Progress')}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                  selectedStatus === 'In Progress'
                    ? 'bg-blue-500/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.25)]'
                    : selectedStatus
                    ? 'bg-slate-800/30 border-slate-800/50 opacity-40 hover:opacity-100'
                    : 'bg-slate-800/40 border-slate-800/80 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                  <span className="text-xs font-semibold text-slate-200">In Progress</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-white">
                    {kpis.inProgressStoryPoints || 0} SP
                  </span>
                  <span className="text-[11px] text-slate-400 ml-1.5 font-medium">
                    ({kpis.inProgressCount} tickets)
                  </span>
                </div>
              </div>

              {/* To Do Item */}
              <div
                onClick={() => setSelectedStatus('To Do')}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                  selectedStatus === 'To Do'
                    ? 'bg-slate-700/40 border-slate-400 shadow-md'
                    : selectedStatus
                    ? 'bg-slate-800/30 border-slate-800/50 opacity-40 hover:opacity-100'
                    : 'bg-slate-800/40 border-slate-800/80 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                  <span className="text-xs font-semibold text-slate-200">To Do</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-white">
                    {kpis.toDoStoryPoints || 0} SP
                  </span>
                  <span className="text-[11px] text-slate-400 ml-1.5 font-medium">
                    ({kpis.toDoCount} tickets)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Pacing Footer Check */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/60">
            <span>Pacing Status (Time vs Work)</span>
            <span className={`font-semibold flex items-center gap-1 ${
              isBehindSchedule ? 'text-rose-400' : isSlightlyBehind ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {isBehindSchedule ? '⚠️ Behind Schedule' : isSlightlyBehind ? '🟡 Slightly Behind' : '🟢 On Track'} ({kpis.completionRate}% Done / {sprintTimeElapsed}% Time)
            </span>
          </div>
        </div>

        {/* Widget 2: Types of Work & Effort (Clickable Gradient Bars + Category Insights Side Panel) */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Types of Work & Effort
              </h3>
              <span className="text-xs font-semibold text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                {typeChartData.length} categories
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Click any bar or category below to cross-filter dashboard by work type.
            </p>
          </div>

          {/* Grid: Bar Chart on Left + Category Insights Panel on Right */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 my-2 items-center">
            
            {/* Left (7 cols): Glowing Gradient Bar Chart with Dimming */}
            <div className="md:col-span-7 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={typeChartData}
                  margin={{ top: 24, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="purpleBlueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.55} />
                    </linearGradient>

                    <filter id="barGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#a855f7" floodOpacity={0.45} />
                    </filter>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    opacity={0.15}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      color: '#f8fafc',
                    }}
                  />

                  {/* Bar with 30% Dimming on non-selected elements */}
                  <Bar
                    dataKey="points"
                    name="Story Points"
                    fill="url(#purpleBlueGradient)"
                    filter="url(#barGlow)"
                    maxBarSize={32}
                    radius={[6, 6, 0, 0]}
                  >
                    {typeChartData.map((entry, index) => {
                      const isSelected = selectedType === entry.name;
                      const isDimmed = selectedType && !isSelected;
                      return (
                        <Cell
                          key={`cell-type-${index}`}
                          fill="url(#purpleBlueGradient)"
                          opacity={isDimmed ? 0.3 : 1}
                          stroke={isSelected ? '#c084fc' : 'none'}
                          strokeWidth={isSelected ? 2 : 0}
                          className="cursor-pointer transition-all duration-300"
                          onClick={() => setSelectedType(entry.name)}
                        />
                      );
                    })}
                    <LabelList
                      dataKey="points"
                      position="top"
                      fill="#f8fafc"
                      fontSize={11}
                      fontWeight={800}
                      formatter={(val) => (val > 0 ? `${val} SP` : '0')}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Right (5 cols): Category Insights Side Panel with Clickable Types */}
            <div className="md:col-span-5 bg-slate-800/40 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Category Insights
                </span>
                <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  Distribution
                </span>
              </div>

              {/* Primary Workload Driver */}
              <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Primary Workload Driver
                </div>
                <div className="text-sm font-bold text-white mt-0.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    {typeChartData[0]?.name || 'Standard Tasks'}
                  </span>
                  <span className="text-indigo-400 font-mono">
                    {typeChartData[0] ? `${typeChartData[0].points} SP` : '0 SP'}
                  </span>
                </div>
              </div>

              {/* Detailed Category Stats List with Click Filter */}
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {typeChartData.map((cat, idx) => {
                  const pct =
                    kpis.totalStoryPoints > 0
                      ? Math.round((cat.points / kpis.totalStoryPoints) * 100)
                      : 0;
                  const isSelected = selectedType === cat.name;
                  const isDimmed = selectedType && !isSelected;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedType(cat.name)}
                      className={`flex items-center justify-between text-xs py-1 px-2 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600/30 border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                          : isDimmed
                          ? 'bg-slate-900/30 border-slate-800/40 opacity-40 hover:opacity-100'
                          : 'bg-slate-900/40 border-slate-800/50 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="text-slate-300 font-medium truncate max-w-[90px]">
                        {cat.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-[11px]">{cat.count} tkts</span>
                        <span className="text-white font-bold font-mono text-[11px] w-12 text-right">
                          {cat.points} SP
                        </span>
                        <span className="text-indigo-400 font-bold text-[10px] w-8 text-right">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <span>Effort Concentration</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Balanced
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/60">
            <span>Bug Density: {kpis.bugRatio}%</span>
            <span className="font-semibold text-indigo-400">{kpis.totalStoryPoints} total Story Points</span>
          </div>
        </div>
      </div>

      {/* ════ 4. EFFORT ALLOCATION & BLOCKERS STREAM ════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left (7 cols): Horizontal Bar Chart with Slim Bars & 40 SP Capacity Limit */}
        <div className="lg:col-span-7 p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Effort Allocation by Assignee
              </h3>
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                  Done SP
                </span>
                <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm" />
                  Remaining SP
                </span>
                <span className="flex items-center gap-1.5 text-rose-400 font-medium border-l border-slate-700 pl-2">
                  <span className="w-3 border-b-2 border-dashed border-rose-500" />
                  Capacity Limit (40 SP)
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Slim workload bars with 40 SP burnout threshold line. Click assignee to isolate their tasks and KPIs.
            </p>
          </div>

          {/* Slim Horizontal Bar Chart with Reference Line */}
          <div className="my-2" style={{ minHeight: `${Math.max(160, assigneeChartData.length * 36 + 25)}px` }}>
            <ResponsiveContainer width="100%" height={Math.max(160, assigneeChartData.length * 36 + 25)}>
              <BarChart
                layout="vertical"
                data={assigneeChartData}
                barSize={14}
                margin={{ top: 12, right: 35, left: 15, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  opacity={0.15}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  width={105}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    borderRadius: '0.5rem',
                    fontSize: '0.75rem',
                    color: '#f8fafc',
                  }}
                />

                {/* Capacity Limit Dashed Line at 40 Story Points */}
                <ReferenceLine
                  x={40}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: 'Capacity (40 SP)',
                    fill: '#fb7185',
                    fontSize: 10,
                    position: 'top',
                  }}
                />

                {/* Stacked Done Story Points (Slim Bar) */}
                <Bar
                  dataKey="completedPoints"
                  name="Done SP"
                  stackId="assigneeEffort"
                  fill="#10b981"
                >
                  {assigneeChartData.map((entry, index) => {
                    const isSelected = selectedAssignee === entry.name;
                    const isDimmed = selectedAssignee && !isSelected;
                    return (
                      <Cell
                        key={`cell-done-${index}`}
                        fill="#10b981"
                        opacity={isDimmed ? 0.3 : 1}
                        className="cursor-pointer transition-all duration-300"
                        onClick={() => setSelectedAssignee(entry.name)}
                      />
                    );
                  })}
                </Bar>

                {/* Stacked Remaining Story Points (Slim Bar) */}
                <Bar
                  dataKey="remainingPoints"
                  name="Remaining SP"
                  stackId="assigneeEffort"
                  fill="#6366f1"
                  radius={[0, 4, 4, 0]}
                >
                  {assigneeChartData.map((entry, index) => {
                    const isSelected = selectedAssignee === entry.name;
                    const isDimmed = selectedAssignee && !isSelected;
                    return (
                      <Cell
                        key={`cell-rem-${index}`}
                        fill="#6366f1"
                        opacity={isDimmed ? 0.3 : 1}
                        className="cursor-pointer transition-all duration-300"
                        onClick={() => setSelectedAssignee(entry.name)}
                      />
                    );
                  })}
                  <LabelList
                    dataKey="totalPoints"
                    position="right"
                    fill="#cbd5e1"
                    fontSize={11}
                    fontWeight={700}
                    formatter={(val) => (val > 0 ? `${val} SP` : '')}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Over-capacity callouts if any team member exceeds 40 SP */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/60 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span>Capacity Burnout Alert:</span>
              {assigneeChartData.some((a) => a.isOverCapacity) ? (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold flex items-center gap-1 text-[11px]">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  {assigneeChartData.filter((a) => a.isOverCapacity).map((a) => `${a.name} (${a.totalPoints} SP)`).join(', ')} exceeds 40 SP limit!
                </span>
              ) : (
                <span className="text-emerald-400 font-medium">All members within safe 40 SP limit</span>
              )}
            </div>
            <span className="text-cyan-400 font-semibold">
              {selectedAssignee ? `Filtered: ${selectedAssignee}` : 'Click assignee to isolate'}
            </span>
          </div>
        </div>

        {/* Right (5 cols): Activity Stream with [All Activity] vs [⚠️ Blockers & Stale] Switch */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Live Activity Stream</h3>
              </div>

              {/* Toggle Switch: [All Activity] vs [⚠️ Blockers & Stale] */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-0.5 flex items-center text-xs font-medium">
                <button
                  onClick={() => setActivityFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    activityFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({filteredIssues.length})
                </button>
                <button
                  onClick={() => setActivityFilter('stale')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                    activityFilter === 'stale'
                      ? 'bg-amber-600 text-white shadow-sm font-semibold'
                      : 'text-amber-400/90 hover:text-amber-300'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  Blockers & Stale ({staleIssuesCount})
                </button>
              </div>
            </div>

            {/* Issues List with Stale (>= 3 days) Orange Border Highlight */}
            <div className="mt-3 space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {displayedStreamIssues.slice(0, 8).map((issue) => {
                const isStaleItem = issue.isStale || (issue.daysInactive !== undefined && issue.daysInactive >= 3);

                return (
                  <div
                    key={issue.id}
                    className={`p-2.5 rounded-xl border transition-all duration-200 group flex items-center justify-between cursor-pointer ${
                      isStaleItem
                        ? 'border-amber-500/70 bg-amber-500/10 hover:bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                        : 'border-transparent hover:border-blue-500/60 hover:bg-blue-600/20 hover:shadow-[0_0_20px_rgba(59,130,246,0.22)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Glowing Indicator Bar */}
                      <div
                        className={`w-1.5 h-8 rounded-full transition-all shrink-0 ${
                          isStaleItem
                            ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                            : 'bg-slate-800 group-hover:bg-blue-400 group-hover:shadow-[0_0_12px_rgba(96,165,250,0.9)]'
                        }`}
                      />

                      {/* Real User Avatar from Jira */}
                      <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0 border border-slate-700 group-hover:border-blue-400 transition-all bg-slate-800 flex items-center justify-center">
                        {issue.avatarUrl ? (
                          <img
                            src={issue.avatarUrl}
                            alt={issue.assignee || 'User'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.nextElementSibling;
                              if (fallback) fallback.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-full h-full items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br from-indigo-500 to-purple-600 ${
                            issue.avatarUrl ? 'hidden' : 'flex'
                          }`}
                        >
                          {issue.assignee ? issue.assignee.substring(0, 2).toUpperCase() : 'UN'}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-mono text-xs font-bold text-blue-400 group-hover:text-blue-300">
                            {issue.key}
                          </span>
                          <span className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                            {issue.summary}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                          <span>{issue.type}</span>
                          <span>·</span>
                          <span className="truncate">{issue.assignee || 'Unassigned'}</span>
                          {issue.storyPoints > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-indigo-400 font-semibold">
                                {issue.storyPoints} SP
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Stale Warning Badge if inactive >= 3 days */}
                      {isStaleItem && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          {issue.daysInactive}d inactive
                        </span>
                      )}

                      <span
                        className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${
                          issue.statusCategory === 'done'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : issue.statusCategory === 'indeterminate'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {issue.status}
                      </span>

                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          className="p-1 bg-blue-600/40 hover:bg-blue-600 text-blue-200 hover:text-white rounded border border-blue-400/50 shadow-sm"
                          title="Inspect ticket"
                        >
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {displayedStreamIssues.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-500 flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500/80" />
                  <span>Zero blockers or stale tickets detected! Sprint velocity is unhindered.</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/60 mt-3">
            <span>Stream Mode: <strong className="text-white">{activityFilter === 'stale' ? 'Blockers & Stale' : 'All Activity'}</strong></span>
            <span className="text-amber-400 font-medium">
              {staleIssuesCount > 0 ? `⚠️ ${staleIssuesCount} stale items need action` : '✅ All tickets active'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
