/**
 * Semantic Color Mapping & Visual Cues Engine (Data Storytelling)
 *
 * Implements strict Jira semantic color codes:
 * - Status: Done = Emerald/Teal, In Progress = Blue, To Do = Slate Grey
 * - Priority: Highest = Red, High = Orange, Medium = Amber Yellow, Low = Cyan, Lowest = Slate
 * - Issue Type: Bug = Crimson Alert Gradient, Story = Purple, Task = Sky Blue, Epic = Magenta
 * - Avatars & Icons: Authentic Atlassian SVG data URIs for ECharts rich labels & HTML tags
 */

// Helper to convert raw SVG to data URI for ECharts & CSS
function svgToDataUri(svgString) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString);
}

// ── 1. OFFICIAL ATLASSIAN ICONS (SVG DATA URIS) ──
export const JIRA_ICONS = {
  // Issue Types
  bug: svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
      <rect width="24" height="24" rx="5" fill="#e5493a"/>
      <path d="M12 6a3.5 3.5 0 0 0-3.5 3.5v.5h7v-.5A3.5 3.5 0 0 0 12 6zm-5 6v1a5 5 0 0 0 10 0v-1H7zm-2-1h2v-1.5a.5.5 0 0 1 .5-.5h.5V7.5A4.5 4.5 0 0 1 12 3a4.5 4.5 0 0 1 4 4.5V8h.5a.5.5 0 0 1 .5.5V11h2a1 1 0 1 1 0 2h-2v1a7 7 0 0 1-4 6.32V21a1 1 0 1 1-2 0v-.68A7 7 0 0 1 7 14v-1H5a1 1 0 1 1 0-2z" fill="#ffffff"/>
    </svg>`
  ),
  story: svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
      <rect width="24" height="24" rx="5" fill="#36b37e"/>
      <path d="M7 5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15.5l-5-3.2-5 3.2V5z" fill="#ffffff"/>
    </svg>`
  ),
  task: svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
      <rect width="24" height="24" rx="5" fill="#4bade8"/>
      <path d="M10.2 15.2l-2.6-2.6a.9.9 0 0 0-1.2 1.2l3.2 3.2a.9.9 0 0 0 1.2 0l6.2-6.2a.9.9 0 0 0-1.2-1.2l-5.6 5.6z" fill="#ffffff"/>
    </svg>`
  ),
  epic: svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
      <rect width="24" height="24" rx="5" fill="#904ee2"/>
      <path d="M13.5 3L6 13h5.5l-2.5 8 9-11h-5.5l2.5-7z" fill="#ffffff"/>
    </svg>`
  ),
  subtask: svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
      <rect width="24" height="24" rx="5" fill="#00c7e5"/>
      <path d="M11 7h6a1 1 0 0 1 1 1v6a1 1 0 0 1-2 0v-4.6l-5.3 5.3a1 1 0 0 1-1.4-1.4L14.6 8H10a1 1 0 0 1 0-2h1z" fill="#ffffff"/>
    </svg>`
  ),

  // Priorities (Official Jira Arrows)
  highest: svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
      <path d="M8 1l-5 5h3v3h4V6h3L8 1zm0 6l-3 3h2v4h2v-4h2l-3-3z" fill="#ef4444"/>
    </svg>`
  ),
  high: svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
      <path d="M8 2l-5.5 6.5h3.5v6.5h4V8.5h3.5L8 2z" fill="#f97316"/>
    </svg>`
  ),
  medium: svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
      <rect x="2.5" y="4.5" width="11" height="2.8" rx="1.2" fill="#eab308"/>
      <rect x="2.5" y="9.2" width="11" height="2.8" rx="1.2" fill="#eab308"/>
    </svg>`
  ),
  low: svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
      <path d="M8 14l5.5-6.5h-3.5V1h-4v6.5H2.5L8 14z" fill="#06b6d4"/>
    </svg>`
  ),
  lowest: svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
      <path d="M8 15l-5-5h3v-3h4v3h3l-5 5zm0-6l-3-3h2V2h2v4h2l-3 3z" fill="#94a3b8"/>
    </svg>`
  ),

  // Statuses
  done: svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
      <circle cx="8" cy="8" r="7.5" fill="#10b981"/>
      <path d="M5 8l2 2 4.2-4.2" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`
  ),
  in_progress: svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
      <circle cx="8" cy="8" r="7" fill="#1e3a8a" stroke="#3b82f6" stroke-width="1.5"/>
      <path d="M8 1a7 7 0 0 1 7 7h-7V1z" fill="#3b82f6"/>
    </svg>`
  ),
  todo: svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
      <circle cx="8" cy="8" r="6.5" fill="#1e293b" stroke="#64748b" stroke-width="1.8"/>
      <circle cx="8" cy="8" r="2.2" fill="#64748b"/>
    </svg>`
  ),

  // Default User Avatar Silhouette
  unassigned: svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
      <circle cx="12" cy="12" r="11" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
      <circle cx="12" cy="8.5" r="3.5" fill="#64748b"/>
      <path d="M5.5 19.5c.8-3.5 3.5-5 6.5-5s5.7 1.5 6.5 5" fill="#64748b"/>
    </svg>`
  ),
};

/**
 * Creates an avatar SVG data URI with user initials
 */
export function getInitialsAvatar(name = 'User') {
  if (!name || name.toLowerCase() === 'unassigned') {
    return JIRA_ICONS.unassigned;
  }
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();

  // Pick deterministic palette
  const colors = [
    ['#3b82f6', '#1d4ed8'],
    ['#8b5cf6', '#6d28d9'],
    ['#06b6d4', '#0e7490'],
    ['#10b981', '#047857'],
    ['#f59e0b', '#b45309'],
    ['#ec4899', '#be185d'],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const color = colors[Math.abs(hash) % colors.length];

  return svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="20" height="20">
      <defs>
        <linearGradient id="g_${Math.abs(hash)}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${color[0]}"/>
          <stop offset="100%" stop-color="${color[1]}"/>
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#g_${Math.abs(hash)})" stroke="#0f172a" stroke-width="2"/>
      <text x="16" y="20.5" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">${initials}</text>
    </svg>`
  );
}

// ── 2. SEMANTIC COLOR DICTIONARY ──
export const COLOR_DICTIONARY = {
  // Status Colors
  status: {
    'done': {
      color: '#10b981', // Emerald / Teal
      gradient: ['#10b981', '#064e3b'],
      bg: 'rgba(16, 185, 129, 0.15)',
      border: '#34d399',
    },
    'in progress': {
      color: '#3b82f6', // Electric Blue
      gradient: ['#3b82f6', '#1e3a8a'],
      bg: 'rgba(59, 130, 246, 0.15)',
      border: '#60a5fa',
    },
    'to do': {
      color: '#64748b', // Slate Grey
      gradient: ['#64748b', '#1e293b'],
      bg: 'rgba(100, 116, 139, 0.15)',
      border: '#94a3b8',
    },
    'backlog': {
      color: '#475569',
      gradient: ['#475569', '#0f172a'],
      bg: 'rgba(71, 85, 105, 0.15)',
      border: '#64748b',
    },
  },

  // Priority Colors
  priority: {
    'highest': {
      color: '#ef4444', // Red Danger
      gradient: ['#ef4444', '#7f1d1d'],
      bg: 'rgba(239, 68, 68, 0.2)',
      border: '#f87171',
    },
    'high': {
      color: '#f97316', // Orange Warning
      gradient: ['#f97316', '#7c2d12'],
      bg: 'rgba(249, 115, 22, 0.2)',
      border: '#fb923c',
    },
    'medium': {
      color: '#eab308', // Amber / Yellow
      gradient: ['#eab308', '#713f12'],
      bg: 'rgba(234, 179, 8, 0.18)',
      border: '#facc15',
    },
    'low': {
      color: '#06b6d4', // Cyan
      gradient: ['#06b6d4', '#164e63'],
      bg: 'rgba(6, 182, 212, 0.15)',
      border: '#22d3ee',
    },
    'lowest': {
      color: '#94a3b8', // Slate
      gradient: ['#94a3b8', '#334155'],
      bg: 'rgba(148, 163, 184, 0.15)',
      border: '#cbd5e1',
    },
  },

  // Issue Type Colors
  type: {
    'bug': {
      color: '#f43f5e', // Red alert
      gradient: ['#f43f5e', '#881337'],
      bg: 'rgba(244, 63, 94, 0.22)',
      border: '#fda4af',
    },
    'story': {
      color: '#8b5cf6', // Indigo / Purple
      gradient: ['#8b5cf6', '#312e81'],
      bg: 'rgba(139, 92, 246, 0.18)',
      border: '#c4b5fd',
    },
    'task': {
      color: '#0ea5e9', // Sky Blue
      gradient: ['#0ea5e9', '#0c4a6e'],
      bg: 'rgba(14, 165, 233, 0.18)',
      border: '#7dd3fc',
    },
    'epic': {
      color: '#d946ef', // Magenta
      gradient: ['#d946ef', '#701a75'],
      bg: 'rgba(217, 70, 239, 0.18)',
      border: '#f0abfc',
    },
    'sub-task': {
      color: '#38bdf8',
      gradient: ['#38bdf8', '#0369a1'],
      bg: 'rgba(56, 189, 248, 0.15)',
      border: '#bae6fd',
    },
    'subtask': {
      color: '#38bdf8',
      gradient: ['#38bdf8', '#0369a1'],
      bg: 'rgba(56, 189, 248, 0.15)',
      border: '#bae6fd',
    },
  },
};

/**
 * Returns the semantic color info for a given dimension and value
 */
export function getSemanticColor(dimension, value) {
  if (!value) return { color: '#64748b', gradient: ['#64748b', '#1e293b'], bg: 'rgba(100,116,139,0.1)' };
  const val = String(value).trim().toLowerCase();
  const dim = String(dimension).trim().toLowerCase();

  if (dim === 'status' || val.includes('done') || val.includes('progress') || val.includes('to do')) {
    if (val.includes('done')) return COLOR_DICTIONARY.status['done'];
    if (val.includes('progress')) return COLOR_DICTIONARY.status['in progress'];
    return COLOR_DICTIONARY.status['to do'];
  }

  if (dim === 'priority' || COLOR_DICTIONARY.priority[val]) {
    return COLOR_DICTIONARY.priority[val] || COLOR_DICTIONARY.priority['medium'];
  }

  if (dim === 'type' || COLOR_DICTIONARY.type[val]) {
    if (val.includes('bug')) return COLOR_DICTIONARY.type['bug'];
    if (val.includes('story')) return COLOR_DICTIONARY.type['story'];
    if (val.includes('task')) return COLOR_DICTIONARY.type['task'];
    if (val.includes('epic')) return COLOR_DICTIONARY.type['epic'];
    return COLOR_DICTIONARY.type[val] || { color: '#3b82f6', gradient: ['#3b82f6', '#1e3a8a'], bg: 'rgba(59,130,246,0.15)' };
  }

  // Fallback deterministic palette for Assignees and custom fields
  const fallbackPalettes = [
    { color: '#38bdf8', gradient: ['#38bdf8', '#0369a1'], bg: 'rgba(56, 189, 248, 0.15)' },
    { color: '#818cf8', gradient: ['#818cf8', '#3730a3'], bg: 'rgba(129, 140, 248, 0.15)' },
    { color: '#34d399', gradient: ['#34d399', '#065f46'], bg: 'rgba(52, 211, 153, 0.15)' },
    { color: '#fb923c', gradient: ['#fb923c', '#9a3412'], bg: 'rgba(251, 146, 60, 0.15)' },
    { color: '#f472b6', gradient: ['#f472b6', '#831843'], bg: 'rgba(244, 114, 182, 0.15)' },
    { color: '#a78bfa', gradient: ['#a78bfa', '#4c1d95'], bg: 'rgba(167, 139, 250, 0.15)' },
  ];
  let h = 0;
  for (let i = 0; i < val.length; i++) h = val.charCodeAt(i) + ((h << 5) - h);
  return fallbackPalettes[Math.abs(h) % fallbackPalettes.length];
}

/**
 * Returns the matching icon data URI for an item
 */
export function getSemanticIcon(dimension, value, issueMap = {}) {
  const val = String(value || '').trim().toLowerCase();
  const dim = String(dimension || '').trim().toLowerCase();

  if (dim === 'type') {
    if (val.includes('bug')) return JIRA_ICONS.bug;
    if (val.includes('story')) return JIRA_ICONS.story;
    if (val.includes('task')) return JIRA_ICONS.task;
    if (val.includes('epic')) return JIRA_ICONS.epic;
    if (val.includes('sub')) return JIRA_ICONS.subtask;
    return JIRA_ICONS.task;
  }

  if (dim === 'priority') {
    if (val.includes('highest')) return JIRA_ICONS.highest;
    if (val.includes('high')) return JIRA_ICONS.high;
    if (val.includes('medium')) return JIRA_ICONS.medium;
    if (val.includes('lowest')) return JIRA_ICONS.lowest;
    if (val.includes('low')) return JIRA_ICONS.low;
    return JIRA_ICONS.medium;
  }

  if (dim === 'status') {
    if (val.includes('done')) return JIRA_ICONS.done;
    if (val.includes('progress')) return JIRA_ICONS.in_progress;
    return JIRA_ICONS.todo;
  }

  if (dim === 'assignee') {
    // Check if an avatarUrl exists in the issueMap
    const avatar = issueMap[value];
    if (avatar && (avatar.startsWith('http') || avatar.startsWith('data:'))) {
      return avatar;
    }
    return getInitialsAvatar(value);
  }

  return null;
}

/**
 * Builds Apache ECharts rich text styles and formatter for category labels
 */
export function buildEchartsCategoryRich(categories = [], dimension = 'type', assigneeAvatarMap = {}) {
  const rich = {};
  const labelMap = {};

  categories.forEach((cat, index) => {
    const slug = `c_${index}`;
    const iconUri = getSemanticIcon(dimension, cat, assigneeAvatarMap);

    if (iconUri) {
      rich[slug] = {
        backgroundColor: {
          image: iconUri,
        },
        width: 15,
        height: 15,
        align: 'center',
        verticalAlign: 'middle',
      };
    }

    labelMap[cat] = slug;
  });

  rich.txt = {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 500,
    padding: [0, 0, 0, 4],
    verticalAlign: 'middle',
  };

  const formatter = function (val) {
    const slug = labelMap[val];
    if (slug && rich[slug]) {
      return `{${slug}|} {txt|${val}}`;
    }
    return `{txt|${val}}`;
  };

  return { rich, formatter };
}
