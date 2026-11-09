import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  Plus,
  LayoutGrid,
  RotateCcw,
  Sliders,
  Sparkles,
  BarChart3,
  ChevronRight,
  HelpCircle,
  Filter,
  X,
  Layers,
} from 'lucide-react';
import ChartWidget from '../components/explorer/ChartWidget';
import WidgetPropertiesSidebar from '../components/explorer/WidgetPropertiesSidebar';
import DrillDownInspectorTable from '../components/explorer/DrillDownInspectorTable';
import ErrorBoundary from '../components/ErrorBoundary';
import { useFilterStore } from '../store/useFilterStore';

// Default Starter BI Widgets
const DEFAULT_WIDGETS = [
  {
    id: 'widget-1',
    title: 'Work Distribution by Issue Type',
    chartType: 'bar',
    groupBy: 'type',
    measure: 'count',
    theme: 'cyber',
    showLabels: true,
    showLegend: false,
  },
  {
    id: 'widget-2',
    title: 'Effort Allocation by Status',
    chartType: 'donut',
    groupBy: 'status',
    measure: 'storyPoints',
    theme: 'cyber',
    showLabels: true,
    showLegend: true,
  },
  {
    id: 'widget-3',
    title: 'Story Points by Assignee',
    chartType: 'line',
    groupBy: 'assignee',
    measure: 'storyPoints',
    theme: 'emerald',
    showLabels: true,
    showLegend: false,
  },
  {
    id: 'widget-4',
    title: 'Total Scope (SP)',
    chartType: 'number',
    groupBy: 'status',
    measure: 'storyPoints',
    theme: 'neon',
    showLabels: false,
    showLegend: false,
  },
  {
    id: 'widget-5',
    title: 'Workload Cross-Tabulation Matrix',
    chartType: 'table',
    groupBy: 'assignee',
    pivotBy: 'status',
    measure: 'storyPoints',
    theme: 'cyber',
    heatmap: true,
    showTotals: true,
  },
];

const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'widget-1', x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
    { i: 'widget-2', x: 6, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
    { i: 'widget-3', x: 0, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
    { i: 'widget-4', x: 6, y: 4, w: 6, h: 4, minW: 3, minH: 2 },
    { i: 'widget-5', x: 0, y: 8, w: 12, h: 5, minW: 6, minH: 4 },
  ],
};

export default function CustomExplorerView({
  allIssues = [],
  projects = [],
  selectedProject,
  onUpdateIssue,
  assigneesList = [],
  statusesList = ['To Do', 'In Progress', 'Done'],
}) {
  const { width, containerRef } = useContainerWidth({ initialWidth: 1200 });
  const storageKey = `agile_pulse_explorer_v1_${selectedProject?.key || 'default'}`;

  const [widgets, setWidgets] = useState(() => {
    try {
      const saved = window.localStorage.getItem(`${storageKey}_widgets`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((w) =>
            w.id === 'widget-4' && w.title === 'Total Active Scope (SP)'
              ? { ...w, title: 'Total Scope (SP)' }
              : w
          );
        }
      }
    } catch (e) {
      // Ignore storage access errors in strict iframe sandboxes
    }
    return DEFAULT_WIDGETS;
  });

  const [layouts, setLayouts] = useState(() => {
    try {
      const saved = window.localStorage.getItem(`${storageKey}_layouts`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      // Ignore storage access errors
    }
    return DEFAULT_LAYOUTS;
  });

  const [selectedWidgetId, setSelectedWidgetId] = useState('widget-1');
  const [expandedWidgetId, setExpandedWidgetId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Persist widgets & layouts to localStorage whenever modified
  useEffect(() => {
    try {
      window.localStorage.setItem(`${storageKey}_widgets`, JSON.stringify(widgets));
      window.localStorage.setItem(`${storageKey}_layouts`, JSON.stringify(layouts));
    } catch (e) {
      // Ignore storage quota / sandbox errors
    }
  }, [storageKey, widgets, layouts]);

  // Close overlays on Escape key
  useEffect(() => {
    if (!expandedWidgetId && !inspectorOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (expandedWidgetId) setExpandedWidgetId(null);
        else if (inspectorOpen) setInspectorOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedWidgetId, inspectorOpen]);

  // Global cross-filtering state from Zustand
  const {
    selectedType,
    selectedStatus,
    selectedAssignee,
    selectedPriority,
    setSelectedType,
    setSelectedStatus,
    setSelectedAssignee,
    setSelectedPriority,
    resetFilters,
    hasActiveFilters,
  } = useFilterStore();

  const isCrossFiltered = hasActiveFilters();

  // Compute cross-filtered issues dynamically across all active filters
  const crossFilteredIssues = useMemo(() => {
    return allIssues.filter((issue) => {
      if (selectedType && issue.type !== selectedType) return false;
      if (selectedAssignee && issue.assignee !== selectedAssignee) return false;
      if (selectedPriority && (issue.priority || 'Unprioritized') !== selectedPriority) return false;
      if (selectedStatus) {
        const cat = issue.statusCategory;
        const sName = (issue.status || '').toLowerCase();
        if (selectedStatus === 'Done' && cat !== 'done' && !sName.includes('done')) return false;
        if (selectedStatus === 'In Progress' && cat !== 'indeterminate' && !sName.includes('progress')) return false;
        if (selectedStatus === 'To Do' && cat !== 'new' && cat !== 'undefined' && !sName.includes('to do')) return false;
      }
      return true;
    });
  }, [allIssues, selectedType, selectedAssignee, selectedStatus, selectedPriority]);

  // Layout change callback - preserves min boundaries across resizes
  const handleLayoutChange = useCallback((currentLayout, allLayouts) => {
    const sanitized = {};
    Object.keys(allLayouts).forEach((bp) => {
      sanitized[bp] = (allLayouts[bp] || []).map((item) => {
        const wMatch = widgets.find((w) => w.id === item.i);
        const isTable = wMatch?.chartType === 'table';
        const isNum = wMatch?.chartType === 'number';
        return {
          ...item,
          minW: item.minW || (isTable ? 6 : isNum ? 3 : 4),
          minH: item.minH || (isTable ? 4 : isNum ? 2 : 3),
        };
      });
    });
    setLayouts(sanitized);
  }, [widgets]);

  // Selected widget object
  const selectedWidget = useMemo(
    () => widgets.find((w) => w.id === selectedWidgetId),
    [widgets, selectedWidgetId]
  );

  // Expanded widget object for fullscreen focus view
  const expandedWidget = useMemo(
    () => widgets.find((w) => w.id === expandedWidgetId),
    [widgets, expandedWidgetId]
  );

  // Add new widget
  const handleAddWidget = (presetType = 'bar') => {
    const isTable = presetType === 'table';
    const newId = `widget-${Date.now()}`;
    const newWidget = {
      id: newId,
      title: isTable
        ? `Pivot Matrix #${widgets.length + 1}`
        : `Custom Report #${widgets.length + 1}`,
      chartType: presetType,
      groupBy: isTable ? 'assignee' : 'type',
      pivotBy: isTable ? 'status' : undefined,
      measure: isTable ? 'storyPoints' : 'count',
      theme: 'cyber',
      showLabels: true,
      showLegend: true,
      heatmap: true,
      showTotals: true,
    };

    setWidgets((prev) => [...prev, newWidget]);

    // Position new widget in next available spot
    const newLayoutItem = {
      i: newId,
      x: isTable ? 0 : (widgets.length * 4) % 12,
      y: Infinity, // place at the bottom
      w: isTable ? 12 : 6,
      h: isTable ? 5 : 4,
      minW: isTable ? 6 : 4,
      minH: isTable ? 4 : 3,
    };

    setLayouts((prev) => ({
      ...prev,
      lg: [...(prev.lg || []), newLayoutItem],
    }));

    setSelectedWidgetId(newId);
    setSidebarOpen(true);
  };

  // Update widget properties in real-time
  const handleUpdateWidget = (id, updates) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates } : w))
    );

    // If widget was upgraded to table/pivot, guarantee sufficient canvas space
    if (updates.chartType === 'table') {
      setLayouts((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((bp) => {
          updated[bp] = (updated[bp] || []).map((l) => {
            if (l.i === id) {
              return {
                ...l,
                w: Math.max(l.w || 6, 8),
                h: Math.max(l.h || 4, 5),
                minW: 6,
                minH: 4,
              };
            }
            return l;
          });
        });
        return updated;
      });
    }
  };

  // Duplicate widget
  const handleDuplicateWidget = (id) => {
    const target = widgets.find((w) => w.id === id);
    if (!target) return;

    const newId = `widget-${Date.now()}`;
    const clonedWidget = {
      ...target,
      id: newId,
      title: `${target.title} (Copy)`,
    };

    setWidgets((prev) => [...prev, clonedWidget]);

    const targetLayout = layouts.lg?.find((l) => l.i === id);
    const newLayoutItem = {
      i: newId,
      x: targetLayout ? (targetLayout.x + 6) % 12 : 0,
      y: targetLayout ? targetLayout.y + 4 : Infinity,
      w: targetLayout?.w || 6,
      h: targetLayout?.h || 4,
      minW: 3,
      minH: 3,
    };

    setLayouts((prev) => ({
      ...prev,
      lg: [...(prev.lg || []), newLayoutItem],
    }));

    setSelectedWidgetId(newId);
  };

  // Delete widget
  const handleDeleteWidget = (id) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    setLayouts((prev) => ({
      ...prev,
      lg: (prev.lg || []).filter((l) => l.i !== id),
    }));
    if (selectedWidgetId === id) {
      setSelectedWidgetId(widgets.find((w) => w.id !== id)?.id || null);
    }
  };

  // Reset to starter template
  const handleResetStarter = () => {
    setWidgets(DEFAULT_WIDGETS);
    setLayouts(DEFAULT_LAYOUTS);
    setSelectedWidgetId('widget-1');
  };

  // Clear all
  const handleClearAll = () => {
    setWidgets([]);
    setLayouts({ lg: [] });
    setSelectedWidgetId(null);
  };

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[640px] rounded-2xl overflow-hidden border border-slate-800 bg-[#070b14] relative">
      {/* ── LEFT & CENTER: BI CANVAS ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* ── TOP ACTION TOOLBAR ── */}
        <div className="p-3.5 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400" />
              <h2 className="text-sm font-bold text-white tracking-tight">
                Self-Service Report Builder
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              Interactive ECharts Grid
            </span>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              · {widgets.length} widget(s) active
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleAddWidget('bar')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Add Widget
            </button>

            <button
              onClick={handleResetStarter}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/60 transition-colors"
              title="Reset to default starter template"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                sidebarOpen
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700/60'
              }`}
              title="Toggle Properties Panel"
            >
              <Sliders className="w-3.5 h-3.5" />
              Properties
            </button>

            <button
              onClick={() => setInspectorOpen(!inspectorOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                inspectorOpen
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 border-blue-500'
                  : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700/60'
              }`}
              title="Toggle Issue Drill-Down Drawer"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Inspector ({isCrossFiltered ? crossFilteredIssues.length : allIssues.length})</span>
            </button>
          </div>
        </div>

        {/* ── CANVAS WORKSPACE WITH DOT GRID BACKGROUND (2D SCROLL SUPPORT) ── */}
        <div
          ref={containerRef}
          className="flex-1 p-4 overflow-auto custom-scrollbar bg-[#070b14] bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:18px_18px] relative min-h-[500px] min-w-0 flex flex-col gap-3"
        >
          {/* ── ACTIVE CROSS-FILTER BAR ── */}
          {isCrossFiltered && (
            <div className="p-3 rounded-2xl bg-slate-900/90 border border-cyan-500/40 shadow-lg shadow-cyan-500/10 flex items-center justify-between gap-3 text-xs flex-wrap animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-cyan-400 font-extrabold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 animate-pulse" />
                  Active Cross-Filters:
                </span>

                {selectedType && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 shadow-sm">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Type:</span>
                    <strong className="text-purple-300 font-bold">{selectedType}</strong>
                    <button
                      type="button"
                      onClick={() => setSelectedType(null)}
                      className="p-0.5 rounded hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 ml-0.5 transition-colors"
                      title="Clear type filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedStatus && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 shadow-sm">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Status:</span>
                    <strong className="text-blue-300 font-bold">{selectedStatus}</strong>
                    <button
                      type="button"
                      onClick={() => setSelectedStatus(null)}
                      className="p-0.5 rounded hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 ml-0.5 transition-colors"
                      title="Clear status filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedAssignee && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 shadow-sm">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Assignee:</span>
                    <strong className="text-cyan-300 font-bold">{selectedAssignee}</strong>
                    <button
                      type="button"
                      onClick={() => setSelectedAssignee(null)}
                      className="p-0.5 rounded hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 ml-0.5 transition-colors"
                      title="Clear assignee filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedPriority && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 shadow-sm">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Priority:</span>
                    <strong className="text-amber-300 font-bold">{selectedPriority}</strong>
                    <button
                      type="button"
                      onClick={() => setSelectedPriority(null)}
                      className="p-0.5 rounded hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 ml-0.5 transition-colors"
                      title="Clear priority filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                <span className="text-slate-400 font-mono text-[11px] ml-1">
                  ({crossFilteredIssues.length} of {allIssues.length} issues match)
                </span>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setInspectorOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Inspect ({crossFilteredIssues.length})</span>
                </button>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 font-bold text-xs border border-slate-700/80 transition-colors shadow-sm"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}
          {widgets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-800 rounded-2xl max-w-lg mx-auto my-12 bg-slate-900/40">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-500/20">
                <LayoutGrid className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Your Canvas is Ready
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
                Build custom reports and executive charts with drag & drop freedom, powered by Apache ECharts and live Jira data.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleAddWidget('bar')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all hover:brightness-110"
                >
                  <Plus className="w-4 h-4" />
                  Add Your First Widget
                </button>
                <button
                  onClick={handleResetStarter}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700/60 transition-colors"
                >
                  Load Starter Pack
                </button>
              </div>
            </div>
          ) : (
            <ResponsiveGridLayout
              className="layout"
              width={width}
              layouts={layouts}
              breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
              cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
              rowHeight={80}
              onLayoutChange={handleLayoutChange}
              draggableHandle=".drag-handle"
              isDraggable={true}
              isResizable={true}
              margin={[16, 16]}
            >
              {widgets.map((widget) => (
                <div key={widget.id} className="relative">
                  <ErrorBoundary
                    title={widget.title || 'Widget Error'}
                    onReset={() => handleUpdateWidget(widget.id, { chartType: 'bar' })}
                  >
                    <ChartWidget
                      widget={widget}
                      issues={crossFilteredIssues}
                      isSelected={selectedWidgetId === widget.id}
                      onSelect={(id) => {
                        setSelectedWidgetId(id);
                        setSidebarOpen(true);
                      }}
                      onDuplicate={handleDuplicateWidget}
                      onDelete={handleDeleteWidget}
                      onMaximize={(id) => setExpandedWidgetId(expandedWidgetId === id ? null : id)}
                      isMaximized={expandedWidgetId === widget.id}
                    />
                  </ErrorBoundary>
                </div>
              ))}
            </ResponsiveGridLayout>
          )}

          {/* Canvas bottom padding */}
          <div className="h-6 shrink-0" />
        </div>
      </div>

      {/* ── EXPANDED / FULLSCREEN FOCUS VIEW OVERLAY ── */}
      {expandedWidget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={expandedWidget.title || 'Expanded Chart View'}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setExpandedWidgetId(null)}
        >
          <div
            className="w-full max-w-6xl h-[88vh] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <ChartWidget
              widget={expandedWidget}
              issues={crossFilteredIssues}
              isSelected={false}
              onSelect={() => {}}
              onDuplicate={handleDuplicateWidget}
              onDelete={() => {
                handleDeleteWidget(expandedWidget.id);
                setExpandedWidgetId(null);
              }}
              onMaximize={() => setExpandedWidgetId(null)}
              isMaximized={true}
            />
          </div>
        </div>
      )}

      {/* ── RIGHT SLIDE-OUT / FIXED SIDEBAR: WIDGET PROPERTIES ── */}
      {sidebarOpen && (
        <WidgetPropertiesSidebar
          selectedWidget={selectedWidget}
          onUpdateWidget={handleUpdateWidget}
          onDuplicateWidget={handleDuplicateWidget}
          onDeleteWidget={handleDeleteWidget}
          onClose={() => setSidebarOpen(false)}
          projects={projects}
          selectedProject={selectedProject}
        />
      )}

      {/* ── SLIDE-UP BOTTOM DRAWER / MODAL: ISSUE INSPECTOR ── */}
      {inspectorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Issue Drill-Down Inspector"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end p-2 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setInspectorOpen(false)}
        >
          <div
            className="w-full max-w-7xl max-h-[85vh] mx-auto bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 ring-1 ring-cyan-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            <DrillDownInspectorTable
              issues={allIssues}
              onUpdateIssue={onUpdateIssue}
              projectKey={selectedProject?.key}
              assigneesList={assigneesList}
              statusesList={statusesList}
              onClose={() => setInspectorOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
