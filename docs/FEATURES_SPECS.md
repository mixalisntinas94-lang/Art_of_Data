# Features & Specifications

## 1. Dynamic Dashboard
- **Description:** A highly responsive dashboard allowing users to filter the entire project dataset by Dimension (Status, Assignee, Issue Type, Priority) and Measure (Count, Story Points, Hours).
- **Technical Flow:** Utilizes `rawIssues` from the backend. The frontend maps and reduces this array in real-time based on React state variables.

## 2. Custom Analytics Engine
- **Description:** A "Power BI" style visual builder. Users can dynamically add multiple widgets (Bar Charts, Pie Charts) to a grid canvas.
- **Moat/Competitive Advantage:** Despite being restricted to native Atlassian UI Kit components, this engine pushes the boundaries of interactivity, offering a customizable reporting experience rarely seen in standard Forge apps.

## 3. Executive Standup Generator
- **Description:** Automatically generates a markdown-formatted summary of the project's health, copy-pasteable directly into Slack or Confluence.

## 4. Bottleneck & Stale Issue Detection
- **Description:** Flags tickets that have been inactive for more than 14 days and provides a direct view of team workload to balance capacity.
