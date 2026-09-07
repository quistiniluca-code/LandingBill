window.ECON_CONFIG = Object.freeze({
  calculationVersion: 'v2-offline-savings-draft-0.3',
  benchmarkVersion: 'pun-index-gme-2026-08-draft',
  currency: 'EUR',
  assumptions: {
    fallbackAllInCostPerKwh: 0.31,
    variableCostShare: 0.78,
    punReference: 0.198,
    targetSpreadLow: 0.010,
    targetSpreadHigh: 0.025,
    targetVariablePriceLow: 0.208,
    targetVariablePriceHigh: 0.223,
    pvYieldKwhPerKwp: 1150,
    residentialMaxKwp: 10,
    businessMaxKwp: 30,
    minKwp: 3,
    selfConsumptionLow: 0.60,
    selfConsumptionHigh: 0.80,
    cerValueLow: 0.08,
    cerValueHigh: 0.12
  },
  thresholds: {
    billMeaningful: 120,
    pvMeaningful: 500
  }
});
