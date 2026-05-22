# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Finper** is a personal finance SPA for tracking expenses, incomes, and accounts. It runs entirely in the browser using vanilla JavaScript, HTML5, and CSS3 — no build step, no server, no npm.

## Running the Application

Open `index.html` directly in a browser, or use a static server:

```
npx serve
```

All data is persisted in browser localStorage — nothing server-side.

## Architecture

### Module Pattern

All modules follow the IIFE pattern and are loaded in order in `index.html`:

```javascript
const ModuleName = (() => {
  function private() { }
  return { publicMethod };
})();
```

### Core Modules (`/js/`)

| Module | Responsibility |
|---|---|
| `store.js` | Data layer — localStorage CRUD, filtering, aggregation, suggestions |
| `ui.js` | Utilities — toasts, modals, date/currency formatting |
| `app.js` | State orchestrator — routes to views, binds navbar/toolbar |
| `dashboard.js` | Metrics + Chart.js charts (line and bar) |
| `table.js` | Table view and pivot cross-tabulation |
| `editor.js` | Column and category management (multi-step wizard) |
| `importer.js` | CSV/XLSX import via SheetJS (drag-and-drop supported) |

### App State

Central state lives in `App.state`:

```javascript
{ dataType: 'expenses'|'incomes'|'accounts', viewMode: 'dashboard'|'table'|'pivot', month, year }
```

After any data mutation, call `App.refresh()` to re-render.

### Data Model (localStorage)

**Keys**: `finper_expenses`, `finper_incomes`, `finper_accounts`, plus metadata keys for categories, types, payment methods, and column definitions.

**Expense record**: `{ fecha (dd-mm-yy), mesPago (mm-yy), categoria, gasto, comentario, tipo, medioPago, id, _created, _updated }`

**Income record**: `{ fecha (mm-yy), monto, fuente, id, _created, _updated }`

**Account record**: `{ fecha (dd-mm-yy), persona, descripcion, tipo, monto, id, _created, _updated }`

Currency values are stored as integers (e.g., `50000` = $50,000 CLP). Parse with `Store.parseCurrency()`, format with `UI.formatCLP()`.

### Dates

- Expenses/accounts use `DD-MM-YY` format
- Incomes use `MM-YY` format
- Parse/format with `UI.parseDateDMY()`, `UI.formatDateDMY()`, `UI.parseDateMY()`, `UI.formatDateMY()`

### External Dependencies (CDN only)

- **Chart.js v4.4.4** — used in `dashboard.js` for line/bar charts
- **SheetJS v0.18.5** — used in `importer.js` for CSV/XLSX parsing

## CSS Design System

All design tokens are CSS variables defined in `styles.css`:

- Colors: `--color-primary`, `--color-accent`, `--color-success`, `--color-danger`, `--color-warning`
- Spacing: `--space-1` (0.25rem) … `--space-12` (3rem)
- Typography: `--text-xs` … `--text-3xl`, `--font-family` (Inter)
- Radius: `--radius-sm` … `--radius-full`
- Transitions: `--transition-fast` (150ms), `--transition-base` (250ms), `--transition-slow` (400ms)

Key layout classes: `.btn`, `.modal`, `.modal-overlay.active`, `.toast`, `.form-group`, `.metric-card`, `.data-table`, `.hidden` (display: none).

## Key Conventions

- **DOM**: no framework — direct `innerHTML`, `querySelector`, `addEventListener`
- **Modals**: toggled with `.active` class on `.modal-overlay`
- **Views**: shown/hidden with `.hidden` class
- **Column types** in `DEFAULT_COLUMNS` (`store.js`) determine input rendering in `table.js`: `date-dmy`, `date-my`, `currency`, `text`, `select`
- **Chart instances** in `dashboard.js` (`lineChart`, `barChart`) must be destroyed before re-creating on re-render
- Confirm dialogs are async Promise-based (`UI.confirm()`)

## Adding to the App

**New column on an existing data type:**
1. Add to `DEFAULT_COLUMNS[dataType]` in `store.js`
2. Update form input routing in `Table.openEditRow()`
3. Update import mapping in `Importer.handleFile()` if needed

**New dashboard metric:**
1. Add calculation in the relevant `Dashboard.render*Dashboard()` function
2. Add `.metric-card` HTML with appropriate color modifier class

**New data type:**
1. Add key + defaults in `Store.KEYS` and `Store.init()`
2. Define columns in `DEFAULT_COLUMNS`
3. Add toggle to toolbar, branches in `App.refresh()`, `Dashboard.render()`, `TableView.render()`, and `Importer`

## Git Conventions
- Use conventional commits format (feat:, fix:, docs:, refactor:).
- Keep commit subject lines under 72 characters.
- Branch naming pattern: feature/initials-description or bugfix/initials-description.
- Always run tests (`npm test` or `pytest`) before generating a commit.

## Testing

No automated tests. Verify changes manually in the browser. Inspect stored data via DevTools → Application → Local Storage.
