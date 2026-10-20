import React, { useState, useEffect, useMemo } from 'react';
import { invoke, view } from '@forge/bridge';
import {
  AlertTriangle,
  Filter,
  RefreshCw,
  X,
  Zap,
} from 'lucide-react';
import { useFilterStore } from './store/useFilterStore';
import GlobalContextBar from './components/GlobalContextBar';
import SprintView from './views/SprintView';
import CustomExplorerView from './views/CustomExplorerView';
import ProjectReleaseView from './views/ProjectReleaseView';
import PortfolioCompanyView from './views/PortfolioCompanyView';

/**
 * Agile Pulse Analytics - Enterprise Custom UI Root Application
 *
 * Core Architecture & Features:
 * 1. Global Context Bar (Sticky Header): Executive Context Switching (Active Sprint, Project / Release, Portfolio / Company).
 * 2. Scope Selector: Dynamic routing mounting different component hierarchies and layouts.
 * 3. Disabled States with Coming Soon badges for Project & Portfolio tiers.
 * 4. SprintView: Tactical delivery engine with real-time pacing, cross-filters, capacity limit, and blockers stream.
 */
export default function App() {
  const [context, setContext] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [metricMode, setMetricMode] = useState('points'); // 'points' or 'hours'

  // Global cross-filtering & scope state from Zustand
  const {
    currentScope,
    selectedType,
    selectedAssignee,
    selectedStatus,
    activityFilter,
    setSelectedType,
    setSelectedAssignee,
    setSelectedStatus,
    setActivityFilter,
    resetFilters,
    hasActiveFilters,
  } = useFilterStore();

  const isCrossFiltered = hasActiveFilters();

  // Fetch product context and Jira projects on mount
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        if (view && view.getContext) {
          const ctx = await view.getContext();
          setContext(ctx);
        }

        const res = await invoke('getProjects');
        if (res && res.success && res.projects && res.projects.length > 0) {
          setProjects(res.projects);
          setSelectedProject(res.projects[0]);
          await loadProjectAnalytics(res.projects[0].key);
        } else {
          setError(res?.error || 'No accessible Jira projects found.');
          setLoading(false);
        }
      } catch (err) {
        console.error('Initialization error:', err);
        setError(err.message || 'Failed to initialize Custom UI.');
        setLoading(false);
      }
    }

    init();
  }, []);

  // Load analytics for a specific project
  const loadProjectAnalytics = async (projectKey) => {
    try {
      setLoading(true);
      setError(null);
      resetFilters();

      const res = await invoke('getProjectAnalytics', {
        projectKey,
        sprint: 'active',
      });

      if (res && res.success) {
        setAnalytics(res);
        setLastRefreshed(new Date().toLocaleTimeString());
      } else {
        setError(res?.error || 'Failed to fetch project analytics.');
      }
    } catch (err) {
      console.error('Analytics load error:', err);
      setError(err.message || 'Error communicating with Forge resolver.');
    } finally {
      setLoading(false);
    }
  };

  const allIssues = analytics?.rawIssues || [];

  // Filter raw issues according to active cross-filters
  const filteredIssues = useMemo(() => {
    return allIssues.filter((issue) => {
      if (selectedType && issue.type !== selectedType) {
        return false;
      }
      if (selectedAssignee && issue.assignee !== selectedAssignee) {
        return false;
      }
      if (selectedStatus) {
        const cat = issue.statusCategory;
        if (selectedStatus === 'Done' && cat !== 'done') return false;
        if (selectedStatus === 'In Progress' && cat !== 'indeterminate') return false;
        if (selectedStatus === 'To Do' && cat !== 'new' && cat !== 'undefined') return false;
      }
      return true;
    });
  }, [allIssues, selectedType, selectedAssignee, selectedStatus]);

  // Derived real-time KPI metrics
  const kpis = useMemo(() => {
    if (!analytics?.kpis) return null;
    const total = filteredIssues.length;
    let completedCount = 0;
    let inProgressCount = 0;
    let toDoCount = 0;
    let completedSP = 0;
    let inProgressSP = 0;
    let toDoSP = 0;
    let totalSP = 0;
    let bugCount = 0;
    let unestimatedSPCount = 0;
    let totalEstHours = 0;
    let totalLoggedHours = 0;

    filteredIssues.forEach((issue) => {
      const isDone = issue.statusCategory === 'done';
      const isInProgress = issue.statusCategory === 'indeterminate';
      const sp = Number(issue.storyPoints) || 0;
      const isEst = issue.storyPoints !== null && issue.storyPoints !== undefined;

      totalSP += sp;
      if (isDone) {
        completedCount++;
        completedSP += sp;
      } else if (isInProgress) {
        inProgressCount++;
        inProgressSP += sp;
        if (!isEst) unestimatedSPCount++;
      } else {
        toDoCount++;
        toDoSP += sp;
        if (!isEst) unestimatedSPCount++;
      }

      if ((issue.type || '').toLowerCase().includes('bug')) {
        bugCount++;
      }

      totalEstHours += issue.estimatedHours || 0;
      totalLoggedHours += issue.loggedHours || 0;
    });

    const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    const bugRatio = total > 0 ? Math.round((bugCount / total) * 100) : 0;

    return {
      totalIssues: total,
      completedCount,
      inProgressCount,
      toDoCount,
      totalStoryPoints: Math.round(totalSP * 10) / 10,
      completedStoryPoints: Math.round(completedSP * 10) / 10,
      inProgressStoryPoints: Math.round(inProgressSP * 10) / 10,
      toDoStoryPoints: Math.round(toDoSP * 10) / 10,
      completionRate,
      bugCount,
      bugRatio,
      unestimatedPointsCount: unestimatedSPCount,
      totalEstimatedHours: Math.round(totalEstHours * 10) / 10,
      totalLoggedHours: Math.round(totalLoggedHours * 10) / 10,
      avgCycleTimeDays: analytics.kpis.avgCycleTimeDays,
      staleCount: analytics.kpis.staleCount,
    };
  }, [analytics, filteredIssues]);

  // Sprint Time Elapsed & Pacing Logic
  const sprintTimeElapsed = analytics?.sprintTimeElapsedPercent ?? 50;
  const paceGap = sprintTimeElapsed - (kpis?.completionRate ?? 0);
  const isBehindSchedule = paceGap > 15;
  const isSlightlyBehind = paceGap > 0 && paceGap <= 15;

  // Count total stale / blocker issues for badge
  const staleIssuesCount = useMemo(() => {
    return filteredIssues.filter((i) => i.isStale || (i.daysInactive !== undefined && i.daysInactive >= 3)).length;
  }, [filteredIssues]);

  // Issues displayed in Activity Stream (respecting [All Activity] vs [⚠️ Blockers & Stale])
  const displayedStreamIssues = useMemo(() => {
    if (activityFilter === 'stale') {
      return filteredIssues.filter((i) => i.isStale || (i.daysInactive !== undefined && i.daysInactive >= 3));
    }
    return filteredIssues;
  }, [filteredIssues, activityFilter]);

  // Status breakdown data for Recharts PieChart
  const statusPieData = useMemo(() => {
    if (!kpis) return [];
    return [
      {
        name: 'Done',
        value: metricMode === 'points' && kpis.totalStoryPoints > 0 ? kpis.completedStoryPoints : kpis.completedCount,
        color: '#10b981',
        count: kpis.completedCount,
        points: kpis.completedStoryPoints,
      },
      {
        name: 'In Progress',
        value: metricMode === 'points' && kpis.totalStoryPoints > 0 ? kpis.inProgressStoryPoints : kpis.inProgressCount,
        color: '#3b82f6',
        count: kpis.inProgressCount,
        points: kpis.inProgressStoryPoints,
      },
      {
        name: 'To Do',
        value: metricMode === 'points' && kpis.totalStoryPoints > 0 ? kpis.toDoStoryPoints : kpis.toDoCount,
        color: '#64748b',
        count: kpis.toDoCount,
        points: kpis.toDoStoryPoints,
      },
    ].filter((item) => item.value > 0);
  }, [kpis, metricMode]);

  // Types of Work breakdown data for Recharts BarChart
  const typeChartData = useMemo(() => {
    const relevantIssues = allIssues.filter((issue) => {
      if (selectedAssignee && issue.assignee !== selectedAssignee) return false;
      if (selectedStatus) {
        const cat = issue.statusCategory;
        if (selectedStatus === 'Done' && cat !== 'done') return false;
        if (selectedStatus === 'In Progress' && cat !== 'indeterminate') return false;
        if (selectedStatus === 'To Do' && cat !== 'new' && cat !== 'undefined') return false;
      }
      return true;
    });

    const typeMap = {};
    relevantIssues.forEach((issue) => {
      const type = issue.type || 'Task';
      if (!typeMap[type]) {
        typeMap[type] = { name: type, count: 0, points: 0 };
      }
      typeMap[type].count += 1;
      typeMap[type].points += Number(issue.storyPoints) || 0;
    });

    const list = Object.values(typeMap).map((t) => ({
      name: t.name,
      count: t.count,
      points: Math.round(t.points * 10) / 10,
    }));

    list.sort((a, b) => b.points - a.points || b.count - a.count);
    return list;
  }, [allIssues, selectedAssignee, selectedStatus]);

  // Assignee Effort Allocation for Horizontal Stacked Bar Chart
  const assigneeChartData = useMemo(() => {
    const relevantIssues = allIssues.filter((issue) => {
      if (selectedType && issue.type !== selectedType) return false;
      if (selectedStatus) {
        const cat = issue.statusCategory;
        if (selectedStatus === 'Done' && cat !== 'done') return false;
        if (selectedStatus === 'In Progress' && cat !== 'indeterminate') return false;
        if (selectedStatus === 'To Do' && cat !== 'new' && cat !== 'undefined') return false;
      }
      return true;
    });

    const map = {};
    relevantIssues.forEach((issue) => {
      const name = issue.assignee || 'Unassigned';
      if (!map[name]) {
        map[name] = {
          name,
          avatarUrl: issue.avatarUrl,
          completedPoints: 0,
          remainingPoints: 0,
          totalPoints: 0,
          totalTickets: 0,
        };
      }
      const sp = Number(issue.storyPoints) || 0;
      map[name].totalTickets += 1;
      map[name].totalPoints += sp;
      if (issue.statusCategory === 'done') {
        map[name].completedPoints += sp;
      } else {
        map[name].remainingPoints += sp;
      }
    });

    const list = Object.values(map).map((item) => ({
      ...item,
      totalPoints: Math.round(item.totalPoints * 10) / 10,
      completedPoints: Math.round(item.completedPoints * 10) / 10,
      remainingPoints: Math.round(item.remainingPoints * 10) / 10,
      isOverCapacity: item.totalPoints > 40,
    }));

    list.sort((a, b) => b.totalPoints - a.totalPoints || b.totalTickets - a.totalTickets);
    return list;
  }, [allIssues, selectedType, selectedStatus]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 p-4 md:p-6 font-sans">
      {/* ── TOP HEADER BAR ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Agile Pulse</h1>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-cyan-400 border border-cyan-500/30">
                  Custom UI Pro
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pacing Intelligence & Multi-Tier Scope Command Center
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Project Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Project:</span>
            <select
              value={selectedProject ? selectedProject.key : ''}
              onChange={(e) => {
                const proj = projects.find((p) => p.key === e.target.value);
                if (proj) {
                  setSelectedProject(proj);
                  loadProjectAnalytics(proj.key);
                }
              }}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              {projects.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
          </div>

          {/* Metric Mode Toggle */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-0.5 flex items-center text-xs font-medium">
            <button
              onClick={() => setMetricMode('points')}
              className={`px-3 py-1 rounded-md transition-all ${
                metricMode === 'points'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Story Points
            </button>
            <button
              onClick={() => setMetricMode('hours')}
              className={`px-3 py-1 rounded-md transition-all ${
                metricMode === 'hours'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hours
            </button>
          </div>

          <button
            onClick={() => selectedProject && loadProjectAnalytics(selectedProject.key)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-semibold rounded-lg border border-slate-700 transition-all text-slate-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* ── ACTIVE CROSS-FILTERS BAR (SPRINT SCOPE ONLY) ── */}
      {currentScope === 'sprint' && (
        <div className="mt-4 p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            Active Filters:
          </span>

          {isCrossFiltered ? (
            <>
              {selectedType && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-semibold">
                  Type: {selectedType}
                  <button
                    onClick={() => setSelectedType(selectedType)}
                    className="hover:text-white ml-0.5"
                    title="Remove filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedAssignee && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-semibold">
                  Assignee: {selectedAssignee}
                  <button
                    onClick={() => setSelectedAssignee(selectedAssignee)}
                    className="hover:text-white ml-0.5"
                    title="Remove filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedStatus && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold">
                  Status: {selectedStatus}
                  <button
                    onClick={() => setSelectedStatus(selectedStatus)}
                    className="hover:text-white ml-0.5"
                    title="Remove filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {activityFilter === 'stale' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold">
                  View: ⚠️ Blockers & Stale
                  <button
                    onClick={() => setActivityFilter('all')}
                    className="hover:text-white ml-0.5"
                    title="Remove filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-slate-500 italic">
              All items active (Click any bar, slice, or assignee to cross-filter)
            </span>
          )}
        </div>

        {isCrossFiltered && (
          <button
            onClick={resetFilters}
            className="text-xs text-rose-400 hover:text-rose-300 underline underline-offset-4 transition-colors font-semibold ml-auto"
          >
            Clear All Filters
          </button>
        )}
      </div>
      )}

      {/* ── ERROR STATE ── */}
      {error && (
        <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">System Notice</h4>
            <p className="text-xs text-rose-300/90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ── SKELETON LOADING STATE ── */}
      {loading && !analytics && (
        <div className="mt-6 space-y-6 animate-pulse">
          <div className="h-12 bg-slate-900/60 rounded-xl border border-slate-800/80" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-36 bg-slate-900/60 rounded-xl border border-slate-800/80 p-4" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-slate-900/60 rounded-xl border border-slate-800/80" />
            <div className="h-80 bg-slate-900/60 rounded-xl border border-slate-800/80" />
          </div>
        </div>
      )}

      {/* ── MAIN DASHBOARD VIEW WITH DYNAMIC ROUTING & CONTEXT SWITCHING ── */}
      {analytics && kpis && (
        <div className="mt-4">
          {/* ════ 1. GLOBAL CONTEXT BAR (STICKY HEADER DIRECTLY ABOVE KPIS) ════ */}
          <GlobalContextBar
            projectKey={selectedProject?.key}
            activeSprintName={analytics?.activeSprintName}
          />

          {/* ════ 2. DYNAMIC COMPONENT RENDERING BASED ON CURRENT SCOPE ════ */}
          {currentScope === 'sprint' && (
            <SprintView
              analytics={analytics}
              kpis={kpis}
              metricMode={metricMode}
              selectedType={selectedType}
              selectedAssignee={selectedAssignee}
              selectedStatus={selectedStatus}
              activityFilter={activityFilter}
              setSelectedType={setSelectedType}
              setSelectedAssignee={setSelectedAssignee}
              setSelectedStatus={setSelectedStatus}
              setActivityFilter={setActivityFilter}
              statusPieData={statusPieData}
              typeChartData={typeChartData}
              assigneeChartData={assigneeChartData}
              filteredIssues={filteredIssues}
              displayedStreamIssues={displayedStreamIssues}
              staleIssuesCount={staleIssuesCount}
              sprintTimeElapsed={sprintTimeElapsed}
              paceGap={paceGap}
              isBehindSchedule={isBehindSchedule}
              isSlightlyBehind={isSlightlyBehind}
              lastRefreshed={lastRefreshed}
              activeSprintStartDate={analytics?.activeSprintStartDate}
              activeSprintEndDate={analytics?.activeSprintEndDate}
            />
          )}

          {currentScope === 'explorer' && (
            <CustomExplorerView
              allIssues={allIssues}
              projects={projects}
              selectedProject={selectedProject}
            />
          )}

          {currentScope === 'project' && (
            <ProjectReleaseView projectKey={selectedProject?.key} />
          )}

          {currentScope === 'portfolio' && (
            <PortfolioCompanyView />
          )}
        </div>
      )}
    </div>
  );
}
