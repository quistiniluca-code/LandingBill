# ECON Bolletta Landing

Progetto HTML statico pronto per GitHub e Netlify.

## File

- `index.html`: landing mobile-first ECON con form Netlify e upload bolletta.
- `netlify.toml`: configurazione Netlify per pubblicazione dalla root.
- `_redirects`: fallback routing Netlify.

## Deploy Netlify

Impostazioni consigliate:

- Branch: `main`
- Base directory: vuota
- Build command: vuoto
- Publish directory: `.`

## Form Netlify

Il form è predisposto con:

- `name="econ-bolletta-upload"`
- `data-netlify="true"`
- `enctype="multipart/form-data"`
- campo file `bolletta`
- honeypot `bot-field`

Dopo il primo deploy, Netlify dovrebbe rilevare automaticamente il form.
