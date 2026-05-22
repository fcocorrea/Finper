// dashboard.js — Metrics & Charts (Chart.js)

const Dashboard = (() => {
  let lineChart = null;
  let barChart = null;

  function render(dataType, month, year) {
    const container = document.getElementById('view-dashboard');
    if (dataType === 'incomes') {
      renderIncomesDashboard(container, month, year);
    } else if (dataType === 'accounts') {
      renderAccountsDashboard(container, month, year);
    } else {
      renderExpensesDashboard(container, month, year);
    }
  }

  function renderExpensesDashboard(container, month, year) {
    const totalIncome = Store.getTotalIncome(month, year);
    const totalExpense = Store.getTotalExpenses(month, year);
    const totalExpenseCore = Store.getTotalExpenses(month, year, ['Deuda', 'Ahorro', 'Inversión']);

    // Metrics
    const pctUsed = totalIncome > 0 ? ((totalExpenseCore / totalIncome) * 100).toFixed(1) : 0;
    const today = new Date();
    const daysInMonth = new Date(year, month, 0).getDate();
    const currentDay = (today.getFullYear() === year && today.getMonth() + 1 === month) ? today.getDate() : daysInMonth;
    const remainingDays = daysInMonth - currentDay;
    const remaining = totalIncome - totalExpenseCore;
    const dailyBudget = remainingDays > 0 ? Math.round(remaining / remainingDays) : remaining;

    // Comparison with previous month
    let prevMonth = month - 1, prevYear = year;
    if (prevMonth < 1) { prevMonth = 12; prevYear--; }
    const prevExpenses = getExpensesToDay(prevMonth, prevYear, currentDay);
    const currentExpenses = getExpensesToDay(month, year, currentDay);
    const comparison = prevExpenses > 0 ? ((currentExpenses / prevExpenses) * 100).toFixed(1) : 0;

    container.innerHTML = `
      <div class="metrics-grid fade-in">
        <div class="metric-card">
          <div class="metric-label">% Gastado del Ingreso</div>
          <div class="metric-value ${pctUsed > 100 ? 'negative' : pctUsed > 80 ? 'warning' : 'positive'}">${pctUsed}%</div>
          <div class="metric-detail">${UI.formatCLP(totalExpenseCore)} de ${UI.formatCLP(totalIncome)}</div>
        </div>
        <div class="metric-card accent">
          <div class="metric-label">Presupuesto Diario</div>
          <div class="metric-value ${dailyBudget < 0 ? 'negative' : 'positive'}">${UI.formatCLP(dailyBudget)}</div>
          <div class="metric-detail">${remainingDays} días restantes del mes</div>
        </div>
        <div class="metric-card success">
          <div class="metric-label">vs. Mes Anterior (día ${currentDay})</div>
          <div class="metric-value ${comparison > 100 ? 'negative' : 'positive'}">${comparison}%</div>
          <div class="metric-detail">${UI.formatCLP(currentExpenses)} vs ${UI.formatCLP(prevExpenses)}</div>
        </div>
      </div>
      <div class="charts-grid fade-in">
        <div class="chart-container">
          <div class="card-header">
            <h3 class="card-title">Ingresos vs Gastos</h3>
          </div>
          <canvas id="chart-line"></canvas>
        </div>
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
      </div>
    `;

    renderLineChart(month, year);
    renderBarChart(month, year, 'categoria');

    document.getElementById('bar-toggle').addEventListener('click', e => {
      const btn = e.target.closest('.toggle-btn');
      if (!btn) return;
      document.querySelectorAll('#bar-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderBarChart(month, year, btn.dataset.group);
    });
  }

  function renderIncomesDashboard(container, month, year) {
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
      </div>
    `;

    // Bar chart by source
    const ctx1 = document.getElementById('chart-income-bar').getContext('2d');
    new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: Object.keys(sourceMap),
        datasets: [{ label: 'Monto', data: Object.values(sourceMap), backgroundColor: chartColors(Object.keys(sourceMap).length), borderRadius: 6 }]
      },
      options: chartBarOptions()
    });

    // Line chart history
    renderIncomeLineChart(month, year);
  }

  function renderAccountsDashboard(container, month, year) {
    const accounts = Store.getAll('accounts');
    const cobrar = accounts.filter(a => a.tipo === 'Cuentas por cobrar');
    const pagar = accounts.filter(a => a.tipo === 'Cuentas por pagar');
    const totalCobrar = cobrar.reduce((s, a) => s + Store.parseCurrency(a.monto), 0);
    const totalPagar = pagar.reduce((s, a) => s + Store.parseCurrency(a.monto), 0);

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
      </div>
    `;
    const ctx = document.getElementById('chart-accounts-pie').getContext('2d');
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Por Cobrar', 'Por Pagar'],
        datasets: [{ data: [totalCobrar, totalPagar], backgroundColor: ['#10b981', '#4a7cf7'], borderWidth: 0 }]
      },
      options: { responsive: true, plugins: { legend: { labels: { color: '#1e293b' } } } }
    });
  }

  // Get expenses up to a specific day of the month
  function getExpensesToDay(month, year, day) {
    const expenses = Store.getByMonth('expenses', month, year);
    return expenses.filter(e => {
      const parsed = Store.parseRecordDate('expenses', e.fecha);
      return parsed && parsed.day <= day;
    }).reduce((sum, e) => sum + Store.parseCurrency(e.gasto), 0);
  }

  // ---------- LINE CHART: INCOME vs EXPENSES ----------
  function renderLineChart(month, year) {
    const ctx = document.getElementById('chart-line');
    if (!ctx) return;

    const labels = [];
    const incomeData = [];
    const expenseData = [];

    // Last 6 months including selected
    for (let i = 5; i >= 0; i--) {
      let m = month - i, y = year;
      while (m < 1) { m += 12; y--; }
      labels.push(UI.getMonthLabel(m, y));
      incomeData.push(Store.getTotalIncome(m, y));
      expenseData.push(Store.getTotalExpenses(m, y, ['Deuda', 'Ahorro', 'Inversión']));
    }

    if (lineChart) lineChart.destroy();
    lineChart = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Ingresos',
            data: incomeData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.1)',
            fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4,
            pointBackgroundColor: '#10b981',
          },
          {
            label: 'Gastos',
            data: expenseData,
            borderColor: '#4a7cf7',
            backgroundColor: 'rgba(74,124,247,0.1)',
            fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4,
            pointBackgroundColor: '#4a7cf7',
          },
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#1e293b', usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${UI.formatCLP(ctx.raw)}`
            }
          }
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: {
            ticks: { color: '#64748b', callback: v => UI.formatCLP(v) },
            grid: { color: 'rgba(0,0,0,0.06)' }
          }
        }
      }
    });
  }

  function renderIncomeLineChart(month, year) {
    const ctx = document.getElementById('chart-income-line');
    if (!ctx) return;
    const labels = [];
    const data = [];
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
          backgroundColor: 'rgba(16,185,129,0.1)',
          fill: true, tension: 0.4, borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#1e293b' } } },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { ticks: { color: '#64748b', callback: v => UI.formatCLP(v) }, grid: { color: 'rgba(0,0,0,0.06)' } }
        }
      }
    });
  }

  // ---------- BAR CHART ----------
  function renderBarChart(month, year, groupBy) {
    const ctx = document.getElementById('chart-bar');
    if (!ctx) return;
    const expenses = Store.getByMonth('expenses', month, year);
    const map = {};
    expenses.forEach(e => {
      const key = e[groupBy] || 'Sin datos';
      map[key] = (map[key] || 0) + Store.parseCurrency(e.gasto);
    });

    // Sort by value descending
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);

    if (barChart) barChart.destroy();
    barChart = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: sorted.map(s => s[0]),
        datasets: [{
          label: 'Gasto',
          data: sorted.map(s => s[1]),
          backgroundColor: chartColors(sorted.length),
          borderRadius: 6,
          maxBarThickness: 40,
        }]
      },
      options: chartBarOptions()
    });
  }

  function chartBarOptions() {
    return {
      responsive: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => UI.formatCLP(ctx.raw) }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', callback: v => UI.formatCLP(v) },
          grid: { color: 'rgba(0,0,0,0.06)' }
        },
        y: {
          ticks: { color: '#1e293b', font: { size: 11 } },
          grid: { display: false }
        }
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
