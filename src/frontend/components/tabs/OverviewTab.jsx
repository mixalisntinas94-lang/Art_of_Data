import React from 'react';
import {
  Box,
  Stack,
  Inline,
  Heading,
  Text,
  Badge,
  Lozenge,
  EmptyState,
  PieChart,
  ProgressBar,
  Strong,
  Em,
} from '@forge/react';
import {
  fullWidthBoxStyle,
  chartCardHalfStyle,
  sectionCardStyle,
  verdictCardStyle,
  activityRowStyle,
} from '../../styles';

/**
 * Maps common Jira issue type names to clear semantic icons.
 */
const getTypeIcon = (typeName = '') => {
  const lower = typeName.toLowerCase();
  if (lower.includes('bug') || lower.includes('defect')) return '🐛';
  if (lower.includes('story') || lower.includes('user story')) return '📖';
  if (lower.includes('task')) return '📋';
  if (lower.includes('epic')) return '⚡';
  if (lower.includes('subtask') || lower.includes('sub-task')) return '📎';
  if (lower.includes('improvement')) return '🚀';
  if (lower.includes('feature')) return '✨';
  return '📌';
};

/**
 * Generates user avatar initials (e.g. "MIXALIS NTINAS" -> "MN").
 */
const getInitials = (name = '') => {
  if (!name || name === 'Unassigned') return 'UN';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Formats relative timestamp (e.g. "about 14 hours ago").
 */
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'recently';
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diffHours = Math.floor((now - time) / (1000 * 60 * 60));
  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `about ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

/**
 * Current Sprint Overview Tab - Enterprise Next-Gen Redesign
 *
 * Outclasses standard free Jira with:
 * 1. Executive Sprint Health & Heuristic Verdict banner.
 * 2. Donut / Pie Chart for Status & Effort (Story Points weighted).
 * 3. Live Sprint Pulse & Risk Sentinel (Recent activity + automated Stale & Unestimated flags).
 * 4. Horizontal Distribution Progress Bars for Types of Work (with exact Story Points).
 * 5. Horizontal Team Capacity & Workload Balance Bars (with overload detection).
 */
export const OverviewTab = ({
  kpis,
  analytics,
  metricMode,
  selectedSprint = 'active',
}) => {
  if (!kpis || !analytics) return null;

  const sprintDisplayName =
    analytics.activeSprintName
      ? analytics.activeSprintName
      : selectedSprint === 'active'
      ? 'Current Active Sprint'
      : selectedSprint === 'all'
      ? 'All Sprints & Project Scope'
      : selectedSprint === 'backlog'
      ? 'Backlog (No Sprint)'
      : selectedSprint === 'closed'
      ? 'Closed Sprints'
      : selectedSprint;

  const rawTypes = analytics.charts?.types || [];
  const activeMembers = (analytics.teamMembers || []).filter((m) => m.name !== 'Unassigned');
  const rawIssues = analytics.rawIssues || [];

  // Sort rawIssues by updated timestamp DESC for the Live Sprint Activity Feed
  const recentActivities = [...rawIssues]
    .sort((a, b) => new Date(b.updated || 0).getTime() - new Date(a.updated || 0).getTime())
    .slice(0, 5);

  // Status Donut Chart Data (Story Points weighted if available, falls back to issue counts)
  const useStoryPoints = metricMode === 'points' && kpis.totalStoryPoints > 0;
  const statusPieData = [
    {
      label: 'Done',
      value: useStoryPoints ? kpis.completedStoryPoints : kpis.completedCount,
      color: '#36b37e',
    },
    {
      label: 'In Progress',
      value: useStoryPoints
        ? (kpis.inProgressStoryPoints || Math.max(0, kpis.remainingStoryPoints - (kpis.toDoStoryPoints || 0)))
        : kpis.inProgressCount,
      color: '#0052cc',
    },
    {
      label: 'To Do',
      value: useStoryPoints ? (kpis.toDoStoryPoints || 0) : kpis.toDoCount,
      color: '#8993a4',
    },
  ].filter((item) => item.value > 0);

  // Fallback if all values are 0
  if (statusPieData.length === 0 && kpis.totalIssues > 0) {
    statusPieData.push({ label: 'To Do', value: kpis.totalIssues, color: '#8993a4' });
  }

  // Executive Sprint Health Diagnosis
  let verdictAppearance = 'success';
  let verdictTitle = '🟢 Sprint on Track';
  let verdictSummary = 'Velocity is pacing well with no critical delivery blockers detected.';

  if (kpis.bugRatio > 25 || (kpis.completionRate < 20 && kpis.totalStoryPoints > 15)) {
    verdictAppearance = 'removed';
    verdictTitle = '🔴 High Delivery Risk';
    verdictSummary = `Critical risk detected: Elevated defect density (${kpis.bugRatio}%) and delivery pace requires immediate triage.`;
  } else if (kpis.staleCount > 0 || kpis.unestimatedPointsCount > 0 || kpis.completionRate < 50) {
    verdictAppearance = 'moved';
    verdictTitle = '🟡 Moderate Scope & Velocity Risk';
    verdictSummary = `Sprint is active with ${kpis.staleCount} stale ticket(s) and ${kpis.unestimatedPointsCount} unestimated item(s) impacting velocity projection.`;
  }

  return (
    <Box padding="space.100" xcss={fullWidthBoxStyle}>
      <Stack space="space.200" alignInline="stretch" grow="fill">
        
        {/* ════════════════════════════════════════════════════
         *  1. EXECUTIVE SPRINT HEALTH & HEURISTIC VERDICT BANNER
         * ════════════════════════════════════════════════════ */}
        <Box xcss={verdictCardStyle}>
          <Stack space="space.100">
            <Inline spread="space-between" alignBlock="center">
              <Inline space="space.100" alignBlock="center">
                <Lozenge appearance={verdictAppearance}>{verdictTitle}</Lozenge>
                <Text><Strong>Executive Diagnosis:</Strong> {verdictSummary}</Text>
              </Inline>
              <Inline space="space.050" alignBlock="center">
                <Lozenge appearance="inprogress">{sprintDisplayName}</Lozenge>
                <Badge appearance="primary">{`${kpis.totalStoryPoints} SP Scope`}</Badge>
              </Inline>
            </Inline>

            {/* 3 Executive Bullet Insights */}
            <Inline spread="space-between" alignBlock="center" space="space.100">
              <Inline space="space.050" alignBlock="center">
                <Text>⚡ <Strong>Delivery:</Strong> {kpis.completedStoryPoints}/{kpis.totalStoryPoints} SP ({kpis.completionRate}% complete · {kpis.completedCount}/{kpis.totalIssues} tickets)</Text>
              </Inline>
              <Inline space="space.050" alignBlock="center">
                <Text>🐛 <Strong>Quality:</Strong> {kpis.bugCount} active bugs ({kpis.bugRatio}% defect ratio)</Text>
              </Inline>
              <Inline space="space.050" alignBlock="center">
                <Text>🎯 <Strong>Estimation:</Strong> {kpis.unestimatedPointsCount > 0 ? `⚠️ ${kpis.unestimatedPointsCount} unestimated issues` : '100% estimated'}</Text>
              </Inline>
            </Inline>
          </Stack>
        </Box>

        {/* ════════════════════════════════════════════════════
         *  ROW 2: Status Donut Chart (50%) + Live Sprint Pulse (50%)
         * ════════════════════════════════════════════════════ */}
        <Inline space="space.200" spread="space-between" alignBlock="stretch">
          
          {/* WIDGET 1: Status & Scope Distribution Donut */}
          <Box xcss={chartCardHalfStyle}>
            <Stack space="space.150">
              <Inline spread="space-between" alignBlock="center">
                <Heading as="h3">📊 Status & Scope Overview</Heading>
                <Lozenge appearance={kpis.completionRate >= 50 ? 'success' : 'inprogress'}>
                  {`${kpis.completionRate}% Delivered`}
                </Lozenge>
              </Inline>
              <Text>
                {useStoryPoints
                  ? `Distribution of ${kpis.totalStoryPoints} Story Points across workflow categories.`
                  : `Distribution of ${kpis.totalIssues} work items across workflow categories.`}
              </Text>

              {kpis.totalIssues > 0 ? (
                <Box paddingBlock="space.100">
                  <PieChart
                    data={statusPieData}
                    labelAccessor="label"
                    valueAccessor="value"
                    colorAccessor="color"
                    height={220}
                  />
                </Box>
              ) : (
                <EmptyState
                  header="No issues found"
                  description="No issues exist in the selected sprint scope."
                />
              )}

              {/* Exact Legend Breakdown with Story Points & Count */}
              <Inline space="space.100" wrap="wrap">
                <Lozenge appearance="success">
                  {`🟢 Done: ${kpis.completedCount} (${kpis.completedStoryPoints} SP)`}
                </Lozenge>
                <Lozenge appearance="inprogress">
                  {`🔵 In Progress: ${kpis.inProgressCount} (${kpis.inProgressStoryPoints || 0} SP)`}
                </Lozenge>
                <Lozenge appearance="default">
                  {`⚪ To Do: ${kpis.toDoCount} (${kpis.toDoPoints || kpis.toDoStoryPoints || 0} SP)`}
                </Lozenge>
              </Inline>
            </Stack>
          </Box>

          {/* WIDGET 2: Live Sprint Pulse & Risk Sentinel (Recent Activity + Risks) */}
          <Box xcss={chartCardHalfStyle}>
            <Stack space="space.150">
              <Inline spread="space-between" alignBlock="center">
                <Heading as="h3">⚡ Live Sprint Pulse & Activity</Heading>
                <Badge appearance="primary">{`${rawIssues.length} items tracked`}</Badge>
              </Inline>
              <Text>
                Real-time updates, assignee actions, and automated bottleneck detection.
              </Text>

              {recentActivities.length > 0 ? (
                <Stack space="space.075">
                  {recentActivities.map((issue) => {
                    const isStale = (analytics.staleIssues || []).some((s) => s.id === issue.id);
                    const isUnestimated = !issue.storyPoints && issue.statusCategory !== 'done';
                    const isHighPriority = issue.priority === 'Highest' || issue.priority === 'High';

                    return (
                      <Box key={`act-${issue.id}`} xcss={activityRowStyle}>
                        <Inline spread="space-between" alignBlock="center">
                          <Inline space="space.050" alignBlock="center">
                            <Badge appearance="default">{getInitials(issue.assignee)}</Badge>
                            <Text><Strong>{issue.key}</Strong></Text>
                            <Text>{getTypeIcon(issue.type)}</Text>
                            <Text>{issue.summary.length > 28 ? issue.summary.substring(0, 28) + '…' : issue.summary}</Text>
                          </Inline>

                          <Inline space="space.050" alignBlock="center">
                            <Lozenge
                              appearance={
                                issue.statusCategory === 'done'
                                  ? 'success'
                                  : issue.statusCategory === 'indeterminate'
                                  ? 'inprogress'
                                  : 'default'
                              }
                            >
                              {issue.status}
                            </Lozenge>

                            {/* Risk Badges */}
                            {isStale && (
                              <Lozenge appearance="removed">⚠️ Stale</Lozenge>
                            )}
                            {isUnestimated && (
                              <Lozenge appearance="moved">0 SP</Lozenge>
                            )}
                            {isHighPriority && (
                              <Lozenge appearance="removed">High</Lozenge>
                            )}

                            <Text><Em>{formatRelativeTime(issue.updated)}</Em></Text>
                          </Inline>
                        </Inline>
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <EmptyState
                  header="No recent activity"
                  description="No issues have been updated in this sprint yet."
                />
              )}

              {/* Bottom Summary Bar */}
              <Inline space="space.100" wrap="wrap">
                <Text><Em>Showing {recentActivities.length} most active sprint items</Em></Text>
                {kpis.staleCount > 0 && (
                  <Lozenge appearance="removed">{`⚠️ ${kpis.staleCount} Stale Issues Alert`}</Lozenge>
                )}
              </Inline>
            </Stack>
          </Box>
        </Inline>

        {/* ════════════════════════════════════════════════════
         *  ROW 3: Types of Work (50%) + Team Capacity (50%)
         * ════════════════════════════════════════════════════ */}
        <Inline space="space.200" spread="space-between" alignBlock="stretch">
          
          {/* WIDGET 3: Types of Work & Effort Allocation (Horizontal Bars) */}
          <Box xcss={chartCardHalfStyle}>
            <Stack space="space.150">
              <Inline spread="space-between" alignBlock="center">
                <Heading as="h3">🧩 Types of Work & Effort</Heading>
                <Lozenge appearance={kpis.bugRatio > 25 ? 'removed' : 'success'}>
                  {`Bug Density: ${kpis.bugRatio}%`}
                </Lozenge>
              </Inline>
              <Text>
                Composition of work items weighted by count and estimated Story Points.
              </Text>

              {rawTypes.length > 0 ? (
                <Stack space="space.100">
                  {rawTypes.map((t, idx) => {
                    const totalCount = kpis.totalIssues || 1;
                    const pct = Math.round((t.value / totalCount) * 100);
                    const isBug = t.name.toLowerCase().includes('bug');
                    const points = t.storyPoints || 0;

                    return (
                      <Stack key={`type-row-${idx}`} space="space.025">
                        <Inline spread="space-between" alignBlock="center">
                          <Inline space="space.050" alignBlock="center">
                            <Text>{getTypeIcon(t.name)}</Text>
                            <Text><Strong>{t.name}</Strong></Text>
                          </Inline>
                          <Inline space="space.050" alignBlock="center">
                            <Text>{`${t.value} issues · ${points} SP (${pct}%)`}</Text>
                          </Inline>
                        </Inline>
                        <ProgressBar
                          value={pct / 100}
                          appearance={isBug ? 'danger' : 'success'}
                        />
                      </Stack>
                    );
                  })}
                </Stack>
              ) : (
                <EmptyState
                  header="No issue types"
                  description="No issue type data available in this scope."
                />
              )}

              {/* Bottom Quick Footers */}
              <Inline space="space.100" wrap="wrap">
                <Lozenge appearance="default">{`${rawTypes.length} distinct work types`}</Lozenge>
                <Lozenge appearance={kpis.bugRatio > 25 ? 'removed' : 'success'}>
                  {kpis.bugRatio > 25 ? '⚠️ Elevated Defect Rate' : '🎯 Quality on Target'}
                </Lozenge>
              </Inline>
            </Stack>
          </Box>

          {/* WIDGET 4: Team Capacity & Workload Balance (Horizontal Bars) */}
          <Box xcss={chartCardHalfStyle}>
            <Stack space="space.150">
              <Inline spread="space-between" alignBlock="center">
                <Heading as="h3">👥 Team Capacity & Workload Balance</Heading>
                <Badge appearance="default">{`${activeMembers.length} Active Members`}</Badge>
              </Inline>
              <Text>
                Developer bandwidth allocation and capacity bottleneck prevention.
              </Text>

              {activeMembers.length > 0 ? (
                <Stack space="space.100">
                  {activeMembers.slice(0, 5).map((m, idx) => {
                    const capacityStatus =
                      metricMode === 'points' ? m.capacityStatusPoints : m.capacityStatusHours;
                    const totalPoints = m.totalPoints || 0;
                    const completedPoints = m.completedPoints || 0;
                    const totalSprintPoints = kpis.totalStoryPoints || 1;
                    const sharePct = Math.round((totalPoints / totalSprintPoints) * 100);

                    return (
                      <Stack key={`member-row-${idx}`} space="space.025">
                        <Inline spread="space-between" alignBlock="center">
                          <Inline space="space.050" alignBlock="center">
                            <Badge appearance="primary">{getInitials(m.name)}</Badge>
                            <Text><Strong>{m.name}</Strong></Text>
                          </Inline>
                          <Inline space="space.050" alignBlock="center">
                            <Text>{`${totalPoints} SP (${sharePct}% of sprint) · ${m.completedIssues}/${m.totalIssues} done`}</Text>
                            <Lozenge
                              appearance={
                                capacityStatus === 'Heavy'
                                  ? 'removed'
                                  : capacityStatus === 'Unestimated'
                                  ? 'moved'
                                  : 'success'
                              }
                            >
                              {capacityStatus}
                            </Lozenge>
                          </Inline>
                        </Inline>
                        <ProgressBar
                          value={Math.min(1, m.completionRate / 100)}
                          appearance={capacityStatus === 'Heavy' ? 'danger' : 'inprogress'}
                        />
                      </Stack>
                    );
                  })}
                </Stack>
              ) : (
                <EmptyState
                  header="No team assignments"
                  description="No issues are assigned to team members in this scope."
                />
              )}

              {/* Bottom Quick Footers */}
              <Inline space="space.100" wrap="wrap">
                <Lozenge appearance="default">{`👥 ${activeMembers.length} Team Members`}</Lozenge>
                <Lozenge appearance={kpis.unassignedCount > 0 ? 'removed' : 'success'}>
                  {kpis.unassignedCount > 0 ? `⚠️ ${kpis.unassignedCount} Unassigned Issues` : '🎯 All Work Assigned'}
                </Lozenge>
              </Inline>
            </Stack>
          </Box>
        </Inline>

      </Stack>
    </Box>
  );
};
