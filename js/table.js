// table.js — Table & Pivot Table views

const TableView = (() => {

  let _sortKey = null;
  let _sortDir = 'asc';
  let _filters = {};
  let _lastCtx = null;
  let _lastFocusedCol = null;

  function _resetTableState() {
    _sortKey = null;
    _sortDir = 'asc';
    _filters = {};
    _lastFocusedCol = null;
  }

  function _parseDateDMY(str) {
    if (!str) return 0;
    const p = str.split('-');
    if (p.length !== 3) return 0;
    return parseInt(p[2]) * 10000 + parseInt(p[1]) * 100 + parseInt(p[0]);
  }

  function _parseDateMY(str) {
    if (!str) return 0;
    const p = str.split('-');
    if (p.length !== 2) return 0;
    return parseInt(p[1]) * 100 + parseInt(p[0]);
  }

  function _applyFilters(data, columns) {
    return data.filter(row =>
      columns.every(col => {
        const term = (_filters[col.key] || '').trim().toLowerCase();
        if (!term) return true;
        let display = row[col.key] || '';
        if (col.type === 'currency') display = UI.formatCLP(display);
        return String(display).toLowerCase().includes(term);
      })
    );
  }

  function _applySort(data, columns) {
    if (!_sortKey) return data;
    const col = columns.find(c => c.key === _sortKey);
    if (!col) return data;
    return [...data].sort((a, b) => {
      const aVal = a[_sortKey] || '';
      const bVal = b[_sortKey] || '';
      let cmp;
      if (col.type === 'currency') {
        cmp = Store.parseCurrency(aVal) - Store.parseCurrency(bVal);
      } else if (col.type === 'date-dmy') {
        cmp = _parseDateDMY(aVal) - _parseDateDMY(bVal);
      } else if (col.type === 'date-my') {
        cmp = _parseDateMY(aVal) - _parseDateMY(bVal);
      } else {
        cmp = String(aVal).localeCompare(String(bVal), 'es');
      }
      return _sortDir === 'asc' ? cmp : -cmp;
    });
  }

  function render(dataType, months, drillFilter = null) {
    const ctx = `${dataType}|${months.map(({month, year}) => `${month}-${year}`).join(',')}`;
    if (ctx !== _lastCtx) {
      _resetTableState();
      _lastCtx = ctx;
    }

    const container = document.getElementById('view-table');
    const columns = Store.getColumns(dataType);
    let data = (dataType === 'accounts')
      ? Store.getAll(dataType)
      : Store.getByMonths(dataType, months);

    if (drillFilter) {
      data = data.filter(row => row[drillFilter.key] === drillFilter.value);
    }

    if (!data.length) {
      container.innerHTML = `
        ${drillFilter ? renderDrillBadge(drillFilter) : ''}
        <div class="empty-state fade-in">
          <div class="empty-state-text">No hay datos registrados</div>
          <div class="empty-state-hint">Usa el botón "Añadir" para comenzar a registrar</div>
        </div>`;
      if (drillFilter) {
        container.querySelector('#clear-drill-filter')
          .addEventListener('click', () => App.clearDrillFilter());
      }
      return;
    }

    const filtered = _applyFilters(data, columns);
    const sorted = _applySort(filtered, columns);
    const hasActiveState = _sortKey !== null || Object.values(_filters).some(v => v.trim());

    let html = (drillFilter ? renderDrillBadge(drillFilter) : '') +
      `<div class="${hasActiveState ? 'table-wrapper' : 'table-wrapper fade-in'}">` +
      `<table class="data-table" id="data-table"><thead><tr>`;

    columns.forEach(col => {
      const isActive = _sortKey === col.key;
      const indicator = isActive
        ? `<span class="sort-indicator active">${_sortDir === 'asc' ? '▲' : '▼'}</span>`
        : `<span class="sort-indicator">⇅</span>`;
      const filterVal = (_filters[col.key] || '').replace(/"/g, '&quot;');
      html += `<th data-col-key="${col.key}">
        <div class="th-sort">${col.label}${indicator}</div>
        <input class="col-filter" data-col-key="${col.key}" placeholder="Filtrar..." value="${filterVal}" />
      </th>`;
    });

    html += `</tr></thead><tbody>`;

    if (!sorted.length) {
      html += `<tr><td colspan="${columns.length}" class="table-no-results">Sin resultados para los filtros aplicados</td></tr>`;
    } else {
      sorted.forEach(row => {
        html += `<tr class="data-row" data-id="${row.id}">`;
        columns.forEach(col => {
          let val = row[col.key] || '';
          if (col.type === 'currency') val = UI.formatCLP(val);
          html += `<td>${val}</td>`;
        });
        html += `</tr>`;
      });
    }

    html += `</tbody></table></div>`;
    container.innerHTML = html;

    if (drillFilter) {
      container.querySelector('#clear-drill-filter')
        .addEventListener('click', () => App.clearDrillFilter());
    }

    if (_lastFocusedCol) {
      const inp = container.querySelector(`.col-filter[data-col-key="${_lastFocusedCol}"]`);
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }

    container.querySelectorAll('th[data-col-key] .th-sort').forEach(sortDiv => {
      sortDiv.addEventListener('click', () => {
        const key = sortDiv.closest('th').dataset.colKey;
        _sortKey === key ? (_sortDir = _sortDir === 'asc' ? 'desc' : 'asc') : (_sortKey = key, _sortDir = 'asc');
        _lastFocusedCol = null;
        render(dataType, months, drillFilter);
      });
    });

    container.querySelectorAll('.col-filter').forEach(input => {
      input.addEventListener('input', () => {
        _filters[input.dataset.colKey] = input.value;
        _lastFocusedCol = input.dataset.colKey;
        render(dataType, months, drillFilter);
      });
    });

    container.querySelector('#data-table').addEventListener('click', (e) => {
      if (e.target.classList.contains('col-filter')) return;
      const row = e.target.closest('tr[data-id]');
      if (!row) return;
      openEditRow(dataType, row.dataset.id);
    });
  }

  function openEditRow(dataType, id) {
    const record = Store.getAll(dataType).find(r => r.id === id);
    if (!record) return;

    const columns = Store.getColumns(dataType);
    let formHTML = '';

    columns.forEach(col => {
      const val = record[col.key] || '';
      if (col.type === 'select') {
        let options = [];
        if (col.key === 'categoria' && dataType === 'savings') options = Store.getSavingsCategories();
        else if (col.key === 'categoria') options = Store.getCategories();
        else if (col.key === 'tipo' && dataType === 'expenses') options = Store.getExpenseTypes();
        else if (col.key === 'tipo' && dataType === 'accounts') options = Store.getAccountTypes();
        else if (col.key === 'medioPago') options = Store.getPaymentMethods();
        formHTML += `<div class="form-group">
          <label class="form-label">${col.label}</label>
          <select class="form-select" data-key="${col.key}">
            ${options.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('')}
          </select></div>`;
      } else {
        formHTML += `<div class="form-group">
          <label class="form-label">${col.label}</label>
          <input class="form-input" data-key="${col.key}" value="${val}" /></div>`;
      }
    });

    const modal = document.getElementById('modal-edit-row');
    document.getElementById('edit-row-form').innerHTML = formHTML;

    document.getElementById('edit-row-save').onclick = () => {
      const updates = {};
      modal.querySelectorAll('[data-key]').forEach(el => {
        updates[el.dataset.key] = el.value;
      });
      Store.update(dataType, id, updates);
      UI.closeModal('modal-edit-row');
      UI.toast('Registro actualizado', 'success');
      App.refresh();
    };

    document.getElementById('edit-row-delete').onclick = async () => {
      const ok = await UI.confirm('Eliminar registro', '¿Estás seguro que deseas eliminar este registro? Esta acción no se puede deshacer.');
      if (ok) {
        Store.remove(dataType, id);
        UI.closeModal('modal-edit-row');
        UI.toast('Registro eliminado', 'success');
        App.refresh();
      }
    };

    UI.openModal('modal-edit-row');
  }

  function renderDrillBadge(drillFilter) {
    return `<div class="drill-filter-badge">
      Filtro activo: <strong>${drillFilter.value}</strong>
      <button class="btn-icon btn-ghost" id="clear-drill-filter" title="Quitar filtro">✕</button>
    </div>`;
  }

  // ---------- PIVOT TABLE ----------
  function renderPivot(dataType, months) {
    const container = document.getElementById('view-pivot');
    if (dataType === 'expenses') renderExpensePivot(container, months);
    else if (dataType === 'incomes') renderIncomePivot(container, months);
    else if (dataType === 'savings') renderSavingsPivot(container, months);
    else renderAccountPivot(container);
  }

  function _bindPivotDrill(container) {
    container.querySelector('.pivot-table').addEventListener('click', (e) => {
      const cell = e.target.closest('.pivot-drillable');
      if (cell) App.drillDown(cell.dataset.drillKey, cell.dataset.drillValue);
    });
  }

  function _renderPivotTable(container, rowLabel, drillKey, rowData, monthLabels, isRange) {
    const rows = Object.entries(rowData)
      .filter(([, amounts]) => amounts.some(a => a > 0))
      .sort(([, a], [, b]) => b.reduce((x, y) => x + y, 0) - a.reduce((x, y) => x + y, 0));

    if (!rows.length) { container.innerHTML = emptyPivot(); return; }

    const monthTotals = new Array(monthLabels.length).fill(0);
    rows.forEach(([, amounts]) => amounts.forEach((a, i) => { monthTotals[i] += a; }));
    const grandTotal = monthTotals.reduce((a, b) => a + b, 0);

    let html = `<div class="table-wrapper fade-in"><table class="data-table pivot-table"><thead><tr>
      <th>${rowLabel}</th>
      ${monthLabels.map(l => `<th>${l}</th>`).join('')}
      ${isRange ? '<th>Total</th>' : ''}
    </tr></thead><tbody>`;

    rows.forEach(([name, amounts]) => {
      const rowTotal = amounts.reduce((a, b) => a + b, 0);
      html += `<tr>
        <td class="pivot-drillable" data-drill-key="${drillKey}" data-drill-value="${name}"><strong>${name}</strong></td>
        ${amounts.map(a => `<td class="pivot-cell-value">${UI.formatCLP(a)}</td>`).join('')}
        ${isRange ? `<td class="pivot-cell-value"><strong>${UI.formatCLP(rowTotal)}</strong></td>` : ''}
      </tr>`;
    });

    html += `<tr class="pivot-total">
      <td><strong>Total</strong></td>
      ${monthTotals.map(t => `<td class="pivot-cell-value">${UI.formatCLP(t)}</td>`).join('')}
      ${isRange ? `<td class="pivot-cell-value"><strong>${UI.formatCLP(grandTotal)}</strong></td>` : ''}
    </tr></tbody></table></div>`;
    container.innerHTML = html;
    _bindPivotDrill(container);
  }

  function renderExpensePivot(container, months) {
    const records = Store.getByMonths('expenses', months);
    const monthLabels = months.map(({month, year}) => UI.getMonthLabel(month, year));
    const rowData = {};
    records.forEach(r => {
      const cat = r.categoria || 'Sin categoría';
      if (!rowData[cat]) rowData[cat] = new Array(months.length).fill(0);
      const idx = months.findIndex(({month, year}) => {
        const p = Store.parseRecordDate('expenses', r.mesPago || r.fecha);
        return p && p.month === month && p.year === year;
      });
      if (idx >= 0) rowData[cat][idx] += Store.parseCurrency(r.gasto);
    });
    _renderPivotTable(container, 'Categoría', 'categoria', rowData, monthLabels, months.length > 1);
  }

  function renderIncomePivot(container, months) {
    const records = Store.getByMonths('incomes', months);
    if (!records.length) { container.innerHTML = emptyPivot(); return; }
    const monthLabels = months.map(({month, year}) => UI.getMonthLabel(month, year));
    const rowData = {};
    records.forEach(r => {
      const src = r.fuente || 'Sin fuente';
      if (!rowData[src]) rowData[src] = new Array(months.length).fill(0);
      const idx = months.findIndex(({month, year}) => {
        const p = Store.parseRecordDate('incomes', r.fecha);
        return p && p.month === month && p.year === year;
      });
      if (idx >= 0) rowData[src][idx] += Store.parseCurrency(r.monto);
    });
    _renderPivotTable(container, 'Fuente', 'fuente', rowData, monthLabels, months.length > 1);
  }

  function renderSavingsPivot(container, months) {
    const records = Store.getByMonths('savings', months);
    const monthLabels = months.map(({month, year}) => UI.getMonthLabel(month, year));
    const rowData = {};
    records.forEach(r => {
      const cat = r.categoria || 'Sin categoría';
      if (!rowData[cat]) rowData[cat] = new Array(months.length).fill(0);
      const idx = months.findIndex(({month, year}) => {
        const p = Store.parseRecordDate('savings', r.mesPago || r.fecha);
        return p && p.month === month && p.year === year;
      });
      if (idx >= 0) rowData[cat][idx] += Store.parseCurrency(r.monto);
    });
    _renderPivotTable(container, 'Categoría', 'categoria', rowData, monthLabels, months.length > 1);
  }

  function renderAccountPivot(container) {
    const accounts = Store.getAll('accounts');
    if (!accounts.length) { container.innerHTML = emptyPivot(); return; }

    const pivot = {};
    accounts.forEach(a => {
      const persona = a.persona || 'Desconocido';
      const tipo    = a.tipo    || 'Sin tipo';
      const key = `${persona}|||${tipo}`;
      pivot[key] = (pivot[key] || 0) + Store.parseCurrency(a.monto);
    });

    let html = `<div class="table-wrapper fade-in"><table class="data-table pivot-table">
      <thead><tr><th>Persona</th><th>Tipo</th><th>Total</th></tr></thead><tbody>`;

    Object.entries(pivot).sort((a, b) => b[1] - a[1]).forEach(([key, total]) => {
      const [persona, tipo] = key.split('|||');
      html += `<tr>
        <td class="pivot-drillable" data-drill-key="persona" data-drill-value="${persona}"><strong>${persona}</strong></td>
        <td><span class="badge ${tipo === 'Cuentas por cobrar' ? 'badge-success' : 'badge-primary'}">${tipo}</span></td>
        <td class="pivot-cell-value">${UI.formatCLP(total)}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
    _bindPivotDrill(container);
  }

  function emptyPivot() {
    return `<div class="empty-state fade-in">
      <div class="empty-state-text">Sin datos para tabla dinámica</div>
      <div class="empty-state-hint">Usa el botón "Añadir" para comenzar a registrar</div>
    </div>`;
  }

  return { render, renderPivot };
})();
