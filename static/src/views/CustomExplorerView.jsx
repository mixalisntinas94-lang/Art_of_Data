import React, { useState, useMemo, useCallback } from 'react';
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
  Layers,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import ChartWidget from '../components/explorer/ChartWidget';
import WidgetPropertiesSidebar from '../components/explorer/WidgetPropertiesSidebar';

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
    title: 'Total Active Scope (SP)',
    chartType: 'number',
    groupBy: 'status',
    measure: 'storyPoints',
    theme: 'neon',
    showLabels: false,
    showLegend: false,
  },
];

const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'widget-1', x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
    { i: 'widget-2', x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
    { i: 'widget-3', x: 0, y: 4, w: 8, h: 4, minW: 3, minH: 3 },
    { i: 'widget-4', x: 8, y: 4, w: 4, h: 4, minW: 3, minH: 2 },
  ],
};

export default function CustomExplorerView({
  allIssues = [],
  projects = [],
  selectedProject,
}) {
  const { width, containerRef } = useContainerWidth({ initialWidth: 1200 });
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
  const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS);
  const [selectedWidgetId, setSelectedWidgetId] = useState('widget-1');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Layout change callback
  const handleLayoutChange = useCallback((currentLayout, allLayouts) => {
    setLayouts(allLayouts);
  }, []);

  // Selected widget object
  const selectedWidget = useMemo(
    () => widgets.find((w) => w.id === selectedWidgetId),
    [widgets, selectedWidgetId]
  );

  // Add new widget
  const handleAddWidget = (presetType = 'bar') => {
    const newId = `widget-${Date.now()}`;
    const newWidget = {
      id: newId,
      title: `Custom Report #${widgets.length + 1}`,
      chartType: presetType,
      groupBy: 'type',
      measure: 'count',
      theme: 'cyber',
      showLabels: true,
      showLegend: true,
    };

    setWidgets((prev) => [...prev, newWidget]);

    // Position new widget in next available spot
    const newLayoutItem = {
      i: newId,
      x: (widgets.length * 4) % 12,
      y: Infinity, // place at the bottom
      w: 6,
      h: 4,
      minW: 3,
      minH: 3,
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
          </div>
        </div>

        {/* ── CANVAS WORKSPACE WITH DOT GRID BACKGROUND ── */}
        <div
          ref={containerRef}
          className="flex-1 p-4 overflow-y-auto bg-[#070b14] bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:18px_18px] relative min-h-[500px]"
        >
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
                  <ChartWidget
                    widget={widget}
                    issues={allIssues}
                    isSelected={selectedWidgetId === widget.id}
                    onSelect={(id) => {
                      setSelectedWidgetId(id);
                      setSidebarOpen(true);
                    }}
                    onDuplicate={handleDuplicateWidget}
                    onDelete={handleDeleteWidget}
                  />
                </div>
              ))}
            </ResponsiveGridLayout>
          )}
        </div>
      </div>

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
    </div>
  );
}
