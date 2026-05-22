// table.js — Table & Pivot Table views

const TableView = (() => {

  function render(dataType, month, year) {
    const container = document.getElementById('view-table');
    const columns = Store.getColumns(dataType);
    const data = (dataType === 'accounts')
      ? Store.getAll('accounts')
      : Store.getByMonth(dataType, month, year);

    if (!data.length) {
      container.innerHTML = `
        <div class="empty-state fade-in">
          <div class="empty-state-text">No hay datos registrados</div>
          <div class="empty-state-hint">Usa el botón "Añadir" para comenzar a registrar</div>
        </div>`;
      return;
    }

    let html = `<div class="table-wrapper fade-in"><table class="data-table" id="data-table">
      <thead><tr>`;
    columns.forEach(col => { html += `<th>${col.label}</th>`; });
    html += `<th style="width:70px"></th></tr></thead><tbody>`;

    data.forEach(row => {
      html += `<tr data-id="${row.id}">`;
      columns.forEach(col => {
        let val = row[col.key] || '';
        if (col.type === 'currency') val = UI.formatCLP(val);
        html += `<td>${val}</td>`;
      });
      html += `<td>
        <div class="row-actions">
          <button class="btn-icon btn-ghost row-edit" title="Editar" style="width:auto;padding:0 var(--space-2);font-size:var(--text-xs)">Editar</button>
          <button class="btn-icon btn-ghost row-delete" title="Eliminar" style="width:auto;padding:0 var(--space-2);font-size:var(--text-xs)">Eliminar</button>
        </div>
      </td></tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;

    // Event delegation
    container.querySelector('#data-table').addEventListener('click', async (e) => {
      const row = e.target.closest('tr');
      if (!row) return;
      const id = row.dataset.id;

      if (e.target.closest('.row-delete')) {
        const ok = await UI.confirm('Eliminar registro', '¿Estás seguro de que deseas eliminar esta fila? Esta acción no se puede deshacer.');
        if (ok) {
          Store.remove(dataType, id);
          UI.toast('Registro eliminado', 'success');
          App.refresh();
        }
      }

      if (e.target.closest('.row-edit')) {
        openEditRow(dataType, id);
      }
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
        if (col.key === 'categoria') options = Store.getCategories();
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
    UI.openModal('modal-edit-row');
  }

  // ---------- PIVOT TABLE ----------
  function renderPivot(dataType, month, year) {
    const container = document.getElementById('view-pivot');

    if (dataType === 'expenses') {
      renderExpensePivot(container, month, year);
    } else if (dataType === 'incomes') {
      renderIncomePivot(container, month, year);
    } else {
      renderAccountPivot(container);
    }
  }

  function renderExpensePivot(container, month, year) {
    const allExpenses = Store.getAll('expenses');
    const categories = Store.getCategories();

    // Collect months up to selected
    const monthKeys = collectMonths(allExpenses, 'expenses', month, year);
    if (!monthKeys.length) {
      container.innerHTML = emptyPivot();
      return;
    }

    // Build pivot data: { monthKey: { category: total } }
    const pivot = {};
    monthKeys.forEach(mk => { pivot[mk] = {}; categories.forEach(c => pivot[mk][c] = 0); });

    allExpenses.forEach(e => {
      const mp = e.mesPago || e.fecha;
      const parsed = Store.parseRecordDate('expenses', mp);
      if (!parsed) return;
      const mk = `${String(parsed.month).padStart(2, '0')}-${String(parsed.year).slice(-2)}`;
      if (!pivot[mk]) return;
      const cat = e.categoria || 'Sin categoría';
      if (!pivot[mk][cat]) pivot[mk][cat] = 0;
      pivot[mk][cat] += Store.parseCurrency(e.gasto);
    });

    // Get categories that have data
    const usedCategories = categories.filter(c =>
      monthKeys.some(mk => pivot[mk][c] > 0)
    );

    if (!usedCategories.length) {
      container.innerHTML = emptyPivot();
      return;
    }

    let html = `<div class="table-wrapper fade-in"><table class="data-table pivot-table">
      <thead><tr><th>Mes</th>`;
    usedCategories.forEach(c => { html += `<th>${c}</th>`; });
    html += `<th>Total</th></tr></thead><tbody>`;

    monthKeys.forEach(mk => {
      html += `<tr><td><strong>${mk}</strong></td>`;
      let rowTotal = 0;
      usedCategories.forEach(c => {
        const v = pivot[mk][c] || 0;
        rowTotal += v;
        html += `<td class="pivot-cell-value">${v ? UI.formatCLP(v) : '-'}</td>`;
      });
      html += `<td class="pivot-cell-value pivot-total">${UI.formatCLP(rowTotal)}</td></tr>`;
    });

    // Grand totals
    html += `<tr class="pivot-total"><td><strong>Total</strong></td>`;
    let grandTotal = 0;
    usedCategories.forEach(c => {
      const colTotal = monthKeys.reduce((s, mk) => s + (pivot[mk][c] || 0), 0);
      grandTotal += colTotal;
      html += `<td class="pivot-cell-value">${UI.formatCLP(colTotal)}</td>`;
    });
    html += `<td class="pivot-cell-value">${UI.formatCLP(grandTotal)}</td></tr>`;
    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }

  function renderIncomePivot(container, month, year) {
    const allIncomes = Store.getAll('incomes');
    const sources = [...new Set(allIncomes.map(i => i.fuente || 'Sin fuente'))];
    const monthKeys = collectMonths(allIncomes, 'incomes', month, year);

    if (!monthKeys.length || !sources.length) {
      container.innerHTML = emptyPivot();
      return;
    }

    const pivot = {};
    monthKeys.forEach(mk => { pivot[mk] = {}; sources.forEach(s => pivot[mk][s] = 0); });

    allIncomes.forEach(i => {
      const parsed = Store.parseRecordDate('incomes', i.fecha);
      if (!parsed) return;
      const mk = `${String(parsed.month).padStart(2, '0')}-${String(parsed.year).slice(-2)}`;
      if (!pivot[mk]) return;
      const src = i.fuente || 'Sin fuente';
      pivot[mk][src] = (pivot[mk][src] || 0) + Store.parseCurrency(i.monto);
    });

    let html = `<div class="table-wrapper fade-in"><table class="data-table pivot-table">
      <thead><tr><th>Mes</th>`;
    sources.forEach(s => { html += `<th>${s}</th>`; });
    html += `<th>Total</th></tr></thead><tbody>`;

    monthKeys.forEach(mk => {
      html += `<tr><td><strong>${mk}</strong></td>`;
      let rowTotal = 0;
      sources.forEach(s => {
        const v = pivot[mk][s] || 0;
        rowTotal += v;
        html += `<td class="pivot-cell-value">${v ? UI.formatCLP(v) : '-'}</td>`;
      });
      html += `<td class="pivot-cell-value pivot-total">${UI.formatCLP(rowTotal)}</td></tr>`;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }

  function renderAccountPivot(container) {
    const accounts = Store.getAll('accounts');
    if (!accounts.length) { container.innerHTML = emptyPivot(); return; }

    const pivot = {};
    accounts.forEach(a => {
      const persona = a.persona || 'Desconocido';
      const tipo = a.tipo || 'Sin tipo';
      const key = `${persona}|||${tipo}`;
      pivot[key] = (pivot[key] || 0) + Store.parseCurrency(a.monto);
    });

    let html = `<div class="table-wrapper fade-in"><table class="data-table pivot-table">
      <thead><tr><th>Persona</th><th>Tipo</th><th>Total</th></tr></thead><tbody>`;

    Object.entries(pivot).sort((a, b) => b[1] - a[1]).forEach(([key, total]) => {
      const [persona, tipo] = key.split('|||');
      html += `<tr>
        <td><strong>${persona}</strong></td>
        <td><span class="badge ${tipo === 'Cuentas por cobrar' ? 'badge-success' : 'badge-primary'}">${tipo}</span></td>
        <td class="pivot-cell-value">${UI.formatCLP(total)}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }

  function collectMonths(records, type, upToMonth, upToYear) {
    const months = new Set();
    records.forEach(r => {
      const dateField = (type === 'expenses') ? (r.mesPago || r.fecha) : r.fecha;
      const parsed = Store.parseRecordDate(type, dateField);
      if (!parsed) return;
      if (parsed.year < upToYear || (parsed.year === upToYear && parsed.month <= upToMonth)) {
        months.add(`${String(parsed.month).padStart(2, '0')}-${String(parsed.year).slice(-2)}`);
      }
    });
    return [...months].sort();
  }

  function emptyPivot() {
    return `<div class="empty-state fade-in">
      <div class="empty-state-text">Sin datos para tabla dinámica</div>
    </div>`;
  }

  return { render, renderPivot };
})();
