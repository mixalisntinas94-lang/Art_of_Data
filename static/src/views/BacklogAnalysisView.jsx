import React, { useState, useMemo } from 'react';
import {
  Inbox,
  AlertTriangle,
  Clock,
  CheckCircle2,
  HelpCircle,
  Layers,
  Sparkles,
  Search,
  Filter,
  ArrowUpDown,
  Calendar,
  Flame,
  User,
  ExternalLink,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';

/**
 * BacklogAnalysisView - Product Owner & Team Backlog Grooming & Health Center
 *
 * Focuses on:
 * - Backlog Volume (Story Points & Item counts)
 * - Refinement Readiness (% with Story Points & Priority)
 * - Backlog Rot / Zombie tickets (>60d & >90d inactive)
 * - Aging Distribution (<30d, 30-60d, 60-90d, >90d)
 * - Actionable grooming list with Refinement Status badges
 */
export default function BacklogAnalysisView({
  analytics,
  allIssues = [],
  onUpdateIssue,
  projectKey,
}) {
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'needsPoints', 'stale', 'bugs'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('updated'); // 'updated', 'points', 'priority', 'created'
  const [sortAsc, setSortAsc] = useState(false);

  // Extract Backlog issues (issues not in any active sprint and not done)
  const backlogIssues = useMemo(() => {
    return allIssues.filter((issue) => {
      // Must not be in Done category
      if (issue.statusCategory === 'done') return false;
      // Must be backlog (no sprints or isBacklog true)
      if (issue.isBacklog !== undefined) return issue.isBacklog;
      if (Array.isArray(issue.sprints) && issue.sprints.length > 0) return false;
      return true;
    });
  }, [allIssues]);

  // Backlog metrics calculations
  const metrics = useMemo(() => {
    const totalItems = backlogIssues.length;
    let totalPoints = 0;
    let estimatedCount = 0;
    let staleCount60 = 0;
    let staleCount90 = 0;
    let bugCount = 0;

    const ageBrackets = {
      under30: 0,
      days30to60: 0,
      days60to90: 0,
      over90: 0,
    };

    const typeCounts = {};
    const priorityCounts = {
      Highest: { estimated: 0, unestimated: 0 },
      High: { estimated: 0, unestimated: 0 },
      Medium: { estimated: 0, unestimated: 0 },
      Low: { estimated: 0, unestimated: 0 },
      Lowest: { estimated: 0, unestimated: 0 },
      Unprioritized: { estimated: 0, unestimated: 0 },
    };

    backlogIssues.forEach((issue) => {
      const sp = Number(issue.storyPoints) || 0;
      totalPoints += sp;

      const isEst = issue.storyPoints !== null && issue.storyPoints !== undefined && sp > 0;
      if (isEst) estimatedCount++;

      const days = issue.daysInactive !== undefined ? issue.daysInactive : 0;
      if (days >= 60) staleCount60++;
      if (days >= 90) staleCount90++;

      const ageDays = issue.daysSinceCreation !== undefined ? issue.daysSinceCreation : days;
      if (ageDays < 30) ageBrackets.under30++;
      else if (ageDays < 60) ageBrackets.days30to60++;
      else if (ageDays < 90) ageBrackets.days60to90++;
      else ageBrackets.over90++;

      const tName = issue.type || 'Task';
      typeCounts[tName] = (typeCounts[tName] || 0) + 1;

      if (issue.isBug) bugCount++;

      const pName = priorityCounts[issue.priority] ? issue.priority : 'Unprioritized';
      if (isEst) priorityCounts[pName].estimated++;
      else priorityCounts[pName].unestimated++;
    });

    const readinessScore = totalItems > 0 ? Math.round((estimatedCount / totalItems) * 100) : 100;
    const estRunwaySprints = totalPoints > 0 ? Math.max(1, Math.round(totalPoints / 25)) : 0;

    return {
      totalItems,
      totalPoints: Math.round(totalPoints * 10) / 10,
      estimatedCount,
      unestimatedCount: totalItems - estimatedCount,
      readinessScore,
      staleCount60,
      staleCount90,
      bugCount,
      estRunwaySprints,
      ageBrackets,
      typeCounts,
      priorityCounts,
    };
  }, [backlogIssues]);

  // Filtered & Sorted Backlog Items for the Interactive Table
  const displayedIssues = useMemo(() => {
    let result = backlogIssues.filter((issue) => {
      // Filter tab
      if (filterMode === 'needsPoints') {
        const sp = Number(issue.storyPoints) || 0;
        if (sp > 0) return false;
      } else if (filterMode === 'stale') {
        const days = issue.daysInactive || 0;
        if (days < 60) return false;
      } else if (filterMode === 'bugs') {
        if (!issue.isBug) return false;
      }

      // Keyword search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const kMatch = (issue.key || '').toLowerCase().includes(q);
        const sMatch = (issue.summary || '').toLowerCase().includes(q);
        const aMatch = (issue.assignee || '').toLowerCase().includes(q);
        if (!kMatch && !sMatch && !aMatch) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'points') {
        valA = Number(a.storyPoints) || 0;
        valB = Number(b.storyPoints) || 0;
      } else if (sortBy === 'priority') {
        const pOrder = { Highest: 5, High: 4, Medium: 3, Low: 2, Lowest: 1, Unprioritized: 0 };
        valA = pOrder[a.priority] || 0;
        valB = pOrder[b.priority] || 0;
      } else if (sortBy === 'created') {
        valA = new Date(a.created || 0).getTime();
        valB = new Date(b.created || 0).getTime();
      } else {
        // default 'updated'
        valA = new Date(a.updated || 0).getTime();
        valB = new Date(b.updated || 0).getTime();
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return result;
  }, [backlogIssues, filterMode, searchQuery, sortBy, sortAsc]);

  // ECharts: Age Pyramid
  const ageChartOption = useMemo(() => {
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: ['< 30 Days (Fresh)', '30-60 Days', '60-90 Days (Staling)', '> 90 Days (Rotting)'],
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#1e293b' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      series: [
        {
          name: 'Issues',
          type: 'bar',
          barWidth: '40%',
          data: [
            { value: metrics.ageBrackets.under30, itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] } },
            { value: metrics.ageBrackets.days30to60, itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] } },
            { value: metrics.ageBrackets.days60to90, itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] } },
            { value: metrics.ageBrackets.over90, itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] } },
          ],
        },
      ],
    };
  }, [metrics.ageBrackets]);

  // ECharts: Type Breakdown Donut
  const typeChartOption = useMemo(() => {
    const pieData = Object.keys(metrics.typeCounts).map((typeName) => ({
      name: typeName,
      value: metrics.typeCounts[typeName],
    }));

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
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
            label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#fff' },
          },
          data: pieData,
        },
      ],
    };
  }, [metrics.typeCounts]);

  return (
    <div className="space-y-6">
      {/* ── 1. EXECUTIVE KPI SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Backlog Volume */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Backlog Scope</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">{metrics.totalItems}</span>
            <span className="text-xs text-slate-400 font-medium">tickets</span>
          </div>
          <div className="mt-1 text-xs text-blue-400 font-semibold">
            {metrics.totalPoints} <span className="text-slate-400 font-normal">Story Points</span>
          </div>
        </div>

        {/* Refinement Readiness Score */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sprint Readiness</span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                metrics.readinessScore >= 75
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : metrics.readinessScore >= 50
                  ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tracking-tight ${
                metrics.readinessScore >= 75
                  ? 'text-emerald-400'
                  : metrics.readinessScore >= 50
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {metrics.readinessScore}%
            </span>
            <span className="text-xs text-slate-400 font-medium">estimated</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {metrics.estimatedCount} of {metrics.totalItems} ready for pull
          </div>
        </div>

        {/* Unestimated Debt */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unestimated Debt</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-300 tracking-tight">{metrics.unestimatedCount}</span>
            <span className="text-xs text-slate-400 font-medium">items</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">Needs grooming session</div>
        </div>

        {/* Zombie / Stale Backlog */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Zombie Tickets</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400 tracking-tight">{metrics.staleCount60}</span>
            <span className="text-xs text-slate-400 font-medium">&gt;60d idle</span>
          </div>
          <div className="mt-1 text-xs text-rose-400/90 font-medium">
            {metrics.staleCount90} tickets &gt;90d rotting
          </div>
        </div>

        {/* Estimated Runway */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pipeline Depth</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-400 tracking-tight">~{metrics.estRunwaySprints}</span>
            <span className="text-xs text-slate-400 font-medium">sprints</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">Based on ~25 SP / sprint</div>
        </div>
      </div>

      {/* ── 2. VISUAL CHARTS (AGE PYRAMID & WORK COMPOSITION) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backlog Age Pyramid */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                Backlog Aging Pyramid
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ticket shelf-life distribution to identify rotting backlog debt
              </p>
            </div>
          </div>
          <div className="h-64">
            <ReactECharts option={ageChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Backlog Composition */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Inbox className="w-4 h-4 text-blue-400" />
                Backlog Work Composition
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Breakdown of backlog demand across work types
              </p>
            </div>
          </div>
          <div className="h-64">
            <ReactECharts option={typeChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      </div>

      {/* ── 3. INTERACTIVE GROOMING & REFINEMENT TABLE ── */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Grooming & Refinement Queue ({displayedIssues.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review unassigned backlog items, assign Story Points, and prioritize for upcoming sprints
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filterMode === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({backlogIssues.length})
            </button>
            <button
              onClick={() => setFilterMode('needsPoints')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filterMode === 'needsPoints' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Needs Points ({metrics.unestimatedCount})
            </button>
            <button
              onClick={() => setFilterMode('stale')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filterMode === 'stale' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Zombie &gt;60d ({metrics.staleCount60})
            </button>
            <button
              onClick={() => setFilterMode('bugs')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filterMode === 'bugs' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Bugs ({metrics.bugCount})
            </button>
          </div>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search key, summary, or assignee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 self-end sm:self-auto">
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="updated">Recently Updated</option>
              <option value="created">Created Date</option>
              <option value="points">Story Points</option>
              <option value="priority">Priority</option>
            </select>
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:text-white text-slate-400"
              title="Toggle sort direction"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                <th className="py-2.5 px-3">Key</th>
                <th className="py-2.5 px-3">Summary</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Story Points</th>
                <th className="py-2.5 px-3">Readiness</th>
                <th className="py-2.5 px-3">Inactive Days</th>
                <th className="py-2.5 px-3">Assignee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {displayedIssues.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-500">
                    No backlog issues match the selected criteria.
                  </td>
                </tr>
              ) : (
                displayedIssues.map((issue) => {
                  const sp = Number(issue.storyPoints) || 0;
                  const isEstimated = issue.storyPoints !== null && issue.storyPoints !== undefined && sp > 0;
                  const days = issue.daysInactive || 0;
                  const isZombie = days >= 60;

                  return (
                    <tr key={issue.id || issue.key} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-400 whitespace-nowrap">
                        {issue.key}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 max-w-xs sm:max-w-md truncate" title={issue.summary}>
                        {issue.summary}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{issue.type}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            issue.priority === 'Highest'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : issue.priority === 'High'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {issue.priority}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{issue.status}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isEstimated ? (
                          <span className="font-semibold text-white bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30">
                            {issue.storyPoints} SP
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Unestimated</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isZombie ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            <Flame className="w-3 h-3 text-rose-400" /> Zombie &gt;60d
                          </span>
                        ) : isEstimated ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <HelpCircle className="w-3 h-3 text-amber-400" /> Needs SP
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {days}d
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {issue.avatarUrl ? (
                            <img src={issue.avatarUrl} alt="" className="w-4 h-4 rounded-full" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span>{issue.assignee || 'Unassigned'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

