// app.js — Main orchestrator

const App = (() => {
  let state = {
    dataType: 'expenses',
    viewMode: 'dashboard',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    drillFilter: null,
    rangeMonths: null,
    dateMode: 'fecha',
  };

  let _initialized = false;

  const _SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  function getActiveMonths() {
    return state.rangeMonths || [{ month: state.month, year: state.year }];
  }

  function _buildMonthRange(fromMonth, fromYear, toMonth, toYear) {
    const result = [];
    let m = fromMonth, y = fromYear;
    while ((y < toYear || (y === toYear && m <= toMonth)) && result.length < 120) {
      result.push({ month: m, year: y });
      if (++m > 12) { m = 1; y++; }
    }
    return result;
  }

  async function init() {
    if (_initialized) return;
    _initialized = true;
    bindNavbar();
    bindToolbar();
    bindRangePicker();
    bindCloseModals();
    await Store.init();
    refresh();
  }

  function refresh() {
    updateMonthDisplay();
    const { dataType, viewMode } = state;
    const months = getActiveMonths();

    document.getElementById('view-dashboard').classList.toggle('hidden', viewMode !== 'dashboard');
    document.getElementById('view-table').classList.toggle('hidden', viewMode !== 'table');
    document.getElementById('view-pivot').classList.toggle('hidden', viewMode !== 'pivot');

    Store.setDateMode(state.dateMode);
    if (viewMode === 'dashboard') Dashboard.render(dataType, months);
    else if (viewMode === 'table') TableView.render(dataType, months, state.drillFilter);
    else if (viewMode === 'pivot') TableView.renderPivot(dataType, months);
  }

  // ---------- NAVBAR ----------
  function bindNavbar() {
    // Dropdown "Añadir" options
    document.getElementById('dropdown-add-income').addEventListener('click', (e) => {
      e.preventDefault();
      renderAddForm('incomes');
      UI.openModal('modal-add');
    });
    document.getElementById('dropdown-add-expense').addEventListener('click', (e) => {
      e.preventDefault();
      renderAddForm('expenses');
      UI.openModal('modal-add');
    });
    document.getElementById('dropdown-add-account').addEventListener('click', (e) => {
      e.preventDefault();
      renderAddForm('accounts');
      UI.openModal('modal-add');
    });
    document.getElementById('dropdown-add-savings').addEventListener('click', (e) => {
      e.preventDefault();
      renderAddForm('savings');
      UI.openModal('modal-add');
    });

    // Dropdown "Edición" options
    document.getElementById('dropdown-edit-income').addEventListener('click', (e) => {
      e.preventDefault();
      Editor.open('incomes');
    });
    document.getElementById('dropdown-edit-expense').addEventListener('click', (e) => {
      e.preventDefault();
      Editor.open('expenses');
    });
    document.getElementById('dropdown-edit-account').addEventListener('click', (e) => {
      e.preventDefault();
      Editor.open('accounts');
    });
    document.getElementById('dropdown-edit-savings').addEventListener('click', (e) => {
      e.preventDefault();
      Editor.open('savings');
    });

    document.getElementById('dropdown-archivo-importar').addEventListener('click', (e) => {
      e.preventDefault();
      Archivo.openImport();
    });
    document.getElementById('dropdown-archivo-descargar').addEventListener('click', (e) => {
      e.preventDefault();
      Archivo.openDownload();
    });
  }

  // ---------- TOOLBAR ----------
  function bindToolbar() {
    // Data type toggles
    document.querySelectorAll('#data-type-toggle .toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#data-type-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.dataType = btn.dataset.type;
        state.drillFilter = null;
        refresh();
      });
    });

    // View mode toggles
    document.querySelectorAll('#view-mode-toggle .toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#view-mode-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.viewMode = btn.dataset.view;
        state.drillFilter = null;
        refresh();
      });
    });

    // Date mode options
    document.querySelectorAll('.date-mode-option').forEach(btn => {
      btn.addEventListener('click', () => {
        state.dateMode = btn.dataset.mode;
        document.querySelectorAll('.date-mode-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('date-mode-btn').textContent = btn.textContent;
        state.drillFilter = null;
        refresh();
      });
    });

    // Month navigation
    document.getElementById('month-prev').addEventListener('click', () => {
      state.month--;
      if (state.month < 1) { state.month = 12; state.year--; }
      state.drillFilter = null;
      refresh();
    });
    document.getElementById('month-next').addEventListener('click', () => {
      state.month++;
      if (state.month > 12) { state.month = 1; state.year++; }
      state.drillFilter = null;
      refresh();
    });
  }

  function updateMonthDisplay() {
    if (state.rangeMonths && state.rangeMonths.length > 0) {
      const first = state.rangeMonths[0];
      const last = state.rangeMonths[state.rangeMonths.length - 1];
      document.getElementById('month-display').textContent =
        `${UI.getMonthLabel(first.month, first.year)} – ${UI.getMonthLabel(last.month, last.year)}`;
    } else {
      document.getElementById('month-display').textContent = UI.getMonthLabel(state.month, state.year);
    }
  }

  // ---------- ADD MODAL ----------
  function renderAddStep1() {
    const content = document.getElementById('add-content');
    content.innerHTML = `
      <p class="form-label" style="margin-bottom:var(--space-4)">¿Qué deseas registrar?</p>
      <div class="type-selector">
        <div class="type-card" data-add-type="incomes">
          <div class="type-card-icon">💰</div>
          <div class="type-card-label">Ingreso</div>
        </div>
        <div class="type-card" data-add-type="expenses">
          <div class="type-card-icon">💸</div>
          <div class="type-card-label">Gasto</div>
        </div>
        <div class="type-card" data-add-type="accounts">
          <div class="type-card-icon">📒</div>
          <div class="type-card-label">Cuenta</div>
        </div>
        <div class="type-card" data-add-type="savings">
          <div class="type-card-icon">🏦</div>
          <div class="type-card-label">Ahorro / Inversión</div>
        </div>
      </div>
    `;
    content.querySelectorAll('.type-card').forEach(card => {
      card.addEventListener('click', () => renderAddForm(card.dataset.addType));
    });
  }

  function renderAddForm(type) {
    const content = document.getElementById('add-content');
    const title = document.getElementById('add-modal-title');

    if (type === 'incomes') {
      title.textContent = 'Registrar Ingreso';
      content.innerHTML = `
        <div class="form-group">
          <label class="form-label">Fecha (mm-yy)</label>
          <input class="form-input" id="add-fecha" placeholder="05-26" value="${UI.formatDateMY(new Date())}" />
        </div>
        <div class="form-group">
          <label class="form-label">Monto (CLP)</label>
          <input class="form-input" id="add-monto" type="number" placeholder="0" />
        </div>
        <div class="form-group autocomplete-wrapper">
          <label class="form-label">Fuente</label>
          <input class="form-input" id="add-fuente" placeholder="Trabajo, Freelance..." />
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="add-back">← Volver</button>
          <button class="btn btn-primary" id="add-save">Guardar</button>
        </div>
      `;

      UI.setupAutocomplete(
        document.getElementById('add-fuente'),
        () => Store.getSuggestions('incomes', 'fuente'),
        null
      );

      document.getElementById('add-back').addEventListener('click', renderAddStep1);
      document.getElementById('add-save').addEventListener('click', () => {
        const fecha = document.getElementById('add-fecha').value.trim();
        const monto = document.getElementById('add-monto').value.trim();
        const fuente = document.getElementById('add-fuente').value.trim();
        if (!fecha || !monto) { UI.toast('Completa los campos obligatorios', 'warning'); return; }
        Store.add('incomes', { fecha, monto: parseInt(monto), fuente });
        Store.addIncomeSource(fuente);
        UI.closeModal('modal-add');
        refresh();
      });

    } else if (type === 'expenses') {
      title.textContent = 'Registrar Gasto';
      content.innerHTML = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Fecha (dd-mm-yy)</label>
            <input class="form-input" id="add-fecha" placeholder="09-05-26" value="${UI.formatDateDMY(new Date())}" />
          </div>
          <div class="form-group">
            <label class="form-label">Mes Pago (mm-yy)</label>
            <input class="form-input" id="add-mesPago" placeholder="05-26" value="${UI.formatDateMY(new Date())}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Categoría</label>
          <select class="form-select" id="add-categoria"></select>
        </div>
        <div class="form-group">
          <label class="form-label">Gasto (CLP)</label>
          <input class="form-input" id="add-gasto" type="number" placeholder="0" />
        </div>
        <div class="form-group autocomplete-wrapper">
          <label class="form-label">Comentario</label>
          <input class="form-input" id="add-comentario" placeholder="Detalle del gasto..." />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tipo</label>
            <select class="form-select" id="add-tipo"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Medio de pago</label>
            <select class="form-select" id="add-medioPago"></select>
          </div>
        </div>
        <div class="form-group hidden" id="cuotas-group">
          <label class="form-label">Número de cuotas</label>
          <input class="form-input" id="add-cuotas" type="number" min="2" placeholder="3" />
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="add-back">← Volver</button>
          <button class="btn btn-primary" id="add-save">Guardar</button>
        </div>
      `;

      UI.renderSelectOptions(document.getElementById('add-categoria'), Store.getCategories(), 'Seleccionar categoría...');
      UI.renderSelectOptions(document.getElementById('add-tipo'), Store.getExpenseTypes(), 'Seleccionar tipo...');
      UI.renderSelectOptions(document.getElementById('add-medioPago'), Store.getPaymentMethods(), 'Seleccionar medio...');

      // Show cuotas field when "Tarjeta de crédito en cuotas" is selected
      document.getElementById('add-medioPago').addEventListener('change', (e) => {
        const cuotasGroup = document.getElementById('cuotas-group');
        if (e.target.value === 'Tarjeta de crédito en cuotas') {
          cuotasGroup.classList.remove('hidden');
        } else {
          cuotasGroup.classList.add('hidden');
        }
      });

      // Autocomplete for comment with category prediction
      UI.setupAutocomplete(
        document.getElementById('add-comentario'),
        () => Store.getSuggestions('expenses', 'comentario'),
        (selected) => {
          const predicted = Store.predictCategory(selected);
          if (predicted) {
            const catSelect = document.getElementById('add-categoria');
            catSelect.value = predicted;
          }
        }
      );

      // Also predict as user types
      document.getElementById('add-comentario').addEventListener('input', (e) => {
        const predicted = Store.predictCategory(e.target.value);
        if (predicted) {
          const catSelect = document.getElementById('add-categoria');
          if (!catSelect.value || catSelect.value === '') {
            catSelect.value = predicted;
          }
        }
      });

      // Validate category is in list
      document.getElementById('add-categoria').addEventListener('change', (e) => {
        const val = e.target.value;
        if (val && !Store.getCategories().includes(val)) {
          UI.toast('Categoría no válida. Ve a Edición para agregar nuevas categorías.', 'warning');
          e.target.value = '';
        }
      });

      document.getElementById('add-back').addEventListener('click', renderAddStep1);
      document.getElementById('add-save').addEventListener('click', () => {
        const fecha = document.getElementById('add-fecha').value.trim();
        const mesPago = document.getElementById('add-mesPago').value.trim();
        const categoria = document.getElementById('add-categoria').value;
        const gasto = parseInt(document.getElementById('add-gasto').value) || 0;
        const comentario = document.getElementById('add-comentario').value.trim();
        const tipo = document.getElementById('add-tipo').value;
        const medioPago = document.getElementById('add-medioPago').value;
        const cuotas = parseInt(document.getElementById('add-cuotas')?.value) || 0;

        if (!fecha || !gasto || !categoria || !tipo || !medioPago) {
          UI.toast('Completa los campos obligatorios', 'warning');
          return;
        }

        if (medioPago === 'Tarjeta de crédito en cuotas' && cuotas >= 2) {
          // Split into installments
          const montoCuota = Math.round(gasto / cuotas);
          const parsedFecha = UI.parseDateDMY(fecha);

          for (let i = 0; i < cuotas; i++) {
            const installDate = new Date(parsedFecha);
            installDate.setMonth(installDate.getMonth() + i);
            const dd = String(installDate.getDate()).padStart(2, '0');
            const mm = String(installDate.getMonth() + 1).padStart(2, '0');
            const yy = String(installDate.getFullYear()).slice(-2);

            Store.add('expenses', {
              fecha: `${dd}-${mm}-${yy}`,
              mesPago: `${mm}-${yy}`,
              categoria,
              gasto: montoCuota,
              comentario: `${comentario} (Cuota ${i + 1}/${cuotas})`,
              tipo,
              medioPago,
            });
          }
        } else {
          Store.add('expenses', { fecha, mesPago, categoria, gasto, comentario, tipo, medioPago });
        }

        UI.closeModal('modal-add');
        refresh();
      });

    } else if (type === 'accounts') {
      title.textContent = 'Registrar Cuenta';
      content.innerHTML = `
        <div class="form-group">
          <label class="form-label">Fecha (dd-mm-yy)</label>
          <input class="form-input" id="add-fecha" placeholder="09-05-26" value="${UI.formatDateDMY(new Date())}" />
        </div>
        <div class="form-group autocomplete-wrapper">
          <label class="form-label">Persona</label>
          <input class="form-input" id="add-persona" placeholder="Nombre de la persona..." />
        </div>
        <div class="form-group">
          <label class="form-label">Descripción</label>
          <textarea class="form-textarea" id="add-descripcion" placeholder="Detalle de la cuenta..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tipo</label>
            <select class="form-select" id="add-tipo"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Monto (CLP)</label>
            <input class="form-input" id="add-monto" type="number" placeholder="0" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="add-back">← Volver</button>
          <button class="btn btn-primary" id="add-save">Guardar</button>
        </div>
      `;

      UI.renderSelectOptions(document.getElementById('add-tipo'), Store.getAccountTypes(), 'Seleccionar tipo...');
      UI.setupAutocomplete(
        document.getElementById('add-persona'),
        () => Store.getSuggestions('accounts', 'persona'),
        null
      );

      document.getElementById('add-back').addEventListener('click', renderAddStep1);
      document.getElementById('add-save').addEventListener('click', () => {
        const fecha = document.getElementById('add-fecha').value.trim();
        const persona = document.getElementById('add-persona').value.trim();
        const descripcion = document.getElementById('add-descripcion').value.trim();
        const tipo = document.getElementById('add-tipo').value;
        const monto = parseInt(document.getElementById('add-monto').value) || 0;
        if (!fecha || !persona || !monto) { UI.toast('Completa los campos obligatorios', 'warning'); return; }
        Store.add('accounts', { fecha, persona, descripcion, tipo, monto });
        UI.closeModal('modal-add');
        refresh();
      });

    } else if (type === 'savings') {
      title.textContent = 'Registrar Ahorro / Inversión';
      content.innerHTML = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Fecha (dd-mm-yy)</label>
            <input class="form-input" id="add-fecha" placeholder="09-05-26" value="${UI.formatDateDMY(new Date())}" />
          </div>
          <div class="form-group">
            <label class="form-label">Mes (mm-yy)</label>
            <input class="form-input" id="add-mesPago" placeholder="05-26" value="${UI.formatDateMY(new Date())}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Categoría</label>
          <select class="form-select" id="add-categoria"></select>
        </div>
        <div class="form-group">
          <label class="form-label">Monto (CLP)</label>
          <input class="form-input" id="add-monto" type="number" placeholder="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Descripción</label>
          <input class="form-input" id="add-descripcion" placeholder="Detalle del movimiento..." />
        </div>
        <div class="form-group autocomplete-wrapper">
          <label class="form-label">Institución</label>
          <input class="form-input" id="add-institucion" placeholder="Banco, Corredora, AFP..." />
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="add-back">← Volver</button>
          <button class="btn btn-primary" id="add-save">Guardar</button>
        </div>
      `;

      UI.renderSelectOptions(document.getElementById('add-categoria'), Store.getSavingsCategories(), 'Seleccionar categoría...');
      UI.setupAutocomplete(
        document.getElementById('add-institucion'),
        () => Store.getSuggestions('savings', 'institucion'),
        null
      );

      document.getElementById('add-back').addEventListener('click', renderAddStep1);
      document.getElementById('add-save').addEventListener('click', () => {
        const fecha = document.getElementById('add-fecha').value.trim();
        const mesPago = document.getElementById('add-mesPago').value.trim();
        const categoria = document.getElementById('add-categoria').value;
        const monto = parseInt(document.getElementById('add-monto').value) || 0;
        const descripcion = document.getElementById('add-descripcion').value.trim();
        const institucion = document.getElementById('add-institucion').value.trim();
        if (!fecha || !monto || !categoria) { UI.toast('Completa los campos obligatorios', 'warning'); return; }
        Store.add('savings', { fecha, mesPago, categoria, monto, descripcion, institucion });
        UI.closeModal('modal-add');
        refresh();
      });
    }
  }

  // ---------- RANGE PICKER ----------
  function bindRangePicker() {
    const btn = document.getElementById('range-picker-btn');
    const popover = document.getElementById('range-popover');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!popover.classList.contains('hidden')) {
        popover.classList.add('hidden');
        return;
      }
      popover.innerHTML = _renderRangePopover();
      popover.classList.remove('hidden');

      document.getElementById('range-apply').addEventListener('click', () => {
        const fromMonth = parseInt(document.getElementById('range-from-month').value);
        const fromYear  = parseInt(document.getElementById('range-from-year').value);
        const toMonth   = parseInt(document.getElementById('range-to-month').value);
        const toYear    = parseInt(document.getElementById('range-to-year').value);
        if (fromYear > toYear || (fromYear === toYear && fromMonth > toMonth)) {
          UI.toast('La fecha inicio debe ser anterior a la fecha final', 'warning');
          return;
        }
        state.rangeMonths = _buildMonthRange(fromMonth, fromYear, toMonth, toYear);
        popover.classList.add('hidden');
        _updateRangeButton();
        refresh();
      });

      const clearBtn = document.getElementById('range-clear');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          state.rangeMonths = null;
          popover.classList.add('hidden');
          _updateRangeButton();
          refresh();
        });
      }
    });

    document.addEventListener('click', (e) => {
      if (!document.getElementById('range-picker-wrapper').contains(e.target)) {
        popover.classList.add('hidden');
      }
    });
  }

  function _renderRangePopover() {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear - 3; y <= currentYear + 1; y++) years.push(y);

    const fromMonth = state.rangeMonths ? state.rangeMonths[0].month : state.month;
    const fromYear  = state.rangeMonths ? state.rangeMonths[0].year  : state.year;
    const toMonth   = state.rangeMonths ? state.rangeMonths[state.rangeMonths.length - 1].month : state.month;
    const toYear    = state.rangeMonths ? state.rangeMonths[state.rangeMonths.length - 1].year  : state.year;

    const monthOpts = (sel) => _SHORT_MONTHS.map((n, i) =>
      `<option value="${i+1}"${i+1===sel?' selected':''}>${n}</option>`).join('');
    const yearOpts  = (sel) => years.map(y =>
      `<option value="${y}"${y===sel?' selected':''}>${y}</option>`).join('');

    return `
      <div class="range-popover-inner">
        <div class="range-fields">
          <div class="range-field">
            <span class="range-field-label">Desde</span>
            <div class="range-selects">
              <select id="range-from-month">${monthOpts(fromMonth)}</select>
              <select id="range-from-year">${yearOpts(fromYear)}</select>
            </div>
          </div>
          <span class="range-arrow">→</span>
          <div class="range-field">
            <span class="range-field-label">Hasta</span>
            <div class="range-selects">
              <select id="range-to-month">${monthOpts(toMonth)}</select>
              <select id="range-to-year">${yearOpts(toYear)}</select>
            </div>
          </div>
        </div>
        <div class="range-actions">
          ${state.rangeMonths ? '<button class="btn btn-outline" id="range-clear">Limpiar</button>' : ''}
          <button class="btn btn-primary" id="range-apply">Aplicar</button>
        </div>
      </div>`;
  }

  function _updateRangeButton() {
    const btn = document.getElementById('range-picker-btn');
    if (!btn) return;
    if (state.rangeMonths && state.rangeMonths.length > 0) {
      const first = state.rangeMonths[0];
      const last  = state.rangeMonths[state.rangeMonths.length - 1];
      btn.textContent = `${_SHORT_MONTHS[first.month-1]} ${String(first.year).slice(-2)} – ${_SHORT_MONTHS[last.month-1]} ${String(last.year).slice(-2)}`;
      btn.classList.add('active');
    } else {
      btn.textContent = 'Meses';
      btn.classList.remove('active');
    }
    const monthPrev = document.getElementById('month-prev');
    const monthNext = document.getElementById('month-next');
    if (monthPrev) monthPrev.disabled = !!state.rangeMonths;
    if (monthNext) monthNext.disabled = !!state.rangeMonths;
  }

  // ---------- DRILL DOWN ----------
  function drillDown(key, value) {
    state.drillFilter = { key, value };
    state.viewMode = 'table';
    document.querySelectorAll('#view-mode-toggle .toggle-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === 'table');
    });
    refresh();
  }

  function clearDrillFilter() {
    state.drillFilter = null;
    refresh();
  }

  // ---------- CLOSE MODALS ----------
  function bindCloseModals() {
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    });
  }

  return { init, refresh, drillDown, clearDrillFilter, getActiveMonths };
})();

// Boot
document.addEventListener('DOMContentLoaded', async () => {
  Auth.init();
  const user = await Auth.checkSession();
  if (user) {
    Auth.hideAuthView();
    App.init();
  } else {
    Auth.showAuthView();
    Auth.renderLoginForm();
  }
});
