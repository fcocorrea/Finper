// dashboard.js — Metrics & Charts (Chart.js)

const Dashboard = (() => {
  let barChart = null;

  function render(dataType, months) {
    const container = document.getElementById('view-dashboard');
    if (dataType === 'resumen') {
      renderResumenDashboard(container, months);
    } else if (dataType === 'presupuesto') {
      renderPresupuestoDashboard(container, months);
    } else if (dataType === 'incomes') {
      renderIncomesDashboard(container, months);
    } else if (dataType === 'accounts') {
      renderAccountsDashboard(container);
    } else if (dataType === 'savings') {
      renderSavingsDashboard(container, months);
    } else {
      renderExpensesDashboard(container, months);
    }
  }

  // ---------- RESUMEN ----------
  // Independent from renderExpensesDashboard — edit freely without touching Gastos.
  function renderResumenDashboard(container, months) {
    const isRange = months.length > 1;
    const { month, year } = months[0];

    if (!isRange) {
      const totalIncome  = Store.getTotalIncome(month, year);
      const totalExpense = Store.getTotalExpenses(month, year);
      const totalSavings = Store.getTotalSavings(month, year);
      const pctUsed = totalIncome > 0 ? ((totalExpense / totalIncome) * 100).toFixed(1) : 0;
      const today = new Date();
      const daysInMonth  = new Date(year, month, 0).getDate();
      const currentDay   = (today.getFullYear() === year && today.getMonth() + 1 === month) ? today.getDate() : daysInMonth;
      const remainingDays = daysInMonth - currentDay;
      const remainingAfterSavings = totalIncome - totalExpense - totalSavings;
      const dailyBudget  = remainingDays > 0 ? Math.round(remainingAfterSavings / remainingDays) : remainingAfterSavings;
      let prevMonth = month - 1, prevYear = year;
      if (prevMonth < 1) { prevMonth = 12; prevYear--; }
      const prevExpenses    = getExpensesToDay(prevMonth, prevYear, currentDay) + getSavingsToDay(prevMonth, prevYear, currentDay);
      const currentExpenses = getExpensesToDay(month, year, currentDay) + getSavingsToDay(month, year, currentDay);
      const comparison = prevExpenses > 0 ? (((currentExpenses - prevExpenses) / prevExpenses) * 100).toFixed(1) : 0;

      container.innerHTML = `
        <div class="metrics-grid fade-in">
          <div class="metric-card">
            <div class="metric-label">% Gastado del Ingreso</div>
            <div class="metric-value ${pctUsed > 100 ? 'negative' : pctUsed > 80 ? 'warning' : 'positive'}">${pctUsed}%</div>
            <div class="metric-detail">${UI.formatCLP(totalExpense)} de ${UI.formatCLP(totalIncome)}</div>
          </div>
          <div class="metric-card accent">
            <div class="metric-label">Presupuesto Diario</div>
            <div class="metric-value ${dailyBudget < 0 ? 'negative' : 'positive'}">${UI.formatCLP(dailyBudget)}</div>
            <div class="metric-detail">${remainingDays} días restantes del mes</div>
          </div>
          <div class="metric-card success">
            <div class="metric-label">vs. Mes Anterior (día ${currentDay})</div>
            <div class="metric-value ${comparison > 0 ? 'negative' : 'positive'}">${comparison}%</div>
            <div class="metric-detail">${UI.formatCLP(currentExpenses)} vs ${UI.formatCLP(prevExpenses)}</div>
          </div>
        </div>
        <div class="charts-grid fade-in">
          <div class="chart-container">
            <div class="card-header"><h3 class="card-title">Ingreso vs Gasto vs Ahorro</h3></div>
            <canvas id="chart-resumen-totals"></canvas>
            <div class="chart-balance ${remainingAfterSavings >= 0 ? 'positive' : 'negative'}">
              <span class="chart-balance-label">Remanente del mes</span>
              <span class="chart-balance-value">${UI.formatCLP(remainingAfterSavings)}</span>
            </div>
          </div>
        </div>`;

      renderResumenTotalsChart(totalIncome, totalExpense, totalSavings);
      return;
    }

    // Multi-month
    const totalIncome  = months.reduce((s, {month: m, year: y}) => s + Store.getTotalIncome(m, y), 0);
    const totalExpense = months.reduce((s, {month: m, year: y}) => s + Store.getTotalExpenses(m, y), 0);
    const totalSavings = months.reduce((s, {month: m, year: y}) => s + Store.getTotalSavings(m, y), 0);
    const remaining    = totalIncome - totalExpense;
    const remainingAfterSavings = totalIncome - totalExpense - totalSavings;

    container.innerHTML = `
      <div class="metrics-grid fade-in">
        <div class="metric-card">
          <div class="metric-label">Total Gastos (${months.length} meses)</div>
          <div class="metric-value negative">${UI.formatCLP(totalExpense)}</div>
          <div class="metric-detail">Promedio: ${UI.formatCLP(Math.round(totalExpense / months.length))}/mes</div>
        </div>
        <div class="metric-card success">
          <div class="metric-label">Total Ingresos (${months.length} meses)</div>
          <div class="metric-value positive">${UI.formatCLP(totalIncome)}</div>
          <div class="metric-detail">Promedio: ${UI.formatCLP(Math.round(totalIncome / months.length))}/mes</div>
        </div>
        <div class="metric-card accent">
          <div class="metric-label">Balance del Rango</div>
          <div class="metric-value ${remaining >= 0 ? 'positive' : 'negative'}">${UI.formatCLP(remaining)}</div>
          <div class="metric-detail">Ingresos – Gastos</div>
        </div>
      </div>
      <div class="charts-grid fade-in">
        <div class="chart-container">
          <div class="card-header"><h3 class="card-title">Ingreso vs Gasto vs Ahorro</h3></div>
          <canvas id="chart-resumen-totals"></canvas>
          <div class="chart-balance ${remainingAfterSavings >= 0 ? 'positive' : 'negative'}">
            <span class="chart-balance-label">Remanente del período</span>
            <span class="chart-balance-value">${UI.formatCLP(remainingAfterSavings)}</span>
          </div>
        </div>
      </div>`;

    renderResumenTotalsChart(totalIncome, totalExpense, totalSavings);
  }

  function renderResumenTotalsChart(income, expense, savings) {
    const ctx = document.getElementById('chart-resumen-totals');
    if (!ctx) return;
    new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Ingreso', 'Gasto', 'Ahorro'],
        datasets: [{
          data: [income, expense, savings],
          backgroundColor: ['#10b981', '#4a7cf7', '#f59e0b'],
          borderRadius: 6, maxBarThickness: 80,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => UI.formatCLP(ctx.raw) } }
        },
        scales: {
          x: { ticks: { color: '#1e293b', font: { weight: '600' } }, grid: { display: false } },
          y: { ticks: { color: '#64748b', callback: v => UI.formatCLP(v) }, grid: { color: 'rgba(0,0,0,0.06)' } }
        }
      }
    });
  }

  // ---------- EXPENSES ----------
  function renderExpensesDashboard(container, months) {
    const isRange = months.length > 1;
    const { month, year } = months[0];

    if (!isRange) {
      const totalExpense = Store.getTotalExpenses(month, year);
      const monthExpenses = Store.getByMonth('expenses', month, year);

      container.innerHTML = `
        <div class="metrics-grid fade-in">
          <div class="metric-card">
            <div class="metric-label">Total Gastos del Mes</div>
            <div class="metric-value negative">${UI.formatCLP(totalExpense)}</div>
            <div class="metric-detail">${monthExpenses.length} registro(s)</div>
          </div>
        </div>
        <div class="charts-grid fade-in">
          <div class="chart-container">
            <div class="card-header">
              <h3 class="card-title">Gastos por</h3>
              <div class="toggle-group" id="bar-toggle">
                <button class="toggle-btn active" data-group="categoria">Categoría</button>
                <button class="toggle-btn" data-group="tipo">Tipo</button>
                <button class="toggle-btn" data-group="medioPago">Medio</button>
              </div>
            </div>
            <canvas id="chart-bar"></canvas>
          </div>
          <div class="chart-container">
            <div class="card-header"><h3 class="card-title">Evolución de Gastos</h3></div>
            <canvas id="chart-expense-line"></canvas>
          </div>
        </div>`;

      renderExpenseLineChart(month, year);
      renderBarChart(month, year, 'categoria');
      document.getElementById('bar-toggle').addEventListener('click', e => {
        const btn = e.target.closest('.toggle-btn');
        if (!btn) return;
        document.querySelectorAll('#bar-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderBarChart(month, year, btn.dataset.group);
      });
      return;
    }

    // Multi-month
    const totalIncome  = months.reduce((s, {month: m, year: y}) => s + Store.getTotalIncome(m, y), 0);
    const totalExpense = months.reduce((s, {month: m, year: y}) => s + Store.getTotalExpenses(m, y), 0);
    const remaining    = totalIncome - totalExpense;

    container.innerHTML = `
      <div class="metrics-grid fade-in">
        <div class="metric-card">
          <div class="metric-label">Total Gastos (${months.length} meses)</div>
          <div class="metric-value negative">${UI.formatCLP(totalExpense)}</div>
          <div class="metric-detail">Promedio: ${UI.formatCLP(Math.round(totalExpense / months.length))}/mes</div>
        </div>
        <div class="metric-card success">
          <div class="metric-label">Total Ingresos (${months.length} meses)</div>
          <div class="metric-value positive">${UI.formatCLP(totalIncome)}</div>
          <div class="metric-detail">Promedio: ${UI.formatCLP(Math.round(totalIncome / months.length))}/mes</div>
        </div>
        <div class="metric-card accent">
          <div class="metric-label">Balance del Rango</div>
          <div class="metric-value ${remaining >= 0 ? 'positive' : 'negative'}">${UI.formatCLP(remaining)}</div>
          <div class="metric-detail">Ingresos – Gastos</div>
        </div>
      </div>
      <div class="charts-grid fade-in">
        <div class="chart-container">
          <div class="card-header">
            <h3 class="card-title">Gastos por</h3>
            <div class="toggle-group" id="bar-toggle">
              <button class="toggle-btn active" data-group="categoria">Categoría</button>
              <button class="toggle-btn" data-group="tipo">Tipo</button>
              <button class="toggle-btn" data-group="medioPago">Medio</button>
            </div>
          </div>
          <canvas id="chart-bar"></canvas>
        </div>
        <div class="chart-container">
          <div class="card-header"><h3 class="card-title">Evolución de Gastos</h3></div>
          <canvas id="chart-expense-line"></canvas>
        </div>
      </div>`;

    renderMultiMonthExpenseLineChart(months);
    renderMultiMonthBarChart(months, 'categoria');
    document.getElementById('bar-toggle').addEventListener('click', e => {
      const btn = e.target.closest('.toggle-btn');
      if (!btn) return;
      document.querySelectorAll('#bar-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMultiMonthBarChart(months, btn.dataset.group);
    });
  }

  // ---------- INCOMES ----------
  function renderIncomesDashboard(container, months) {
    const isRange = months.length > 1;
    const { month, year } = months[0];

    if (!isRange) {
      const totalIncome = Store.getTotalIncome(month, year);
      const incomes = Store.getByMonth('incomes', month, year);
      const sourceMap = {};
      incomes.forEach(i => {
        const src = i.fuente || 'Sin fuente';
        sourceMap[src] = (sourceMap[src] || 0) + Store.parseCurrency(i.monto);
      });

      container.innerHTML = `
        <div class="metrics-grid fade-in">
          <div class="metric-card">
            <div class="metric-label">Total Ingresos del Mes</div>
            <div class="metric-value positive">${UI.formatCLP(totalIncome)}</div>
            <div class="metric-detail">${incomes.length} registro(s)</div>
          </div>
        </div>
        <div class="charts-grid fade-in">
          <div class="chart-container">
            <div class="card-header"><h3 class="card-title">Ingresos por Fuente</h3></div>
            <canvas id="chart-income-bar"></canvas>
          </div>
          <div class="chart-container">
            <div class="card-header"><h3 class="card-title">Evolución de Ingresos</h3></div>
            <canvas id="chart-income-line"></canvas>
          </div>
        </div>`;

      new Chart(document.getElementById('chart-income-bar').getContext('2d'), {
        type: 'bar',
        data: {
          labels: Object.keys(sourceMap),
          datasets: [{ label: 'Monto', data: Object.values(sourceMap), backgroundColor: chartColors(Object.keys(sourceMap).length), borderRadius: 6 }]
        },
        options: chartBarOptions()
      });
      renderIncomeLineChart(month, year);
      return;
    }

    // Multi-month
    const totalIncome  = months.reduce((s, {month: m, year: y}) => s + Store.getTotalIncome(m, y), 0);
    const allIncomes   = Store.getByMonths('incomes', months);
    const labels       = months.map(({month: m, year: y}) => UI.getMonthLabel(m, y));

    container.innerHTML = `
      <div class="metrics-grid fade-in">
        <div class="metric-card">
          <div class="metric-label">Total Ingresos (${months.length} meses)</div>
          <div class="metric-value positive">${UI.formatCLP(totalIncome)}</div>
          <div class="metric-detail">${allIncomes.length} registro(s)</div>
        </div>
        <div class="metric-card accent">
          <div class="metric-label">Promedio Mensual</div>
          <div class="metric-value positive">${UI.formatCLP(Math.round(totalIncome / months.length))}</div>
        </div>
      </div>
      <div class="charts-grid fade-in">
        <div class="chart-container">
          <div class="card-header"><h3 class="card-title">Ingresos por Fuente</h3></div>
          <canvas id="chart-income-bar"></canvas>
        </div>
        <div class="chart-container">
          <div class="card-header"><h3 class="card-title">Evolución de Ingresos</h3></div>
          <canvas id="chart-income-line"></canvas>
        </div>
      </div>`;

    const sourceMonthMap = {};
    months.forEach(({month: m, year: y}, idx) => {
      Store.getByMonth('incomes', m, y).forEach(i => {
        const src = i.fuente || 'Sin fuente';
        if (!sourceMonthMap[src]) sourceMonthMap[src] = new Array(months.length).fill(0);
        sourceMonthMap[src][idx] += Store.parseCurrency(i.monto);
      });
    });
    const sortedSources = Object.entries(sourceMonthMap)
      .sort(([, a], [, b]) => b.reduce((x, y) => x + y, 0) - a.reduce((x, y) => x + y, 0));

    new Chart(document.getElementById('chart-income-bar').getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: sortedSources.map(([src, data], i) => ({
          label: src, data, backgroundColor: chartColors(sortedSources.length)[i], borderRadius: 2,
        }))
      },
      options: stackedBarOptions()
    });

    new Chart(document.getElementById('chart-income-line').getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Ingresos',
          data: months.map(({month: m, year: y}) => Store.getTotalIncome(m, y)),
          borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)',
          fill: true, tension: 0.4, borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#1e293b' } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${UI.formatCLP(ctx.raw)}` } }
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { ticks: { color: '#64748b', callback: v => UI.formatCLP(v) }, grid: { color: 'rgba(0,0,0,0.06)' } }
        }
      }
    });
  }

  // ---------- SAVINGS ----------
  function renderSavingsDashboard(container, months) {
    const isRange = months.length > 1;
    const { month, year } = months[0];
    const allSavingsAll = Store.getAll('savings');
    const totalAccumulated = allSavingsAll.reduce((s, r) => s + Store.parseCurrency(r.monto), 0);

    if (!isRange) {
      const monthlySavings = Store.getTotalSavings(month, year);
      const records = Store.getByMonth('savings', month, year);
      const categoryMap = {};
      records.forEach(r => {
        const cat = r.categoria || 'Sin categoría';
        categoryMap[cat] = (categoryMap[cat] || 0) + Store.parseCurrency(r.monto);
      });

      container.innerHTML = `
        <div class="metrics-grid fade-in">
          <div class="metric-card success">
            <div class="metric-label">Ahorros del Mes</div>
            <div class="metric-value positive">${UI.formatCLP(monthlySavings)}</div>
            <div class="metric-detail">${records.length} registro(s)</div>
          </div>
          <div class="metric-card accent">
            <div class="metric-label">Total Acumulado</div>
            <div class="metric-value positive">${UI.formatCLP(totalAccumulated)}</div>
            <div class="metric-detail">${allSavingsAll.length} movimiento(s) históricos</div>
          </div>
        </div>
        <div class="charts-grid fade-in">
          <div class="chart-container">
            <div class="card-header"><h3 class="card-title">Por Categoría (mes)</h3></div>
            <canvas id="chart-savings-bar"></canvas>
          </div>
          <div class="chart-container">
            <div class="card-header"><h3 class="card-title">Evolución de Ahorros</h3></div>
            <canvas id="chart-savings-line"></canvas>
          </div>
        </div>`;

      const sorted = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
      new Chart(document.getElementById('chart-savings-bar').getContext('2d'), {
        type: 'bar',
        data: {
          labels: sorted.map(s => s[0]),
          datasets: [{ label: 'Monto', data: sorted.map(s => s[1]), backgroundColor: chartColors(sorted.length), borderRadius: 6, maxBarThickness: 40 }]
        },
        options: chartBarOptions()
      });

      const lineLabels = [], lineData = [];
      for (let i = 5; i >= 0; i--) {
        let m = month - i, y = year;
        while (m < 1) { m += 12; y--; }
        lineLabels.push(UI.getMonthLabel(m, y));
        lineData.push(Store.getTotalSavings(m, y));
      }
      new Chart(document.getElementById('chart-savings-line').getContext('2d'), {
        type: 'line',
        data: {
          labels: lineLabels,
          datasets: [{
            label: 'Ahorros', data: lineData, borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,0.1)', fill: true, tension: 0.4, borderWidth: 2,
            pointRadius: 4, pointBackgroundColor: '#f59e0b',
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { labels: { color: '#1e293b', usePointStyle: true } },
            tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${UI.formatCLP(ctx.raw)}` } }
          },
          scales: {
            x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.06)' } },
            y: { ticks: { color: '#64748b', callback: v => UI.formatCLP(v) }, grid: { color: 'rgba(0,0,0,0.06)' } }
          }
        }
      });
      return;
    }

    // Multi-month
    const totalSavings   = months.reduce((s, {month: m, year: y}) => s + Store.getTotalSavings(m, y), 0);
    const allRecords     = Store.getByMonths('savings', months);
    const labels         = months.map(({month: m, year: y}) => UI.getMonthLabel(m, y));

    container.innerHTML = `
      <div class="metrics-grid fade-in">
        <div class="metric-card success">
          <div class="metric-label">Ahorros (${months.length} meses)</div>
          <div class="metric-value positive">${UI.formatCLP(totalSavings)}</div>
          <div class="metric-detail">${allRecords.length} registro(s)</div>
        </div>
        <div class="metric-card accent">
          <div class="metric-label">Total Acumulado</div>
          <div class="metric-value positive">${UI.formatCLP(totalAccumulated)}</div>
          <div class="metric-detail">${allSavingsAll.length} movimiento(s) históricos</div>
        </div>
      </div>
      <div class="charts-grid fade-in">
        <div class="chart-container">
          <div class="card-header"><h3 class="card-title">Por Categoría</h3></div>
          <canvas id="chart-savings-bar"></canvas>
        </div>
        <div class="chart-container">
          <div class="card-header"><h3 class="card-title">Evolución de Ahorros</h3></div>
          <canvas id="chart-savings-line"></canvas>
        </div>
      </div>`;

    const catMonthMap = {};
    months.forEach(({month: m, year: y}, idx) => {
      Store.getByMonth('savings', m, y).forEach(r => {
        const cat = r.categoria || 'Sin categoría';
        if (!catMonthMap[cat]) catMonthMap[cat] = new Array(months.length).fill(0);
        catMonthMap[cat][idx] += Store.parseCurrency(r.monto);
      });
    });
    const sortedCats = Object.entries(catMonthMap)
      .sort(([, a], [, b]) => b.reduce((x, y) => x + y, 0) - a.reduce((x, y) => x + y, 0));

    new Chart(document.getElementById('chart-savings-bar').getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: sortedCats.map(([cat, data], i) => ({
          label: cat, data, backgroundColor: chartColors(sortedCats.length)[i], borderRadius: 2,
        }))
      },
      options: stackedBarOptions()
    });

    new Chart(document.getElementById('chart-savings-line').getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Ahorros',
          data: months.map(({month: m, year: y}) => Store.getTotalSavings(m, y)),
          borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)',
          fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#f59e0b',
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#1e293b', usePointStyle: true } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${UI.formatCLP(ctx.raw)}` } }
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { ticks: { color: '#64748b', callback: v => UI.formatCLP(v) }, grid: { color: 'rgba(0,0,0,0.06)' } }
        }
      }
    });
  }

  // ---------- ACCOUNTS ----------
  function renderAccountsDashboard(container) {
    const accounts   = Store.getAll('accounts');
    const cobrar     = accounts.filter(a => a.tipo === 'Cuentas por cobrar');
    const pagar      = accounts.filter(a => a.tipo === 'Cuentas por pagar');
    const totalCobrar = cobrar.reduce((s, a) => s + Store.parseCurrency(a.monto), 0);
    const totalPagar  = pagar.reduce((s, a)  => s + Store.parseCurrency(a.monto), 0);

    container.innerHTML = `
      <div class="metrics-grid fade-in">
        <div class="metric-card">
          <div class="metric-label">Total por Cobrar</div>
          <div class="metric-value positive">${UI.formatCLP(totalCobrar)}</div>
          <div class="metric-detail">${cobrar.length} cuenta(s)</div>
        </div>
        <div class="metric-card accent">
          <div class="metric-label">Total por Pagar</div>
          <div class="metric-value negative">${UI.formatCLP(totalPagar)}</div>
          <div class="metric-detail">${pagar.length} cuenta(s)</div>
        </div>
        <div class="metric-card success">
          <div class="metric-label">Balance Neto</div>
          <div class="metric-value ${totalCobrar - totalPagar >= 0 ? 'positive' : 'negative'}">${UI.formatCLP(totalCobrar - totalPagar)}</div>
        </div>
      </div>
      <div class="charts-grid fade-in">
        <div class="chart-container">
          <div class="card-header"><h3 class="card-title">Distribución de Cuentas</h3></div>
          <canvas id="chart-accounts-pie"></canvas>
        </div>
      </div>`;

    new Chart(document.getElementById('chart-accounts-pie').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Por Cobrar', 'Por Pagar'],
        datasets: [{ data: [totalCobrar, totalPagar], backgroundColor: ['#10b981', '#4a7cf7'], borderWidth: 0 }]
      },
      options: { responsive: true, plugins: { legend: { labels: { color: '#1e293b' } } } }
    });
  }

  // ---------- HELPERS ----------
  function getExpensesToDay(month, year, day) {
    return Store.getByMonth('expenses', month, year)
      .filter(e => { const p = Store.parseRecordDate('expenses', e.fecha); return p && p.day <= day; })
      .reduce((sum, e) => sum + Store.parseCurrency(e.gasto), 0);
  }

  function getSavingsToDay(month, year, day) {
    return Store.getByMonth('savings', month, year)
      .filter(s => { const p = Store.parseRecordDate('savings', s.fecha); return p && p.day <= day; })
      .reduce((sum, s) => sum + Store.parseCurrency(s.monto), 0);
  }

  // ---------- PRESUPUESTO ("5 facetas") ----------
  function getCategorySpend(categoria, month, year) {
    const gasto = Store.getByMonth('expenses', month, year)
      .filter(e => e.categoria === categoria)
      .reduce((s, e) => s + Store.parseCurrency(e.gasto), 0);
    const ahorro = Store.getByMonth('savings', month, year)
      .filter(r => r.categoria === categoria)
      .reduce((s, r) => s + Store.parseCurrency(r.monto), 0);
    return gasto + ahorro;
  }

  function renderPresupuestoDashboard(container, months) {
    const groups = Store.getBudgetGroups();
    if (!groups.length) {
      container.innerHTML = `
        <div class="empty-state fade-in">
          <div class="empty-state-text">No hay grupos de presupuesto configurados</div>
          <div class="empty-state-hint">Ve a Edición → Presupuesto (5 facetas) para crear tus grupos</div>
        </div>`;
      return;
    }

    const isRange = months.length > 1;
    const totalIncome = months.reduce((s, { month, year }) => s + Store.getTotalIncome(month, year), 0);

    const rows = groups
      .map(g => {
        const categorias = g.categorias || [];
        const spent = categorias.reduce((s, cat) =>
          s + months.reduce((s2, { month, year }) => s2 + getCategorySpend(cat, month, year), 0), 0);
        const target = Math.round(totalIncome * (parseFloat(g.porcentaje) || 0) / 100);
        return { nombre: g.nombre, porcentaje: g.porcentaje, spent, target, pct: target > 0 ? (spent / target) * 100 : 0 };
      })
      .sort((a, b) => b.pct - a.pct);

    const assignedCategorias = new Set(groups.flatMap(g => g.categorias || []));
    const unassigned = [...Store.getCategories(), ...Store.getSavingsCategories()]
      .filter(cat => !assignedCategorias.has(cat))
      .map(cat => ({ categoria: cat, spent: months.reduce((s, { month, year }) => s + getCategorySpend(cat, month, year), 0) }))
      .filter(r => r.spent > 0);

    const totalSpent  = rows.reduce((s, r) => s + r.spent, 0);
    const pctSum      = groups.reduce((s, g) => s + (parseFloat(g.porcentaje) || 0), 0);
    const overCount   = rows.filter(r => r.pct >= 100).length;

    const rowsHTML = rows.map(r => {
      const level = r.pct >= 100 ? 'danger' : r.pct >= 80 ? 'warning' : 'success';
      return `
        <div class="budget-row">
          <div class="budget-row-header">
            <span class="budget-row-category">${r.nombre} <span class="budget-row-pct">(${r.porcentaje}%)</span></span>
            <span class="budget-row-amounts">${UI.formatCLP(r.spent)} / ${UI.formatCLP(r.target)}</span>
          </div>
          <div class="budget-bar"><div class="budget-bar-fill ${level}" style="width:${Math.min(r.pct, 100)}%"></div></div>
        </div>`;
    }).join('');

    const unassignedHTML = unassigned.length ? `
      <div class="chart-container fade-in" style="margin-top:var(--space-6)">
        <div class="card-header"><h3 class="card-title">Sin grupo asignado</h3></div>
        ${unassigned.map(r => `
          <div class="budget-row">
            <div class="budget-row-header">
              <span class="budget-row-category">${r.categoria}</span>
              <span class="budget-row-amounts">${UI.formatCLP(r.spent)}</span>
            </div>
          </div>`).join('')}
      </div>` : '';

    container.innerHTML = `
      <div class="metrics-grid fade-in">
        <div class="metric-card">
          <div class="metric-label">Ingreso ${isRange ? `(${months.length} meses)` : 'del Mes'}</div>
          <div class="metric-value positive">${UI.formatCLP(totalIncome)}</div>
          <div class="metric-detail">${UI.formatCLP(totalSpent)} distribuido en grupos</div>
        </div>
        <div class="metric-card ${overCount > 0 ? 'accent' : 'success'}">
          <div class="metric-label">Grupos sobre presupuesto</div>
          <div class="metric-value ${overCount > 0 ? 'negative' : 'positive'}">${overCount} / ${rows.length}</div>
          <div class="metric-detail">${overCount > 0 ? 'Revisa los grupos en rojo' : 'Todo dentro del presupuesto'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Suma de porcentajes</div>
          <div class="metric-value ${pctSum === 100 ? 'positive' : 'warning'}">${pctSum}%</div>
          <div class="metric-detail">Editable en Edición → Presupuesto</div>
        </div>
      </div>
      <div class="chart-container fade-in">
        <div class="card-header"><h3 class="card-title">Presupuesto por Grupo</h3></div>
        ${rowsHTML}
      </div>
      ${unassignedHTML}`;
  }

  function renderExpenseLineChart(month, year) {
    const ctx = document.getElementById('chart-expense-line');
    if (!ctx) return;
    const labels = [], data = [];
    for (let i = 5; i >= 0; i--) {
      let m = month - i, y = year;
      while (m < 1) { m += 12; y--; }
      labels.push(UI.getMonthLabel(m, y));
      data.push(Store.getTotalExpenses(m, y));
    }
    new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Gastos', data, borderColor: '#4a7cf7',
          backgroundColor: 'rgba(74,124,247,0.1)', fill: true, tension: 0.4, borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#1e293b' } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${UI.formatCLP(ctx.raw)}` } }
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { ticks: { color: '#64748b', callback: v => UI.formatCLP(v) }, grid: { color: 'rgba(0,0,0,0.06)' } }
        }
      }
    });
  }

  function renderMultiMonthExpenseLineChart(months) {
    const ctx = document.getElementById('chart-expense-line');
    if (!ctx) return;
    const labels = months.map(({month, year}) => UI.getMonthLabel(month, year));
    const data    = months.map(({month, year}) => Store.getTotalExpenses(month, year));
    new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Gastos', data, borderColor: '#4a7cf7',
          backgroundColor: 'rgba(74,124,247,0.1)', fill: true, tension: 0.4, borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#1e293b' } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${UI.formatCLP(ctx.raw)}` } }
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { ticks: { color: '#64748b', callback: v => UI.formatCLP(v) }, grid: { color: 'rgba(0,0,0,0.06)' } }
        }
      }
    });
  }

  function renderIncomeLineChart(month, year) {
    const ctx = document.getElementById('chart-income-line');
    if (!ctx) return;
    const labels = [], data = [];
    for (let i = 5; i >= 0; i--) {
      let m = month - i, y = year;
      while (m < 1) { m += 12; y--; }
      labels.push(UI.getMonthLabel(m, y));
      data.push(Store.getTotalIncome(m, y));
    }
    new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Ingresos', data, borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4, borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#1e293b' } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${UI.formatCLP(ctx.raw)}` } }
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { ticks: { color: '#64748b', callback: v => UI.formatCLP(v) }, grid: { color: 'rgba(0,0,0,0.06)' } }
        }
      }
    });
  }

  function renderBarChart(month, year, groupBy) {
    const ctx = document.getElementById('chart-bar');
    if (!ctx) return;
    const map = {};
    Store.getByMonth('expenses', month, year).forEach(e => {
      const key = e[groupBy] || 'Sin datos';
      map[key] = (map[key] || 0) + Store.parseCurrency(e.gasto);
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    if (barChart) barChart.destroy();
    barChart = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: sorted.map(s => s[0]),
        datasets: [{ label: 'Gasto', data: sorted.map(s => s[1]), backgroundColor: chartColors(sorted.length), borderRadius: 6, maxBarThickness: 40 }]
      },
      options: chartBarOptions()
    });
  }

  function renderMultiMonthBarChart(months, groupBy) {
    const ctx = document.getElementById('chart-bar');
    if (!ctx) return;
    const labels = months.map(({month, year}) => UI.getMonthLabel(month, year));
    const groupMonthMap = {};
    months.forEach(({month, year}, idx) => {
      Store.getByMonth('expenses', month, year).forEach(e => {
        const key = e[groupBy] || 'Sin datos';
        if (!groupMonthMap[key]) groupMonthMap[key] = new Array(months.length).fill(0);
        groupMonthMap[key][idx] += Store.parseCurrency(e.gasto);
      });
    });
    const sorted = Object.entries(groupMonthMap)
      .sort(([, a], [, b]) => b.reduce((x, y) => x + y, 0) - a.reduce((x, y) => x + y, 0));
    const colors = chartColors(sorted.length);
    if (barChart) barChart.destroy();
    barChart = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: sorted.map(([name, data], i) => ({ label: name, data, backgroundColor: colors[i], borderRadius: 2 }))
      },
      options: stackedBarOptions()
    });
  }

  function chartBarOptions() {
    return {
      responsive: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => UI.formatCLP(ctx.raw) } }
      },
      scales: {
        x: { ticks: { color: '#64748b', callback: v => UI.formatCLP(v) }, grid: { color: 'rgba(0,0,0,0.06)' } },
        y: { ticks: { color: '#1e293b', font: { size: 11 } }, grid: { display: false } }
      }
    };
  }

  function stackedBarOptions() {
    return {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#1e293b', font: { size: 10 }, usePointStyle: true, padding: 10 }
        },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${UI.formatCLP(ctx.raw)}` } }
      },
      scales: {
        x: { stacked: true, ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.06)' } },
        y: { stacked: true, ticks: { color: '#64748b', callback: v => UI.formatCLP(v) }, grid: { color: 'rgba(0,0,0,0.06)' } }
      }
    };
  }

  function chartColors(count) {
    const palette = [
      '#4a7cf7', '#6366f1', '#10b981', '#f59e0b', '#8b5cf6',
      '#ec4899', '#f97316', '#14b8a6', '#3b82f6', '#06b6d4',
      '#22c55e', '#eab308', '#0ea5e9', '#d946ef', '#a855f7',
      '#84cc16', '#7c3aed', '#fb923c', '#2dd4bf', '#0d9488',
      '#4f46e5', '#6d28d9', '#65a30d',
    ];
    return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
  }

  return { render };
})();
