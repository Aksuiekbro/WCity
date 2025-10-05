# frontend

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) 
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build

## API Base URL (Dev/Prod)

- The dev server proxies `'/api'` to the backend at `http://localhost:3000` (see `vite.config.js`).
- You can override the API base with an explicit environment variable:

```
# .env.local
VITE_API_BASE_URL=http://localhost:3000/api
```

If not set, `src/services/apiClient.js` defaults to `http://localhost:3000/api`.

For production, set the API base via environment:

```
# .env.production (or your deployment env vars)
VITE_API_BASE_URL=https://api.your-domain.com/api
```

This ensures the app calls your deployed backend without code changes.
```
