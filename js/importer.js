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
      UI.toast('Solo se admiten archivos .csv o .xlsx', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!jsonData.length) {
          UI.toast('El archivo está vacío', 'warning');
          return;
        }

        const dataType = document.getElementById('import-type').value;
        const columns = Store.getColumns(dataType);
        const fileHeaders = Object.keys(jsonData[0]);

        // Validate headers match
        const colLabels = columns.map(c => c.label.toLowerCase().trim());
        const matchedHeaders = {};
        let mismatch = false;

        fileHeaders.forEach(h => {
          const normalized = h.toLowerCase().trim();
          const colIdx = colLabels.findIndex(cl => cl === normalized);
          if (colIdx >= 0) {
            matchedHeaders[h] = columns[colIdx].key;
          }
        });

        if (Object.keys(matchedHeaders).length === 0) {
          UI.toast('Los encabezados del archivo no coinciden con la configuración actual. Verifica que los nombres de las columnas sean iguales.', 'error');
          return;
        }

        // Map records
        pendingRecords = jsonData.map(row => {
          const record = {};
          Object.entries(matchedHeaders).forEach(([fileH, colKey]) => {
            let val = row[fileH];
            const col = columns.find(c => c.key === colKey);
            // Adapt format
            if (col && col.type === 'currency') {
              val = Store.parseCurrency(val);
            }
            record[colKey] = String(val);
          });
          return record;
        });

        // Preview
        const preview = document.getElementById('import-preview');
        let html = `<p style="margin-bottom:var(--space-2);color:var(--color-accent);font-weight:600">${pendingRecords.length} registros detectados</p>`;
        html += `<div class="table-wrapper" style="max-height:250px;overflow-y:auto"><table class="data-table"><thead><tr>`;
        columns.forEach(c => { html += `<th>${c.label}</th>`; });
        html += `</tr></thead><tbody>`;
        pendingRecords.slice(0, 10).forEach(r => {
          html += `<tr>`;
          columns.forEach(c => {
            html += `<td>${r[c.key] || ''}</td>`;
          });
          html += `</tr>`;
        });
        if (pendingRecords.length > 10) {
          html += `<tr><td colspan="${columns.length}" style="text-align:center;color:var(--color-muted)">... y ${pendingRecords.length - 10} más</td></tr>`;
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

      } catch (err) {
        console.error(err);
        UI.toast('Error al leer el archivo', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return { open };
})();
