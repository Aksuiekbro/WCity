# PRD 5 — Robustness, Equity Analytics & Research Extensions

## 1. Overview
Provide advanced analytics—scenario stress tests, climate-adjusted planning, and research sandboxes—needed by municipal strategists and academic partners to trust long-term recommendations.

## 2. Problem Statement
Single-scenario outputs ignore uncertainty (population growth, climate change, demand shocks). Without robustness metrics (regret, worst-case, sensitivity) and scenario tooling, the platform cannot support strategic plans or academic collaborations (e.g., MBZUAI research).

## 3. Target Users
- Research teams evaluating fairness and robustness of allocation policies.
- Municipal strategists planning staged deployments over a decade.
- NGOs assessing resilience of interventions under extreme events.

## 4. Objectives
1. Run multi-scenario stress tests automatically and visualize robustness metrics per site/scenario.
2. Incorporate climate projections and demand shocks into hazard/demand layers.
3. Offer experimental tooling (robust optimization, reinforcement learning prototypes) for research extensions.

## 5. Functional Requirements
- **Scenario generator**: Library of predefined futures (population +20%, heatwave frequency +50%, major bridge outage, epidemic demand spike) configurable via UI/CLI.
- **Batch optimization runner**: Execute optimization jobs across scenarios; persist outputs, compute regret vs. scenario-optimal baseline.
- **Robustness dashboards**: Heatmaps showing per-site performance across scenarios, worst-case metrics, sensitivity bars.
- **Climate-adjusted layers**: Integrate CMIP6 downscaled temperature/precipitation (2030/2050) and recompute hazard layers (heat, flood trends).
- **Multi-period planning**: Allow staged investments (Year 0/5/10 budgets) with intertemporal constraints.
- **Research sandbox APIs**: Expose anonymized benchmark datasets + solver hooks for experimentation (RL, heuristics, robust optimization).

## 6. Service Replacement Mapping
| Current Capability | Limitation | Upgrade / Service | Notes |
|--------------------|------------|-------------------|-------|
| Single-run optimization | No uncertainty handling | **ScenarioBatchService** orchestrating multi-scenario runs + regret metrics | Uses job queue (e.g., BullMQ) + worker pool |
| Static climate layers | No future projections | Integrate **CMIP6 downscaled** datasets via CDS/ESGF, derive delta layers | Blend with existing rasters for future hazard maps |
| No research hooks | Difficult to collaborate with universities | **ResearchSandbox API** exposing datasets + baseline solvers | Include documentation + example notebooks |

## 7. Success Metrics
- Ability to evaluate ≥5 scenarios per plan and surface sites robust in ≥80% of futures.
- Export-ready robustness report (charts, metrics) auto-generated for at least one pilot partner.
- At least one research partner (e.g., MBZUAI) runs experiments via sandbox API.

## 8. Timeline & Resources
- Requires PRDs 1–4. Estimated 6–12 months with 2 engineers + 1 researcher.
- Milestones: (1) Scenario generator + batch runner, (2) climate-adjusted layers, (3) robustness dashboards + research sandbox.

## 9. Risks & Mitigations
- **Computation cost** → Use queue-based batch jobs, allow downsampling for exploratory runs.
- **Climate data volume** → Clip to AOIs, store as deltas vs. baseline to reduce size.
- **RL/advanced methods uncertainty** → Keep traditional OR-Tools baseline as fallback; treat RL as experimental feature flag.
