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

  function _buildWorkbook(type) {
    const columns = Store.getColumns(type);
    const records = Store.getAll(type);
    const headers = columns.map(c => c.label);
    const rows = records.map(r => columns.map(c => r[c.key] ?? ''));
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

  return { openImport, openDownload, openDelete };
})();
