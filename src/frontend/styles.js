import { xcss } from '@forge/react';

/**
 * Modern Design Tokens & Card Styles
 * Powered by Atlassian Design System tokens for flawless Light and Dark mode rendering.
 */
export const kpiCardStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.large',
  padding: 'space.200',
  boxShadow: 'elevation.shadow.raised',
  flexGrow: 1,
  width: '19%',
});

export const sectionCardStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.large',
  padding: 'space.250',
  boxShadow: 'elevation.shadow.raised',
});

export const fullWidthBoxStyle = xcss({
  width: '100%',
});

export const chartCardHalfStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.large',
  padding: 'space.250',
  boxShadow: 'elevation.shadow.raised',
  flexGrow: 1,
  width: '49%',
});

export const chartCardWideStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.large',
  padding: 'space.250',
  boxShadow: 'elevation.shadow.raised',
  flexGrow: 1,
  width: '100%',
});

export const headerContainerStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.large',
  padding: 'space.200',
  boxShadow: 'elevation.shadow.raised',
});

export const filterToolbarStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.large',
  padding: 'space.150',
  boxShadow: 'elevation.shadow.raised',
});

export const filterPanelContainerStyle = xcss({
  backgroundColor: 'elevation.surface.overlay',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.large',
  padding: 'space.200',
  boxShadow: 'elevation.shadow.overlay',
  maxWidth: '680px',
  width: '100%',
});

export const filterLeftColStyle = xcss({
  borderColor: 'color.border',
  borderRightWidth: 'border.width',
  borderRightStyle: 'solid',
  paddingRight: 'space.150',
  minWidth: '200px',
  maxWidth: '200px',
});

export const filterRightColStyle = xcss({
  paddingLeft: 'space.200',
  flexGrow: 1,
  minHeight: '260px',
});

export const filterFooterStyle = xcss({
  borderColor: 'color.border',
  borderTopWidth: 'border.width',
  borderTopStyle: 'solid',
  paddingTop: 'space.100',
  marginTop: 'space.150',
});

export const filterCodeEditorBoxStyle = xcss({
  backgroundColor: 'elevation.surface.sunken',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.medium',
  padding: 'space.150',
});

export const filterSavedMenuBoxStyle = xcss({
  backgroundColor: 'elevation.surface.overlay',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.medium',
  padding: 'space.150',
  boxShadow: 'elevation.shadow.overlay',
  maxWidth: '280px',
  width: '100%',
});

export const filterClauseRowStyle = xcss({
  backgroundColor: 'elevation.surface.sunken',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.medium',
  padding: 'space.100',
});

export const verdictCardStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.large',
  padding: 'space.200',
  boxShadow: 'elevation.shadow.raised',
});

export const activityRowStyle = xcss({
  backgroundColor: 'elevation.surface.sunken',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.medium',
  padding: 'space.100',
});

// Helper for Status Lozenge appearances
export const getStatusAppearance = (statusCategory) => {
  switch (statusCategory) {
    case 'done':
      return 'success';
    case 'indeterminate':
      return 'inprogress';
    case 'new':
    default:
      return 'default';
  }
};

// Helper for Capacity Lozenge
export const getCapacityAppearance = (status) => {
  switch (status) {
    case 'Optimal':
      return 'success';
    case 'Heavy':
      return 'removed';
    case 'Unestimated':
      return 'moved';
    default:
      return 'default';
  }
};

// Helper for Priority Lozenge
export const getPriorityAppearance = (priority) => {
  const p = (priority || '').toLowerCase();
  if (p.includes('highest') || p.includes('high') || p.includes('blocker') || p.includes('critical')) {
    return 'removed';
  }
  if (p.includes('medium')) {
    return 'inprogress';
  }
  return 'default';
};
