// search.js — Global keyword search across every record type

const Search = (() => {
  const SOURCES = [
    {
      type: 'expenses', label: 'Gasto', badge: 'badge-primary', amount: 'gasto',
      main: 'categoria', detail: ['comentario', 'medioPago'],
      fields: ['categoria', 'comentario', 'tipo', 'medioPago'],
    },
    {
      type: 'incomes', label: 'Ingreso', badge: 'badge-success', amount: 'monto',
      main: 'fuente', detail: [],
      fields: ['fuente'],
    },
    {
      type: 'accounts', label: 'Cuenta', badge: 'badge-accent', amount: 'monto',
      main: 'tipo', detail: ['persona', 'descripcion'],
      fields: ['persona', 'descripcion', 'tipo'],
    },
    {
      type: 'savings', label: 'Ahorro', badge: 'badge-muted', amount: 'monto',
      main: 'categoria', detail: ['descripcion', 'institucion'],
      fields: ['categoria', 'descripcion', 'institucion'],
    },
  ];

  const _esc = s => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Every distinct value the user could search for: categories, comments,
  // sources, people, payment methods… across all record types.
  function suggestions() {
    const set = new Set();
    SOURCES.forEach(src => {
      Store.getAll(src.type).forEach(r => {
        src.fields.forEach(f => { if (r[f]) set.add(String(r[f]).trim()); });
      });
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }

  function match(query) {
    const q = UI.normalize(query).trim();
    if (!q) return [];
    return SOURCES.flatMap(src =>
      Store.getAll(src.type)
        .filter(r => src.fields.some(f => UI.normalize(r[f]).includes(q)))
        .map(record => ({ src, record }))
    );
  }

  function _dateKey({ src, record }) {
    const p = Store.parseRecordDate(src.type, record.fecha);
    if (!p) return 0;
    return p.year * 10000 + p.month * 100 + (p.day || 0);
  }

  // Gastos/Ahorros llevan un mes de pago separado de la fecha; el resto no.
  function _mesKey({ src, record }) {
    const p = Store.parseRecordDate(src.type, record.mesPago || record.fecha);
    if (!p) return 0;
    return p.year * 100 + p.month;
  }

  const COLUMNS = [
    { key: 'tipo', label: 'Tipo', value: r => r.src.label },
    { key: 'fecha', label: 'Fecha', value: r => _dateKey(r) },
    { key: 'mesPago', label: 'Mes Pago', value: r => _mesKey(r) },
    { key: 'categoria', label: 'Categoría', value: r => r.record[r.src.main] || '' },
    { key: 'detalle', label: 'Detalle', value: r => r.src.detail.map(f => r.record[f]).filter(Boolean).join(' · ') },
    { key: 'monto', label: 'Monto', value: r => Store.parseCurrency(r.record[r.src.amount]) },
  ];

  let _sortKey = 'fecha';
  let _sortDir = 'desc';

  function _applySort(results) {
    const col = COLUMNS.find(c => c.key === _sortKey);
    if (!col) return results;
    return [...results].sort((a, b) => {
      const av = col.value(a), bv = col.value(b);
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), 'es');
      return _sortDir === 'asc' ? cmp : -cmp;
    });
  }

  let _lastQuery = '';

  function render(query) {
    _lastQuery = query;
    const container = document.getElementById('view-search');
    const results = _applySort(match(query));

    ['view-dashboard', 'view-table', 'view-pivot']
      .forEach(id => document.getElementById(id).classList.add('hidden'));
    container.classList.remove('hidden');

    const header = `<div class="drill-filter-badge">
      Búsqueda: <strong>${_esc(query)}</strong>
      <span class="search-count">${results.length} ${results.length === 1 ? 'movimiento' : 'movimientos'}</span>
      <button class="btn-icon btn-ghost" id="clear-search" title="Limpiar búsqueda">✕</button>
    </div>`;

    if (!results.length) {
      container.innerHTML = `${header}
        <div class="empty-state fade-in">
          <div class="empty-state-text">No hay movimientos para mostrar</div>
          <div class="empty-state-hint">Prueba con otra palabra clave o categoría</div>
        </div>`;
    } else {
      container.innerHTML = `${header}
        <div class="table-wrapper fade-in"><table class="data-table" id="search-results-table"><thead><tr>
        ${COLUMNS.map(col => {
          const isActive = _sortKey === col.key;
          const indicator = isActive
            ? `<span class="sort-indicator active">${_sortDir === 'asc' ? '▲' : '▼'}</span>`
            : `<span class="sort-indicator">⇅</span>`;
          return `<th data-col-key="${col.key}"><div class="th-sort">${col.label}${indicator}</div></th>`;
        }).join('')}
        </tr></thead><tbody>
        ${results.map(({ src, record }) => `<tr class="data-row" data-id="${record.id}" data-type="${src.type}">
          <td><span class="badge ${src.badge}">${src.label}</span></td>
          <td>${_esc(record.fecha)}</td>
          <td>${_esc(record.mesPago)}</td>
          <td>${_esc(record[src.main])}</td>
          <td class="search-detail">${_esc(src.detail.map(f => record[f]).filter(Boolean).join(' · '))}</td>
          <td class="pivot-cell-value">${UI.formatCLP(record[src.amount])}</td>
        </tr>`).join('')}
        </tbody></table></div>`;

      container.querySelectorAll('#search-results-table th[data-col-key] .th-sort').forEach(sortDiv => {
        sortDiv.addEventListener('click', () => {
          const key = sortDiv.closest('th').dataset.colKey;
          _sortKey === key ? (_sortDir = _sortDir === 'asc' ? 'desc' : 'asc') : (_sortKey = key, _sortDir = 'asc');
          render(_lastQuery);
        });
      });

      container.querySelector('#search-results-table').addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-id]');
        if (!row) return;
        TableView.openEditRow(row.dataset.type, row.dataset.id, () => render(_lastQuery));
      });
    }

    document.getElementById('clear-search').addEventListener('click', () => {
      close();
      App.refresh();
    });
  }

  function close() {
    const container = document.getElementById('view-search');
    if (container) container.classList.add('hidden');
    const input = document.getElementById('global-search');
    if (input) input.value = '';
  }

  function init() {
    const input = document.getElementById('global-search');
    UI.setupAutocomplete(input, suggestions, render);

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && input.value.trim()) render(input.value.trim());
      if (e.key === 'Escape') { close(); App.refresh(); }
    });
  }

  return { init, render, close, match, suggestions };
})();
