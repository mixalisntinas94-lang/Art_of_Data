import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronRight,
  ChevronDown,
  Table,
  ListTree,
  X,
  ExternalLink,
  Layers,
  Sparkles,
  Filter,
} from 'lucide-react';
import { getIssueDimValue, getIssueMeasureValue } from './ChartWidget';
import {
  getSemanticColor,
  getSemanticIcon,
  getInitialsAvatar,
  JIRA_ICONS,
} from '../../utils/colorDictionary';
import { useFilterStore } from '../../store/useFilterStore';

/**
 * Dimension Labels mapping
 */
const DIM_LABELS = {
  assignee: 'Assignee',
  status: 'Status',
  type: 'Issue Type',
  priority: 'Priority',
};

export default function PivotTableWidget({
  issues = [],
  rowDim = 'assignee',
  colDim = 'status',
  measure = 'storyPoints',
  showTotals = true,
  heatmap = true,
  theme = 'cyber',
  initialViewMode = 'matrix',
}) {
  const [viewMode, setViewMode] = useState(initialViewMode); // 'matrix' | 'tree'
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('total'); // 'row' | 'total' | colKey
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [expandedSubKeys, setExpandedSubKeys] = useState(new Set());
  const [selectedDrillDown, setSelectedDrillDown] = useState(null); // { row, col }

  // Global cross-filtering integration
  const {
    setCrossFilter,
    selectedType,
    selectedStatus,
    selectedAssignee,
    selectedPriority,
  } = useFilterStore();

  // Map assignees to Jira avatar URLs
  const assigneeAvatarMap = useMemo(() => {
    const map = {};
    issues.forEach((i) => {
      if (i.assignee && i.avatarUrl) {
        map[i.assignee] = i.avatarUrl;
      }
    });
    return map;
  }, [issues]);

  // Check if a given row/col dimension value is currently active in cross-filter
  const isValueFiltered = (dim, val) => {
    if (dim === 'type') return selectedType === val;
    if (dim === 'status') return selectedStatus === val;
    if (dim === 'assignee') return selectedAssignee === val;
    if (dim === 'priority') return selectedPriority === val;
    return false;
  };

  // Measure display unit
  const measureUnit =
    measure === 'storyPoints'
      ? 'SP'
      : measure === 'loggedHours'
      ? 'hrs'
      : measure === 'estimatedHours'
      ? 'est'
      : 'issues';

  // Group issues by Row Dimension and by (Row, Col) cell
  const {
    rowKeys,
    colKeys,
    matrix,
    rowTotals,
    colTotals,
    grandTotal,
    maxVal,
    issuesByRow,
    issuesByCell,
  } = useMemo(() => {
    const rawMatrix = {};
    const colSet = new Set();
    const rowSet = new Set();
    const rTotals = {};
    const cTotals = {};
    const byRow = new Map();
    const byCell = new Map();
    let gTotal = 0;
    let maxCell = 0;

    issues.forEach((issue) => {
      const rKey = getIssueDimValue(issue, rowDim);
      const cKey = getIssueDimValue(issue, colDim);
      const val = getIssueMeasureValue(issue, measure);

      rowSet.add(rKey);
      colSet.add(cKey);

      if (!rawMatrix[rKey]) rawMatrix[rKey] = {};
      rawMatrix[rKey][cKey] = (rawMatrix[rKey][cKey] || 0) + val;

      rTotals[rKey] = (rTotals[rKey] || 0) + val;
      cTotals[cKey] = (cTotals[cKey] || 0) + val;
      gTotal += val;

      // Group issues
      if (!byRow.has(rKey)) byRow.set(rKey, []);
      byRow.get(rKey).push(issue);

      const cellKey = `${rKey}:::${cKey}`;
      if (!byCell.has(cellKey)) byCell.set(cellKey, []);
      byCell.get(cellKey).push(issue);
    });

    const cols = Array.from(colSet);
    const rows = Array.from(rowSet);

    // Standard ordering for common dimensions
    const statusOrder = ['To Do', 'In Progress', 'Done'];
    const priorityOrder = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

    cols.sort((a, b) => {
      if (colDim === 'status') {
        const iA = statusOrder.indexOf(a);
        const iB = statusOrder.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
      }
      if (colDim === 'priority') {
        const iA = priorityOrder.indexOf(a);
        const iB = priorityOrder.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
      }
      return a.localeCompare(b);
    });

    // Find max cell value for heatmap scaling
    rows.forEach((r) => {
      cols.forEach((c) => {
        const v = rawMatrix[r]?.[c] || 0;
        if (v > maxCell) maxCell = v;
      });
    });

    return {
      rowKeys: rows,
      colKeys: cols,
      matrix: rawMatrix,
      rowTotals: rTotals,
      colTotals: cTotals,
      grandTotal: Math.round(gTotal * 10) / 10,
      maxVal: maxCell || 1,
      issuesByRow: byRow,
      issuesByCell: byCell,
    };
  }, [issues, rowDim, colDim, measure]);

  // Filter rows by search keyword
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rowKeys;
    const lower = search.toLowerCase();
    return rowKeys.filter((r) => r.toLowerCase().includes(lower));
  }, [rowKeys, search]);

  // Sort rows based on sort configuration
  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (sortField === 'row') {
        return sortDir === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
      } else if (sortField === 'total') {
        valA = rowTotals[a] || 0;
        valB = rowTotals[b] || 0;
      } else {
        valA = matrix[a]?.[sortField] || 0;
        valB = matrix[b]?.[sortField] || 0;
      }

      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
    return list;
  }, [filteredRows, sortField, sortDir, rowTotals, matrix]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Toggle row expand
  const toggleRowExpand = (rKey) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rKey)) next.delete(rKey);
      else next.add(rKey);
      return next;
    });
  };

  // Toggle sub-item expand in tree mode
  const toggleSubKeyExpand = (key) => {
    setExpandedSubKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Toggle all expand/collapse
  const toggleAllExpand = () => {
    if (expandedRows.size === sortedRows.length) {
      setExpandedRows(new Set());
      setExpandedSubKeys(new Set());
    } else {
      setExpandedRows(new Set(sortedRows));
    }
  };

  // Heatmap background color calculator
  const getCellBg = (val) => {
    if (!heatmap || !val || val === 0) return 'transparent';
    const intensity = Math.min(val / maxVal, 1);
    if (theme === 'emerald') {
      return `rgba(16, 185, 129, ${0.12 + intensity * 0.45})`;
    } else if (theme === 'sunset') {
      return `rgba(244, 63, 94, ${0.12 + intensity * 0.45})`;
    } else if (theme === 'neon') {
      return `rgba(0, 245, 212, ${0.12 + intensity * 0.45})`;
    }
    return `rgba(14, 165, 233, ${0.12 + intensity * 0.48})`;
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden text-slate-200 text-xs select-text">
      {/* ── TOOLBAR / SUB-BAR: DIMENSIONS & VIEW CONTROLS ── */}
      <div className="px-3 py-2 flex items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/60 shrink-0 flex-wrap">
        {/* Dimensions Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-300 font-bold">
            Row: {DIM_LABELS[rowDim] || rowDim}
          </span>
          <span className="text-slate-500 font-bold">✕</span>
          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold">
            Col: {DIM_LABELS[colDim] || colDim}
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-cyan-400 font-mono text-[10px] font-semibold uppercase">
            {measureUnit}
          </span>
        </div>

        {/* View Controls & Search */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Mode Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px]">
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
                viewMode === 'matrix'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="2D Cross-Tabulation Grid"
            >
              <Table className="w-3 h-3" />
              <span>2D Matrix</span>
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
                viewMode === 'tree'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Hierarchical Expandable Tree (Drill-Down)"
            >
              <ListTree className="w-3 h-3" />
              <span>Nested Tree</span>
            </button>
          </div>

          {/* Expand/Collapse All Button */}
          <button
            onClick={toggleAllExpand}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-slate-700 text-[10px] font-medium transition-colors"
            title="Expand or collapse all rows"
          >
            {expandedRows.size === sortedRows.length ? (
              <>
                <ChevronDown className="w-3 h-3 text-cyan-400" />
                <span>Collapse All</span>
              </>
            ) : (
              <>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span>Expand All</span>
              </>
            )}
          </button>

          {/* Quick Filter */}
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter..."
              className="w-24 sm:w-32 bg-slate-900 border border-slate-800 focus:border-cyan-500/80 rounded-md pl-6 pr-2 py-0.5 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar relative">
        {viewMode === 'matrix' ? (
          /* ══════════════════════════════════════════════════════
             MODE 1: 2D MATRIX (CROSS-TABULATION) WITH 2-TIER HEADER
             ══════════════════════════════════════════════════════ */
          <table className="w-full min-w-max border-collapse text-left text-[11px]">
            {/* 2-TIER STICKY HEADER */}
            <thead className="sticky top-0 z-20 bg-slate-950 shadow-md border-b border-slate-800">
              {/* TIER 1: Column Dimension Grouping Banner */}
              <tr className="border-b border-slate-800/80 bg-slate-950">
                <th
                  rowSpan={2}
                  onClick={() => handleSort('row')}
                  className="sticky top-0 left-0 z-30 bg-slate-950 p-2.5 font-bold text-slate-300 cursor-pointer select-none hover:text-white transition-colors border-r border-slate-800 min-w-[170px] shadow-sm align-bottom"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Row:</span>
                    <span className="text-cyan-300 font-bold">{DIM_LABELS[rowDim] || rowDim}</span>
                    {sortField === 'row' ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-cyan-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-cyan-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>

                {/* Column Dimension Super-Header */}
                <th
                  colSpan={colKeys.length}
                  className="p-1.5 text-center font-bold text-slate-200 bg-slate-900/90 border-r border-slate-800 border-b border-slate-800/80"
                >
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Column Dimension:
                    </span>
                    <span className="text-indigo-300 font-extrabold tracking-wide uppercase">
                      {DIM_LABELS[colDim] || colDim}
                    </span>
                    <span className="text-slate-500 font-mono text-[10px] font-normal">
                      ({colKeys.length} categories)
                    </span>
                  </div>
                </th>

                {showTotals && (
                  <th
                    rowSpan={2}
                    onClick={() => handleSort('total')}
                    className="p-2 font-bold text-cyan-300 text-center cursor-pointer select-none hover:text-cyan-200 transition-colors bg-cyan-950/40 border-l border-slate-800 min-w-[85px] align-bottom shadow-sm"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Total</span>
                      {sortField === 'total' ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-cyan-400" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-cyan-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-600" />
                      )}
                    </div>
                  </th>
                )}
              </tr>

              {/* TIER 2: Category Headers with Jira Icons & Cross-Filter */}
              <tr className="bg-slate-950/95">
                {colKeys.map((col) => {
                  const colIcon = getSemanticIcon(colDim, col, assigneeAvatarMap);
                  const isColFiltered = isValueFiltered(colDim, col);

                  return (
                    <th
                      key={col}
                      className={`p-2 font-semibold text-center select-none transition-colors border-r border-slate-800/60 min-w-[95px] ${
                        isColFiltered
                          ? 'bg-cyan-950/60 text-cyan-300 border-b-2 border-b-cyan-400'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5 group/th">
                        {colIcon && (
                          <img
                            src={colIcon}
                            alt=""
                            className="w-3.5 h-3.5 shrink-0 object-contain"
                          />
                        )}
                        <span
                          onClick={() => handleSort(col)}
                          className="truncate max-w-[95px] cursor-pointer hover:text-cyan-300"
                          title={col}
                        >
                          {col}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCrossFilter(colDim, col);
                          }}
                          className={`p-0.5 rounded hover:bg-cyan-500/20 transition-all ${
                            isColFiltered ? 'text-cyan-400 opacity-100' : 'text-slate-500 opacity-0 group-hover/th:opacity-100'
                          }`}
                          title={`Cross-filter dashboard by ${col}`}
                        >
                          <Filter className="w-2.5 h-2.5" />
                        </button>
                        {sortField === col && (
                          sortDir === 'asc' ? (
                            <ArrowUp className="w-2.5 h-2.5 text-cyan-400" />
                          ) : (
                            <ArrowDown className="w-2.5 h-2.5 text-cyan-400" />
                          )
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* TABLE BODY */}
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {sortedRows.map((rowKey) => {
                const rTotal = Math.round((rowTotals[rowKey] || 0) * 10) / 10;
                const isExpanded = expandedRows.has(rowKey);
                const rowIssues = issuesByRow.get(rowKey) || [];
                const isRowFiltered = isValueFiltered(rowDim, rowKey);
                const rowIcon = getSemanticIcon(rowDim, rowKey, assigneeAvatarMap);

                return (
                  <React.Fragment key={rowKey}>
                    <tr className={`transition-colors group ${isExpanded ? 'bg-slate-900/70' : 'hover:bg-slate-800/40'}`}>
                      {/* Sticky Row Header with Expand Button, Jira Avatar/Icon & Filter */}
                      <td
                        className={`sticky left-0 z-10 bg-slate-950/95 group-hover:bg-slate-900 p-2 font-sans font-semibold border-r border-slate-800/80 max-w-[185px] shadow-sm transition-colors ${
                          isRowFiltered
                            ? 'text-cyan-300 bg-cyan-950/40 border-l-2 border-l-cyan-400'
                            : 'text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowExpand(rowKey);
                            }}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors shrink-0"
                            title={isExpanded ? 'Collapse breakdown' : 'Open / Expand breakdown'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {rowIcon && (
                            <img
                              src={rowIcon}
                              alt=""
                              className="w-4 h-4 rounded shrink-0 object-cover"
                            />
                          )}
                          <span
                            onClick={() => toggleRowExpand(rowKey)}
                            className="truncate cursor-pointer hover:text-cyan-300 transition-colors flex-1"
                            title={`${rowKey} (${rowIssues.length} issues)`}
                          >
                            {rowKey}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCrossFilter(rowDim, rowKey);
                            }}
                            className={`p-0.5 rounded hover:bg-cyan-500/20 transition-all ${
                              isRowFiltered
                                ? 'text-cyan-400 opacity-100'
                                : 'text-slate-500 opacity-0 group-hover:opacity-100'
                            }`}
                            title={`Cross-filter dashboard by ${rowKey}`}
                          >
                            <Filter className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </td>

                      {/* Pivot Data Cells with Heatmap & Drill-Down Click */}
                      {colKeys.map((colKey) => {
                        const rawVal = matrix[rowKey]?.[colKey] || 0;
                        const displayVal = rawVal > 0 ? Math.round(rawVal * 10) / 10 : 0;
                        const cellBg = getCellBg(rawVal);
                        const cellIssuesCount = (issuesByCell.get(`${rowKey}:::${colKey}`) || []).length;

                        return (
                          <td
                            key={colKey}
                            style={{ backgroundColor: cellBg }}
                            onClick={() => rawVal > 0 && setSelectedDrillDown({ row: rowKey, col: colKey })}
                            className={`p-2 text-center border-r border-slate-800/40 transition-all text-slate-200 ${
                              rawVal > 0
                                ? 'cursor-pointer hover:ring-1 hover:ring-cyan-400 hover:scale-[1.02] hover:z-10'
                                : ''
                            }`}
                            title={rawVal > 0 ? `Click to inspect ${cellIssuesCount} issue(s)` : undefined}
                          >
                            {displayVal > 0 ? (
                              <span className={rawVal >= maxVal * 0.7 ? 'font-bold text-white' : 'font-medium'}>
                                {displayVal}
                              </span>
                            ) : (
                              <span className="text-slate-600 select-none">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Row Total Column */}
                      {showTotals && (
                        <td
                          onClick={() => setSelectedDrillDown({ row: rowKey, col: null })}
                          className="p-2 text-center font-bold text-cyan-300 bg-cyan-950/15 border-l border-slate-800/80 cursor-pointer hover:bg-cyan-950/30 transition-colors"
                          title="Click to inspect all issues for this row"
                        >
                          {rTotal > 0 ? rTotal : '—'}
                        </td>
                      )}
                    </tr>

                    {/* ── EXPANDED COLLAPSIBLE BREAKDOWN ("ΑΝΟΙΓΜΑ") ── */}
                    {isExpanded && (
                      <tr className="bg-slate-950/90 border-b border-cyan-500/20">
                        <td colSpan={colKeys.length + (showTotals ? 2 : 1)} className="p-3">
                          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3 space-y-2.5 shadow-inner">
                            {/* Breakdown by 2nd Dimension with Category Icons */}
                            <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-slate-800/80">
                              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                                {DIM_LABELS[colDim] || colDim} Breakdown:
                              </span>
                              {colKeys.map((col) => {
                                const v = matrix[rowKey]?.[col] || 0;
                                if (v === 0) return null;
                                const pct = rTotal > 0 ? Math.round((v / rTotal) * 100) : 0;
                                const colPillIcon = getSemanticIcon(colDim, col, assigneeAvatarMap);

                                return (
                                  <button
                                    key={col}
                                    type="button"
                                    onClick={() => setSelectedDrillDown({ row: rowKey, col })}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/60 text-[10px] transition-all hover:scale-105"
                                  >
                                    {colPillIcon && (
                                      <img src={colPillIcon} alt="" className="w-3 h-3 shrink-0 object-contain" />
                                    )}
                                    <span className="font-semibold text-slate-300">{col}:</span>
                                    <span className="font-bold text-cyan-400 font-mono">
                                      {v} {measureUnit}
                                    </span>
                                    <span className="text-slate-500 text-[9px]">({pct}%)</span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Underlying Issues Details with Issue Type & Priority Icons */}
                            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                              <p className="text-[10px] text-slate-400 font-semibold uppercase">
                                Underlying Issues ({rowIssues.length}):
                              </p>
                              {rowIssues.map((issue) => {
                                const issueColVal = getIssueDimValue(issue, colDim);
                                const issueVal = getIssueMeasureValue(issue, measure);
                                const tIcon = getSemanticIcon('type', issue.type);
                                const pIcon = getSemanticIcon('priority', issue.priority);
                                const sSem = getSemanticColor('status', issue.status);

                                return (
                                  <div
                                    key={issue.key || issue.id}
                                    className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/50 text-[11px] transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      {tIcon && (
                                        <img src={tIcon} alt="" className="w-3.5 h-3.5 shrink-0" title={issue.type} />
                                      )}
                                      <span className="font-mono font-bold text-cyan-400 shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">
                                        {issue.key}
                                      </span>
                                      <span className="text-slate-200 truncate font-sans text-xs">
                                        {issue.summary}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 font-mono">
                                      {pIcon && (
                                        <img src={pIcon} alt="" className="w-3 h-3 shrink-0" title={issue.priority} />
                                      )}
                                      <span
                                        style={{ backgroundColor: sSem.bg, color: sSem.border, borderColor: sSem.color }}
                                        className="px-2 py-0.5 rounded-full text-[9px] font-semibold border"
                                      >
                                        {issueColVal}
                                      </span>
                                      <span className="font-bold text-slate-200 text-xs">
                                        {issueVal} {measureUnit}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* TABLE FOOTER / COLUMN TOTALS */}
            {showTotals && (
              <tfoot className="sticky bottom-0 z-20 bg-slate-950 border-t-2 border-slate-800 font-mono font-bold text-slate-200 shadow-lg">
                <tr>
                  <td className="sticky bottom-0 left-0 z-30 bg-slate-950 p-2 font-sans text-cyan-400 border-r border-slate-800/80 shadow-sm">
                    Total
                  </td>

                  {colKeys.map((colKey) => {
                    const cTotal = Math.round((colTotals[colKey] || 0) * 10) / 10;
                    return (
                      <td key={colKey} className="p-2 text-center border-r border-slate-800/60 bg-slate-950">
                        {cTotal > 0 ? cTotal : '—'}
                      </td>
                    );
                  })}

                  <td className="p-2 text-center text-cyan-300 bg-cyan-950/60 text-[12px] font-black border-l border-slate-800">
                    {grandTotal}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        ) : (
          /* ══════════════════════════════════════════════════════
             MODE 2: NESTED HIERARCHICAL TREE VIEW (DRILL-DOWN)
             ══════════════════════════════════════════════════════ */
          <div className="p-3 space-y-2">
            <div className="text-[11px] text-slate-400 pb-2 border-b border-slate-800 flex items-center justify-between">
              <span>
                Hierarchical Drill-down:{' '}
                <strong className="text-cyan-300">{DIM_LABELS[rowDim] || rowDim}</strong>
                {' ➔ '}
                <strong className="text-indigo-300">{DIM_LABELS[colDim] || colDim}</strong>
              </span>
              <span className="font-mono text-cyan-400 font-bold">Grand Total: {grandTotal} {measureUnit}</span>
            </div>

            <div className="space-y-1.5">
              {sortedRows.map((rKey) => {
                const rTotal = Math.round((rowTotals[rKey] || 0) * 10) / 10;
                const isExpanded = expandedRows.has(rKey);
                const rowIssues = issuesByRow.get(rKey) || [];

                return (
                  <div
                    key={rKey}
                    className="rounded-xl border border-slate-800/80 bg-slate-950/60 overflow-hidden transition-all"
                  >
                    {/* LEVEL 1: Primary Dimension Row with Jira Icon */}
                    <div
                      onClick={() => toggleRowExpand(rKey)}
                      className={`p-2.5 flex items-center justify-between gap-3 hover:bg-slate-800/40 cursor-pointer transition-colors ${
                        isValueFiltered(rowDim, rKey) ? 'bg-cyan-950/40 border-l-2 border-l-cyan-400' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          className="p-1 rounded text-slate-400 hover:text-cyan-300"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        {(() => {
                          const rIcon = getSemanticIcon(rowDim, rKey, assigneeAvatarMap);
                          return rIcon ? (
                            <img src={rIcon} alt="" className="w-4 h-4 rounded shrink-0 object-cover" />
                          ) : null;
                        })()}
                        <span className="font-bold text-slate-200 text-xs truncate">
                          {rKey}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({rowIssues.length} issues)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCrossFilter(rowDim, rKey);
                          }}
                          className="p-1 rounded hover:bg-cyan-500/20 text-slate-500 hover:text-cyan-400 ml-1 transition-colors"
                          title={`Cross-filter by ${rKey}`}
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 font-mono">
                        <span className="text-xs font-bold text-cyan-300">
                          {rTotal} {measureUnit}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {grandTotal > 0 ? Math.round((rTotal / grandTotal) * 100) : 0}%
                        </span>
                      </div>
                    </div>

                    {/* LEVEL 2: Nested Secondary Dimension Rows with Icons */}
                    {isExpanded && (
                      <div className="pl-6 pr-3 py-2 space-y-1.5 border-t border-slate-800/60 bg-slate-900/40">
                        {colKeys.map((cKey) => {
                          const val = matrix[rKey]?.[cKey] || 0;
                          if (val === 0) return null;
                          const subKey = `${rKey}:::${cKey}`;
                          const isSubExpanded = expandedSubKeys.has(subKey);
                          const cellIssues = issuesByCell.get(subKey) || [];
                          const pct = rTotal > 0 ? Math.round((val / rTotal) * 100) : 0;
                          const cIcon = getSemanticIcon(colDim, cKey, assigneeAvatarMap);

                          return (
                            <div
                              key={cKey}
                              className="rounded-lg border border-slate-800/60 bg-slate-950/40 overflow-hidden"
                            >
                              <div
                                onClick={() => toggleSubKeyExpand(subKey)}
                                className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-800/40 cursor-pointer text-xs"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <button type="button" className="text-slate-500 hover:text-white">
                                    {isSubExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  {cIcon && (
                                    <img src={cIcon} alt="" className="w-3.5 h-3.5 shrink-0 object-contain" />
                                  )}
                                  <span className="font-semibold text-slate-300 truncate">
                                    {cKey}
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-mono">
                                    ({cellIssues.length} issues)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCrossFilter(colDim, cKey);
                                    }}
                                    className="p-1 rounded hover:bg-cyan-500/20 text-slate-500 hover:text-cyan-400 ml-1 transition-colors"
                                    title={`Cross-filter by ${cKey}`}
                                  >
                                    <Filter className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                                <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                                  <span className="font-bold text-indigo-300">
                                    {val} {measureUnit}
                                  </span>
                                  <span className="text-slate-500 text-[10px]">({pct}%)</span>
                                </div>
                              </div>

                              {/* LEVEL 3: Individual Issues with Jira Type & Priority Icons */}
                              {isSubExpanded && (
                                <div className="pl-6 pr-2 py-1.5 space-y-1 border-t border-slate-800/40 bg-slate-950/60">
                                  {cellIssues.map((issue) => {
                                    const issueTypeIcon = getSemanticIcon('type', issue.type);
                                    const issuePriorityIcon = getSemanticIcon('priority', issue.priority);

                                    return (
                                      <div
                                        key={issue.key || issue.id}
                                        className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-slate-800/50 text-[11px]"
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          {issueTypeIcon && (
                                            <img src={issueTypeIcon} alt="" className="w-3.5 h-3.5 shrink-0" title={issue.type} />
                                          )}
                                          <span className="font-mono text-[10px] text-cyan-400 font-bold shrink-0">
                                            {issue.key}
                                          </span>
                                          <span className="text-slate-300 truncate font-sans">
                                            {issue.summary}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          {issuePriorityIcon && (
                                            <img src={issuePriorityIcon} alt="" className="w-3 h-3 shrink-0" title={issue.priority} />
                                          )}
                                          <span className="font-mono font-semibold text-slate-300">
                                            {getIssueMeasureValue(issue, measure)} {measureUnit}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── INTERACTIVE CELL DRILL-DOWN MODAL WITH ICONS & CROSS-FILTER ── */}
      {selectedDrillDown && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedDrillDown(null)}
        >
          <div
            className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Issue Drill-Down Details</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <span className="text-cyan-300 font-bold">{selectedDrillDown.row}</span>
                  {selectedDrillDown.col && (
                    <>
                      <span>·</span>
                      <span className="text-indigo-300 font-bold">{selectedDrillDown.col}</span>
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => setSelectedDrillDown(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Issues Table with Rich Icons & Avatars */}
            <div className="flex-1 overflow-y-auto custom-scrollbar my-3 space-y-1.5 pr-1">
              {(() => {
                const issuesList = selectedDrillDown.col
                  ? issuesByCell.get(`${selectedDrillDown.row}:::${selectedDrillDown.col}`) || []
                  : issuesByRow.get(selectedDrillDown.row) || [];

                if (issuesList.length === 0) {
                  return (
                    <div className="text-center p-6 text-slate-500 text-xs">
                      No issues found for this slice.
                    </div>
                  );
                }

                return issuesList.map((issue) => {
                  const tIcon = getSemanticIcon('type', issue.type);
                  const pIcon = getSemanticIcon('priority', issue.priority);
                  const sSem = getSemanticColor('status', issue.status);
                  const avatar = issue.avatarUrl || getInitialsAvatar(issue.assignee);

                  return (
                    <div
                      key={issue.key || issue.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono font-bold text-xs text-cyan-400">
                            {issue.key}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCrossFilter('type', issue.type)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                            title="Filter dashboard by this type"
                          >
                            {tIcon && <img src={tIcon} alt="" className="w-3 h-3 shrink-0" />}
                            <span>{issue.type || 'Task'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCrossFilter('status', issue.status)}
                            style={{ backgroundColor: sSem.bg, color: sSem.border, borderColor: sSem.color }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border transition-opacity hover:opacity-80"
                            title="Filter dashboard by this status"
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sSem.color }} />
                            <span>{issue.status || 'To Do'}</span>
                          </button>
                          {pIcon && (
                            <button
                              type="button"
                              onClick={() => setCrossFilter('priority', issue.priority)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[9px] font-semibold text-slate-300 hover:border-slate-700 transition-colors"
                              title="Filter dashboard by this priority"
                            >
                              <img src={pIcon} alt="" className="w-3 h-3 shrink-0" />
                              <span>{issue.priority || 'Medium'}</span>
                            </button>
                          )}
                          {issue.assignee && (
                            <button
                              type="button"
                              onClick={() => setCrossFilter('assignee', issue.assignee)}
                              className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-300 ml-1 transition-colors"
                              title="Filter dashboard by this assignee"
                            >
                              {avatar && <img src={avatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />}
                              <span>{issue.assignee}</span>
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-200 truncate">{issue.summary}</p>
                      </div>

                      <div className="text-right shrink-0 font-mono">
                        <span className="text-sm font-bold text-cyan-300">
                          {getIssueMeasureValue(issue, measure)}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1">{measureUnit}</span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedDrillDown(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
