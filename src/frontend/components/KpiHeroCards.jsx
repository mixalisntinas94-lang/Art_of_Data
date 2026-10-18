import React from 'react';
import {
  Box,
  Stack,
  Inline,
  Heading,
  Text,
  Lozenge,
  ProgressBar,
  Strong,
  Em,
} from '@forge/react';
import { kpiCardStyle } from '../styles';

/**
 * Executive KPI Hero Cards
 * Designed with a clean, high-contrast, clutter-free aesthetic.
 * Removed repetitive emojis and verbose sub-prompts in favor of crisp enterprise metrics.
 */
export const KpiHeroCards = ({
  kpis,
  metricMode,
  analytics,
  selectedSprint,
  lastRefreshed,
}) => {
  if (!kpis) return null;

  const isSprintScoped = selectedSprint !== 'all' && selectedSprint !== 'backlog';
  const activeMembersCount = (analytics?.teamMembers || []).filter((m) => m.name !== 'Unassigned').length;

  return (
    <Inline space="space.150" spread="space-between" alignBlock="stretch">
      {/* Card 1: Completion Rate */}
      <Box xcss={kpiCardStyle}>
        <Stack space="space.100">
          <Inline spread="space-between" alignBlock="center">
            <Text><Strong>{isSprintScoped ? 'SPRINT COMPLETION' : 'OVERALL COMPLETION'}</Strong></Text>
            <Lozenge
              appearance={
                kpis.completionRate === 100
                  ? 'success'
                  : kpis.completionRate >= 50
                  ? 'inprogress'
                  : 'default'
              }
            >
              {kpis.completionRate === 100 ? 'Done' : kpis.completionRate >= 50 ? 'On Track' : 'Active'}
            </Lozenge>
          </Inline>
          <Heading as="h1">{`${kpis.completionRate}%`}</Heading>
          <ProgressBar
            value={kpis.completionRate / 100}
            appearance="success"
          />
          <Text>
            <Strong>{kpis.completedCount}</Strong> of <Strong>{kpis.totalIssues}</Strong> issues completed
          </Text>
        </Stack>
      </Box>

      {/* Card 2: Sprint Velocity / Delivered Effort */}
      <Box xcss={kpiCardStyle}>
        <Stack space="space.100">
          <Inline spread="space-between" alignBlock="center">
            <Text><Strong>{metricMode === 'hours' ? 'LOGGED EFFORT' : 'DELIVERED VELOCITY'}</Strong></Text>
            <Lozenge appearance="inprogress">
              {metricMode === 'hours' ? 'Hours' : 'Story Points'}
            </Lozenge>
          </Inline>
          <Heading as="h1">
            {metricMode === 'hours'
              ? `${kpis.totalLoggedHours}h`
              : `${kpis.completedStoryPoints} SP`}
          </Heading>
          <Text>
            {metricMode === 'hours'
              ? `${kpis.totalRemainingHours}h remaining · Total ${kpis.totalEstimatedHours}h`
              : `${kpis.completedStoryPoints} of ${kpis.totalStoryPoints} SP · ${kpis.remainingStoryPoints} SP left`}
          </Text>
        </Stack>
      </Box>

      {/* Card 3: Quality & Bug Ratio */}
      <Box xcss={kpiCardStyle}>
        <Stack space="space.100">
          <Inline spread="space-between" alignBlock="center">
            <Text><Strong>DEFECT DENSITY</Strong></Text>
            <Lozenge appearance={kpis.bugRatio > 25 ? 'removed' : kpis.bugRatio > 10 ? 'moved' : 'success'}>
              {kpis.bugRatio > 25 ? 'High Risk' : kpis.bugRatio > 10 ? 'Elevated' : 'Optimal'}
            </Lozenge>
          </Inline>
          <Heading as="h1">{`${kpis.bugRatio}%`}</Heading>
          <Text>
            <Strong>{kpis.bugCount}</Strong> active bugs · <Strong>{kpis.staleCount}</Strong> stale tickets
          </Text>
        </Stack>
      </Box>

      {/* Card 4: Scope & Estimation Health */}
      <Box xcss={kpiCardStyle}>
        <Stack space="space.100">
          <Inline spread="space-between" alignBlock="center">
            <Text><Strong>SCOPE DELIVERED</Strong></Text>
            <Lozenge appearance={kpis.completedStoryPoints >= kpis.totalStoryPoints * 0.75 ? 'success' : 'default'}>
              {kpis.completedStoryPoints >= kpis.totalStoryPoints * 0.75 ? 'Near Target' : 'Underway'}
            </Lozenge>
          </Inline>
          <Heading as="h1">
            {metricMode === 'hours'
              ? `${kpis.totalLoggedHours} / ${kpis.totalEstimatedHours}h`
              : `${kpis.completedStoryPoints} / ${kpis.totalStoryPoints} SP`}
          </Heading>
          <ProgressBar
            value={
              metricMode === 'hours'
                ? kpis.totalEstimatedHours > 0 ? kpis.totalLoggedHours / kpis.totalEstimatedHours : 0
                : kpis.totalStoryPoints > 0 ? kpis.completedStoryPoints / kpis.totalStoryPoints : 0
            }
            appearance="success"
          />
          <Text>
            {kpis.unestimatedPointsCount > 0
              ? `${kpis.unestimatedPointsCount} unestimated issues`
              : '100% of issues estimated'}
          </Text>
        </Stack>
      </Box>

      {/* Card 5: Average Cycle Time */}
      <Box xcss={kpiCardStyle}>
        <Stack space="space.100">
          <Inline spread="space-between" alignBlock="center">
            <Text><Strong>CYCLE TIME</Strong></Text>
            <Lozenge appearance="default">Lead Time</Lozenge>
          </Inline>
          <Heading as="h1">
            {kpis.avgCycleTimeDays !== null && kpis.avgCycleTimeDays > 0 ? `${kpis.avgCycleTimeDays}d` : 'N/A'}
          </Heading>
          <Text>
            {activeMembersCount > 0
              ? `${activeMembersCount} active contributor${activeMembersCount !== 1 ? 's' : ''}`
              : 'No assigned contributors'}
          </Text>
        </Stack>
      </Box>
    </Inline>
  );
};
