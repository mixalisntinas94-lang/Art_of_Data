# Art of Data - Architecture

## Overview
Art of Data is an Atlassian Forge application built specifically for Jira. It provides advanced analytics, dynamic dashboards, and deep agile insights using Forge UI Kit.

## Technical Stack
- **Platform**: Atlassian Forge
- **Frontend**: Forge UI Kit (React-like component structure, restricted to native Atlassian components)
- **Backend (Resolvers)**: Node.js / Forge FaaS
- **Data Source**: Jira REST API (JQL)

## Application Structure
- `manifest.yml`: The blueprint of the app. Defines modules (Global Page), permissions (scopes), and environment requirements.
- `src/frontend/index.jsx`: The entire UI layer. Responsible for state management, rendering charts (BarChart, PieChart, LineChart), dynamic tables, and the Custom Analytics Engine. 
- `src/resolvers/index.js`: The backend API layer. Uses `requestJira` from `@forge/bridge` to fetch data securely from the user's Jira instance.

## Key Design Decisions & Constraints
- **UI Kit Limitation**: The app strictly adheres to Atlassian UI Kit (`@forge/ui` is deprecated, using `@forge/react`). Custom UI (HTML/CSS/D3.js) is not used, which enforces a standard Atlassian look and feel and guarantees long-term compatibility, while maintaining a competitive moat via advanced backend logic and dynamic state management.
- **Single Fetch Pattern**: To minimize API rate limiting and loading times, the resolver fetches all relevant issues upfront (paginated) and sends a `rawIssues` array to the frontend. All filtering, grouping, and metrics calculations happen client-side in real-time.
