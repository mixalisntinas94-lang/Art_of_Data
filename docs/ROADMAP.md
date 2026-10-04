# Art of Data - Product Roadmap

## Current Status
- ✅ Basic Agile Metrics (Sprint progress, Bugs, Cycle time)
- ✅ Dynamic Dashboard (Filtering and Grouping)
- ✅ Custom Analytics Engine (Power BI-style widget builder within UI Kit limits)

## Next Steps (Short-term)
1. **Persistent Custom Dashboards**
   - **Goal:** Allow users to save their Custom Analytics widgets so they persist across sessions.
   - **Tech:** Implement Forge Storage API (Entity Properties) to save the `customWidgets` array per user or per project.
2. **Interactive Drill-downs**
   - **Goal:** Enhance the data tables so users can click on a specific metric and see exactly which tickets comprise it, ideally via a Modal window.

## Future Vision (Mid to Long-term)
1. **Advanced Math & Forecasting**
   - Implement Monte Carlo simulations for accurate Sprint completion forecasting.
   - Develop Bottleneck Detection algorithms to identify stages where tickets stall the most.
2. **AI-Assisted Insights (Atlassian Intelligence integration)**
   - Automatically generate text summaries of sprint health using LLMs based on the raw metrics.
