// table.js — Table & Pivot Table views

const TableView = (() => {

  function render(dataType, month, year) {
    const container = document.getElementById('view-table');
    const columns = Store.getColumns(dataType);
    const data = (dataType === 'accounts')
      ? Store.getAll(dataType)
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
    UI.openModal('modal-edit-row');
  }

  // ---------- PIVOT TABLE ----------
  function renderPivot(dataType, month, year) {
    const container = document.getElementById('view-pivot');

    if (dataType === 'expenses') {
      renderExpensePivot(container, month, year);
    } else if (dataType === 'incomes') {
      renderIncomePivot(container, month, year);
    } else if (dataType === 'savings') {
      renderSavingsPivot(container, month, year);
    } else {
      renderAccountPivot(container);
    }
  }

  function renderExpensePivot(container, month, year) {
    const expenses = Store.getByMonth('expenses', month, year);
    const categories = Store.getCategories();
    const monthLabel = UI.getMonthLabel(month, year);

    const totals = {};
    expenses.forEach(e => {
      const cat = e.categoria || 'Sin categoría';
      totals[cat] = (totals[cat] || 0) + Store.parseCurrency(e.gasto);
    });

    const usedCategories = categories.filter(c => totals[c] > 0);
    if (!usedCategories.length) { container.innerHTML = emptyPivot(); return; }

    let grandTotal = 0;
    let html = `<div class="table-wrapper fade-in"><table class="data-table pivot-table">
      <thead><tr><th>Categoría</th><th>${monthLabel}</th></tr></thead><tbody>`;

    usedCategories.forEach(c => {
      const v = totals[c];
      grandTotal += v;
      html += `<tr><td><strong>${c}</strong></td><td class="pivot-cell-value">${UI.formatCLP(v)}</td></tr>`;
    });

    html += `<tr class="pivot-total"><td><strong>Total</strong></td><td class="pivot-cell-value">${UI.formatCLP(grandTotal)}</td></tr>`;
    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }

  function renderIncomePivot(container, month, year) {
    const incomes = Store.getByMonth('incomes', month, year);
    const monthLabel = UI.getMonthLabel(month, year);

    if (!incomes.length) { container.innerHTML = emptyPivot(); return; }

    const sourceMap = {};
    incomes.forEach(i => {
      const src = i.fuente || 'Sin fuente';
      sourceMap[src] = (sourceMap[src] || 0) + Store.parseCurrency(i.monto);
    });

    let grandTotal = 0;
    let html = `<div class="table-wrapper fade-in"><table class="data-table pivot-table">
      <thead><tr><th>Fuente</th><th>${monthLabel}</th></tr></thead><tbody>`;

    Object.entries(sourceMap).forEach(([src, v]) => {
      grandTotal += v;
      html += `<tr><td><strong>${src}</strong></td><td class="pivot-cell-value">${UI.formatCLP(v)}</td></tr>`;
    });

    html += `<tr class="pivot-total"><td><strong>Total</strong></td><td class="pivot-cell-value">${UI.formatCLP(grandTotal)}</td></tr>`;
    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }

  function renderSavingsPivot(container, month, year) {
    const savings = Store.getByMonth('savings', month, year);
    const categories = Store.getSavingsCategories();
    const monthLabel = UI.getMonthLabel(month, year);

    const totals = {};
    savings.forEach(r => {
      const cat = r.categoria || 'Sin categoría';
      totals[cat] = (totals[cat] || 0) + Store.parseCurrency(r.monto);
    });

    const usedCategories = categories.filter(c => totals[c] > 0);
    if (!usedCategories.length) { container.innerHTML = emptyPivot(); return; }

    let grandTotal = 0;
    let html = `<div class="table-wrapper fade-in"><table class="data-table pivot-table">
      <thead><tr><th>Categoría</th><th>${monthLabel}</th></tr></thead><tbody>`;

    usedCategories.forEach(c => {
      const v = totals[c];
      grandTotal += v;
      html += `<tr><td><strong>${c}</strong></td><td class="pivot-cell-value">${UI.formatCLP(v)}</td></tr>`;
    });

    html += `<tr class="pivot-total"><td><strong>Total</strong></td><td class="pivot-cell-value">${UI.formatCLP(grandTotal)}</td></tr>`;
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

  function emptyPivot() {
    return `<div class="empty-state fade-in">
      <div class="empty-state-text">Sin datos para tabla dinámica</div>
      <div class="empty-state-hint">Usa el botón "Añadir" para comenzar a registrar</div>
    </div>`;
  }

  return { render, renderPivot };
})();
