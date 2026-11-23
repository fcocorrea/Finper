// store.js — Data persistence layer using localStorage

const Store = (() => {
  let _dateMode = 'mesPago';

  function setDateMode(mode) { _dateMode = mode; }

  const KEYS = {
    expenses: 'finper_expenses',
    incomes: 'finper_incomes',
    accounts: 'finper_accounts',
    savings: 'finper_savings',
    categories: 'finper_categories',
    expenseTypes: 'finper_expense_types',
    paymentMethods: 'finper_payment_methods',
    columns: 'finper_columns',
    accountTypes: 'finper_account_types',
    incomeSources: 'finper_income_sources',
    savingsCategories: 'finper_savings_categories',
    monthlyBudget: 'finper_monthly_budget',
    billingDate: 'finper_billing_date',
  };

  const DEFAULT_CATEGORIES = [
    'Salud', 'Regalo', 'Transporte', 'Alimentación', 'Carrete', 'Educación',
    'Ropa', 'Ocio', 'Servicios', 'Trámites', 'Orden/Higiene', 'Banco/Intereses',
    'Aplicación', 'Salida a comer', 'Comunicación', 'Delivery', 'Supermercado',
    'Software', 'Vivienda', 'Panorama', 'Energia', 'Niñitas', 'Utilidad'
  ];

  const DEFAULT_SAVINGS_CATEGORIES = [
    'Fondo Mutuo', 'Depósito a Plazo', 'Acciones', 'ETF', 'AFP/Pensión', 'Efectivo', 'Trading', 'Otros',
  ];

  // Only variable expenses are budgeted — fixed ones are predictable by definition.
  const DEFAULT_MONTHLY_BUDGET = 500000;

  const DEFAULT_EXPENSE_TYPES = ['Variable', 'Fijo', 'Deuda'];
  const DEFAULT_PAYMENT_METHODS = ['Tarjeta de crédito', 'Cuenta corriente', 'Tarjeta de crédito en cuotas'];
  const DEFAULT_ACCOUNT_TYPES = ['Cuentas por cobrar', 'Cuentas por pagar'];

  // Columna derivada: se compone de cuotaActual/totalCuotas, no es un campo
  // propio del registro y por eso queda fuera de importaciones y exportaciones.
  const ACCOUNT_CUOTA_COLUMN = { key: 'cuota', label: 'Cuota', type: 'cuota' };

  const DEFAULT_COLUMNS = {
    expenses: [
      { key: 'fecha', label: 'Fecha', type: 'date-dmy' },
      { key: 'mesPago', label: 'Mes Pago', type: 'date-my' },
      { key: 'categoria', label: 'Categoría', type: 'select' },
      { key: 'gasto', label: 'Gasto', type: 'currency' },
      { key: 'comentario', label: 'Comentario', type: 'text' },
      { key: 'tipo', label: 'Tipo', type: 'select' },
      { key: 'medioPago', label: 'Medio de pago', type: 'select' },
    ],
    incomes: [
      { key: 'fecha', label: 'Fecha', type: 'date-my' },
      { key: 'monto', label: 'Monto', type: 'currency' },
      { key: 'fuente', label: 'Fuente', type: 'text' },
    ],
    accounts: [
      { key: 'fecha', label: 'Fecha', type: 'date-dmy' },
      { key: 'fechaPago', label: 'Fecha pago', type: 'date-my' },
      { key: 'persona', label: 'Persona', type: 'text' },
      { key: 'descripcion', label: 'Descripción', type: 'text' },
      { key: 'tipo', label: 'Tipo', type: 'select' },
      { key: 'monto', label: 'Monto', type: 'currency' },
      ACCOUNT_CUOTA_COLUMN,
    ],
    savings: [
      { key: 'fecha', label: 'Fecha', type: 'date-dmy' },
      { key: 'mesPago', label: 'Mes', type: 'date-my' },
      { key: 'categoria', label: 'Categoría', type: 'select' },
      { key: 'monto', label: 'Monto', type: 'currency' },
      { key: 'descripcion', label: 'Descripción', type: 'text' },
      { key: 'institucion', label: 'Institución', type: 'text' },
    ],
  };

  function _get(key) {
    try {
      const d = localStorage.getItem(key);
      return d ? JSON.parse(d) : null;
    } catch { return null; }
  }

  function _set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  let _idCounter = 0;
  function _genId() {
    _idCounter++;
    return Date.now().toString(36) + _idCounter.toString(36) + Math.random().toString(36).substring(2, 8);
  }

  // Initialize defaults
  function init() {
    if (!_get(KEYS.categories)) _set(KEYS.categories, DEFAULT_CATEGORIES);
    if (!_get(KEYS.expenseTypes)) _set(KEYS.expenseTypes, DEFAULT_EXPENSE_TYPES);
    if (!_get(KEYS.paymentMethods)) _set(KEYS.paymentMethods, DEFAULT_PAYMENT_METHODS);
    if (!_get(KEYS.accountTypes)) _set(KEYS.accountTypes, DEFAULT_ACCOUNT_TYPES);
    if (!_get(KEYS.columns)) _set(KEYS.columns, DEFAULT_COLUMNS);
    if (!_get(KEYS.expenses)) _set(KEYS.expenses, []);
    if (!_get(KEYS.incomes)) _set(KEYS.incomes, []);
    if (!_get(KEYS.accounts)) _set(KEYS.accounts, []);
    if (!_get(KEYS.savings)) _set(KEYS.savings, []);
    if (!_get(KEYS.incomeSources)) _set(KEYS.incomeSources, []);
    if (!_get(KEYS.savingsCategories)) _set(KEYS.savingsCategories, DEFAULT_SAVINGS_CATEGORIES);
    const _sc = _get(KEYS.savingsCategories);
    if (_sc && !_sc.includes('Trading')) _set(KEYS.savingsCategories, [..._sc, 'Trading']);

    _migrateExpensesToSavings();
    _migrateCanonicalPaymentMethods();
    _migrateAccountColumns();

    if (typeof Sync !== 'undefined') {
      Sync.init();
      return Sync.pull();
    }
    return Promise.resolve(true);
  }

  function _migrateExpensesToSavings() {
    const MIGRATION_KEY = 'finper_migration_savings_v1';
    if (localStorage.getItem(MIGRATION_KEY)) return;

    const expenses = getAll('expenses');
    const savingsCats = getSavingsCategories();

    const isSavingsRecord = e =>
      e.tipo === 'Ahorro' || e.tipo === 'Inversión' || savingsCats.includes(e.categoria);

    const toMigrate = expenses.filter(isSavingsRecord);

    if (toMigrate.length) {
      const existing = getAll('savings');
      const migrated = toMigrate.map(e => {
        const cat = savingsCats.includes(e.categoria) ? e.categoria : 'Otros';
        // mesPago on savings uses mm-yy; derive from fecha (dd-mm-yy) if missing
        const mesPago = e.mesPago || (e.fecha ? e.fecha.slice(3) : '');
        return {
          id: e.id,
          fecha: e.fecha,
          mesPago,
          categoria: cat,
          monto: e.gasto,
          descripcion: e.comentario || '',
          institucion: '',
          _created: e._created,
          _updated: e._updated,
        };
      });

      _set(KEYS.savings, [...existing, ...migrated]);
      _set(KEYS.expenses, expenses.filter(e => !isSavingsRecord(e)));
    }

    localStorage.setItem(MIGRATION_KEY, '1');
  }

  // Un respaldo exportado de Supabase o un CSV antiguo pueden traer variantes del
  // mismo medio de pago ("Tarjeta de Crédito (cuotas)", mayúsculas, etc.).
  // Se reescriben al canonical de la app; un valor desconocido se respeta tal cual.
  const PAGO_CANONICAL = {
    'tarjeta de credito': 'Tarjeta de crédito',
    'tarjeta de credito en cuotas': 'Tarjeta de crédito en cuotas',
    'cuenta corriente': 'Cuenta corriente',
  };

  function _canonicalPago(val) {
    if (!val || typeof val !== 'string') return val;
    const norm = val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\(\s*cuotas\s*\)/i, ' en cuotas')
      .replace(/\s+/g, ' ')
      .trim();
    return PAGO_CANONICAL[norm] || val;
  }

  // Existing devices keep their column definitions in localStorage, so a new
  // default column won't show up unless it is merged into the stored set once.
  function _migrateAccountColumns() {
    const all = _get(KEYS.columns);
    if (!all || !Array.isArray(all.accounts)) return;
    let changed = false;

    if (!all.accounts.some(c => c.key === 'fechaPago')) {
      const idx = all.accounts.findIndex(c => c.key === 'fecha');
      all.accounts.splice(idx === -1 ? 1 : idx + 1, 0,
        { key: 'fechaPago', label: 'Fecha pago', type: 'date-my' });
      changed = true;
    }

    if (!all.accounts.some(c => c.key === ACCOUNT_CUOTA_COLUMN.key)) {
      all.accounts.push({ ...ACCOUNT_CUOTA_COLUMN });
      changed = true;
    }

    if (changed) _set(KEYS.columns, all);
  }

  function _migrateCanonicalPaymentMethods() {
    const methods = _get(KEYS.paymentMethods) || [];
    const deduped = [];
    methods.forEach(m => {
      const c = _canonicalPago(m);
      if (c && !deduped.includes(c)) deduped.push(c);
    });
    if (JSON.stringify(deduped) !== JSON.stringify(methods)) _set(KEYS.paymentMethods, deduped);

    const expenses = getAll('expenses');
    let changed = false;
    const fixed = expenses.map(e => {
      const c = _canonicalPago(e.medioPago);
      if (c !== e.medioPago) { changed = true; return { ...e, medioPago: c }; }
      return e;
    });
    if (changed) _set(KEYS.expenses, fixed);
  }

  // ---------- GENERIC CRUD ----------
  function getAll(type) { return _get(KEYS[type]) || []; }

  function add(type, record) {
    const list = getAll(type);
    record.id = _genId();
    record._created = new Date().toISOString();
    list.push(record);
    _set(KEYS[type], list);
    if (typeof Sync !== 'undefined') Sync.pushAdd(type, record);
    return record;
  }

  function update(type, id, updates) {
    const list = getAll(type);
    const idx = list.findIndex(r => r.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, _updated: new Date().toISOString() };
    _set(KEYS[type], list);
    if (typeof Sync !== 'undefined') Sync.pushUpdate(type, list[idx]);
    return list[idx];
  }

  function remove(type, id) {
    let list = getAll(type);
    const record = list.find(r => r.id === id);
    list = list.filter(r => r.id !== id);
    _set(KEYS[type], list);
    if (typeof Sync !== 'undefined' && record?._supabase_id) {
      Sync.pushRemove(type, record._supabase_id);
    }
  }

  function clearAll(type) {
    const list = getAll(type);
    _set(KEYS[type], []);
    if (typeof Sync !== 'undefined') {
      list.forEach(r => { if (r._supabase_id) Sync.pushRemove(type, r._supabase_id); });
    }
  }

  function bulkAdd(type, records) {
    const list = getAll(type);
    const added = [];
    records.forEach(r => {
      const clone = { ...r };
      clone.id = _genId();
      clone._created = new Date().toISOString();
      list.push(clone);
      added.push(clone);
    });
    _set(KEYS[type], list);
    // Devuelve la promesa: quien importa debe esperarla, o un reload a destiempo
    // deja los registros sin _supabase_id y duplicados en el siguiente pull.
    if (typeof Sync !== 'undefined') return Sync.pushBulkAdd(type, added);
    return Promise.resolve();
  }

  // ---------- CATEGORIES ----------
  function getCategories() { return sortCategories(_get(KEYS.categories) || []); }
  function sortCategories(cats) { return [...cats].sort((a, b) => a.localeCompare(b, 'es')); }
  function addCategory(name) {
    const cats = getCategories();
    if (cats.includes(name)) return false;
    cats.push(name);
    _set(KEYS.categories, cats);
    return true;
  }
  function removeCategory(name) {
    const expenses = getAll('expenses');
    if (expenses.some(e => e.categoria === name)) return { error: 'in_use' };
    let cats = getCategories().filter(c => c !== name);
    _set(KEYS.categories, cats);
    return { success: true };
  }
  function renameCategory(oldName, newName) {
    let cats = getCategories();
    const idx = cats.indexOf(oldName);
    if (idx === -1) return false;
    cats[idx] = newName;
    _set(KEYS.categories, cats);
    // Update existing expenses
    const expenses = getAll('expenses');
    expenses.forEach(e => { if (e.categoria === oldName) e.categoria = newName; });
    _set(KEYS.expenses, expenses);
    return true;
  }

  // ---------- MONTHLY BUDGET ----------
  // ponytail: device-local, not synced to Supabase — one number, no table for it.
  function getMonthlyBudget() {
    const v = _get(KEYS.monthlyBudget);
    return v == null ? DEFAULT_MONTHLY_BUDGET : v;
  }
  function setMonthlyBudget(val) {
    _set(KEYS.monthlyBudget, Math.max(0, parseCurrency(val)));
  }

  // ---------- FECHA DE FACTURACIÓN (tarjeta de crédito) ----------
  // Se guarda la próxima facturación en dd-mm-yy; si ya pasó, se proyecta al
  // mismo día del mes siguiente cada vez que se consulta.
  // ponytail: device-local, igual que el presupuesto — un dato, sin tabla.

  function _pad2(n) { return String(n).padStart(2, '0'); }

  function _parseDMY(str) {
    if (typeof str !== 'string') return null;
    const parts = str.split('-');
    if (parts.length !== 3) return null;
    const d = parseInt(parts[0]), m = parseInt(parts[1]), y = _fullYear(parts[2]);
    if (!d || !m || m > 12 || d > 31) return null;
    const date = new Date(y, m - 1, d);
    // Rechaza fechas inexistentes que Date desborda (p. ej. 31-02 → marzo).
    return date.getMonth() === m - 1 ? date : null;
  }

  function _startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  // Suma meses conservando el día de corte: 31 → último día del mes destino.
  function _addMonths(date, months, anchorDay) {
    const day = anchorDay || date.getDate();
    const lastDay = new Date(date.getFullYear(), date.getMonth() + months + 1, 0).getDate();
    return new Date(date.getFullYear(), date.getMonth() + months, Math.min(day, lastDay));
  }

  function _projectBilling(anchor, today) {
    if (anchor >= today) return anchor;
    const day = anchor.getDate();
    let months = (today.getFullYear() - anchor.getFullYear()) * 12
               + (today.getMonth() - anchor.getMonth());
    let candidate = _addMonths(anchor, months, day);
    while (candidate < today) {
      months++;
      candidate = _addMonths(anchor, months, day);
    }
    return candidate;
  }

  // Factura → mes de pago: el sueldo de fin de mes se usa para el mes
  // siguiente, así que se suma un mes. `offset` son las cuotas siguientes.
  function _mesPagoFor(billing, fechaStr, offset) {
    const day = billing.getDate();
    const purchase = _parseDMY(fechaStr);
    let months = 0;
    if (purchase) {
      months = Math.max(0, (purchase.getFullYear() - billing.getFullYear()) * 12
                         + (purchase.getMonth() - billing.getMonth()));
      // Un gasto posterior al corte cae en la factura siguiente.
      while (_addMonths(billing, months, day) <= purchase) months++;
    }
    const pay = _addMonths(billing, months + 1 + (offset || 0), day);
    return `${_pad2(pay.getMonth() + 1)}-${String(pay.getFullYear()).slice(-2)}`;
  }

  function getBillingDate() {
    const anchor = _parseDMY(_get(KEYS.billingDate));
    if (!anchor) return null;
    return _projectBilling(_startOfDay(anchor), _startOfDay(new Date()));
  }

  function setBillingDate(str) {
    const parsed = _parseDMY(str);
    if (!parsed) return false;
    _set(KEYS.billingDate, `${_pad2(parsed.getDate())}-${_pad2(parsed.getMonth() + 1)}-${String(parsed.getFullYear()).slice(-2)}`);
    return true;
  }

  function clearBillingDate() {
    localStorage.removeItem(KEYS.billingDate);
  }

  // Mes de pago de un gasto con tarjeta. Sin facturación configurada no hay
  // cálculo automático: devuelve '' y el formulario mantiene el valor manual.
  function calcCardMesPago(fechaStr, offset = 0) {
    const billing = getBillingDate();
    return billing ? _mesPagoFor(billing, fechaStr, offset) : '';
  }

  // Igual que calcCardMesPago pero con una facturación sin guardar (vista previa).
  function previewCardMesPago(billingStr, fechaStr, offset = 0) {
    const anchor = _parseDMY(billingStr);
    if (!anchor) return '';
    const billing = _projectBilling(_startOfDay(anchor), _startOfDay(new Date()));
    return _mesPagoFor(billing, fechaStr, offset);
  }

  // ---------- EXPENSE TYPES ----------
  function getExpenseTypes() { return _get(KEYS.expenseTypes) || []; }

  // ---------- PAYMENT METHODS ----------
  function getPaymentMethods() { return _get(KEYS.paymentMethods) || []; }

  // ---------- ACCOUNT TYPES ----------
  function getAccountTypes() { return _get(KEYS.accountTypes) || []; }

  // ---------- INSTALLMENTS (cuotas) ----------
  // Divide un monto en cuotas enteras que suman exactamente el total: el
  // residuo del redondeo se reparte en las primeras cuotas.
  function splitInstallments(monto, cuotas) {
    const total = parseCurrency(monto);
    const n = Math.floor(Number(cuotas) || 0);
    if (n <= 1) return [total];
    const base = Math.floor(total / n);
    const resto = total - base * n;
    return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
  }

  // Texto de la columna "Cuota" ("2/3"); vacío si la cuenta no va en cuotas.
  function formatCuota(record) {
    if (!record || !record.totalCuotas || record.totalCuotas < 2) return '';
    return `${record.cuotaActual || 1}/${record.totalCuotas}`;
  }

  // Una cuenta en cuotas es N registros mensuales consecutivos: misma fecha,
  // persona, descripción y tipo, con el monto dividido y fechaPago avanzando
  // un mes por cuota.
  function addInstallmentAccounts(record, cuotas) {
    const shares = splitInstallments(record.monto, cuotas);
    const [mm, yy] = String(record.fechaPago || '').split('-');
    const today = new Date();
    let month = parseInt(mm) || today.getMonth() + 1;
    let year = yy && !isNaN(parseInt(yy)) ? _fullYear(yy) : today.getFullYear();
    // Un fechaPago escrito a mano ("13-26") no debe generar meses inexistentes.
    if (month < 1 || month > 12) { month = today.getMonth() + 1; year = today.getFullYear(); }

    const records = shares.map((monto, i) => {
      if (i > 0 && ++month > 12) { month = 1; year++; }
      return {
        ...record,
        monto,
        fechaPago: `${String(month).padStart(2, '0')}-${String(year).slice(-2)}`,
        cuotaActual: i + 1,
        totalCuotas: shares.length,
      };
    });

    return bulkAdd('accounts', records);
  }

  // ---------- COLUMNS ----------
  function getColumns(type) {
    const cols = _get(KEYS.columns) || DEFAULT_COLUMNS;
    return cols[type] || [];
  }
  function setColumns(type, cols) {
    const all = _get(KEYS.columns) || DEFAULT_COLUMNS;
    all[type] = cols;
    _set(KEYS.columns, all);
  }

  // ---------- INCOME SOURCES ----------
  function getIncomeSources() { return _get(KEYS.incomeSources) || []; }
  function addIncomeSource(src) {
    const sources = getIncomeSources();
    if (!sources.includes(src)) {
      sources.push(src);
      _set(KEYS.incomeSources, sources);
    }
  }

  // ---------- SUGGESTIONS (autocomplete) ----------
  function getSuggestions(type, field) {
    const all = getAll(type);
    const values = all.map(r => r[field]).filter(Boolean);
    return [...new Set(values)];
  }

  // Try to predict category from comment based on past data
  function predictCategory(comment) {
    if (!comment || comment.length < 2) return null;
    const expenses = getAll('expenses');
    const lower = comment.toLowerCase();
    // Find expenses with similar comments
    const match = expenses.find(e =>
      e.comentario && e.comentario.toLowerCase().includes(lower)
    );
    return match ? match.categoria : null;
  }

  // ---------- FILTERS ----------
  // ---------- SAVINGS CATEGORIES ----------
  function getSavingsCategories() { return sortCategories(_get(KEYS.savingsCategories) || []); }
  function addSavingsCategory(name) {
    const cats = getSavingsCategories();
    if (cats.includes(name)) return false;
    cats.push(name);
    _set(KEYS.savingsCategories, cats);
    return true;
  }
  function removeSavingsCategory(name) {
    const records = getAll('savings');
    if (records.some(r => r.categoria === name)) return { error: 'in_use' };
    _set(KEYS.savingsCategories, getSavingsCategories().filter(c => c !== name));
    return { success: true };
  }
  function renameSavingsCategory(oldName, newName) {
    const cats = getSavingsCategories();
    const idx = cats.indexOf(oldName);
    if (idx === -1) return false;
    cats[idx] = newName;
    _set(KEYS.savingsCategories, cats);
    const records = getAll('savings');
    records.forEach(r => { if (r.categoria === oldName) r.categoria = newName; });
    _set(KEYS.savings, records);
    return true;
  }

  function getByMonths(type, months) {
    return months.flatMap(({ month, year }) => getByMonth(type, month, year));
  }

  // Single source of truth for which date field a record is bucketed by.
  // ponytail: _dateMode='fecha' filters by exact date instead of billing month
  function getRecordDateStr(type, record) {
    if (type === 'expenses' || type === 'savings') {
      return _dateMode === 'fecha' ? record.fecha : (record.mesPago || record.fecha);
    }
    if (type === 'accounts') {
      return _dateMode === 'fecha' ? record.fecha : (record.fechaPago || record.fecha);
    }
    return record.fecha;
  }

  function getByMonth(type, month, year) {
    const all = getAll(type);
    return all.filter(record => {
      const parsed = parseRecordDate(type, getRecordDateStr(type, record));
      if (!parsed) return false;
      return parsed.month === month && parsed.year === year;
    });
  }

  // Accepts a 2-digit ("26") or 4-digit ("2026") year segment.
  function _fullYear(y) {
    return y.length === 4 ? parseInt(y) : 2000 + parseInt(y);
  }

  function parseRecordDate(type, dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (type === 'incomes') {
      if (parts.length === 2) {
        return { month: parseInt(parts[0]), year: _fullYear(parts[1]) };
      }
    } else {
      // expenses, savings, accounts: dd-mm-yy or mm-yy (mesPago)
      if (parts.length === 3) {
        return { day: parseInt(parts[0]), month: parseInt(parts[1]), year: _fullYear(parts[2]) };
      }
      if (parts.length === 2) {
        return { month: parseInt(parts[0]), year: _fullYear(parts[1]) };
      }
    }
    return null;
  }

  // Get total income for a month
  function getTotalIncome(month, year) {
    const data = getByMonth('incomes', month, year);
    return data.reduce((sum, r) => sum + (parseCurrency(r.monto) || 0), 0);
  }

  // Get total expenses for a month
  function getTotalExpenses(month, year) {
    const data = getByMonth('expenses', month, year);
    return data.reduce((sum, r) => sum + (parseCurrency(r.gasto) || 0), 0);
  }

  // Get total savings for a month
  function getTotalSavings(month, year) {
    const data = getByMonth('savings', month, year);
    return data.reduce((sum, r) => sum + (parseCurrency(r.monto) || 0), 0);
  }

  function parseCurrency(val) {
    if (typeof val === 'number') return Math.round(val);
    if (!val) return 0;
    const str = String(val).trim();
    // A single dot means float decimal notation (e.g. "29666.666666666667" from Supabase
    // numeric columns or importer). Stripping the dot would inflate the value by ~10^N.
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount === 1) {
      return Math.round(parseFloat(str.replace(/[^0-9.-]/g, '')) || 0);
    }
    // No dots (plain integer) or multiple dots (Chilean thousands separator "1.234.567"):
    // strip non-digit chars and parse.
    return parseInt(str.replace(/[^0-9-]/g, '')) || 0;
  }

  return {
    init, getAll, add, update, remove, clearAll, bulkAdd,
    getCategories, addCategory, removeCategory, renameCategory,
    getSavingsCategories, addSavingsCategory, removeSavingsCategory, renameSavingsCategory,
    getExpenseTypes, getPaymentMethods, getAccountTypes,
    splitInstallments, formatCuota, addInstallmentAccounts,
    getColumns, setColumns,
    getIncomeSources, addIncomeSource,
    getSuggestions, predictCategory,
    setDateMode, getByMonths, getByMonth, getRecordDateStr, parseRecordDate,
    getTotalIncome, getTotalExpenses, getTotalSavings, parseCurrency,
    getMonthlyBudget, setMonthlyBudget,
    getBillingDate, setBillingDate, clearBillingDate, calcCardMesPago, previewCardMesPago,
    DEFAULT_COLUMNS,
  };
})();
