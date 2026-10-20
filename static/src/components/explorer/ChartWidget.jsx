import React, { useRef, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
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
} from 'lucide-react';

/**
 * Aggregates Jira issues by groupBy dimension and calculates measure
 */
export function aggregateData(issues = [], groupBy = 'type', measure = 'count') {
  const map = new Map();

  issues.forEach((issue) => {
    let key = 'Unassigned';
    if (groupBy === 'assignee') {
      key = issue.assignee || 'Unassigned';
    } else if (groupBy === 'status') {
      key =
        issue.status ||
        (issue.statusCategory === 'done'
          ? 'Done'
          : issue.statusCategory === 'indeterminate'
          ? 'In Progress'
          : 'To Do');
    } else if (groupBy === 'type') {
      key = issue.type || 'Task';
    } else if (groupBy === 'priority') {
      key = issue.priority || 'Medium';
    }

    let val = 0;
    if (measure === 'count') {
      val = 1;
    } else if (measure === 'storyPoints') {
      val = Number(issue.storyPoints) || 0;
    } else if (measure === 'loggedHours') {
      val = Number(issue.loggedHours) || 0;
    } else if (measure === 'estimatedHours') {
      val = Number(issue.estimatedHours) || 0;
    }

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
}) {
  const chartRef = useRef(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = useRef(null);

  // Close hover / click menu on click outside
  React.useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const {
    title = 'Custom Chart',
    chartType = 'bar',
    groupBy = 'type',
    measure = 'count',
    theme = 'cyber',
    showLabels = true,
    showLegend = true,
  } = widget;

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

  // Measure label
  const measureLabel =
    measure === 'storyPoints'
      ? 'Story Points'
      : measure === 'loggedHours'
      ? 'Logged Hours'
      : measure === 'estimatedHours'
      ? 'Estimated Hours'
      : 'Issue Count';

  // Build Apache ECharts Option
  const echartsOption = useMemo(() => {
    const palette = COLOR_PALETTES[theme] || COLOR_PALETTES.cyber;

    if (chartType === 'number') {
      return null;
    }

    if (chartType === 'pie' || chartType === 'donut') {
      const pieData = categories.map((cat, idx) => ({
        name: cat,
        value: values[idx],
        itemStyle: {
          color: palette[idx % palette.length],
        },
      }));

      return {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          textStyle: { color: '#f8fafc', fontSize: 12 },
          formatter: `{b}: <strong style="color:#38bdf8">{c}</strong> ({d}%)`,
        },
        legend: showLegend
          ? {
              orient: 'horizontal',
              bottom: '0%',
              left: 'center',
              textStyle: { color: '#94a3b8', fontSize: 11 },
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

    if (chartType === 'line') {
      return {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          textStyle: { color: '#f8fafc', fontSize: 12 },
          axisPointer: { type: 'cross', label: { backgroundColor: '#1e293b' } },
        },
        grid: {
          top: '15%',
          left: '3%',
          right: '4%',
          bottom: '10%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: categories,
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#94a3b8', fontSize: 11, rotate: categories.length > 5 ? 25 : 0 },
        },
        YAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
          axisLabel: { color: '#94a3b8', fontSize: 11 },
        },
        series: [
          {
            data: values,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: { color: palette[0] },
            lineStyle: { width: 3, color: palette[0] },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(59, 130, 246, 0.45)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.0)' },
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

    // Default: Bar Chart
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
      },
      grid: {
        top: '15%',
        left: '3%',
        right: '4%',
        bottom: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#94a3b8', fontSize: 11, rotate: categories.length > 5 ? 25 : 0 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      series: [
        {
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: palette[i % palette.length] },
                { offset: 1, color: '#1e1b4b' },
              ]),
              borderRadius: [6, 6, 0, 0],
            },
          })),
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
  }, [categories, values, chartType, theme, showLabels, showLegend]);

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
    const csvHeader = `${groupBy},${measure}\n`;
    const csvRows = categories
      .map((cat, i) => `"${cat}",${values[i]}`)
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
      className={`relative w-full h-full rounded-2xl bg-slate-900/90 border transition-all flex flex-col overflow-hidden group shadow-lg ${
        isSelected
          ? 'border-cyan-500 shadow-cyan-500/20 ring-1 ring-cyan-500'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* ── CARD HEADER & DRAG HANDLE ── */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800/80 bg-slate-950/60 select-none">
        <div className="flex items-center gap-2 drag-handle cursor-move flex-1 min-w-0 pr-2">
          <GripHorizontal className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0" />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-slate-200 tracking-wide truncate group-hover:text-white transition-colors">
              {title}
            </h4>
            <p className="text-[10px] text-slate-400 truncate">
              {groupBy.toUpperCase()} · {measureLabel}
            </p>
          </div>
        </div>

        {/* ── TOP-RIGHT ACTIONS DROPDOWN ── */}
        <div className="relative shrink-0" ref={menuRef}>
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
                disabled={chartType === 'number'}
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

      {/* ── CARD CONTENT BODY ── */}
      <div className="flex-1 p-3 flex items-center justify-center min-h-0 relative">
        {chartType === 'number' ? (
          <div className="text-center space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {measureLabel} Total
            </span>
            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-400 tracking-tight">
              {Math.round(total * 10) / 10}
            </div>
            <p className="text-xs text-slate-400 font-medium">
              across {categories.length} {groupBy} groups ({relevantIssues.length} issues)
            </p>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center p-4 text-slate-500 text-xs">
            No matching issues for this criteria.
          </div>
        ) : (
          <ReactECharts
            ref={chartRef}
            option={echartsOption}
            style={{ width: '100%', height: '100%' }}
            opts={{ renderer: 'canvas' }}
            notMerge={true}
            lazyUpdate={true}
          />
        )}
      </div>
    </div>
  );
}
