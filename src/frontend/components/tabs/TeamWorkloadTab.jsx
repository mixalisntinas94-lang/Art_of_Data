import React from 'react';
import {
  Box,
  Stack,
  Inline,
  Heading,
  Text,
  DynamicTable,
  EmptyState,
} from '@forge/react';
import { sectionCardStyle } from '../../styles';

export const TeamWorkloadTab = ({ analytics, metricMode, teamTableRows }) => {
  if (!analytics) return null;

  return (
    <Box padding="space.100">
      <Box xcss={sectionCardStyle}>
        <Stack space="space.200">
          <Inline spread="space-between" alignBlock="center">
            <Stack space="space.050">
              <Heading as="h3">
                👥 Team Workload &{' '}
                {metricMode === 'points' ? 'Story Points' : 'Hours'} Capacity Balancer
              </Heading>
              <Text>
                {metricMode === 'points'
                  ? 'Track active issue distribution and estimated Story Points per team member to prevent developer burnout.'
                  : 'Track active issue distribution and estimated hours per team member to prevent developer burnout.'}
              </Text>
            </Stack>
          </Inline>

          {(analytics.teamMembers || []).length > 0 ? (
            <DynamicTable
              caption={
                metricMode === 'points'
                  ? 'Team Story Points Allocation'
                  : 'Team Hours Allocation'
              }
              head={{
                cells: [
                  { key: 'name', content: 'Team Member', isSortable: true },
                  { key: 'total', content: 'Assigned Issues', isSortable: true },
                  { key: 'completed', content: 'Completed' },
                  {
                    key: 'metrics',
                    content:
                      metricMode === 'points'
                        ? 'Story Points (Done / Total)'
                        : 'Effort (Spent / Est. Hours)',
                  },
                  { key: 'capacity', content: 'Capacity Status' },
                ],
              }}
              rows={teamTableRows}
            />
          ) : (
            <EmptyState
              header="No Team Members Found"
              description="No assignees match the current filters in this project."
            />
          )}
        </Stack>
      </Box>
    </Box>
  );
};
