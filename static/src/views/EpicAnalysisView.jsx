import React, { useState, useMemo } from 'react';
import {
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ChevronDown,
  ChevronRight,
  User,
  Users,
  Flame,
  Search,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';

/**
 * EpicAnalysisView - Strategic Roadmap & Epics Health Center
 *
 * Focuses on:
 * - Strategic Epic Progress & Delivery (% Completion by Story Points & Issues)
 * - Multi-segment Progress Bars [ Done 🟢 | In Progress 🔵 | To Do ⚪ ]
 * - Effort Allocation across Epics (Donut)
 * - At-Risk Epics identification (bugs, blockers)
 * - Orphan Issues detection (tickets with no Epic assigned)
 * - Expandable child issue tree for deep-dive inspection
 */
export default function EpicAnalysisView({
  analytics,
  allIssues = [],
  metricMode = 'points',
  onUpdateIssue,
  projectKey,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'active', 'atRisk', 'completed'
  const [expandedEpicKey, setExpandedEpicKey] = useState(null);
  const [showOrphanDetails, setShowOrphanDetails] = useState(false);
  const [showAllOrphans, setShowAllOrphans] = useState(false);

  // Compute Epics dynamically from allIssues (with fallback to analytics.epics)
  const { epicsList, orphanIssues, epicMetrics } = useMemo(() => {
    const epicsMap = new Map();
    const orphans = [];
    let totalProjectPoints = 0;
    let totalEpicPoints = 0;
    let completedEpicPoints = 0;
    let totalEpicHours = 0;
    let completedEpicHours = 0;
    let atRiskCount = 0;

    allIssues.forEach((issue) => {
      const sp = Number(issue.storyPoints) || 0;
      const estH = Number(issue.estimatedHours) || 0;
      totalProjectPoints += sp;

      const isEpicType = (issue.type || '').toLowerCase() === 'epic' || issue.isEpic;
      const parentType = (issue.parent?.type || '').toLowerCase();
      const parentIsEpic = !parentType || parentType === 'epic';
      const epicKey = isEpicType
        ? issue.key
        : issue.epicKey || (parentIsEpic ? issue.parent?.key || null : null);
      const epicSummary = isEpicType
        ? (issue.summary || issue.key)
        : issue.epicSummary || (parentIsEpic ? issue.parent?.summary || epicKey : null);

      const isDone = issue.statusCategory === 'done';
      const isInProgress = issue.statusCategory === 'indeterminate';

      if (epicKey) {
        if (!epicsMap.has(epicKey)) {
          epicsMap.set(epicKey, {
            key: epicKey,
            summary: epicSummary || epicKey,
            status: isEpicType ? issue.status : 'Active',
            statusCategory: isEpicType ? issue.statusCategory : 'indeterminate',
            totalIssues: 0,
            doneIssues: 0,
            inProgressIssues: 0,
            toDoIssues: 0,
            totalPoints: 0,
            donePoints: 0,
            inProgressPoints: 0,
            toDoPoints: 0,
            totalHours: 0,
            doneHours: 0,
            inProgressHours: 0,
            toDoHours: 0,
            bugCount: 0,
            contributors: new Set(),
            childIssues: [],
          });
        }

        const ep = epicsMap.get(epicKey);
        if (epicSummary && ep.summary === epicKey) ep.summary = epicSummary;

        if (!isEpicType) {
          ep.totalIssues += 1;
          ep.totalPoints += sp;
          ep.totalHours += estH;
          totalEpicPoints += sp;
          totalEpicHours += estH;

          if (isDone) {
            ep.doneIssues += 1;
            ep.donePoints += sp;
            ep.doneHours += estH;
            completedEpicPoints += sp;
            completedEpicHours += estH;
          } else if (isInProgress) {
            ep.inProgressIssues += 1;
            ep.inProgressPoints += sp;
            ep.inProgressHours += estH;
          } else {
            ep.toDoIssues += 1;
            ep.toDoPoints += sp;
            ep.toDoHours += estH;
          }

          if (issue.isBug) ep.bugCount += 1;
          if (issue.assignee && issue.assignee !== 'Unassigned') {
            ep.contributors.add(issue.assignee);
          }

          ep.childIssues.push(issue);
        }
      } else if (!isEpicType) {
        orphans.push(issue);
      }
    });

    const list = Array.from(epicsMap.values()).map((ep) => {
      const issueCompRate = ep.totalIssues > 0 ? Math.round((ep.doneIssues / ep.totalIssues) * 100) : 0;
      const spCompRate = ep.totalPoints > 0 ? Math.round((ep.donePoints / ep.totalPoints) * 100) : issueCompRate;
      const isAtRisk = ep.bugCount >= 2 || (ep.inProgressIssues > 8 && spCompRate < 25);
      if (isAtRisk) atRiskCount++;

      return {
        ...ep,
        totalPoints: Math.round(ep.totalPoints * 10) / 10,
        donePoints: Math.round(ep.donePoints * 10) / 10,
        inProgressPoints: Math.round(ep.inProgressPoints * 10) / 10,
        toDoPoints: Math.round(ep.toDoPoints * 10) / 10,
        totalHours: Math.round(ep.totalHours * 10) / 10,
        doneHours: Math.round(ep.doneHours * 10) / 10,
        inProgressHours: Math.round(ep.inProgressHours * 10) / 10,
        toDoHours: Math.round(ep.toDoHours * 10) / 10,
        completionRate: issueCompRate,
        spCompletionRate: spCompRate,
        isAtRisk,
        contributorsList: Array.from(ep.contributors),
      };
    });

    list.sort((a, b) => b.totalPoints - a.totalPoints || b.totalIssues - a.totalIssues);

    const overallCompRate =
      metricMode === 'hours'
        ? totalEpicHours > 0
          ? Math.round((completedEpicHours / totalEpicHours) * 100)
          : 0
        : totalEpicPoints > 0
        ? Math.round((completedEpicPoints / totalEpicPoints) * 100)
        : 0;
    const orphanPoints = orphans.reduce((sum, i) => sum + (Number(i.storyPoints) || 0), 0);
    const orphanHours = orphans.reduce((sum, i) => sum + (Number(i.estimatedHours) || 0), 0);

    return {
      epicsList: list,
      orphanIssues: orphans,
      epicMetrics: {
        totalEpics: list.length,
        activeEpicsCount: list.filter((e) => e.completionRate < 100).length,
        completedEpicsCount: list.filter((e) => e.completionRate === 100).length,
        totalEpicPoints: Math.round(totalEpicPoints * 10) / 10,
        completedEpicPoints: Math.round(completedEpicPoints * 10) / 10,
        remainingEpicPoints: Math.round((totalEpicPoints - completedEpicPoints) * 10) / 10,
        totalEpicHours: Math.round(totalEpicHours * 10) / 10,
        completedEpicHours: Math.round(completedEpicHours * 10) / 10,
        remainingEpicHours: Math.round((totalEpicHours - completedEpicHours) * 10) / 10,
        overallCompRate,
        atRiskCount,
        orphanCount: orphans.length,
        orphanPoints: Math.round(orphanPoints * 10) / 10,
        orphanHours: Math.round(orphanHours * 10) / 10,
        orphanRatio: allIssues.length > 0 ? Math.round((orphans.length / allIssues.length) * 100) : 0,
      },
    };
  }, [allIssues, metricMode]);

  // Filtered Epics
  const displayedEpics = useMemo(() => {
    return epicsList.filter((ep) => {
      if (filterMode === 'active' && ep.completionRate === 100) return false;
      if (filterMode === 'completed' && ep.completionRate < 100) return false;
      if (filterMode === 'atRisk' && !ep.isAtRisk) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const kMatch = ep.key.toLowerCase().includes(q);
        const sMatch = ep.summary.toLowerCase().includes(q);
        if (!kMatch && !sMatch) return false;
      }
      return true;
    });
  }, [epicsList, filterMode, searchQuery]);

  // ECharts: Effort Allocation by Epic Donut
  const effortChartOption = useMemo(() => {
    const pieData = epicsList.slice(0, 7).map((ep) => ({
      name: ep.summary.length > 25 ? `${ep.summary.slice(0, 25)}...` : ep.summary,
      value: ep.totalPoints > 0 ? ep.totalPoints : ep.totalIssues,
    }));

    if (epicsList.length > 7) {
      const otherPoints = epicsList.slice(7).reduce((acc, e) => acc + (e.totalPoints || e.totalIssues), 0);
      pieData.push({ name: 'Other Epics', value: Math.round(otherPoints * 10) / 10 });
    }

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} SP ({d}%)',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
      },
      legend: {
        bottom: '0%',
        left: 'center',
        textStyle: { color: '#94a3b8', fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#0b0f19',
            borderWidth: 2,
          },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 12, fontWeight: 'bold', color: '#fff' },
          },
          data: pieData,
        },
      ],
    };
  }, [epicsList]);

  // ECharts: Delivery Stacked Bar (Done vs In Progress vs To Do)
  const deliveryChartOption = useMemo(() => {
    const topEpics = epicsList.slice(0, 6);
    const categories = topEpics.map((e) => (e.summary.length > 18 ? `${e.summary.slice(0, 18)}...` : e.summary));
    const doneSeries = topEpics.map((e) => e.donePoints);
    const inProgSeries = topEpics.map((e) => e.inProgressPoints);
    const toDoSeries = topEpics.map((e) => e.toDoPoints);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
      },
      legend: {
        top: '0%',
        textStyle: { color: '#94a3b8', fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#1e293b' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      series: [
        {
          name: 'Done (SP)',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#10b981' },
          data: doneSeries,
        },
        {
          name: 'In Progress (SP)',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#3b82f6' },
          data: inProgSeries,
        },
        {
          name: 'To Do (SP)',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#475569' },
          data: toDoSeries,
        },
      ],
    };
  }, [epicsList]);

  return (
    <div className="space-y-6">
      {/* ── 1. EXECUTIVE EPIC METRIC CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Epics */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Epics</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">{epicMetrics.totalEpics}</span>
            <span className="text-xs text-slate-400 font-medium">epics</span>
          </div>
          <div className="mt-1 text-xs text-indigo-400 font-semibold">
            {metricMode === 'hours' ? `${epicMetrics.totalEpicHours}h` : `${epicMetrics.totalEpicPoints}`}{' '}
            <span className="text-slate-400 font-normal">
              {metricMode === 'hours' ? 'Estimated Hours total' : 'Story Points total'}
            </span>
          </div>
        </div>

        {/* Strategic Delivery Progress */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Delivery Rate</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400 tracking-tight">
              {epicMetrics.overallCompRate}%
            </span>
            <span className="text-xs text-slate-400 font-medium">delivered</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {metricMode === 'hours'
              ? `${epicMetrics.completedEpicHours}h of ${epicMetrics.totalEpicHours}h Done`
              : `${epicMetrics.completedEpicPoints} of ${epicMetrics.totalEpicPoints} SP Done`}
          </div>
        </div>

        {/* Remaining Epic Points */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Remaining Effort</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-400 tracking-tight">
              {metricMode === 'hours' ? epicMetrics.remainingEpicHours : epicMetrics.remainingEpicPoints}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {metricMode === 'hours' ? 'h pending' : 'SP pending'}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-400">Remaining roadmap scope</div>
        </div>

        {/* At-Risk Epics */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">At-Risk Epics</span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                epicMetrics.atRiskCount > 0
                  ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                  : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tracking-tight ${
                epicMetrics.atRiskCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {epicMetrics.atRiskCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">epics</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">High bug load or slow progress</div>
        </div>

        {/* Orphan Issues Indicator */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Orphan Work</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-300 tracking-tight">{epicMetrics.orphanCount}</span>
            <span className="text-xs text-slate-400 font-medium">tickets</span>
          </div>
          <div className="mt-1 text-xs text-amber-400/90 font-medium">
            {metricMode === 'hours' ? `${epicMetrics.orphanHours}h` : `${epicMetrics.orphanPoints} SP`} unaligned to any Epic
          </div>
        </div>
      </div>

      {/* ── 2. VISUAL CHARTS (EFFORT ALLOCATION & DELIVERY BREAKDOWN) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Effort Allocation Donut */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-400" />
                Effort Allocation by Epic
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Distribution of engineering capacity across roadmap initiatives
              </p>
            </div>
          </div>
          <div className="h-64">
            <ReactECharts option={effortChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Stacked Delivery Progress */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Top Epics Delivery Status
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Story points breakdown across Done, In Progress and To Do
              </p>
            </div>
          </div>
          <div className="h-64">
            <ReactECharts option={deliveryChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      </div>

      {/* ── 3. ORPHAN ISSUES CALLOUT (IF ANY) ── */}
      {epicMetrics.orphanCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Unaligned Work Detected: {epicMetrics.orphanCount} Orphan Tickets (
                  {metricMode === 'hours' ? `${epicMetrics.orphanHours}h` : `${epicMetrics.orphanPoints} SP`})
                </h4>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  These tickets do not belong to any Epic. Assigning them to an Epic ensures complete roadmap tracking.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowOrphanDetails(!showOrphanDetails)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 transition-colors"
            >
              {showOrphanDetails ? 'Hide Orphan List' : 'Inspect Orphan Issues'}
            </button>
          </div>

          {showOrphanDetails && (
            <div className="mt-3 pt-3 border-t border-amber-500/20 max-h-64 overflow-y-auto space-y-1.5">
              {(showAllOrphans ? orphanIssues : orphanIssues.slice(0, 15)).map((issue) => (
                <div
                  key={issue.key}
                  className="flex items-center justify-between text-xs py-1 px-2.5 rounded bg-slate-950/60 border border-amber-500/20"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono font-bold text-amber-300">{issue.key}</span>
                    <span className="truncate text-slate-300">{issue.summary}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-[10px] text-slate-400">{issue.type}</span>
                    <span className="font-semibold text-slate-200">
                      {metricMode === 'hours' ? `${issue.estimatedHours || 0}h` : `${issue.storyPoints || 0} SP`}
                    </span>
                  </div>
                </div>
              ))}
              {orphanIssues.length > 15 && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAllOrphans(!showAllOrphans)}
                    className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 px-3 py-1 rounded bg-amber-500/20 border border-amber-500/40 transition-colors"
                  >
                    {showAllOrphans
                      ? 'Show first 15 tickets'
                      : `Show all ${orphanIssues.length} unaligned tickets (+${orphanIssues.length - 15} more)`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 4. ROADMAP EPICS LIST WITH DRILL-DOWN CHILD ISSUES ── */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-400" />
              Strategic Epic Progress ({displayedEpics.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Track multi-segment completion, story point burndown, and drill down into child tickets
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filterMode === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({epicsList.length})
            </button>
            <button
              onClick={() => setFilterMode('active')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filterMode === 'active' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              In Progress ({epicMetrics.activeEpicsCount})
            </button>
            <button
              onClick={() => setFilterMode('atRisk')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filterMode === 'atRisk' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              At Risk ({epicMetrics.atRiskCount})
            </button>
            <button
              onClick={() => setFilterMode('completed')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filterMode === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Completed ({epicMetrics.completedEpicsCount})
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search epics by key or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Epics Cards List */}
        <div className="space-y-3">
          {displayedEpics.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No epics match the selected filter.
            </div>
          ) : (
            displayedEpics.map((epic) => {
              const isExpanded = expandedEpicKey === epic.key;
              const donePct = epic.totalPoints > 0 ? (epic.donePoints / epic.totalPoints) * 100 : 0;
              const inProgPct = epic.totalPoints > 0 ? (epic.inProgressPoints / epic.totalPoints) * 100 : 0;
              const toDoPct = Math.max(0, 100 - donePct - inProgPct);

              return (
                <div
                  key={epic.key}
                  className="rounded-xl bg-slate-950/70 border border-slate-800/90 p-4 transition-all hover:border-slate-700/80 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setExpandedEpicKey(isExpanded ? null : epic.key)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        title={isExpanded ? 'Collapse child issues' : 'Expand child issues'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        {epic.key}
                      </span>
                      <h4 className="text-sm font-semibold text-white tracking-tight">{epic.summary}</h4>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {epic.isAtRisk && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          <Flame className="w-3 h-3 text-rose-400" /> At Risk ({epic.bugCount} bugs)
                        </span>
                      )}
                      <span className="text-xs font-bold text-slate-200">
                        {epic.spCompletionRate}% Done
                      </span>
                    </div>
                  </div>

                  {/* Multi-segment Progress Bar */}
                  <div className="space-y-1">
                    <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
                      <div
                        style={{ width: `${donePct}%` }}
                        className="bg-emerald-500 h-full transition-all duration-500"
                        title={`Done: ${epic.donePoints} SP (${Math.round(donePct)}%)`}
                      />
                      <div
                        style={{ width: `${inProgPct}%` }}
                        className="bg-blue-500 h-full transition-all duration-500"
                        title={`In Progress: ${epic.inProgressPoints} SP (${Math.round(inProgPct)}%)`}
                      />
                      <div
                        style={{ width: `${toDoPct}%` }}
                        className="bg-slate-700 h-full transition-all duration-500"
                        title={`To Do: ${epic.toDoPoints} SP (${Math.round(toDoPct)}%)`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                      <span>
                        <strong className="text-emerald-400">{epic.donePoints} SP</strong> Done ·{' '}
                        <strong className="text-blue-400">{epic.inProgressPoints} SP</strong> In Progress ·{' '}
                        <strong className="text-slate-400">{epic.toDoPoints} SP</strong> To Do
                      </span>
                      <span>
                        Total: <strong>{epic.totalPoints} SP</strong> ({epic.totalIssues} tickets)
                      </span>
                    </div>
                  </div>

                  {/* Contributors & Deep Dive trigger */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span>{epic.contributorsList.length} Contributors:</span>
                      <span className="text-slate-300 font-medium truncate max-w-xs sm:max-w-md">
                        {epic.contributorsList.join(', ') || 'None assigned'}
                      </span>
                    </div>

                    <button
                      onClick={() => setExpandedEpicKey(isExpanded ? null : epic.key)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1 transition-colors"
                    >
                      {isExpanded ? 'Hide Child Issues' : `Inspect ${epic.childIssues.length} Child Tickets`}
                    </button>
                  </div>

                  {/* Child Issues List Drawer */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 bg-slate-900/50 -mx-4 -mb-4 p-4 rounded-b-xl space-y-2">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Child Issues under {epic.key} ({epic.childIssues.length})
                      </h5>
                      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                        {epic.childIssues.length === 0 ? (
                          <div className="text-xs text-slate-500 italic py-2">
                            No child stories or tasks currently linked to this epic.
                          </div>
                        ) : (
                          epic.childIssues.map((child) => (
                            <div
                              key={child.key}
                              className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-mono font-bold text-blue-400">{child.key}</span>
                                <span className="truncate text-slate-200">{child.summary}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 ml-2">
                                <span className="text-[10px] text-slate-400">{child.type}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    child.statusCategory === 'done'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : child.statusCategory === 'indeterminate'
                                      ? 'bg-blue-500/20 text-blue-300'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {child.status}
                                </span>
                                <span className="font-bold text-white min-w-8 text-right">
                                  {child.storyPoints ? `${child.storyPoints} SP` : '-'}
                                </span>
                                <span className="text-slate-400 text-[11px] truncate max-w-24">
                                  {child.assignee || 'Unassigned'}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

