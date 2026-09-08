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

function applyEconUiRevisions() {
  const privacyUrl = window.ECON_CONFIG && window.ECON_CONFIG.privacyUrl;

  // Brand: logo only. Remove the descriptor requested for this campaign.
  document.querySelectorAll('.descriptor').forEach(function (el) {
    el.remove();
  });

  // Result: keep outcome and commercial interpretation visible, but do not expose
  // calculation mechanics, assumptions or component formulas in the interface.
  document.querySelectorAll('.assumption').forEach(function (el) {
    el.remove();
  });

  const resultNote = document.querySelector('.resultNote');
  if (resultNote) {
    resultNote.textContent = 'Stima preliminare personalizzata ECON';
  }

  document.querySelectorAll('.lever > span').forEach(function (el) {
    el.style.display = 'none';
  });

  // Privacy link next to consent.
  const privacyCheckbox = document.getElementById('verificationPrivacy');
  const consent = privacyCheckbox && privacyCheckbox.closest('.inlineConsent');
  const privacyNote = consent && consent.nextElementSibling && consent.nextElementSibling.classList.contains('privacyNote')
    ? consent.nextElementSibling
    : null;

  if (privacyNote && privacyUrl) {
    privacyNote.innerHTML = 'Consulta l\'<a href="' + privacyUrl + '" target="_blank" rel="noopener noreferrer">informativa privacy completa</a>.';
    const link = privacyNote.querySelector('a');
    if (link) {
      link.style.color = 'var(--green)';
      link.style.fontWeight = '700';
      link.style.textUnderlineOffset = '2px';
    }
  }

  // Footer: remove "Sistema Energia | Fotovoltaico" and retain only contact details + privacy.
  const footerLine = document.querySelector('.footer .footerInner span:last-child');
  if (footerLine) {
    footerLine.innerHTML = '+39 378 309 1137 · econ-apex.com';
    if (privacyUrl) {
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
  }
}

document.addEventListener('DOMContentLoaded', applyEconUiRevisions);

// Restore the flyer-aligned campaign layer and re-apply the campaign-specific
// cleanup after it has loaded, so these revisions remain authoritative.
(function () {
  const script = document.createElement('script');
  script.src = '/campaign-ui.js';
  script.defer = true;
  script.onload = applyEconUiRevisions;
  document.head.appendChild(script);
})();
