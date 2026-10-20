import React from 'react';
import {
  X,
  Sliders,
  Database,
  BarChart2,
  TrendingUp,
  PieChart as PieIcon,
  CircleDot,
  Hash,
  Palette,
  Check,
  Trash2,
  Copy,
  Sparkles,
} from 'lucide-react';

const CHART_TYPES = [
  { id: 'bar', label: 'Bar', icon: BarChart2, desc: 'Categorical distribution' },
  { id: 'line', label: 'Line', icon: TrendingUp, desc: 'Trend & trajectory' },
  { id: 'pie', label: 'Pie', icon: PieIcon, desc: 'Proportional share' },
  { id: 'donut', label: 'Donut', icon: CircleDot, desc: 'Ratio with center focus' },
  { id: 'number', label: 'Metric', icon: Hash, desc: 'Single KPI summary' },
];

const GROUP_BY_OPTIONS = [
  { id: 'type', label: 'Issue Type (Story, Bug, Task...)' },
  { id: 'status', label: 'Status Category (To Do, In Progress, Done)' },
  { id: 'assignee', label: 'Assignee (Team Member)' },
  { id: 'priority', label: 'Priority (High, Medium, Low...)' },
];

const MEASURE_OPTIONS = [
  { id: 'count', label: 'Issue Count (Volume of items)' },
  { id: 'storyPoints', label: 'Sum of Story Points (SP)' },
  { id: 'loggedHours', label: 'Total Logged Hours' },
  { id: 'estimatedHours', label: 'Total Estimated Hours' },
];

const THEME_OPTIONS = [
  { id: 'cyber', label: 'Cyber Indigo', color: '#6366f1' },
  { id: 'emerald', label: 'Emerald Glow', color: '#10b981' },
  { id: 'sunset', label: 'Sunset Coral', color: '#f43f5e' },
  { id: 'neon', label: 'Neon Pulse', color: '#00f5d4' },
];

export default function WidgetPropertiesSidebar({
  selectedWidget,
  onUpdateWidget,
  onDuplicateWidget,
  onDeleteWidget,
  onClose,
  projects = [],
  selectedProject,
}) {
  if (!selectedWidget) {
    return (
      <aside className="w-80 md:w-96 bg-slate-900/95 border-l border-slate-800 p-6 flex flex-col items-center justify-center text-center text-slate-500 select-none">
        <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-3">
          <Sliders className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-300">Widget Properties</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
          Click any widget on the canvas to inspect and configure its live BI dimensions.
        </p>
      </aside>
    );
  }

  const handleChange = (field, value) => {
    onUpdateWidget(selectedWidget.id, { [field]: value });
  };

  return (
    <aside className="w-80 md:w-96 bg-slate-900/95 backdrop-blur-md border-l border-slate-800 flex flex-col h-full shadow-2xl z-30 transition-all overflow-y-auto">
      {/* ── SIDEBAR HEADER ── */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/90 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Widget Properties</h3>
            <p className="text-[11px] text-cyan-400 font-mono">Live Preview Engine</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Close Sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-6 flex-1 text-xs">
        {/* ── 1. TITLE & SUBTITLE ── */}
        <div className="space-y-1.5">
          <label className="font-semibold text-slate-300 tracking-wider text-[11px] uppercase">
            Widget Title
          </label>
          <input
            type="text"
            value={selectedWidget.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="e.g. Delivered Velocity by Squad"
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none font-medium transition-colors"
          />
        </div>

        {/* ── 2. DATA SOURCE ── */}
        <div className="space-y-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-300 font-bold tracking-wider text-[11px] uppercase">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>Data Source</span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Target Project</label>
            <select
              value={selectedWidget.projectKey || selectedProject?.key || ''}
              onChange={(e) => handleChange('projectKey', e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
            >
              <option value="">Current Active Project ({selectedProject?.key || 'Active'})</option>
              {projects.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 pt-1">
            <label className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Filter with Custom JQL (Optional)</span>
              <span className="text-[10px] text-cyan-400 font-mono">Live query</span>
            </label>
            <input
              type="text"
              value={selectedWidget.jql || ''}
              onChange={(e) => handleChange('jql', e.target.value)}
              placeholder="e.g. issuetype = Bug AND status != Done"
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-[11px] focus:outline-none"
            />
          </div>
        </div>

        {/* ── 3. VISUALIZATION / CHART TYPE ── */}
        <div className="space-y-2">
          <label className="font-semibold text-slate-300 tracking-wider text-[11px] uppercase">
            Chart Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CHART_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedWidget.chartType === type.id;

              return (
                <button
                  key={type.id}
                  onClick={() => handleChange('chartType', type.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                    isSelected
                      ? 'bg-blue-600/20 border-cyan-500 text-white shadow-md shadow-cyan-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs truncate leading-tight">{type.label}</p>
                    <p className="text-[9px] text-slate-500 truncate leading-tight mt-0.5">{type.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 4. DIMENSIONS & MEASURES (X & Y AXIS) ── */}
        {selectedWidget.chartType !== 'number' && (
          <div className="space-y-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
                X-Axis / Group By (Dimension)
              </label>
              <select
                value={selectedWidget.groupBy || 'type'}
                onChange={(e) => handleChange('groupBy', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
              >
                {GROUP_BY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
                Y-Axis / Measure (Aggregation)
              </label>
              <select
                value={selectedWidget.measure || 'count'}
                onChange={(e) => handleChange('measure', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
              >
                {MEASURE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── 5. PALETTE & PRESENTATION ── */}
        <div className="space-y-3">
          <label className="font-semibold text-slate-300 tracking-wider text-[11px] uppercase flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-indigo-400" />
            <span>Theme & Accent</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {THEME_OPTIONS.map((t) => {
              const isSelected = (selectedWidget.theme || 'cyber') === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleChange('theme', t.id)}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-cyan-500 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="truncate">{t.label}</span>
                  {isSelected && <Check className="w-3 h-3 text-cyan-400 ml-auto" />}
                </button>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
            <span className="text-slate-300 font-medium">Show Data Labels</span>
            <input
              type="checkbox"
              checked={selectedWidget.showLabels ?? true}
              onChange={(e) => handleChange('showLabels', e.target.checked)}
              className="accent-cyan-500 w-4 h-4 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">Show Legend</span>
            <input
              type="checkbox"
              checked={selectedWidget.showLegend ?? true}
              onChange={(e) => handleChange('showLegend', e.target.checked)}
              className="accent-cyan-500 w-4 h-4 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* ── SIDEBAR BOTTOM ACTIONS ── */}
      <div className="p-4 border-t border-slate-800/90 bg-slate-950/60 flex items-center gap-2 sticky bottom-0">
        <button
          onClick={() => onDuplicateWidget(selectedWidget.id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
        >
          <Copy className="w-3.5 h-3.5 text-indigo-400" />
          Duplicate
        </button>

        <button
          onClick={() => onDeleteWidget(selectedWidget.id)}
          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
          title="Delete Widget"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
