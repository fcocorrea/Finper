// importer.js — CSV/XLSX file import (SheetJS)

const Importer = (() => {

  function open() {
    renderImportModal();
    UI.openModal('modal-import');
  }

  function renderImportModal() {
    const content = document.getElementById('import-content');
    content.innerHTML = `
      <div class="form-group">
        <label class="form-label">¿Qué tipo de dato estás importando?</label>
        <select class="form-select" id="import-type">
          <option value="expenses">Gastos</option>
          <option value="incomes">Ingresos</option>
          <option value="accounts">Cuentas</option>
          <option value="savings">Ahorros / Inversiones</option>
        </select>
      </div>
      <div class="file-drop" id="file-drop-zone">
        <div class="file-drop-icon"></div>
        <div class="file-drop-text">Arrastra un archivo <strong>.csv</strong> o <strong>.xlsx</strong> aquí<br>o haz clic para seleccionar</div>
        <input type="file" id="import-file-input" accept=".csv,.xlsx,.xls" style="display:none" />
      </div>
      <div id="import-preview" style="margin-top:var(--space-4)"></div>
      <div id="import-actions" class="hidden" style="margin-top:var(--space-4);display:flex;gap:var(--space-3);justify-content:flex-end">
        <button class="btn btn-primary" id="import-confirm">Importar datos</button>
      </div>
    `;

    const dropZone = document.getElementById('file-drop-zone');
    const fileInput = document.getElementById('import-file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleFile(fileInput.files[0]);
    });
  }

  let pendingRecords = [];

  function handleFile(file) {
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      UI.toast('Formato no válido. Solo se admiten archivos .csv o .xlsx', 'error');
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      _showError(
        'No se pudo leer el archivo.',
        'El archivo puede estar en uso por otro programa o estar dañado.'
      );
    };

    reader.onload = (e) => {
      // ── 1. Parse workbook ──────────────────────────────────────────
      let workbook;
      try {
        workbook = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      } catch (err) {
        _showError(
          'El archivo no pudo ser procesado como Excel o CSV.',
          `Detalle técnico: ${err.message}`
        );
        return;
      }

      // ── 2. Extract rows ────────────────────────────────────────────
      let jsonData;
      try {
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      } catch (err) {
        _showError(
          'No se pudo leer la hoja de datos del archivo.',
          `Detalle técnico: ${err.message}`
        );
        return;
      }

      if (!jsonData.length) {
        _showError(
          'El archivo no contiene datos.',
          'Verifica que la primera fila tenga los encabezados de columna y que exista al menos un registro.'
        );
        return;
      }

      // ── 3. Match headers ───────────────────────────────────────────
      const dataType = document.getElementById('import-type').value;
      const columns = Store.getColumns(dataType);
      const fileHeaders = Object.keys(jsonData[0]);
      const colLabels = columns.map(c => c.label.toLowerCase().trim());

      const matchedHeaders = {};
      fileHeaders.forEach(h => {
        const idx = colLabels.findIndex(cl => cl === h.toLowerCase().trim());
        if (idx >= 0) matchedHeaders[h] = columns[idx].key;
      });

      if (!Object.keys(matchedHeaders).length) {
        _showError(
          'Ningún encabezado del archivo coincide con las columnas configuradas.',
          `<strong>Columnas esperadas:</strong> ${columns.map(c => c.label).join(', ')}<br>` +
          `<strong>Columnas encontradas:</strong> ${fileHeaders.join(', ')}`
        );
        return;
      }

      const unmatchedCols = columns
        .filter(c => !Object.values(matchedHeaders).includes(c.key))
        .map(c => c.label);

      // ── 4. Map & validate rows ─────────────────────────────────────
      const DMY = /^\d{2}-\d{2}-\d{2}$/;
      const MY  = /^\d{2}-\d{2}$/;
      const rowErrors = [];
      const mapped = [];

      jsonData.forEach((row, i) => {
        const record = {};
        let rowError = null;

        try {
          Object.entries(matchedHeaders).forEach(([fileH, colKey]) => {
            let val = row[fileH];
            const col = columns.find(c => c.key === colKey);
            if (!col) return;

            if (col.type === 'currency') {
              val = Store.parseCurrency(val);
            } else if (col.type === 'date-dmy') {
              val = _toDateDMY(val);
              if (!DMY.test(val)) {
                throw new Error(`Fecha inválida en columna "${col.label}": "${row[fileH]}" — formato esperado dd-mm-aa`);
              }
            } else if (col.type === 'date-my') {
              val = _toDateMY(val);
              if (!MY.test(val)) {
                throw new Error(`Fecha inválida en columna "${col.label}": "${row[fileH]}" — formato esperado mm-aa`);
              }
            }

            record[colKey] = String(val);
          });
        } catch (err) {
          rowError = err.message;
        }

        if (rowError) {
          rowErrors.push(`Fila ${i + 2}: ${rowError}`);
        } else {
          mapped.push(record);
        }
      });

      if (!mapped.length) {
        _showError(
          `Todos los registros (${jsonData.length}) contienen errores y no pueden importarse.`,
          rowErrors.slice(0, 5).map(e => `• ${e}`).join('<br>') +
          (rowErrors.length > 5 ? `<br>• ... y ${rowErrors.length - 5} errores más` : '')
        );
        return;
      }

      pendingRecords = mapped;

      // ── 5. Render preview ──────────────────────────────────────────
      const preview = document.getElementById('import-preview');
      let html = '';

      if (rowErrors.length) {
        html += `<div class="import-banner import-banner--warning">
          <strong>${rowErrors.length} fila(s) con errores serán omitidas.</strong><br>
          ${rowErrors.slice(0, 3).map(e => `• ${e}`).join('<br>')}
          ${rowErrors.length > 3 ? `<br>• ... y ${rowErrors.length - 3} más` : ''}
        </div>`;
      }

      if (unmatchedCols.length) {
        html += `<div class="import-banner import-banner--warning">
          <strong>Columnas no encontradas en el archivo (quedarán vacías):</strong> ${unmatchedCols.join(', ')}
        </div>`;
      }

      html += `<p style="margin-bottom:var(--space-2);color:var(--color-accent);font-weight:600">${mapped.length} registros listos para importar</p>`;
      html += `<div class="table-wrapper" style="max-height:250px;overflow-y:auto"><table class="data-table"><thead><tr>`;
      columns.forEach(c => { html += `<th>${c.label}</th>`; });
      html += `</tr></thead><tbody>`;
      mapped.slice(0, 10).forEach(r => {
        html += `<tr>`;
        columns.forEach(c => { html += `<td>${r[c.key] || ''}</td>`; });
        html += `</tr>`;
      });
      if (mapped.length > 10) {
        html += `<tr><td colspan="${columns.length}" style="text-align:center;color:var(--color-muted)">... y ${mapped.length - 10} más</td></tr>`;
      }
      html += `</tbody></table></div>`;
      preview.innerHTML = html;

      const actions = document.getElementById('import-actions');
      actions.classList.remove('hidden');
      actions.style.display = 'flex';

      document.getElementById('import-confirm').onclick = () => {
        const type = document.getElementById('import-type').value;
        Store.bulkAdd(type, pendingRecords);
        UI.toast(`${pendingRecords.length} registros importados`, 'success');
        pendingRecords = [];
        UI.closeModal('modal-import');
        App.refresh();
      };
    };

    reader.readAsArrayBuffer(file);
  }

  function _showError(message, detail = '') {
    const preview = document.getElementById('import-preview');
    if (!preview) return;
    preview.innerHTML = `
      <div class="import-banner import-banner--error">
        <strong>${message}</strong>
        ${detail ? `<div style="margin-top:var(--space-2);line-height:1.7">${detail}</div>` : ''}
      </div>
    `;
    const actions = document.getElementById('import-actions');
    if (actions) actions.classList.add('hidden');
    pendingRecords = [];
  }

  function _parseToDate(val) {
    if (val instanceof Date) return val;
    if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000);
    return null;
  }

  function _toDateDMY(val) {
    const d = _parseToDate(val);
    if (!d) return String(val);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yy = String(d.getUTCFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  }

  function _toDateMY(val) {
    const d = _parseToDate(val);
    if (!d) return String(val);
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yy = String(d.getUTCFullYear()).slice(-2);
    return `${mm}-${yy}`;
  }

  return { open };
})();
