import React, { useState, useMemo } from 'react';
import { invoke } from '@forge/bridge';
import {
  History,
  Database,
  TrendingUp,
  CheckCircle2,
  Camera,
  RefreshCw,
  Trash2,
  Zap,
  ArrowRight,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';

/**
 * HistoricalTrendsView - FIFO Historical Snapshot Vault & Executive Trend Engine
 *
 * Implements the 1-by-1 Chronological FIFO Circular Buffer (max 104 snapshots / 28 KB per project):
 * - Automatically stores compact numerical KPI snapshots in Jira Project Properties (`asUser()`).
 * - When the buffer reaches capacity, unhooks ONLY the single oldest chronological report (`snapshots[0]`)
 *   one-by-one as each new report enters, preserving a continuous 2-year rolling window.
 */
export default function HistoricalTrendsView({
  analytics,
  kpis,
  projectKey,
  sprintScope,
  onHistoryUpdated,
}) {
  const [busyAction, setBusyAction] = useState(null); // 'capture' | 'rollover' | 'shift' | null
  const [actionBanner, setActionBanner] = useState(null);
  const [sortNewestFirst, setSortNewestFirst] = useState(true);

  const fifoHistory = analytics?.fifoHistory || {
    snapshots: [],
    usedCount: 0,
    maxCapacity: 104,
    usagePct: 0,
    byteSize: 0,
    maxBytes: 28672,
    byteUsagePct: 0,
    totalEvictedCount: 0,
    lastEvictedReport: null,
  };

  // Chronological ascending list (index 0 = Oldest / FIFO Head, last index = Newest / FIFO Tail)
  const chronologicalSnapshots = useMemo(() => {
    const raw = Array.isArray(fifoHistory.snapshots) ? [...fifoHistory.snapshots] : [];
    raw.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    return raw;
  }, [fifoHistory.snapshots]);

  const displayedTableSnapshots = useMemo(() => {
    return sortNewestFirst ? [...chronologicalSnapshots].reverse() : chronologicalSnapshots;
  }, [chronologicalSnapshots, sortNewestFirst]);

  const oldestSnap = chronologicalSnapshots[0] || null;
  const newestSnap = chronologicalSnapshots[chronologicalSnapshots.length - 1] || null;

  // Compute trajectory deltas between oldest and newest snapshot
  const trendMetrics = useMemo(() => {
    if (chronologicalSnapshots.length === 0) {
      return {
        velocityDelta: 0,
        scopeDelta: 0,
        avgCompRate: 0,
        compDelta: 0,
        earliestDate: 'N/A',
        latestDate: 'N/A',
      };
    }
    const first = chronologicalSnapshots[0];
    const last = chronologicalSnapshots[chronologicalSnapshots.length - 1];
    const velocityDelta = Math.round(((last.doneSP || 0) - (first.doneSP || 0)) * 10) / 10;
    const scopeDelta = Math.round(((last.totalSP || 0) - (first.totalSP || 0)) * 10) / 10;
    const sumComp = chronologicalSnapshots.reduce((s, item) => s + (item.compRate || 0), 0);
    const avgCompRate = Math.round(sumComp / chronologicalSnapshots.length);
    const compDelta = (last.compRate || 0) - (first.compRate || 0);

    return {
      velocityDelta,
      scopeDelta,
      avgCompRate,
      compDelta,
      earliestDate: first.dateLabel || 'N/A',
      latestDate: last.dateLabel || 'N/A',
    };
  }, [chronologicalSnapshots]);

  // Capture a new snapshot or simulate full-queue 1-by-1 FIFO rollover
  const handleCaptureSnapshot = async (simulateFullQueue = false) => {
    if (!projectKey || busyAction) return;
    try {
      setBusyAction(simulateFullQueue ? 'rollover' : 'capture');
      setActionBanner(null);

      const snapshotData = {
        sprintScope: sprintScope || analytics?.sprintScope || 'active',
        activeSprintName: analytics?.activeSprintName || 'Active Sprint',
        totalStoryPoints: kpis?.totalStoryPoints ?? analytics?.kpis?.totalStoryPoints ?? 0,
        completedStoryPoints: kpis?.completedStoryPoints ?? analytics?.kpis?.completedStoryPoints ?? 0,
        inProgressStoryPoints: kpis?.inProgressStoryPoints ?? analytics?.kpis?.inProgressStoryPoints ?? 0,
        toDoStoryPoints: kpis?.toDoStoryPoints ?? analytics?.kpis?.toDoStoryPoints ?? 0,
        spCompletionRate: kpis?.spCompletionRate ?? analytics?.kpis?.spCompletionRate ?? 0,
        ticketCompletionRate: kpis?.ticketCompletionRate ?? analytics?.kpis?.ticketCompletionRate ?? 0,
        totalIssues: kpis?.totalIssues ?? analytics?.kpis?.totalIssues ?? 0,
        completedCount: kpis?.completedCount ?? analytics?.kpis?.completedCount ?? 0,
        bugCount: kpis?.bugCount ?? analytics?.kpis?.bugCount ?? 0,
        activeBugCount: kpis?.activeBugCount ?? analytics?.kpis?.activeBugCount ?? 0,
        staleCount: kpis?.staleCount ?? analytics?.kpis?.staleCount ?? 0,
        avgCycleTimeDays: kpis?.avgCycleTimeDays ?? analytics?.kpis?.avgCycleTimeDays ?? null,
        unestimatedPointsCount: kpis?.unestimatedPointsCount ?? analytics?.kpis?.unestimatedPointsCount ?? 0,
        orphanIssuesCount: analytics?.orphanIssuesCount ?? 0,
        backlogTotalPoints: analytics?.backlog?.totalPoints ?? 0,
        backlogTotalItems: analytics?.backlog?.totalItems ?? 0,
      };

      const res = await invoke('captureFifoSnapshot', {
        projectKey,
        snapshotData,
        simulateFullQueue,
      });

      if (res && res.success && res.fifoHistory) {
        if (onHistoryUpdated) {
          onHistoryUpdated(res.fifoHistory);
        }
        const evictedList = res.fifoHistory.evictedNow || [];
        if (evictedList.length > 0) {
          const ev = evictedList[0];
          setActionBanner({
            type: 'fifo-rollover',
            message: `1-by-1 FIFO Rollover Executed: Added new snapshot and unhooked ONLY the single oldest chronological report (${ev.dateLabel} · ${ev.timeLabel || ''} · ${ev.doneSP}/${ev.totalSP} SP).`,
          });
        } else {
          setActionBanner({
            type: 'captured',
            message: `New point-in-time snapshot captured into the FIFO Vault (${res.fifoHistory.usedCount} / ${res.fifoHistory.maxCapacity} slots used).`,
          });
        }
      } else {
        setActionBanner({
          type: 'error',
          message: res?.error || 'Could not capture snapshot.',
        });
      }
    } catch (err) {
      setActionBanner({
        type: 'error',
        message: err.message || 'Error communicating with Forge resolver.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  // Manually unhook ONLY the single oldest chronological report (index 0)
  const handleShiftOldest = async () => {
    if (!projectKey || busyAction) return;
    try {
      setBusyAction('shift');
      setActionBanner(null);

      const res = await invoke('shiftOldestFifoSnapshot', { projectKey });
      if (res && res.success && res.fifoHistory) {
        if (onHistoryUpdated) {
          onHistoryUpdated(res.fifoHistory);
        }
        const ev = (res.fifoHistory.evictedNow || [])[0] || res.fifoHistory.lastEvictedReport;
        setActionBanner({
          type: 'fifo-shift',
          message: ev
            ? `Single Oldest Report Unhooked (FIFO Shift): Removed oldest report from ${ev.dateLabel} (${ev.doneSP}/${ev.totalSP} SP). Remaining reports: ${res.fifoHistory.usedCount}.`
            : 'Single oldest report unhooked from FIFO queue.',
        });
      } else {
        setActionBanner({
          type: 'error',
          message: res?.error || 'Could not unhook oldest snapshot.',
        });
      }
    } catch (err) {
      setActionBanner({
        type: 'error',
        message: err.message || 'Error communicating with Forge resolver.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  // ECharts 1: Historical Scope & Delivered Velocity Burnup
  const burnupChartOption = useMemo(() => {
    const labels = chronologicalSnapshots.map(
      (s, idx) => `${s.dateLabel}${idx === chronologicalSnapshots.length - 1 ? ' (Latest)' : ''}`
    );
    const totalSpSeries = chronologicalSnapshots.map((s) => s.totalSP || 0);
    const doneSpSeries = chronologicalSnapshots.map((s) => s.doneSP || 0);
    const inProgSpSeries = chronologicalSnapshots.map((s) => s.inProgSP || 0);

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
      },
      legend: {
        top: '0%',
        textStyle: { color: '#94a3b8', fontSize: 11 },
        itemWidth: 12,
        itemHeight: 8,
      },
      grid: { left: '3%', right: '4%', bottom: '5%', top: '16%', containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: 'Story Points (SP)',
        nameTextStyle: { color: '#64748b', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1e293b' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      series: [
        {
          name: 'Total Scope (SP)',
          type: 'line',
          smooth: true,
          data: totalSpSeries,
          itemStyle: { color: '#38bdf8' },
          lineStyle: { width: 2.5, color: '#38bdf8' },
          areaStyle: { color: 'rgba(56, 189, 248, 0.10)' },
        },
        {
          name: 'Delivered Velocity (Done SP)',
          type: 'line',
          smooth: true,
          data: doneSpSeries,
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 3, color: '#10b981' },
          areaStyle: { color: 'rgba(16, 185, 129, 0.18)' },
        },
        {
          name: 'In Flight (In Progress SP)',
          type: 'bar',
          barMaxWidth: 24,
          data: inProgSpSeries,
          itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  }, [chronologicalSnapshots]);

  // ECharts 2: Completion % & Quality Trajectory Over Time
  const qualityChartOption = useMemo(() => {
    const labels = chronologicalSnapshots.map((s) => s.dateLabel);
    const compSeries = chronologicalSnapshots.map((s) => s.compRate || 0);
    const openBugsSeries = chronologicalSnapshots.map((s) => s.openBugs ?? s.bugCount ?? 0);
    const staleSeries = chronologicalSnapshots.map((s) => s.staleCount || 0);

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
      },
      legend: {
        top: '0%',
        textStyle: { color: '#94a3b8', fontSize: 11 },
        itemWidth: 12,
        itemHeight: 8,
      },
      grid: { left: '3%', right: '4%', bottom: '5%', top: '16%', containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Completion %',
          min: 0,
          max: 100,
          nameTextStyle: { color: '#10b981', fontSize: 10 },
          splitLine: { lineStyle: { color: '#1e293b' } },
          axisLabel: { color: '#94a3b8', fontSize: 11, formatter: '{value}%' },
        },
        {
          type: 'value',
          name: 'Tickets',
          nameTextStyle: { color: '#f43f5e', fontSize: 10 },
          splitLine: { show: false },
          axisLabel: { color: '#94a3b8', fontSize: 11 },
        },
      ],
      series: [
        {
          name: 'Completion Rate (%)',
          type: 'line',
          yAxisIndex: 0,
          smooth: true,
          data: compSeries,
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 2.5, color: '#10b981' },
        },
        {
          name: 'Open Bugs',
          type: 'bar',
          yAxisIndex: 1,
          barMaxWidth: 20,
          data: openBugsSeries,
          itemStyle: { color: '#f43f5e', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'Stale Items',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          data: staleSeries,
          itemStyle: { color: '#f59e0b' },
          lineStyle: { width: 2, type: 'dashed', color: '#f59e0b' },
        },
      ],
    };
  }, [chronologicalSnapshots]);

  const byteKB = Math.round(((fifoHistory.byteSize || 0) / 1024) * 10) / 10;
  const maxKB = Math.round(((fifoHistory.maxBytes || 28672) / 1024) * 10) / 10;

  return (
    <div className="space-y-6">
      {/* ── 1. EXECUTIVE FIFO VAULT KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: FIFO Buffer Capacity */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              FIFO Vault Capacity
            </span>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {fifoHistory.usedCount} / {fifoHistory.maxCapacity}
            </span>
            <span className="text-xs text-cyan-400 font-semibold">({fifoHistory.usagePct}%)</span>
          </div>
          <div className="mt-1.5 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-cyan-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(4, fifoHistory.usagePct)}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Payload: <strong className="text-slate-200">{byteKB} KB</strong> / {maxKB} KB ceiling
          </div>
        </div>

        {/* Card 2: Velocity Trajectory */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Delivered Velocity
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400 tracking-tight">
              {newestSnap ? `${newestSnap.doneSP} SP` : '0 SP'}
            </span>
            <span
              className={`text-xs font-bold ${
                trendMetrics.velocityDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {trendMetrics.velocityDelta >= 0
                ? `+${trendMetrics.velocityDelta} SP`
                : `${trendMetrics.velocityDelta} SP`}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Baseline: {oldestSnap ? `${oldestSnap.doneSP} SP` : '0 SP'} ({trendMetrics.earliestDate})
          </div>
        </div>

        {/* Card 3: Historical Completion Rate */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Completion Trend
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {newestSnap ? `${newestSnap.compRate}%` : '0%'}
            </span>
            <span className="text-xs text-blue-400 font-semibold">
              ({trendMetrics.compDelta >= 0 ? `+${trendMetrics.compDelta}%` : `${trendMetrics.compDelta}%`})
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Historical Avg: <strong className="text-slate-200">{trendMetrics.avgCompRate}%</strong> Done
          </div>
        </div>

        {/* Card 4: 1-by-1 FIFO Rollover Counter */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              1-by-1 FIFO Evictions
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-300 tracking-tight">
              {fifoHistory.totalEvictedCount || 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">oldest unhooked</span>
          </div>
          <div className="mt-1 text-xs text-slate-400 truncate">
            {fifoHistory.lastEvictedReport
              ? `Last unhooked: ${fifoHistory.lastEvictedReport.dateLabel}`
              : 'Auto-unhooks 1 oldest when >104'}
          </div>
        </div>

        {/* Card 5: Historical Retention Span */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Retention Window
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 text-sm font-bold text-indigo-300">
            <span>{trendMetrics.earliestDate}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>{trendMetrics.latestDate}</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Zero-scope Project Entity Vault
          </div>
        </div>
      </div>

      {/* ── 2. INTERACTIVE FIFO ENGINE CONTROL BAR ── */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/30 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              Rolling FIFO Circular Buffer
            </span>
            <h3 className="text-sm font-bold text-white">
              Historical Snapshot Engine (1-by-1 Oldest Report Eviction)
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Snapshots are stored automatically per project. When the queue reaches{' '}
            <strong className="text-slate-200">{fifoHistory.maxCapacity} reports</strong> (or 28 KB), each new
            report unhooks <strong className="text-amber-300">only the single oldest chronological report</strong>{' '}
            (never deleting in bulk).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() => handleCaptureSnapshot(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{busyAction === 'capture' ? 'Capturing...' : 'Capture Snapshot Now'}</span>
          </button>

          <button
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() => handleCaptureSnapshot(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all disabled:opacity-50"
            title="Simulates a full buffer: adds 1 new snapshot at the tail and unhooks ONLY the 1 oldest snapshot at the head"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {busyAction === 'rollover'
                ? 'Rolling FIFO...'
                : 'Test Full-Queue Rollover (+1 New / -1 Oldest)'}
            </span>
          </button>

          <button
            type="button"
            disabled={Boolean(busyAction) || chronologicalSnapshots.length <= 1}
            onClick={handleShiftOldest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-all disabled:opacity-40"
            title="Unhook only the single oldest chronological report (snapshots[0])"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Unhook 1 Oldest</span>
          </button>
        </div>
      </div>

      {/* Live Feedback Banner after FIFO Action */}
      {actionBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            actionBanner.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : actionBanner.type === 'fifo-rollover' || actionBanner.type === 'fifo-shift'
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionBanner.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="font-medium">{actionBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="text-slate-400 hover:text-white font-bold px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── 3. HISTORICAL TREND CHARTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="mb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Historical Scope & Velocity Burnup (SP)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Longitudinal progression of Total Project Scope vs Delivered Story Points across saved snapshots
            </p>
          </div>
          <div className="h-64">
            <ReactECharts option={burnupChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="mb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Completion Rate & Quality Trajectory
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical Completion % alongside Open Defect count and Stale Backlog items
            </p>
          </div>
          <div className="h-64">
            <ReactECharts option={qualityChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      </div>

      {/* ── 4. CHRONOLOGICAL FIFO SNAPSHOT LEDGER TABLE ── */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Chronological FIFO Snapshot Ledger ({chronologicalSnapshots.length} stored)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspect every historical checkpoint. The <strong className="text-amber-300">FIFO Head (Oldest)</strong> is
              the single report that will be unhooked next when capacity exceeds {fifoHistory.maxCapacity}.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSortNewestFirst(!sortNewestFirst)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:text-white font-semibold self-start sm:self-auto"
          >
            Order: {sortNewestFirst ? 'Newest → Oldest' : 'Oldest (FIFO Head) → Newest'}
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                <th className="py-2.5 px-3">FIFO Position</th>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Scope / Sprint</th>
                <th className="py-2.5 px-3">Delivered / Total SP</th>
                <th className="py-2.5 px-3">Completion %</th>
                <th className="py-2.5 px-3">Issues (Done/Total)</th>
                <th className="py-2.5 px-3">Open Bugs</th>
                <th className="py-2.5 px-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {displayedTableSnapshots.map((snap) => {
                const isOldest = oldestSnap && snap.id === oldestSnap.id;
                const isNewest = newestSnap && snap.id === newestSnap.id;
                const chronoIndex =
                  chronologicalSnapshots.findIndex((s) => s.id === snap.id) + 1;

                return (
                  <tr
                    key={snap.id}
                    className={`transition-colors ${
                      isOldest
                        ? 'bg-amber-500/5 hover:bg-amber-500/10'
                        : isNewest
                        ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-400 font-bold">#{chronoIndex}</span>
                        {isOldest && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            FIFO HEAD (Oldest — Next to Unhook)
                          </span>
                        )}
                        {isNewest && !isOldest && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            FIFO TAIL (Latest)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-200 whitespace-nowrap">
                      {snap.dateLabel}{' '}
                      <span className="text-slate-500 text-[11px]">{snap.timeLabel || ''}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                      {snap.sprintName || snap.scope}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-bold text-emerald-400">{snap.doneSP} SP</span>
                      <span className="text-slate-400"> / {snap.totalSP} SP</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                        {snap.compRate}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                      {snap.doneIssues} / {snap.totalIssues} tickets
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          (snap.openBugs ?? snap.bugCount) > 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {snap.openBugs ?? snap.bugCount ?? 0} open
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {snap.trigger || 'auto-daily'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

