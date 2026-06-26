// sync.js — Hybrid Supabase sync layer
//
// Reads always come from localStorage (instant, synchronous).
// Writes go to localStorage first, then replicate to Supabase in the background.
// On app start, Supabase data is pulled to refresh localStorage so all devices
// stay in sync.
//
// Tables synced: gastos, ingresos, cuentas_por_pagar_cobrar, ahorros

const Sync = (() => {
  const SUPABASE_URL = 'https://cbecdmhrmbncyfkaztrb.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_i0LokvuzJBb_gN6PJHc2KA_P4ZyuDEB';

  let _db = null;
  let _catMap   = {};  // nombre → id
  let _catById  = {};  // id     → nombre

  // ── Public init ───────────────────────────────────────────────

  function init() {
    _db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    _loadCategories();
  }

  // ── Date helpers ──────────────────────────────────────────────

  function _dmyToISO(s) {
    // '31-05-26' → '2026-05-31'
    const [d, m, y] = s.split('-');
    return `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  function _isoToDMY(s) {
    // '2026-05-31T...' → '31-05-26'
    const [y, m, d] = s.split('T')[0].split('-');
    return `${d}-${m}-${y.slice(2)}`;
  }

  function _myToISO(s) {
    // '05-26' → '2026-05-01'
    const [m, y] = s.split('-');
    return `20${y}-${m.padStart(2, '0')}-01`;
  }

  // ── medio_pago case normalization ─────────────────────────────
  // App stores lowercase 'c'; DB CHECK constraint uses uppercase 'C'.

  const _PAGO_TO_DB = {
    'Tarjeta de crédito':           'Tarjeta de Crédito',
    'Cuenta corriente':             'Cuenta Corriente',
    'Tarjeta de crédito en cuotas': 'Tarjeta de Crédito en cuotas',
  };
  const _PAGO_FROM_DB = Object.fromEntries(
    Object.entries(_PAGO_TO_DB).map(([k, v]) => [v, k])
  );

  // ── Category map ──────────────────────────────────────────────

  async function _loadCategories() {
    if (!_db) return;
    const { data, error } = await _db.from('categorias_gastos').select('id, nombre');
    if (error || !data) return;
    _catMap  = {};
    _catById = {};
    data.forEach(c => { _catMap[c.nombre] = c.id; _catById[c.id] = c.nombre; });
  }

  // ── DB row → App record ───────────────────────────────────────

  function _rowToExpense(row) {
    return {
      _supabase_id: row.id,
      fecha:        _isoToDMY(row.fecha),
      mesPago:      row.mes_pago,
      categoria:    row.categorias_gastos?.nombre || _catById[row.categoria_id] || '',
      gasto:        row.monto,
      comentario:   row.comentario  || '',
      tipo:         row.tipo        || '',
      medioPago:    _PAGO_FROM_DB[row.medio_pago] || row.medio_pago || '',
      cuotaActual:  row.cuota_actual  || null,
      totalCuotas:  row.total_cuotas  || null,
      _created:     row.created_at,
      _updated:     row.updated_at,
    };
  }

  function _rowToIncome(row) {
    return {
      _supabase_id: row.id,
      fecha:        row.mes_periodo,
      monto:        row.monto,
      fuente:       row.fuente || '',
      _created:     row.created_at,
      _updated:     row.updated_at,
    };
  }

  function _rowToAccount(row) {
    return {
      _supabase_id: row.id,
      fecha:        _isoToDMY(row.fecha),
      persona:      row.persona      || '',
      descripcion:  row.descripcion  || '',
      tipo:         row.tipo         || '',
      monto:        row.monto,
      _created:     row.created_at,
      _updated:     row.updated_at,
    };
  }

  function _rowToSavings(row) {
    return {
      _supabase_id: row.id,
      fecha:        _isoToDMY(row.fecha),
      mesPago:      row.mes_pago     || '',
      categoria:    row.categoria    || '',
      monto:        row.monto,
      descripcion:  row.descripcion  || '',
      institucion:  row.institucion  || '',
      _created:     row.created_at,
      _updated:     row.updated_at,
    };
  }

  // ── App record → DB payload ───────────────────────────────────

  function _expenseToDB(r) {
    const catId = _catMap[r.categoria];
    if (!catId) return null;
    const userId = Auth.getCurrentUserId();
    return {
      user_id:      userId,
      fecha:        _dmyToISO(r.fecha),
      mes_pago:     r.mesPago,
      categoria_id: catId,
      monto:        Store.parseCurrency(r.gasto),
      comentario:   r.comentario  || null,
      tipo:         r.tipo        || null,
      medio_pago:   _PAGO_TO_DB[r.medioPago] || r.medioPago || null,
      cuota_actual: r.cuotaActual || null,
      total_cuotas: r.totalCuotas || null,
    };
  }

  function _incomeToDB(r) {
    const userId = Auth.getCurrentUserId();
    return {
      user_id:     userId,
      fecha:       _myToISO(r.fecha),
      mes_periodo: r.fecha,
      monto:       Store.parseCurrency(r.monto),
      fuente:      r.fuente || '',
    };
  }

  function _accountToDB(r) {
    const userId = Auth.getCurrentUserId();
    return {
      user_id:     userId,
      fecha:       _dmyToISO(r.fecha),
      persona:     r.persona     || '',
      descripcion: r.descripcion || null,
      tipo:        r.tipo,
      monto:       Store.parseCurrency(r.monto),
    };
  }

  function _savingsToDB(r) {
    if (!r.fecha) return null;
    const userId = Auth.getCurrentUserId();
    return {
      user_id:     userId,
      fecha:       _dmyToISO(r.fecha),
      mes_pago:    r.mesPago     || null,
      categoria:   r.categoria   || null,
      monto:       Store.parseCurrency(r.monto),
      descripcion: r.descripcion || null,
      institucion: r.institucion || null,
    };
  }

  const _TABLES = {
    expenses: { table: 'gastos',                   toDB: _expenseToDB, toApp: _rowToExpense },
    incomes:  { table: 'ingresos',                 toDB: _incomeToDB,  toApp: _rowToIncome  },
    accounts: { table: 'cuentas_por_pagar_cobrar', toDB: _accountToDB, toApp: _rowToAccount },
    savings:  { table: 'ahorros',                  toDB: _savingsToDB, toApp: _rowToSavings },
  };

  // ── Ensure categories exist in Supabase ──────────────────────

  async function _ensureCategories(names) {
    const missing = [...new Set(names)].filter(n => n && !_catMap[n]);
    if (!missing.length) return;

    const userId = Auth.getCurrentUserId();

    // Insert new ones — ignore errors (e.g. duplicate key if category already exists)
    const { data: inserted } = await _db
      .from('categorias_gastos')
      .insert(missing.map(nombre => ({ nombre, user_id: userId })))
      .select('id, nombre');

    if (inserted?.length) {
      inserted.forEach(c => { _catMap[c.nombre] = c.id; _catById[c.id] = c.nombre; });
    }

    // Re-fetch any that are still unmapped (they already existed in Supabase)
    const stillMissing = missing.filter(n => !_catMap[n]);
    if (stillMissing.length) {
      const { data: existing } = await _db
        .from('categorias_gastos')
        .select('id, nombre')
        .in('nombre', stillMissing);
      if (existing?.length) {
        existing.forEach(c => { _catMap[c.nombre] = c.id; _catById[c.id] = c.nombre; });
      }
    }
  }

  // ── ID generator (for pulled records) ────────────────────────

  let _seq = 0;
  function _newId() {
    return Date.now().toString(36) + (++_seq).toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ── Merge helper ─────────────────────────────────────────────
  // Replaces confirmed records with fresh Supabase data while
  // preserving local-only records (no _supabase_id) that haven't
  // been pushed yet — so a failed or in-flight push never causes
  // data loss on the next pull.

  function _mergeIntoStorage(key, supabaseRecords) {
    const local = JSON.parse(localStorage.getItem(key) || '[]');
    const pending = local.filter(r => !r._supabase_id);
    localStorage.setItem(key, JSON.stringify([...supabaseRecords, ...pending]));
  }

  // ── Pull: Supabase → localStorage ────────────────────────────

  async function pull() {
    if (!_db) return false;
    // Ensure session is restored before querying (Supabase client recovers async)
    const { data: { session } } = await _db.auth.getSession();
    if (!session) return false;
    try {
      await _loadCategories();

      const [expRes, incRes, accRes, savRes] = await Promise.all([
        _db.from('gastos').select('*, categorias_gastos(nombre)').order('fecha', { ascending: false }),
        _db.from('ingresos').select('*').order('fecha', { ascending: false }),
        _db.from('cuentas_por_pagar_cobrar').select('*').order('fecha', { ascending: false }),
        _db.from('ahorros').select('*').order('fecha', { ascending: false }),
      ]);

      let ok = true;

      if (expRes.error) {
        ok = false;
        console.error('[Sync] pull expenses:', expRes.error.message);
      } else {
        _mergeIntoStorage('finper_expenses', expRes.data.map(r => ({ id: _newId(), ..._rowToExpense(r) })));
      }

      if (incRes.error) {
        ok = false;
        console.error('[Sync] pull incomes:', incRes.error.message);
      } else {
        _mergeIntoStorage('finper_incomes', incRes.data.map(r => ({ id: _newId(), ..._rowToIncome(r) })));
      }

      if (accRes.error) {
        ok = false;
        console.error('[Sync] pull accounts:', accRes.error.message);
      } else {
        _mergeIntoStorage('finper_accounts', accRes.data.map(r => ({ id: _newId(), ..._rowToAccount(r) })));
      }

      if (savRes.error) {
        ok = false;
        console.error('[Sync] pull savings:', savRes.error.message);
      } else {
        _mergeIntoStorage('finper_savings', savRes.data.map(r => ({ id: _newId(), ..._rowToSavings(r) })));
      }

      return ok;
    } catch (e) {
      console.error('[Sync] pull failed:', e);
      return false;
    }
  }

  // ── pushAdd ───────────────────────────────────────────────────

  async function pushAdd(type, record) {
    if (!_db) return;
    const mapping = _TABLES[type];
    if (!mapping) return;
    if (type === 'expenses') await _ensureCategories([record.categoria]);
    const payload = mapping.toDB(record);
    if (!payload) return;

    const { data, error } = await _db.from(mapping.table).insert(payload).select('id').single();
    if (error) { console.error(`[Sync] pushAdd ${type}:`, error.message); return; }

    if (data?.id) {
      const key  = `finper_${type}`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      const idx  = list.findIndex(r => r.id === record.id);
      if (idx !== -1) {
        list[idx]._supabase_id = data.id;
        localStorage.setItem(key, JSON.stringify(list));
      }
    }
  }

  // ── pushUpdate ────────────────────────────────────────────────

  async function pushUpdate(type, record) {
    if (!_db || !record._supabase_id) return;
    const mapping = _TABLES[type];
    if (!mapping) return;
    const payload = mapping.toDB(record);
    if (!payload) return;

    const { error } = await _db.from(mapping.table).update(payload).eq('id', record._supabase_id);
    if (error) console.error(`[Sync] pushUpdate ${type}:`, error.message);
  }

  // ── pushRemove ────────────────────────────────────────────────

  async function pushRemove(type, supabaseId) {
    if (!_db || !supabaseId) return;
    const mapping = _TABLES[type];
    if (!mapping) return;

    const { error } = await _db.from(mapping.table).delete().eq('id', supabaseId);
    if (error) console.error(`[Sync] pushRemove ${type}:`, error.message);
  }

  // ── pushBulkAdd ───────────────────────────────────────────────

  async function pushBulkAdd(type, records) {
    if (!_db || !records.length) return;
    const mapping = _TABLES[type];
    if (!mapping) return;

    if (type === 'expenses') await _ensureCategories(records.map(r => r.categoria));

    const payloads = records.map(r => mapping.toDB(r)).filter(Boolean);
    if (!payloads.length) return;

    const { data, error } = await _db.from(mapping.table).insert(payloads).select('id');
    if (error) { console.error(`[Sync] pushBulkAdd ${type}:`, error.message); return; }

    if (data?.length) {
      const key  = `finper_${type}`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      records.forEach((r, i) => {
        if (!data[i]?.id) return;
        const idx = list.findIndex(rec => rec.id === r.id);
        if (idx !== -1) list[idx]._supabase_id = data[i].id;
      });
      localStorage.setItem(key, JSON.stringify(list));
    }
  }

  return { init, pull, pushAdd, pushUpdate, pushRemove, pushBulkAdd };
})();
