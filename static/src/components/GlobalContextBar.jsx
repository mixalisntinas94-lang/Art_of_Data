import React from 'react';
import { Zap, Layers, Briefcase, ChevronRight, Sparkles, LayoutGrid, Inbox, Target, History } from 'lucide-react';
import { useFilterStore } from '../store/useFilterStore';

/**
 * Global Context Bar - Executive Routing & Scope Selector
 *
 * Provides Context Switching across enterprise levels:
 * 1. Active Sprint (Tactical Delivery Engine - Current Active Scope)
 * 2. Backlog Analysis (Grooming, Refinement & Readiness)
 * 3. Epic Analysis (Strategic Roadmap & Progress Delivery)
 * 4. Custom Explorer (Self-Service Analytics Builder & Drag & Drop BI Canvas)
 * 5. Historical Vault (1-by-1 FIFO Rolling Snapshot Engine & Longitudinal Trends)
 * 6. Portfolio / Company (C-Level Executive Strategy - Coming Soon)
 */
export default function GlobalContextBar({ projectKey, activeSprintName, fifoCount }) {
  const { currentScope, setCurrentScope } = useFilterStore();

  const scopes = [
    {
      id: 'sprint',
      label: 'Active Sprint',
      icon: Zap,
      enabled: true,
      description: 'Sprint health, velocity, blockers & daily team flow',
    },
    {
      id: 'backlog',
      label: 'Backlog Analysis',
      icon: Inbox,
      enabled: true,
      badge: 'Hygiene',
      description: 'Backlog readiness, grooming coverage, rot & age distribution',
    },
    {
      id: 'epic',
      label: 'Epic Analysis',
      icon: Target,
      enabled: true,
      badge: 'Roadmap',
      description: 'Strategic epic progress, delivery confidence & orphan tickets',
    },
    {
      id: 'explorer',
      label: 'Custom Explorer',
      icon: LayoutGrid,
      enabled: true,
      badge: 'BI Studio',
      description: 'Self-service drag & drop BI canvas with Apache ECharts',
    },
    {
      id: 'history',
      label: 'Historical Vault',
      icon: History,
      enabled: true,
      badge: fifoCount !== undefined ? `FIFO ${fifoCount}/104` : 'FIFO',
      description: '2-year rolling FIFO snapshot buffer & longitudinal velocity trends',
    },
    {
      id: 'portfolio',
      label: 'Portfolio / Company',
      icon: Briefcase,
      enabled: false,
      badge: 'Coming Soon',
      description: 'Multi-project budget, C-level burn-down & strategic alignment',
    },
  ];

  return (
    <div className="sticky top-0 z-20 bg-[#0b0f19]/95 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-slate-800 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 transition-all">
      {/* ── LEFT: SCOPE SELECTOR (SEGMENTED CONTROL) ── */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/90 overflow-x-auto">
        {scopes.map((scope) => {
          const Icon = scope.icon;
          const isSelected = currentScope === scope.id;

          return (
            <button
              key={scope.id}
              disabled={!scope.enabled}
              onClick={() => scope.enabled && setCurrentScope(scope.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap select-none ${
                isSelected
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 border border-blue-400/40'
                  : scope.enabled
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-500 cursor-not-allowed opacity-60 hover:bg-transparent'
              }`}
              title={scope.description}
            >
              <Icon
                className={`w-3.5 h-3.5 ${
                  isSelected ? 'text-white' : scope.enabled ? 'text-blue-400' : 'text-slate-600'
                }`}
              />
              <span>{scope.label}</span>

              {/* Discrete Coming Soon Badge for Future Contexts */}
              {scope.badge && (
                <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/80">
                  {scope.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── RIGHT: ACTIVE CONTEXT BREADCRUMB & METRICS LEVEL ── */}
      <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
        <span className="font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60 font-semibold">
          {projectKey}
        </span>
        <ChevronRight className="w-3 h-3 text-slate-600" />
        <span className="text-white font-medium flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              currentScope === 'explorer'
                ? 'bg-cyan-400 shadow-cyan-400/80'
                : currentScope === 'backlog'
                ? 'bg-amber-400 shadow-amber-400/80'
                : currentScope === 'epic'
                ? 'bg-indigo-400 shadow-indigo-400/80'
                : currentScope === 'history'
                ? 'bg-purple-400 shadow-purple-400/80'
                : 'bg-emerald-400 shadow-emerald-400/80'
            } shadow-sm`}
          />
          {currentScope === 'explorer'
            ? 'Custom BI Studio'
            : currentScope === 'backlog'
            ? 'Backlog Grooming & Health'
            : currentScope === 'epic'
            ? 'Strategic Epics & Roadmap'
            : currentScope === 'history'
            ? 'FIFO Historical Snapshot Vault'
            : activeSprintName || 'Active Sprint View'}
        </span>
      </div>
    </div>
  );
}
