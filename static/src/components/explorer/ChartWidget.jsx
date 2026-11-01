import React, { useRef, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import ErrorBoundary from '../ErrorBoundary';
import PivotTableWidget from './PivotTableWidget';
import { useFilterStore } from '../../store/useFilterStore';
import {
  getSemanticColor,
  getSemanticIcon,
  buildEchartsCategoryRich,
} from '../../utils/colorDictionary';
import {
  MoreVertical,
  Edit2,
  Copy,
  Download,
  FileSpreadsheet,
  Trash2,
  GripHorizontal,
  BarChart2,
  TrendingUp,
  PieChart as PieIcon,
  CircleDot,
  Hash,
  Maximize2,
  Minimize2,
  Filter,
} from 'lucide-react';

/**
 * Escapes untrusted strings for safe interpolation into ECharts HTML tooltips (prevents DOM XSS).
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes a cell value for CSV export to prevent Spreadsheet Formula Injection (=, +, -, @, \t, \r)
 * and properly escapes embedded double quotes.
 */
function sanitizeCsvCell(value) {
  const raw = String(value ?? '');
  const defused = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${defused.replace(/"/g, '""')}"`;
}

/**
 * Safe dimension value extractor
 */
export function getIssueDimValue(issue, dim) {
  if (dim === 'assignee') {
    return issue.assignee || 'Unassigned';
  } else if (dim === 'status') {
    return (
      issue.status ||
      (issue.statusCategory === 'done'
        ? 'Done'
        : issue.statusCategory === 'indeterminate'
        ? 'In Progress'
        : 'To Do')
    );
  } else if (dim === 'type') {
    return issue.type || 'Task';
  } else if (dim === 'priority') {
    return issue.priority || 'Medium';
  }
  return issue[dim] || 'Unassigned';
}

/**
 * Safe measure value extractor
 */
export function getIssueMeasureValue(issue, measure) {
  if (measure === 'count') return 1;
  if (measure === 'storyPoints') return Number(issue.storyPoints) || 0;
  if (measure === 'loggedHours') return Number(issue.loggedHours) || 0;
  if (measure === 'estimatedHours') return Number(issue.estimatedHours) || 0;
  return 0;
}

/**
 * Aggregates Jira issues by groupBy dimension and calculates measure
 */
export function aggregateData(issues = [], groupBy = 'type', measure = 'count') {
  const map = new Map();

  issues.forEach((issue) => {
    const key = getIssueDimValue(issue, groupBy);
    const val = getIssueMeasureValue(issue, measure);
    map.set(key, (map.get(key) || 0) + val);
  });

  const categories = Array.from(map.keys());
  const values = Array.from(map.values()).map((v) => Math.round(v * 10) / 10);
  const total = values.reduce((sum, v) => sum + v, 0);

  return { categories, values, total, map };
}

/**
 * Color Themes for ECharts
 */
const COLOR_PALETTES = {
  cyber: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'],
  emerald: ['#10b981', '#059669', '#34d399', '#06b6d4', '#3b82f6', '#6366f1'],
  sunset: ['#f43f5e', '#fb923c', '#f59e0b', '#e11d48', '#8b5cf6', '#3b82f6'],
  neon: ['#00f5d4', '#7b2cbf', '#f72585', '#4cc9f0', '#7209b7', '#3f37c9'],
};

export default function ChartWidget({
  widget,
  issues,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
  onMaximize,
  isMaximized = false,
}) {
  const chartRef = useRef(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = useRef(null);

  // Global cross-filtering state from Zustand
  const {
    selectedType,
    selectedStatus,
    selectedAssignee,
    selectedPriority,
    setCrossFilter,
  } = useFilterStore();

  // Close hover / click menu on click outside or Escape key (only bound while menuOpen is true)
  React.useEffect(() => {
    if (!menuOpen) return undefined;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const {
    title = 'Custom Chart',
    chartType = 'bar',
    groupBy = 'type',
    measure = 'count',
    theme = 'cyber',
    showLabels = true,
    showLegend = true,
  } = widget;

  // Active cross-filter value on this widget's dimension
  const activeCrossFilter =
    groupBy === 'type'
      ? selectedType
      : groupBy === 'status'
      ? selectedStatus
      : groupBy === 'assignee'
      ? selectedAssignee
      : groupBy === 'priority'
      ? selectedPriority
      : null;

  // Filter issues if widget has custom JQL or project
  const relevantIssues = useMemo(() => {
    if (!widget.jql || !widget.jql.trim()) return issues;
    const lowerJql = widget.jql.toLowerCase();
    return issues.filter((i) => {
      if (lowerJql.includes('bug') && !((i.type || '').toLowerCase().includes('bug'))) return false;
      if (lowerJql.includes('done') && i.statusCategory !== 'done') return false;
      return true;
    });
  }, [issues, widget.jql]);

  // Aggregate data for ECharts
  const { categories, values, total } = useMemo(
    () => aggregateData(relevantIssues, groupBy, measure),
    [relevantIssues, groupBy, measure]
  );

  // Map assignees to Jira avatar URLs
  const assigneeAvatarMap = useMemo(() => {
    const map = {};
    relevantIssues.forEach((i) => {
      if (i.assignee && i.avatarUrl) {
        map[i.assignee] = i.avatarUrl;
      }
    });
    return map;
  }, [relevantIssues]);

  // Build Rich Text formatting with authentic Atlassian SVG icons
  const { rich, formatter } = useMemo(
    () => buildEchartsCategoryRich(categories, groupBy, assigneeAvatarMap),
    [categories, groupBy, assigneeAvatarMap]
  );

  // Measure label
  const measureLabel =
    measure === 'storyPoints'
      ? 'Story Points'
      : measure === 'loggedHours'
      ? 'Logged Hours'
      : measure === 'estimatedHours'
      ? 'Estimated Hours'
      : 'Issue Count';

  // Handle cross-filter click on any chart element
  const handleChartClick = (params) => {
    if (!params || !params.name) return;
    setCrossFilter(groupBy, params.name);
  };

  // Build Apache ECharts Option with Semantic Colors & Authentic Icons
  const echartsOption = useMemo(() => {
    if (chartType === 'number' || chartType === 'table') {
      return null;
    }

    if (chartType === 'pie' || chartType === 'donut') {
      const pieData = categories.map((cat, idx) => {
        const sem = getSemanticColor(groupBy, cat);
        const isDimmed = activeCrossFilter && activeCrossFilter !== cat;
        const isSelected = activeCrossFilter === cat;

        return {
          name: cat,
          value: values[idx],
          itemStyle: {
            color: sem.color,
            opacity: isDimmed ? 0.25 : 1,
            borderColor: isSelected ? '#ffffff' : '#0b0f19',
            borderWidth: isSelected ? 3 : 2,
            shadowColor: isSelected ? sem.color : 'transparent',
            shadowBlur: isSelected ? 12 : 0,
          },
        };
      });

      return {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          confine: true,
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          textStyle: { color: '#f8fafc', fontSize: 12 },
          formatter: (p) => {
            if (!p) return '';
            const safeName = escapeHtml(p.name);
            const safeVal = escapeHtml(p.value);
            const safePct = escapeHtml(p.percent ?? 0);
            return `${safeName}: <strong style="color:#38bdf8">${safeVal}</strong> (${safePct}%)<br/><span style="font-size:10px;color:#94a3b8">Click slice to cross-filter</span>`;
          },
        },
        legend: showLegend
          ? {
              orient: 'horizontal',
              bottom: '0%',
              left: 'center',
              formatter,
              textStyle: {
                color: '#94a3b8',
                fontSize: 11,
                rich,
              },
              itemWidth: 10,
              itemHeight: 10,
            }
          : undefined,
        series: [
          {
            type: 'pie',
            radius: chartType === 'donut' ? ['42%', '68%'] : '65%',
            center: ['50%', showLegend ? '45%' : '50%'],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 6,
              borderColor: '#0b0f19',
              borderWidth: 2,
            },
            label: {
              show: showLabels,
              color: '#cbd5e1',
              fontSize: 11,
              formatter: '{b}: {c}',
            },
            labelLine: {
              lineStyle: { color: '#475569' },
              smooth: 0.2,
              length: 10,
              length2: 12,
            },
            data: pieData,
            animationType: 'scale',
            animationEasing: 'elasticOut',
            animationDuration: 800,
          },
        ],
      };
    }

    const hasManyCategories = categories.length > 5;
    const dataZoomConfig = [
      {
        type: 'inside',
        xAxisIndex: 0,
        filterMode: 'filter',
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
      },
      ...(hasManyCategories
        ? [
            {
              type: 'slider',
              xAxisIndex: 0,
              height: 14,
              bottom: '2%',
              borderColor: 'transparent',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              fillerColor: 'rgba(56, 189, 248, 0.25)',
              handleStyle: { color: '#38bdf8', borderColor: '#0284c7' },
              moveHandleStyle: { color: '#38bdf8' },
              showDataShadow: false,
              showDetail: false,
            },
          ]
        : []),
    ];

    if (chartType === 'line') {
      const lineSeriesData = categories.map((cat, i) => {
        const sem = getSemanticColor(groupBy, cat);
        const isDimmed = activeCrossFilter && activeCrossFilter !== cat;
        const isSelected = activeCrossFilter === cat;

        return {
          value: values[i],
          symbolSize: isSelected ? 12 : 8,
          itemStyle: {
            color: sem.color,
            borderColor: isSelected ? '#ffffff' : sem.color,
            borderWidth: isSelected ? 2.5 : 1,
            opacity: isDimmed ? 0.25 : 1,
          },
        };
      });

      const primaryColor = getSemanticColor(groupBy, categories[0] || 'default').color || '#3b82f6';

      return {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          confine: true,
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          textStyle: { color: '#f8fafc', fontSize: 12 },
          axisPointer: { type: 'cross', label: { backgroundColor: '#1e293b' } },
        },
        dataZoom: dataZoomConfig,
        grid: {
          top: '14%',
          left: '3%',
          right: '4%',
          bottom: hasManyCategories ? '20%' : '12%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: categories,
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: {
            color: '#cbd5e1',
            fontSize: 11,
            rotate: categories.length > 5 ? 20 : 0,
            formatter,
            rich,
          },
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
          axisLabel: { color: '#94a3b8', fontSize: 11 },
        },
        series: [
          {
            data: lineSeriesData,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            lineStyle: { width: 3, color: primaryColor },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: `${primaryColor}40` },
                { offset: 1, color: `${primaryColor}00` },
              ]),
            },
            label: {
              show: showLabels,
              position: 'top',
              color: '#cbd5e1',
              fontSize: 11,
              fontWeight: 600,
            },
            animationDuration: 750,
          },
        ],
      };
    }

    // Default: Bar Chart with Semantic Colors & Dimming on Non-Active Slices
    const barData = categories.map((cat, i) => {
      const sem = getSemanticColor(groupBy, cat);
      const isDimmed = activeCrossFilter && activeCrossFilter !== cat;
      const isSelected = activeCrossFilter === cat;

      return {
        value: values[i],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: sem.color },
            { offset: 1, color: sem.gradient ? sem.gradient[1] : sem.color },
          ]),
          opacity: isDimmed ? 0.25 : 1,
          borderRadius: [6, 6, 0, 0],
          borderColor: isSelected ? '#ffffff' : sem.border || 'transparent',
          borderWidth: isSelected ? 2 : 0,
          shadowColor: isSelected ? sem.color : 'transparent',
          shadowBlur: isSelected ? 12 : 0,
        },
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params) => {
          if (!params || !params[0]) return '';
          const p = params[0];
          const safeName = escapeHtml(p.name);
          const safeMeasure = escapeHtml(measureLabel);
          const safeVal = escapeHtml(p.value);
          return `<strong>${safeName}</strong><br/>${safeMeasure}: <span style="color:#38bdf8;font-weight:bold">${safeVal}</span><br/><span style="font-size:10px;color:#94a3b8">Click bar to cross-filter</span>`;
        },
      },
      dataZoom: dataZoomConfig,
      grid: {
        top: '14%',
        left: '3%',
        right: '4%',
        bottom: hasManyCategories ? '20%' : '12%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: {
          color: '#cbd5e1',
          fontSize: 11,
          rotate: categories.length > 5 ? 20 : 0,
          formatter,
          rich,
        },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      series: [
        {
          data: barData,
          type: 'bar',
          barMaxWidth: 38,
          label: {
            show: showLabels,
            position: 'top',
            color: '#cbd5e1',
            fontSize: 11,
            fontWeight: 600,
          },
          animationDuration: 750,
        },
      ],
    };
  }, [categories, values, chartType, groupBy, showLabels, showLegend, activeCrossFilter, rich, formatter, measureLabel]);

  // PNG Export Handler
  const handleExportPng = () => {
    if (!chartRef.current) return;
    const echartsInstance = chartRef.current.getEchartsInstance();
    if (!echartsInstance) return;

    const dataUrl = echartsInstance.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#0b0f19',
    });

    const link = document.createElement('a');
    link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_export.png`;
    link.href = dataUrl;
    link.click();
    setMenuOpen(false);
  };

  // CSV Export Handler
  const handleExportCsv = () => {
    if (chartType === 'table') {
      const rowDim = widget.groupBy || 'assignee';
      const colDim = widget.pivotBy || 'status';
      const colSet = new Set();
      const rowSet = new Set();
      const matrix = {};

      relevantIssues.forEach((issue) => {
        const r = getIssueDimValue(issue, rowDim);
        const c = getIssueDimValue(issue, colDim);
        const v = getIssueMeasureValue(issue, measure);
        rowSet.add(r);
        colSet.add(c);
        if (!matrix[r]) matrix[r] = {};
        matrix[r][c] = (matrix[r][c] || 0) + v;
      });

      const cols = Array.from(colSet);
      const rows = Array.from(rowSet);

      let csv =
        `${sanitizeCsvCell(`${rowDim} / ${colDim}`)},` +
        cols.map((c) => sanitizeCsvCell(c)).join(',') +
        ',"Total"\n';
      rows.forEach((r) => {
        let rTotal = 0;
        const rowVals = cols.map((c) => {
          const v = matrix[r]?.[c] || 0;
          rTotal += v;
          return v;
        });
        csv += `${sanitizeCsvCell(r)},` + rowVals.join(',') + `,${Math.round(rTotal * 10) / 10}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_pivot_export.csv`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      setMenuOpen(false);
      return;
    }

    const csvHeader = `${sanitizeCsvCell(groupBy)},${sanitizeCsvCell(measure)}\n`;
    const csvRows = categories
      .map((cat, i) => `${sanitizeCsvCell(cat)},${values[i]}`)
      .join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_export.csv`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  return (
    <div
      onClick={() => onSelect(widget.id)}
      className={`relative w-full h-full min-h-[190px] min-w-[240px] rounded-2xl bg-slate-900/90 border transition-all flex flex-col overflow-hidden group shadow-lg ${
        isSelected
          ? 'border-cyan-500 shadow-cyan-500/20 ring-1 ring-cyan-500'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* ── CARD HEADER & DRAG HANDLE ── */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800/80 bg-slate-950/60 select-none">
        <div className="flex items-center gap-2 drag-handle cursor-move flex-1 min-w-0 pr-2">
          <GripHorizontal className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0" />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-slate-200 tracking-wide truncate group-hover:text-white transition-colors">
              {title}
            </h4>
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[10px] text-slate-400 truncate">
                {groupBy.toUpperCase()} · {measureLabel}
              </p>
              {activeCrossFilter && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-[9px] font-bold text-cyan-300">
                  <Filter className="w-2.5 h-2.5" />
                  <span>Filtered: {activeCrossFilter}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCrossFilter(groupBy, activeCrossFilter);
                    }}
                    className="hover:text-rose-400 font-bold ml-0.5"
                    title="Clear filter"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── TOP-RIGHT ACTIONS (MAXIMIZE & MENU) ── */}
        <div className="flex items-center gap-1 shrink-0" ref={menuRef}>
          {onMaximize && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMaximize(widget.id);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isMaximized ? "Restore view" : "Maximize view"}
            >
              {isMaximized ? (
                <Minimize2 className="w-4 h-4 text-cyan-400" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Widget Actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-7 w-44 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-50 text-xs font-medium space-y-0.5 animate-in fade-in zoom-in-95 duration-150"
            >
              <button
                onClick={() => {
                  onSelect(widget.id);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                Edit Properties
              </button>

              <button
                onClick={() => {
                  onDuplicate(widget.id);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-indigo-400" />
                Duplicate
              </button>

              <div className="h-px bg-slate-800 my-1" />

              <button
                onClick={handleExportPng}
                disabled={chartType === 'number' || chartType === 'table'}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Export as PNG
              </button>

              <button
                onClick={handleExportCsv}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                Export as CSV
              </button>

              <div className="h-px bg-slate-800 my-1" />

              <button
                onClick={() => {
                  onDelete(widget.id);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Widget
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── CARD CONTENT BODY (FULL-BLEED & SCROLLABLE) ── */}
      <div
        className={`flex-1 min-h-0 w-full h-full relative ${
          chartType === 'table'
            ? 'overflow-auto custom-scrollbar p-0'
            : chartType === 'number'
            ? 'p-3 flex items-center justify-center overflow-auto custom-scrollbar'
            : 'p-2 flex flex-col overflow-auto custom-scrollbar'
        }`}
      >
        {chartType === 'table' ? (
          <PivotTableWidget
            issues={relevantIssues}
            rowDim={widget.groupBy || 'assignee'}
            colDim={widget.pivotBy || 'status'}
            measure={widget.measure || 'storyPoints'}
            showTotals={widget.showTotals ?? true}
            heatmap={widget.heatmap ?? true}
            theme={widget.theme || 'cyber'}
            initialViewMode={widget.pivotMode || 'matrix'}
          />
        ) : chartType === 'number' ? (
          <div className="text-center space-y-1 my-auto">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {measureLabel} Total
            </span>
            <div className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-400 tracking-tight">
              {Math.round(total * 10) / 10}
            </div>
            <p className="text-xs text-slate-400 font-medium">
              across {categories.length} {groupBy} groups ({relevantIssues.length} issues)
            </p>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center m-auto p-4 text-slate-500 text-xs">
            No matching issues for this criteria.
          </div>
        ) : (
          <ErrorBoundary
            title="Chart Display Error"
            fallback={
              <div className="text-center m-auto p-4 text-rose-400 text-xs">
                Could not render {chartType} chart. Try selecting a different visual type.
              </div>
            }
          >
            <div className="w-full h-full min-h-[170px] min-w-[220px]">
              <ReactECharts
                key={`${widget.id}-${chartType}`}
                ref={chartRef}
                option={echartsOption}
                style={{ width: '100%', height: '100%' }}
                opts={{ renderer: 'canvas' }}
                notMerge={true}
                lazyUpdate={true}
                onEvents={{
                  click: handleChartClick,
                }}
              />
            </div>
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
