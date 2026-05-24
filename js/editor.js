// editor.js — Column & category editor

const Editor = (() => {

  function open(dataType) {
    if (dataType) {
      renderStep2(dataType);
    } else {
      renderStep1();
    }
    UI.openModal('modal-editor');
  }

  function renderStep1() {
    const content = document.getElementById('editor-content');
    content.innerHTML = `
      <p class="form-label" style="margin-bottom: var(--space-4)">¿Qué tipo de dato deseas editar?</p>
      <div class="type-selector">
        <div class="type-card" data-type="expenses">
          <div class="type-card-icon"></div>
          <div class="type-card-label">Gastos</div>
        </div>
        <div class="type-card" data-type="incomes">
          <div class="type-card-icon"></div>
          <div class="type-card-label">Ingresos</div>
        </div>
        <div class="type-card" data-type="accounts">
          <div class="type-card-icon"></div>
          <div class="type-card-label">Cuentas</div>
        </div>
        <div class="type-card" data-type="savings">
          <div class="type-card-icon"></div>
          <div class="type-card-label">Ahorros</div>
        </div>
      </div>
    `;
    content.querySelectorAll('.type-card').forEach(card => {
      card.addEventListener('click', () => renderStep2(card.dataset.type));
    });
  }

  function renderStep2(dataType) {
    const content = document.getElementById('editor-content');
    const typeLabel = { expenses: 'Gastos', incomes: 'Ingresos', accounts: 'Cuentas', savings: 'Ahorros' }[dataType];

    let html = `
      <button class="btn btn-ghost btn-sm" id="editor-back" style="margin-bottom:var(--space-4)">← Volver</button>
      <h3 style="margin-bottom:var(--space-4)">Editar ${typeLabel}</h3>
      <div class="type-selector">
        <div class="type-card" data-action="rename">
          <div class="type-card-icon"></div>
          <div class="type-card-label">Renombrar columna</div>
        </div>
        <div class="type-card" data-action="add-col">
          <div class="type-card-icon"></div>
          <div class="type-card-label">Agregar columna</div>
        </div>
        <div class="type-card" data-action="remove-col">
          <div class="type-card-icon"></div>
          <div class="type-card-label">Eliminar columna</div>
        </div>`;

    if (dataType === 'expenses') {
      html += `
        <div class="type-card" data-action="edit-categories">
          <div class="type-card-icon"></div>
          <div class="type-card-label">Editar categorías</div>
        </div>`;
    }
    if (dataType === 'savings') {
      html += `
        <div class="type-card" data-action="edit-savings-categories">
          <div class="type-card-icon"></div>
          <div class="type-card-label">Editar categorías</div>
        </div>`;
    }

    html += `</div>`;
    content.innerHTML = html;

    document.getElementById('editor-back').addEventListener('click', renderStep1);

    content.querySelectorAll('.type-card').forEach(card => {
      card.addEventListener('click', () => {
        const action = card.dataset.action;
        if (action === 'rename') renderRenameColumn(dataType);
        else if (action === 'add-col') renderAddColumn(dataType);
        else if (action === 'remove-col') renderRemoveColumn(dataType);
        else if (action === 'edit-categories') renderEditCategories();
        else if (action === 'edit-savings-categories') renderEditSavingsCategories();
      });
    });
  }

  // ---------- RENAME COLUMN ----------
  function renderRenameColumn(dataType) {
    const content = document.getElementById('editor-content');
    const columns = Store.getColumns(dataType);

    content.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="editor-back">← Volver</button>
      <h3 style="margin:var(--space-4) 0">Renombrar columna</h3>
      <div class="form-group">
        <label class="form-label">Seleccionar columna</label>
        <select class="form-select" id="col-select">
          ${columns.map(c => `<option value="${c.key}">${c.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Nuevo nombre</label>
        <input class="form-input" id="col-new-name" placeholder="Nuevo nombre..." />
      </div>
      <button class="btn btn-primary" id="col-rename-save">Guardar</button>
    `;

    document.getElementById('editor-back').addEventListener('click', () => renderStep2(dataType));
    document.getElementById('col-rename-save').addEventListener('click', () => {
      const key = document.getElementById('col-select').value;
      const newName = document.getElementById('col-new-name').value.trim();
      if (!newName) { UI.toast('Ingresa un nombre', 'warning'); return; }
      const cols = Store.getColumns(dataType);
      const col = cols.find(c => c.key === key);
      if (col) {
        col.label = newName;
        Store.setColumns(dataType, cols);
        UI.toast('Columna renombrada', 'success');
        App.refresh();
      }
    });
  }

  // ---------- ADD COLUMN ----------
  function renderAddColumn(dataType) {
    const content = document.getElementById('editor-content');
    content.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="editor-back">← Volver</button>
      <h3 style="margin:var(--space-4) 0">Agregar columna</h3>
      <div class="form-group">
        <label class="form-label">Nombre de la columna</label>
        <input class="form-input" id="new-col-name" placeholder="Nombre..." />
      </div>
      <div class="form-group">
        <label class="form-label">Tipo de dato</label>
        <select class="form-select" id="new-col-type">
          <option value="text">Texto</option>
          <option value="currency">Moneda (CLP)</option>
          <option value="date-dmy">Fecha (dd-mm-yy)</option>
          <option value="date-my">Fecha (mm-yy)</option>
          <option value="select">Lista desplegable</option>
        </select>
      </div>
      <button class="btn btn-primary" id="new-col-save">Agregar</button>
    `;

    document.getElementById('editor-back').addEventListener('click', () => renderStep2(dataType));
    document.getElementById('new-col-save').addEventListener('click', () => {
      const name = document.getElementById('new-col-name').value.trim();
      const type = document.getElementById('new-col-type').value;
      if (!name) { UI.toast('Ingresa un nombre', 'warning'); return; }
      const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const cols = Store.getColumns(dataType);
      if (cols.some(c => c.key === key)) { UI.toast('Ya existe una columna similar', 'warning'); return; }
      cols.push({ key, label: name, type });
      Store.setColumns(dataType, cols);
      UI.toast('Columna agregada', 'success');
      App.refresh();
    });
  }

  // ---------- REMOVE COLUMN ----------
  function renderRemoveColumn(dataType) {
    const content = document.getElementById('editor-content');
    const columns = Store.getColumns(dataType);

    content.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="editor-back">← Volver</button>
      <h3 style="margin:var(--space-4) 0">Eliminar columna</h3>
      <div class="form-group">
        <label class="form-label">Seleccionar columna a eliminar</label>
        <select class="form-select" id="col-remove-select">
          ${columns.map(c => `<option value="${c.key}">${c.label}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-danger" id="col-remove-btn">Eliminar</button>
    `;

    document.getElementById('editor-back').addEventListener('click', () => renderStep2(dataType));
    document.getElementById('col-remove-btn').addEventListener('click', async () => {
      const key = document.getElementById('col-remove-select').value;
      const ok = await UI.confirm('Eliminar columna', '¿Estás seguro? Los datos de esta columna no se eliminarán, pero la columna no será visible.');
      if (ok) {
        let cols = Store.getColumns(dataType).filter(c => c.key !== key);
        Store.setColumns(dataType, cols);
        UI.toast('Columna eliminada', 'success');
        App.refresh();
      }
    });
  }

  // ---------- EDIT CATEGORIES ----------
  function renderEditCategories() {
    const content = document.getElementById('editor-content');
    const categories = Store.getCategories();

    function renderList() {
      let html = `
        <button class="btn btn-ghost btn-sm" id="editor-back">← Volver</button>
        <h3 style="margin:var(--space-4) 0">Editar categorías de gastos</h3>
        <div class="form-row" style="margin-bottom:var(--space-4)">
          <input class="form-input" id="new-cat-input" placeholder="Nueva categoría..." />
          <button class="btn btn-accent" id="add-cat-btn">Agregar</button>
        </div>
        <div style="max-height:300px;overflow-y:auto">
      `;
      Store.getCategories().forEach(cat => {
        html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--color-border)">
          <span>${cat}</span>
          <div style="display:flex;gap:var(--space-1)">
            <button class="btn btn-ghost btn-sm cat-rename" data-cat="${cat}" title="Renombrar" style="width:auto;padding:0 var(--space-2);font-size:var(--text-xs)">Renombrar</button>
            <button class="btn btn-ghost btn-sm cat-delete" data-cat="${cat}" title="Eliminar" style="width:auto;padding:0 var(--space-2);font-size:var(--text-xs)">Eliminar</button>
          </div>
        </div>`;
      });
      html += `</div>`;
      content.innerHTML = html;

      document.getElementById('editor-back').addEventListener('click', () => renderStep2('expenses'));
      document.getElementById('add-cat-btn').addEventListener('click', () => {
        const name = document.getElementById('new-cat-input').value.trim();
        if (!name) return;
        if (Store.addCategory(name)) {
          UI.toast(`Categoría "${name}" agregada`, 'success');
          renderList();
        } else {
          UI.toast('La categoría ya existe', 'warning');
        }
      });

      content.querySelectorAll('.cat-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          const cat = btn.dataset.cat;
          const result = Store.removeCategory(cat);
          if (result.error === 'in_use') {
            UI.toast(`No se puede eliminar "${cat}" porque está en uso`, 'error');
          } else {
            UI.toast(`Categoría "${cat}" eliminada`, 'success');
            renderList();
          }
        });
      });

      content.querySelectorAll('.cat-rename').forEach(btn => {
        btn.addEventListener('click', () => {
          const cat = btn.dataset.cat;
          const newName = prompt(`Renombrar "${cat}" a:`, cat);
          if (newName && newName.trim() && newName.trim() !== cat) {
            Store.renameCategory(cat, newName.trim());
            UI.toast(`Categoría renombrada a "${newName.trim()}"`, 'success');
            renderList();
          }
        });
      });
    }

    renderList();
  }

  // ---------- EDIT SAVINGS CATEGORIES ----------
  function renderEditSavingsCategories() {
    const content = document.getElementById('editor-content');

    function renderList() {
      let html = `
        <button class="btn btn-ghost btn-sm" id="editor-back">← Volver</button>
        <h3 style="margin:var(--space-4) 0">Editar categorías de ahorros</h3>
        <div class="form-row" style="margin-bottom:var(--space-4)">
          <input class="form-input" id="new-cat-input" placeholder="Nueva categoría..." />
          <button class="btn btn-accent" id="add-cat-btn">Agregar</button>
        </div>
        <div style="max-height:300px;overflow-y:auto">
      `;
      Store.getSavingsCategories().forEach(cat => {
        html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--color-border)">
          <span>${cat}</span>
          <div style="display:flex;gap:var(--space-1)">
            <button class="btn btn-ghost btn-sm cat-rename" data-cat="${cat}" style="width:auto;padding:0 var(--space-2);font-size:var(--text-xs)">Renombrar</button>
            <button class="btn btn-ghost btn-sm cat-delete" data-cat="${cat}" style="width:auto;padding:0 var(--space-2);font-size:var(--text-xs)">Eliminar</button>
          </div>
        </div>`;
      });
      html += `</div>`;
      content.innerHTML = html;

      document.getElementById('editor-back').addEventListener('click', () => renderStep2('savings'));
      document.getElementById('add-cat-btn').addEventListener('click', () => {
        const name = document.getElementById('new-cat-input').value.trim();
        if (!name) return;
        if (Store.addSavingsCategory(name)) {
          UI.toast(`Categoría "${name}" agregada`, 'success');
          renderList();
        } else {
          UI.toast('La categoría ya existe', 'warning');
        }
      });

      content.querySelectorAll('.cat-delete').forEach(btn => {
        btn.addEventListener('click', () => {
          const cat = btn.dataset.cat;
          const result = Store.removeSavingsCategory(cat);
          if (result.error === 'in_use') {
            UI.toast(`No se puede eliminar "${cat}" porque está en uso`, 'error');
          } else {
            UI.toast(`Categoría "${cat}" eliminada`, 'success');
            renderList();
          }
        });
      });

      content.querySelectorAll('.cat-rename').forEach(btn => {
        btn.addEventListener('click', () => {
          const cat = btn.dataset.cat;
          const newName = prompt(`Renombrar "${cat}" a:`, cat);
          if (newName && newName.trim() && newName.trim() !== cat) {
            Store.renameSavingsCategory(cat, newName.trim());
            UI.toast(`Categoría renombrada a "${newName.trim()}"`, 'success');
            renderList();
          }
        });
      });
    }

    renderList();
  }

  return { open };
})();
