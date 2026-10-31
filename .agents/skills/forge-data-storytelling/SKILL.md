---
name: forge-data-storytelling
description: "Guidelines and patterns for designing high-value, executive-ready data visualizations and UI storytelling inside Atlassian Forge using native UI Kit, Custom UI ECharts, and Jira semantic tokens."
---

# Forge Data Storytelling & Executive Visuals

This skill guides the design and transformation of raw ticket/sprint data into compelling, executive-ready analytics that justify premium customer investment.

## 1. Core Principles of Business-Driven Visuals
- **Answer the 'So What?':** Never show a chart without an immediate business takeaway (e.g., instead of just "Issues by Status", show "Delivery Risk: 65% of Sprint Points are blocked or stale").
- **Contrast & Hierarchy:** Highlight bottlenecks with high-contrast Lozenges, Badges, and Jira semantic colors (`done` = Emerald, `indeterminate` = Blue, `to do` = Slate, `bugs` = Rose/Crimson).
- **Executive Framing:** Combine 3 complementary views for every metric:
  1. **Top-Level KPI:** Big number, trend indicator (e.g. `+14% vs last sprint`), and a compact status Lozenge.
  2. **Distribution / Trend Chart:** A discrete categorical visual (`BarChart`, `HorizontalBarChart`, `PieChart`, `LineChart`, or Apache ECharts).
  3. **Actionable Detail List:** A `DynamicTable` or `TanStack` Inspector showing exactly which tickets or team members need attention right now.

## 2. Component Selection Guide

| Business Question | Best Component Pattern | Rationale |
| :--- | :--- | :--- |
| **"Where are our bottlenecks?"** | `HorizontalBarChart` / `StackBarChart` | Easy to read long status names; clearly exposes which stage piles up work. |
| **"How is team capacity distributed?"** | `PivotTableWidget` (Matrix & Tree) | Cross-tabulates assignees by status/type with heatmap intensity tinting. |
| **"What is our completion / delivery rate?"** | `ProgressBar` + `SingleValueChart` | Instant glance at delivery percentage. |
| **"What type of work consumes our budget?"** | `PieChart` / `Donut` | High-level portfolio split (Bugs vs Stories vs Tech Debt). |
| **"Which tickets need immediate intervention?"** | `DrillDownInspectorTable` (TanStack) | Master-detail reactive binding; Radar mode for idle risk detection; inline status/assignee transitions. |

## 3. Custom UI Self-Service BI Patterns
- **Universal Cross-Filtering:** Clicking any bar, slice, or table row triggers `useFilterStore.setCrossFilter(dim, val)`, isolating records across all widgets simultaneously.
- **Authentic Atlassian Visuals:** Grounded in [`colorDictionary.js`](file:///c:/New_sql_test/Art_of_Data/static/src/utils/colorDictionary.js) with official SVG Data URIs for Issue Types (Bug, Story, Task, Epic) and Priorities (Highest, High, Medium, Low, Lowest).
- **Interactive Pivot Table:** Supports both 2D Matrix mode (sticky dual-tier headers, column sorting, cell drilldown modal) and Hierarchical Drill-down Nested Tree mode.
- **Master-Detail Reactive Inspector:** TanStack Table bound to the global cross-filter, equipped with Radar mode for stale/blocker issues and optimistic UI updates for instant Jira transitions.

## 4. Atlassian UI Kit Strict Compliance (UI Kit Modules)
- **Zero Raw HTML:** Absolutely no `<div>`, `<span>`, `<table>`, `<tr>`, `<td>` in UI Kit components.
- **Containers:** Only `Box`, `Stack` (vertical layout), `Inline` (horizontal layout).
- **Typography:** Only `Heading`, `Text`, `Strong`, `Em`.
- **Tables:** Exclusively `DynamicTable` (never `Table`).
- **Styling with `xcss`:**
  - Backgrounds: `'elevation.surface.raised'`, `'elevation.surface.sunken'`
  - Borders: `'color.border'`, `'border.width'`, `'border.style.solid'`
  - Radii: `'radius.large'` (for premium card appearance)
  - Shadows: `'elevation.shadow.raised'`
