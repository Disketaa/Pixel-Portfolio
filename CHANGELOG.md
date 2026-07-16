# Changelog

## [Unreleased]

### Changed

- Split monolithic `script.js` (849 lines) into 5 ES modules under `scripts/helpers/`:
  - `utils.js` — `toDisplayName()`, `slug()`, `clamp()`
  - `lightbox.js` — zoom/pan/pinch/lightbox system
  - `gallery.js` — card/section rendering, layout logic
  - `header-scroll.js` — scroll spy, header progress, tag navigation
  - `main.js` — entry point, DOM refs, manifest loading, bootstrap
- `index.html` now loads `<script type="module" src="scripts/helpers/main.js">`
- `worksData` is no longer a global variable — owned by `gallery.js`, passed explicitly to `lightbox.js` via `openLightbox()` parameter

### Fixed

- GitHub Actions workflow (`build-deploy.yml`): removed stale `script.js` reference from paths trigger and deploy `cp` command, now copies `scripts/helpers/*.js` to `_site/`

### Docs

- Updated `.kilo/AGENTS.md` — Key files table, JS conventions, Directories section
- Updated `.kilo/README.md` — project structure diagram
