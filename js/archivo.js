// archivo.js — Archivo menu: Import, Download, Delete

const Archivo = (() => {
  const DATA_TYPES = [
    { key: 'expenses', label: 'Gastos' },
    { key: 'incomes',  label: 'Ingresos' },
    { key: 'accounts', label: 'Cuentas' },
    { key: 'savings',  label: 'Ahorros' },
  ];

  function openImport() {
    Importer.open();
  }

  function openDownload() {
    _renderModal('modal-download');
    UI.openModal('modal-download');
  }

  function openDelete() {
    _renderModal('modal-delete');
    UI.openModal('modal-delete');
  }

  // ---------- FECHA DE FACTURACIÓN ----------
  // La factura de la tarjeta se paga con el sueldo de fin de mes, que se usa
  // para el mes siguiente: el mes de pago siempre es facturación + 1.
  function openBilling() {
    const content = document.getElementById('billing-content');
    const billing = Store.getBillingDate();

    content.innerHTML = `
      <p class="form-label" style="margin-bottom:var(--space-4)">
        Ingresa la próxima fecha en que tu tarjeta de crédito factura. Los gastos con
        tarjeta calcularán su mes de pago desde esa fecha.
      </p>
      <div class="form-group">
        <label class="form-label">Próxima fecha de facturación (dd-mm-yy)</label>
        <input class="form-input" id="billing-input" placeholder="18-12-26"
          value="${billing ? UI.formatDateDMY(billing) : ''}" />
        <span class="form-hint" id="billing-hint"></span>
      </div>
      <div class="modal-footer">
        ${billing ? '<button class="btn btn-danger" id="billing-clear">Quitar</button>' : ''}
        <button class="btn btn-outline" id="billing-cancel">Cancelar</button>
        <button class="btn btn-primary" id="billing-save">Guardar</button>
      </div>
    `;

    const input = document.getElementById('billing-input');
    const hint = document.getElementById('billing-hint');

    function updatePreview() {
      const value = input.value.trim();
      if (!value) {
        hint.textContent = 'Sin fecha configurada, el mes de pago se ingresa a mano.';
        return;
      }
      const mesPago = Store.previewCardMesPago(value, UI.formatDateDMY(new Date()));
      if (!mesPago) {
        hint.textContent = 'Fecha inválida. Usa el formato dd-mm-yy.';
        return;
      }
      const parsed = UI.parseDateMY(mesPago);
      hint.textContent = `Un gasto de hoy quedaría para pago ${UI.getMonthLabel(parsed.getMonth() + 1, parsed.getFullYear())} (${mesPago}).`;
    }

    input.addEventListener('input', updatePreview);
    updatePreview();

    document.getElementById('billing-cancel').addEventListener('click', () => UI.closeModal('modal-billing'));

    document.getElementById('billing-save').addEventListener('click', () => {
      const value = input.value.trim();
      if (!value) { UI.toast('Ingresa una fecha de facturación', 'warning'); return; }
      if (!Store.setBillingDate(value)) { UI.toast('Fecha inválida. Usa dd-mm-yy', 'warning'); return; }
      UI.closeModal('modal-billing');
      UI.toast(`Facturación guardada: ${UI.formatDateDMY(Store.getBillingDate())}`, 'success');
      App.refresh();
    });

    const clearBtn = document.getElementById('billing-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        Store.clearBillingDate();
        UI.closeModal('modal-billing');
        UI.toast('Fecha de facturación eliminada', 'success');
        App.refresh();
      });
    }

    UI.openModal('modal-billing');
    input.focus();
    input.select();
  }

  function _renderModal(modalId) {
    const isDelete = modalId === 'modal-delete';
    const mode = isDelete ? 'delete' : 'download';
    const content = document.getElementById(`${mode}-content`);

    content.innerHTML = `
      <p class="form-label" style="margin-bottom:var(--space-4)">
        ${isDelete ? 'Selecciona los datos a eliminar:' : 'Selecciona los datos a descargar:'}
      </p>
      <div class="checkbox-group">
        ${DATA_TYPES.map(t => `
          <label class="checkbox-label">
            <input type="checkbox" class="data-type-checkbox" value="${t.key}" />
            <span>${t.label}</span>
          </label>
        `).join('')}
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" id="${mode}-cancel">Cancelar</button>
        <button class="btn ${isDelete ? 'btn-danger' : 'btn-primary'}" id="${mode}-confirm">
          ${isDelete ? 'Eliminar' : 'Descargar'}
        </button>
      </div>
    `;

    document.getElementById(`${mode}-cancel`).addEventListener('click', () => UI.closeModal(modalId));

    document.getElementById(`${mode}-confirm`).addEventListener('click', async () => {
      const selected = [...content.querySelectorAll('.data-type-checkbox:checked')].map(cb => cb.value);
      if (!selected.length) {
        UI.toast('Selecciona al menos un tipo de dato', 'warning');
        return;
      }
      if (isDelete) {
        await _handleDelete(selected, modalId);
      } else {
        _handleDownload(selected, modalId);
      }
    });
  }

  async function _handleDelete(types, modalId) {
    const names = types.map(t => DATA_TYPES.find(d => d.key === t).label).join(', ');
    const single = types.length === 1;
    const confirmed = await UI.confirm(
      '¿Estás seguro?',
      'Esta acción no se puede deshacer.'
    );
    if (!confirmed) return;

    types.forEach(type => Store.clearAll(type));
    UI.closeModal(modalId);
    UI.toast(`Eliminado: ${names}`, 'success');
    App.refresh();
  }

  function _handleDownload(types, modalId) {
    if (types.length === 1) {
      _downloadSingle(types[0]);
    } else {
      _downloadZip(types);
    }
    UI.closeModal(modalId);
  }

  // Las columnas derivadas (p. ej. "Cuota") no tienen campo propio en el registro.
  function _cellValue(record, col) {
    if (col.type === 'cuota') return Store.formatCuota(record);
    return record[col.key] ?? '';
  }

  function _buildWorkbook(type) {
    const columns = Store.getColumns(type);
    const records = Store.getAll(type);
    const headers = columns.map(c => c.label);
    const rows = records.map(r => columns.map(c => _cellValue(r, c)));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    return wb;
  }

  function _downloadSingle(type) {
    const label = DATA_TYPES.find(d => d.key === type).label;
    const wb = _buildWorkbook(type);
    XLSX.writeFile(wb, `finper_${type}.xlsx`);
    UI.toast(`${label} exportado correctamente`, 'success');
  }

  async function _downloadZip(types) {
    if (typeof JSZip === 'undefined') {
      UI.toast('JSZip no disponible — descargando archivos por separado', 'warning');
      types.forEach(t => _downloadSingle(t));
      return;
    }

    const zip = new JSZip();
    types.forEach(type => {
      const wb = _buildWorkbook(type);
      const wbArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      zip.file(`finper_${type}.xlsx`, wbArray);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finper_exportacion.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.toast('Exportación descargada como ZIP', 'success');
  }

  return { openImport, openDownload, openDelete, openBilling };
})();
