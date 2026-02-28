# >_ DevToolKit

**Free, fast, open-source developer tools that run entirely in your browser.**

[![Live Site](https://img.shields.io/badge/Live-dev--tools.devtoolsite.workers.dev-blue)](https://dev-tools.devtoolsite.workers.dev)
[![Built with Astro](https://img.shields.io/badge/Built%20with-Astro-BC52EE?logo=astro&logoColor=white)](https://astro.build)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Deployed on Cloudflare](https://img.shields.io/badge/Deployed%20on-Cloudflare-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)

---

No tracking. No data collection. No sign-up. **100% client-side** -- your data never leaves your browser.

## Tools

| Tool | Description | Link |
|------|-------------|------|
| **chmod Calculator** | Interactive Unix file permission calculator with octal/symbolic output, common presets (755, 644), security warnings, and umask calculation | [Open](https://dev-tools.devtoolsite.workers.dev/chmod-calculator) |
| **TOML / JSON / YAML Converter** | Convert between TOML, JSON, and YAML formats instantly. Auto-detect input, bidirectional conversion, syntax validation | [Open](https://dev-tools.devtoolsite.workers.dev/toml-json-yaml-converter) |
| **.env File Editor** | Parse, edit, and convert .env files. Framework templates for Next.js, Django, Laravel, Express, Rails. Export to JSON, YAML, Docker env | [Open](https://dev-tools.devtoolsite.workers.dev/env-file-editor) |
| **Cron Expression Generator** | Build and decode cron expressions with a visual editor. Human-readable descriptions and next execution preview | [Open](https://dev-tools.devtoolsite.workers.dev/cron-expression-generator) |
| **Docker Compose Validator** | Validate docker-compose.yml with schema-aware checks. Detects invalid keys, circular dependencies, port issues | [Open](https://dev-tools.devtoolsite.workers.dev/docker-compose-validator) |

## Tech Stack

- **[Astro](https://astro.build)** -- Static site generation with island architecture
- **[React 19](https://react.dev)** -- Interactive tool components
- **[Tailwind CSS v4](https://tailwindcss.com)** -- Utility-first styling
- **[Cloudflare Workers](https://workers.cloudflare.com)** -- Edge deployment, globally distributed

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Why DevToolKit?

- **Privacy-first**: Everything runs in your browser. Zero server calls, zero data stored.
- **Fast**: Static HTML + progressive hydration. No loading spinners.
- **Free & open source**: No paywalls, no premium tiers, no ads-before-content.
- **Offline-capable**: Works after first load, even without internet.

## License

MIT
