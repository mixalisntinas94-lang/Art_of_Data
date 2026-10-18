import React from 'react';
import {
  Box,
  Stack,
  Heading,
  Text,
  DynamicTable,
  SectionMessage,
} from '@forge/react';
import { sectionCardStyle } from '../../styles';

export const BottlenecksTab = ({ analytics, staleTableRows }) => {
  if (!analytics) return null;

  return (
    <Box padding="space.100">
      <Box xcss={sectionCardStyle}>
        <Stack space="space.200">
          <Stack space="space.050">
            <Heading as="h3">⚠️ Bottleneck Detector & Stale Tickets</Heading>
            <Text>
              Tickets in open or in-progress statuses with no updates for ≥ 4 days are
              flagged as potential blockers.
            </Text>
          </Stack>

          {analytics.staleIssues && analytics.staleIssues.length > 0 ? (
            <>
              <SectionMessage appearance="warning" title="Action Recommended">
                <Text>
                  {analytics.staleIssues.length} tickets appear stalled. Review them in
                  daily standup to unblock team members.
                </Text>
              </SectionMessage>

              <DynamicTable
                caption="Stalled & Inactive Tickets"
                head={{
                  cells: [
                    { key: 'key', content: 'Key', isSortable: true },
                    { key: 'summary', content: 'Summary' },
                    { key: 'status', content: 'Status' },
                    { key: 'priority', content: 'Priority' },
                    { key: 'assignee', content: 'Assignee' },
                    { key: 'inactive', content: 'Inactivity Alert', isSortable: true },
                  ],
                }}
                rows={staleTableRows}
              />
            </>
          ) : (
            <SectionMessage appearance="confirmation" title="Smooth Flow">
              <Text>
                🎉 Outstanding! No stale or blocked issues detected with the current filters.
              </Text>
            </SectionMessage>
          )}
        </Stack>
      </Box>
    </Box>
  );
};
