import React from 'react';
import {
  Box,
  Stack,
  Heading,
  Text,
  DynamicTable,
  EmptyState,
} from '@forge/react';
import { sectionCardStyle } from '../../styles';

export const IssueExplorerTab = ({
  analytics,
  metricMode,
  selectedProject,
  explorerTableRows,
}) => {
  if (!analytics) return null;

  return (
    <Box padding="space.100">
      <Box xcss={sectionCardStyle}>
        <Stack space="space.200">
          <Heading as="h3">📋 Project Issue Explorer</Heading>
          <Text>
            Recent active issues with{' '}
            {metricMode === 'points' ? 'Story Point estimates' : 'Hours logged & estimated'}{' '}
            for {selectedProject?.name}.
          </Text>

          {analytics.recentIssues && analytics.recentIssues.length > 0 ? (
            <DynamicTable
              caption="Recent Issues Drill-down"
              head={{
                cells: [
                  { key: 'key', content: 'Key' },
                  { key: 'type', content: 'Type' },
                  { key: 'summary', content: 'Summary' },
                  { key: 'status', content: 'Status' },
                  { key: 'priority', content: 'Priority' },
                  { key: 'assignee', content: 'Assignee' },
                  {
                    key: 'metric',
                    content:
                      metricMode === 'points' ? 'Story Points' : 'Est / Spent (Hours)',
                  },
                ],
              }}
              rows={explorerTableRows}
            />
          ) : (
            <EmptyState
              header="No Issues Found"
              description="No issues match the current search or filter criteria."
            />
          )}
        </Stack>
      </Box>
    </Box>
  );
};
