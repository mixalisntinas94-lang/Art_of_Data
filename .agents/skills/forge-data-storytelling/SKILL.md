---
name: forge-data-storytelling
description: "Guidelines and patterns for designing high-value, executive-ready data visualizations and UI storytelling inside Atlassian Forge using native UI Kit and design tokens."
---

# Forge Data Storytelling & Executive Visuals

This skill guides the design and transformation of raw ticket/sprint data into compelling, executive-ready analytics that justify premium customer investment.

## 1. Core Principles of Business-Driven Visuals
- **Answer the 'So What?':** Never show a chart without an immediate business takeaway (e.g., instead of just "Issues by Status", show "Delivery Risk: 65% of Sprint Points are blocked or stale").
- **Contrast & Hierarchy:** Highlight bottlenecks with high-contrast Lozenges and Badges (`removed` / red for critical, `inprogress` for ongoing, `success` for completed).
- **Executive Framing:** Combine 3 complementary views for every metric:
  1. **Top-Level KPI:** Big number, trend indicator (e.g. `+14% vs last sprint`), and a compact status Lozenge.
  2. **Distribution / Trend Chart:** A discrete categorical visual (`BarChart`, `HorizontalBarChart`, `PieChart`, or `LineChart`).
  3. **Actionable Detail List:** A `DynamicTable` showing exactly which tickets or team members need attention right now.

## 2. Component Selection Guide

| Business Question | Best Forge UI Kit Component | Rationale |
| :--- | :--- | :--- |
| **"Where are our bottlenecks?"** | `HorizontalBarChart` / `StackBarChart` | Easy to read long status names; clearly exposes which stage piles up work. |
| **"How is team capacity distributed?"** | `DynamicTable` + `Lozenge` (`inprogress` / `success` / `removed`) | Tabulates assignees, story points, and flags overloaded members. |
| **"What is our completion / delivery rate?"** | `ProgressBar` + `SingleValueChart` | Instant glance at delivery percentage. |
| **"What type of work consumes our budget?"** | `PieChart` / `Donut` | High-level portfolio split (Bugs vs Stories vs Tech Debt). |
| **"Which tickets need immediate intervention?"** | `DynamicTable` with sortable headers | Allows filtering by `daysInactive` and direct drill-down. |

## 3. Atlassian UI Kit Strict Compliance
- **Zero Raw HTML:** Absolutely no `<div>`, `<span>`, `<table>`, `<tr>`, `<td>`.
- **Containers:** Only `Box`, `Stack` (vertical layout), `Inline` (horizontal layout).
- **Typography:** Only `Heading`, `Text`, `Strong`, `Em`.
- **Tables:** Exclusively `DynamicTable` (never `Table`).
- **Styling with `xcss`:**
  - Backgrounds: `'elevation.surface.raised'`, `'elevation.surface.sunken'`
  - Borders: `'color.border'`, `'border.width'`, `'border.style.solid'`
  - Radii: `'radius.large'` (for premium card appearance)
  - Shadows: `'elevation.shadow.raised'`
