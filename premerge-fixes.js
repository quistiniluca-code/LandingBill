(() => {
  'use strict';

  const nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  let directPreference = '';

  function formEvent(name, payload) {
    try {
      const stored = JSON.parse(sessionStorage.getItem('econ_savings_attr') || '{}');
      const body = new URLSearchParams({
        'form-name': 'econ-events-v2',
        'bot-field': '',
        event_name: name,
        session_id: sessionStorage.getItem('econ_savings_session') || '',
        ts: new Date().toISOString(),
        source: stored.source || 'direct',
        format: stored.format || '',
        wave: stored.wave || '',
        cluster: stored.cluster || '',
        point: stored.point || '',
        step: '6',
        payload: JSON.stringify(payload || {})
      });
      if (navigator.sendBeacon) navigator.sendBeacon('/', body);
    } catch (_) {}
  }

  // Preserve the original user gesture for phone/WhatsApp. The existing outcome
  // request is still started, but the UI no longer waits for it before opening
  // the external app. The step-1 intake has already stored the contact reference.
  document.addEventListener('click', (event) => {
    const button = event.target && event.target.closest && event.target.closest('[data-contact]');
    if (!button) return;
    const preference = button.dataset.contact || '';
    if (preference !== 'CALL_NOW' && preference !== 'WHATSAPP_NOW') return;
    directPreference = preference;
    formEvent('direct_contact_intent_preflight', { preference });
  }, true);

  if (nativeFetch) {
    window.fetch = function(input, init) {
      try {
        const body = init && init.body;
        if (directPreference && body instanceof FormData && body.get('form-name') === 'econ-outcome-v2') {
          nativeFetch(input, init).catch(() => {});
          directPreference = '';
          return Promise.resolve(new Response('', { status: 200 }));
        }
      } catch (_) {}
      return nativeFetch(input, init);
    };
  }

  // Province: normalize and reject non-letter values before the legacy handler.
  document.addEventListener('input', (event) => {
    if (!event.target || event.target.id !== 'province') return;
    event.target.value = String(event.target.value || '').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target && event.target.closest && event.target.closest('#intakeNext');
    if (!target) return;
    const province = document.getElementById('province');
    if (!province) return;
    const value = String(province.value || '').trim().toUpperCase();
    province.value = value;
    if (/^[A-Z]{2}$/.test(value)) return;
    event.preventDefault();
    event.stopPropagation();
    const help = document.getElementById('intakeHelp');
    if (help) help.textContent = 'Inserisci una provincia valida di 2 lettere.';
    province.focus();
  }, true);

  // File upload: enforce the formats declared in the interface, not only size.
  document.addEventListener('change', (event) => {
    if (!event.target || event.target.id !== 'bill') return;
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.type)) return;
    event.stopPropagation();
    event.target.value = '';
    const meta = document.getElementById('fileMeta');
    if (meta) {
      meta.textContent = 'Formato non supportato. Usa PDF, JPG, PNG o WebP.';
      meta.classList.add('show');
    }
  }, true);
})();
