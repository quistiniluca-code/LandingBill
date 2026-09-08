window.ECON_CONFIG = Object.freeze({
  calculationVersion: 'v2-offline-savings-draft-0.3',
  benchmarkVersion: 'pun-index-gme-2026-08-draft',
  currency: 'EUR',
  privacyUrl: 'https://www.econ-apex.com/privacy',
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

// Legal link for the V2 campaign funnel. Kept in config so the URL is
// centralized and can be changed without touching the calculation logic.
document.addEventListener('DOMContentLoaded', function () {
  const privacyUrl = window.ECON_CONFIG && window.ECON_CONFIG.privacyUrl;
  if (!privacyUrl) return;

  const privacyCheckbox = document.getElementById('verificationPrivacy');
  const consent = privacyCheckbox && privacyCheckbox.closest('.inlineConsent');
  const privacyNote = consent && consent.nextElementSibling && consent.nextElementSibling.classList.contains('privacyNote')
    ? consent.nextElementSibling
    : null;

  if (privacyNote) {
    privacyNote.innerHTML = 'Consulta l\'<a href="' + privacyUrl + '" target="_blank" rel="noopener noreferrer">informativa privacy completa</a>.';
    const link = privacyNote.querySelector('a');
    if (link) {
      link.style.color = 'var(--green)';
      link.style.fontWeight = '700';
      link.style.textUnderlineOffset = '2px';
    }
  }

  const footerLine = document.querySelector('.footer .footerInner span:last-child');
  if (footerLine && !footerLine.querySelector('a[data-econ-privacy]')) {
    footerLine.appendChild(document.createTextNode(' · '));
    const footerLink = document.createElement('a');
    footerLink.href = privacyUrl;
    footerLink.target = '_blank';
    footerLink.rel = 'noopener noreferrer';
    footerLink.dataset.econPrivacy = 'true';
    footerLink.textContent = 'Privacy';
    footerLink.style.color = 'var(--green)';
    footerLink.style.fontWeight = '700';
    footerLink.style.textUnderlineOffset = '2px';
    footerLine.appendChild(footerLink);
  }
});
