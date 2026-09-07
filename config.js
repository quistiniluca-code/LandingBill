window.ECON_CONFIG = Object.freeze({
  calculationVersion: 'v2-offline-savings-draft-0.1',
  benchmarkVersion: 'econ-benchmark-2026-09-draft',
  currency: 'EUR',
  assumptions: {
    fallbackAllInCostPerKwh: 0.31,
    variableCostShare: 0.78,
    targetVariablePriceLow: 0.135,
    targetVariablePriceHigh: 0.155,
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
