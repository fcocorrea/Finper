// store.js — Data persistence layer using localStorage

const Store = (() => {
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
  };

  const DEFAULT_CATEGORIES = [
    'Salud', 'Regalo', 'Transporte', 'Alimentación', 'Carrete', 'Educación',
    'Ropa', 'Ocio', 'Servicios', 'Trámites', 'Orden/Higiene', 'Banco/Intereses',
    'Aplicación', 'Salida a comer', 'Comunicación', 'Delivery', 'Supermercado',
    'Software', 'Vivienda', 'Panorama', 'Energia', 'Niñitas', 'Utilidad'
  ];

  const DEFAULT_SAVINGS_CATEGORIES = [
    'Fondo Mutuo', 'Depósito a Plazo', 'Acciones', 'ETF', 'AFP/Pensión', 'Efectivo', 'Otros',
  ];

  const DEFAULT_EXPENSE_TYPES = ['Variable', 'Fijo', 'Deuda'];
  const DEFAULT_PAYMENT_METHODS = ['Tarjeta de crédito', 'Cuenta corriente', 'Tarjeta de crédito en cuotas'];
  const DEFAULT_ACCOUNT_TYPES = ['Cuentas por cobrar', 'Cuentas por pagar'];

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
      { key: 'persona', label: 'Persona', type: 'text' },
      { key: 'descripcion', label: 'Descripción', type: 'text' },
      { key: 'tipo', label: 'Tipo', type: 'select' },
      { key: 'monto', label: 'Monto', type: 'currency' },
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
  }

  // ---------- GENERIC CRUD ----------
  function getAll(type) { return _get(KEYS[type]) || []; }

  function add(type, record) {
    const list = getAll(type);
    record.id = _genId();
    record._created = new Date().toISOString();
    list.push(record);
    _set(KEYS[type], list);
    return record;
  }

  function update(type, id, updates) {
    const list = getAll(type);
    const idx = list.findIndex(r => r.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, _updated: new Date().toISOString() };
    _set(KEYS[type], list);
    return list[idx];
  }

  function remove(type, id) {
    let list = getAll(type);
    list = list.filter(r => r.id !== id);
    _set(KEYS[type], list);
  }

  function bulkAdd(type, records) {
    const list = getAll(type);
    records.forEach(r => {
      const clone = { ...r };
      clone.id = _genId();
      clone._created = new Date().toISOString();
      list.push(clone);
    });
    _set(KEYS[type], list);
  }

  // ---------- CATEGORIES ----------
  function getCategories() { return _get(KEYS.categories) || []; }
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

  // ---------- EXPENSE TYPES ----------
  function getExpenseTypes() { return _get(KEYS.expenseTypes) || []; }

  // ---------- PAYMENT METHODS ----------
  function getPaymentMethods() { return _get(KEYS.paymentMethods) || []; }

  // ---------- ACCOUNT TYPES ----------
  function getAccountTypes() { return _get(KEYS.accountTypes) || []; }

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
  function getSavingsCategories() { return _get(KEYS.savingsCategories) || []; }
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

  function getByMonth(type, month, year) {
    const all = getAll(type);
    return all.filter(record => {
      let dateStr;
      if (type === 'expenses' || type === 'savings') {
        dateStr = record.mesPago || record.fecha;
      } else {
        dateStr = record.fecha;
      }
      if (!dateStr) return false;
      const parsed = parseRecordDate(type, dateStr);
      if (!parsed) return false;
      return parsed.month === month && parsed.year === year;
    });
  }

  function parseRecordDate(type, dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (type === 'incomes') {
      if (parts.length === 2) {
        return { month: parseInt(parts[0]), year: 2000 + parseInt(parts[1]) };
      }
    } else {
      // expenses, savings, accounts: dd-mm-yy or mm-yy (mesPago)
      if (parts.length === 3) {
        return { day: parseInt(parts[0]), month: parseInt(parts[1]), year: 2000 + parseInt(parts[2]) };
      }
      if (parts.length === 2) {
        return { month: parseInt(parts[0]), year: 2000 + parseInt(parts[1]) };
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
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseInt(String(val).replace(/[^0-9-]/g, '')) || 0;
  }

  return {
    init, getAll, add, update, remove, bulkAdd,
    getCategories, addCategory, removeCategory, renameCategory,
    getSavingsCategories, addSavingsCategory, removeSavingsCategory, renameSavingsCategory,
    getExpenseTypes, getPaymentMethods, getAccountTypes,
    getColumns, setColumns,
    getIncomeSources, addIncomeSource,
    getSuggestions, predictCategory,
    getByMonth, parseRecordDate,
    getTotalIncome, getTotalExpenses, getTotalSavings, parseCurrency,
    DEFAULT_COLUMNS,
  };
})();
