// ui.js — UI utilities, modals, toast, confirm, navigation

const UI = (() => {
  // ---------- TOAST ----------
  function toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const icons = { success: '✓', error: 'X', warning: '!', info: 'i' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  // ---------- CONFIRM DIALOG ----------
  function confirm(title, message) {
    return new Promise(resolve => {
      const overlay = document.getElementById('confirm-overlay');
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-message').textContent = message;
      overlay.classList.add('active');
      const yesBtn = document.getElementById('confirm-yes');
      const noBtn = document.getElementById('confirm-no');
      function cleanup() {
        overlay.classList.remove('active');
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
      }
      function onYes() { cleanup(); resolve(true); }
      function onNo() { cleanup(); resolve(false); }
      yesBtn.addEventListener('click', onYes);
      noBtn.addEventListener('click', onNo);
    });
  }

  // ---------- MODAL ----------
  function openModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.add('active');
  }

  function closeModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.remove('active');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }

  // ---------- FORMAT ----------
  function formatCLP(amount) {
    const num = typeof amount === 'number'
      ? Math.round(amount)
      : parseInt(String(amount).replace(/[^0-9-]/g, '')) || 0;
    return '$' + num.toLocaleString('es-CL');
  }

  function formatDateDMY(date) {
    if (!date) return '';
    if (typeof date === 'string' && date.includes('-') && date.length <= 8) return date;
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  }

  function formatDateMY(date) {
    if (!date) return '';
    if (typeof date === 'string' && date.includes('-') && date.length <= 5) return date;
    const d = new Date(date);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}-${yy}`;
  }

  // Accepts a 2-digit ("26") or 4-digit ("2026") year segment.
  function _fullYear(y) {
    return y.length === 4 ? parseInt(y) : 2000 + parseInt(y);
  }

  function parseDateDMY(str) {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length === 3) {
      return new Date(_fullYear(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return null;
  }

  function parseDateMY(str) {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length === 2) {
      return new Date(_fullYear(parts[1]), parseInt(parts[0]) - 1, 1);
    }
    return null;
  }

  // ---------- MONTH NAVIGATION ----------
  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  function getMonthLabel(month, year) {
    return `${MONTH_NAMES[month - 1]} ${year}`;
  }

  // ---------- AUTOCOMPLETE ----------
  function setupAutocomplete(inputEl, getItems, onSelect) {
    const wrapper = inputEl.parentElement;
    wrapper.classList.add('autocomplete-wrapper');

    let listEl = wrapper.querySelector('.autocomplete-list');
    if (!listEl) {
      listEl = document.createElement('div');
      listEl.className = 'autocomplete-list';
      wrapper.appendChild(listEl);
    }

    let highlighted = -1;

    inputEl.addEventListener('input', () => {
      const val = inputEl.value.toLowerCase();
      const items = getItems().filter(i => i.toLowerCase().includes(val));
      renderList(items);
    });

    inputEl.addEventListener('focus', () => {
      const val = inputEl.value.toLowerCase();
      const items = getItems().filter(i => i.toLowerCase().includes(val));
      if (items.length) renderList(items);
    });

    inputEl.addEventListener('keydown', (e) => {
      const items = listEl.querySelectorAll('.autocomplete-item');
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlighted = Math.min(highlighted + 1, items.length - 1);
        updateHighlight(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlighted = Math.max(highlighted - 1, 0);
        updateHighlight(items);
      } else if (e.key === 'Enter' && highlighted >= 0) {
        e.preventDefault();
        items[highlighted].click();
      } else if (e.key === 'Escape') {
        listEl.classList.remove('show');
      }
    });

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) listEl.classList.remove('show');
    });

    function renderList(items) {
      highlighted = -1;
      if (!items.length) { listEl.classList.remove('show'); return; }
      listEl.innerHTML = items.map(i =>
        `<div class="autocomplete-item">${i}</div>`
      ).join('');
      listEl.classList.add('show');
      listEl.querySelectorAll('.autocomplete-item').forEach(el => {
        el.addEventListener('click', () => {
          inputEl.value = el.textContent;
          listEl.classList.remove('show');
          if (onSelect) onSelect(el.textContent);
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });
    }

    function updateHighlight(items) {
      items.forEach((el, i) => el.classList.toggle('highlighted', i === highlighted));
    }
  }

  // ---------- FORMULA INPUT (Excel-style arithmetic) ----------
  // Typing "=1500+2300" and leaving the field evaluates it to "3800".
  function enableFormulaInput(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && inputEl.value.trim().startsWith('=')) {
        e.preventDefault();
        _evaluateFormula(inputEl);
      }
    });
    inputEl.addEventListener('blur', () => _evaluateFormula(inputEl));
  }

  function _evaluateFormula(inputEl) {
    const raw = inputEl.value.trim();
    if (!raw.startsWith('=')) return;
    const expr = raw.slice(1);
    if (!expr || !/^[0-9+\-*/(). ]+$/.test(expr)) {
      toast('Fórmula inválida', 'warning');
      return;
    }
    let result;
    try {
      result = Function(`"use strict"; return (${expr});`)();
    } catch {
      toast('Fórmula inválida', 'warning');
      return;
    }
    if (typeof result !== 'number' || !isFinite(result)) {
      toast('Fórmula inválida', 'warning');
      return;
    }
    inputEl.value = String(Math.round(result));
  }

  // ---------- RENDER SELECT OPTIONS ----------
  function renderSelectOptions(selectEl, options, placeholder = 'Seleccionar...') {
    selectEl.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
    options.forEach(opt => {
      selectEl.innerHTML += `<option value="${opt}">${opt}</option>`;
    });
  }

  return {
    toast, confirm, openModal, closeModal, closeAllModals,
    formatCLP, formatDateDMY, formatDateMY, parseDateDMY, parseDateMY,
    MONTH_NAMES, getMonthLabel,
    setupAutocomplete, renderSelectOptions, enableFormulaInput,
  };
})();
