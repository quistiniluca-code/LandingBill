# ECON V2 — Calculation audit

Branch: `v2-offline-savings`

## Purpose
Validate the preliminary savings engine before production. These values are not customer promises; they are QA scenarios for checking monotonicity, double-counting and order of magnitude.

## Current draft assumptions
- Fallback all-in electricity cost: 0.31 €/kWh
- Variable-cost share used by the current calculator: 78%
- Draft PUN reference: 0.198 €/kWh
- Draft target procurement spread: 0.010–0.025 €/kWh
- Target variable price: 0.208–0.223 €/kWh
- PV yield: 1,150 kWh/kWp/year
- Minimum preliminary PV size: 3 kWp
- Residential cap: 10 kWp
- Self-consumption range: 60–80%
- CER/export value draft range: 0.08–0.12 €/kWh

## QA scenarios — manual spend path
Assuming: house, owner, no existing PV, roof available.

| Monthly spend band proxy | Estimated annual consumption | PV size approx. | Purchase saving | PV saving | Total preliminary range |
|---:|---:|---:|---:|---:|---:|
| €45/mo | 1,742 kWh | 3.0 kWp | €0–0 | €558–626 | €558–626 |
| €80/mo | 3,097 kWh | 3.0 kWp | €6–35 | €556–833 | €562–868 |
| €125/mo | 4,839 kWh | 4.2 kWp | €18–65 | €779–1,168 | €798–1,234 |
| €200/mo | 7,742 kWh | 6.7 kWp | €29–105 | €1,247–1,869 | €1,276–1,974 |
| €300/mo | 11,613 kWh | 10.0 kWp cap | €45–159 | €1,852–2,777 | €1,898–2,936 |

## Checks passed conceptually
1. Procurement saving is applied only to residual grid purchases after estimated self-consumption.
2. PV and procurement savings are not simply calculated independently on the same full consumption.
3. Results are shown as ranges, not false point estimates.
4. If PV is not applicable, the engine keeps the procurement path available.
5. `BILL / FV / DUAL / NURTURE` remains internal and is not shown as a public score.

## Blocking items before production
- Replace the draft PUN benchmark with the operational ECON benchmark approved for the launch period.
- Validate whether CER value should represent only incentive/shared-energy remuneration, export energy value, or a combined proxy; do not mix these without an explicit model.
- Validate the all-in-to-variable-cost decomposition against a representative sample of real residential bills.
- Add real bill parsing and confirmation before treating uploaded-bill values as `REAL_BILL`.
- Link the definitive privacy notice.

## Recommended validation sample
Before merge, test at least 10 real anonymized bills covering low, medium and high consumption, including a case with an already competitive supply contract and a case with an expensive supply contract.
