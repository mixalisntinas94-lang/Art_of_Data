# 📊 Agile Pulse Analytics (Jira Cloud Forge App)

**Agile Pulse Analytics** is a comprehensive, production-ready Jira Cloud analytics and capacity management app built on **Atlassian Forge** with the official **UI Kit (`@forge/react`)**.

---

## 🚀 Key Features

1. **🎯 Sprint Completion & Velocity Tracker**:
   - Real-time sprint progress bar and completion rate.
   - Total estimated hours vs. logged hours vs. remaining hours.
   - Average cycle time from creation to resolution.

2. **👥 Team Workload & Capacity Balancer**:
   - Breakdown of assigned issues and estimated workload per team member.
   - Over-allocation and capacity warnings to prevent team burnout.
   - Detection of unassigned tickets and missing time estimates.

3. **⚠️ Bottleneck & Stale Ticket Detector**:
   - Highlights in-progress or open issues with no activity for ≥ 4 days.
   - Interactive `DynamicTable` with status lozenges, priority flags, and direct issue keys.

4. **🐛 Quality & Bug Ratio**:
   - Live Bug vs. Feature ratio tracker.
   - Issue type distribution (Story, Bug, Task, Epic) and priority breakdown.

5. **📑 Executive Standup & Brief Export**:
   - Ready-to-copy structured markdown summary for daily standups, Slack, MS Teams, or Confluence updates.

---

## 🏗️ Architecture & Placement

- **Jira Global Page (`jira:globalPage`)**: Cross-project and portfolio analytics accessible from the Jira top navigation bar.
- **Jira Project Page (`jira:projectPage`)**: Dedicated "Agile Insights" tab embedded in the left sidebar of any Jira Project.

---

## 🛠️ Development & Deployment

### Run Linter
```bash
npm run lint
```

### Deploy to Jira Cloud
```bash
forge deploy --environment development
```

### Start Development Tunnel
```bash
forge tunnel
```

### Upgrade / Install App
```bash
forge install --upgrade
```
