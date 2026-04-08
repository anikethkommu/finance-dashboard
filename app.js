/* ─────────────────────────────────────
   FINANCE DASHBOARD — app.js
   Handles: transactions, chart, storage,
   dark mode, toast notifications
───────────────────────────────────── */

/* ─────────────────────────────────────
   1. STATE
   This is the single source of truth.
   All data lives here while the app runs.
───────────────────────────────────── */
let transactions = [];      // array of transaction objects
let currentType  = 'expense'; // tracks if user picked income or expense
let spendingChart = null;    // will hold the Chart.js instance

/* ─────────────────────────────────────
   2. DOM REFERENCES
   Grab every element we need once, at
   the top — faster than querying each time.
───────────────────────────────────── */
const balanceEl       = document.getElementById('balance');
const totalIncomeEl   = document.getElementById('total-income');
const totalExpensesEl = document.getElementById('total-expenses');
const balanceNoteEl   = document.getElementById('balance-note');

const descInput       = document.getElementById('desc');
const amountInput     = document.getElementById('amount');
const categorySelect  = document.getElementById('category');
const addBtn          = document.getElementById('add-btn');
const formError       = document.getElementById('form-error');

const btnExpense      = document.getElementById('btn-expense');
const btnIncome       = document.getElementById('btn-income');

const transactionList = document.getElementById('transaction-list');
const emptyState      = document.getElementById('empty-state');
const clearBtn        = document.getElementById('clear-btn');

const chartCanvas     = document.getElementById('spending-chart');
const chartEmpty      = document.getElementById('chart-empty');
const breakdownList   = document.getElementById('breakdown-list');

const themeToggle     = document.getElementById('theme-toggle');
const themeIcon       = document.getElementById('theme-icon');
const todayDateEl     = document.getElementById('today-date');
const toastEl         = document.getElementById('toast');

/* ─────────────────────────────────────
   3. CHART COLOURS
   One colour per spending category.
   Used in the doughnut chart and the
   category breakdown bar fills.
───────────────────────────────────── */
const CATEGORY_COLORS = {
  Food:          '#3b82f6',
  Transport:     '#8b5cf6',
  Housing:       '#f59e0b',
  Entertainment: '#ec4899',
  Healthcare:    '#10b981',
  Shopping:      '#ef4444',
  Salary:        '#14b8a6',
  Other:         '#9ca3af',
};

/* ─────────────────────────────────────
   4. LOCALSTORAGE HELPERS
   These two functions save and load
   transactions so data survives a page
   refresh.
───────────────────────────────────── */

// Save the transactions array to localStorage as a JSON string
function saveToStorage() {
  localStorage.setItem('ft_transactions', JSON.stringify(transactions));
}

// Load transactions from localStorage (returns empty array if nothing saved yet)
function loadFromStorage() {
  const saved = localStorage.getItem('ft_transactions');
  return saved ? JSON.parse(saved) : [];
}

/* ─────────────────────────────────────
   5. SUMMARY CARDS
   Calculates total income, total expenses,
   and balance, then updates the three
   cards at the top of the page.
───────────────────────────────────── */
function updateSummary() {
  const income   = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance  = income - expenses;

  // Format as currency and inject into the DOM
  balanceEl.textContent       = formatCurrency(balance);
  totalIncomeEl.textContent   = formatCurrency(income);
  totalExpensesEl.textContent = formatCurrency(expenses);

  // Change the balance colour: green if positive, red if negative
  balanceEl.style.color =
    balance > 0 ? 'var(--accent-green)' :
    balance < 0 ? 'var(--accent-red)'   : '';

  // Update the small subtitle under the balance
  balanceNoteEl.textContent = transactions.length === 0
    ? 'Add your first transaction'
    : balance >= 0 ? 'You are on track' : 'Expenses exceed income';
}

/* ─────────────────────────────────────
   6. TRANSACTION LIST
   Renders the full list of transactions
   in the History card. Called every time
   a transaction is added or deleted.
───────────────────────────────────── */
function renderTransactions() {
  // Remove all existing items except the empty state placeholder
  const items = transactionList.querySelectorAll('.transaction-item');
  items.forEach(item => item.remove());

  if (transactions.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  // Show newest transactions at the top (reverse order)
  const reversed = [...transactions].reverse();

  reversed.forEach(t => {
    const li = document.createElement('li');
    li.className = 'transaction-item';
    li.dataset.id = t.id;

    const sign = t.type === 'income' ? '+' : '-';

    li.innerHTML = `
      <div class="txn-left">
        <span class="txn-dot ${t.type}"></span>
        <div class="txn-info">
          <div class="txn-desc">${escapeHTML(t.desc)}</div>
          <div class="txn-cat">${t.category}</div>
        </div>
      </div>
      <div class="txn-right">
        <span class="txn-amount ${t.type}">${sign}${formatCurrency(t.amount)}</span>
        <button class="txn-delete" data-id="${t.id}" aria-label="Delete transaction">✕</button>
      </div>
    `;

    transactionList.appendChild(li);
  });
}

/* ─────────────────────────────────────
   7. CHART
   Builds or updates the doughnut chart
   using Chart.js. Only counts expenses
   (not income) grouped by category.
───────────────────────────────────── */
function updateChart() {
  // Group expenses by category and sum their amounts
  const expenses = transactions.filter(t => t.type === 'expense');

  if (expenses.length === 0) {
    chartEmpty.style.display = 'flex';
    if (spendingChart) {
      spendingChart.destroy();
      spendingChart = null;
    }
    return;
  }

  chartEmpty.style.display = 'none';

  // Build a totals object: { Food: 50, Transport: 30, ... }
  const totals = {};
  expenses.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(totals);
  const data   = Object.values(totals);
  const colors = labels.map(l => CATEGORY_COLORS[l] || '#9ca3af');

  if (spendingChart) {
    // Chart already exists — just update the data
    spendingChart.data.labels   = labels;
    spendingChart.data.datasets[0].data            = data;
    spendingChart.data.datasets[0].backgroundColor = colors;
    spendingChart.update();
  } else {
    // Create the chart for the first time
    spendingChart = new Chart(chartCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: getComputedStyle(document.documentElement)
            .getPropertyValue('--bg-card').trim() || '#ffffff',
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: true,
        cutout: '68%',          // size of the hole in the middle
        plugins: {
          legend: { display: false }, // we build our own legend below
          tooltip: {
            callbacks: {
              // Show dollar amount in the tooltip
              label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`
            }
          }
        }
      }
    });
  }

  updateBreakdown(totals);
}

/* ─────────────────────────────────────
   8. CATEGORY BREAKDOWN
   Renders the list of categories with
   a coloured progress bar showing what
   percentage of total spending each is.
───────────────────────────────────── */
function updateBreakdown(totals) {
  breakdownList.innerHTML = '';

  if (Object.keys(totals).length === 0) {
    breakdownList.innerHTML = '<li class="empty-state">No expenses yet</li>';
    return;
  }

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  Object.entries(totals)
    .sort((a, b) => b[1] - a[1])   // sort highest first
    .forEach(([cat, amt]) => {
      const pct   = grandTotal > 0 ? (amt / grandTotal) * 100 : 0;
      const color = CATEGORY_COLORS[cat] || '#9ca3af';

      const li = document.createElement('li');
      li.className = 'breakdown-item';
      li.innerHTML = `
        <div class="breakdown-top">
          <span class="breakdown-name">${cat}</span>
          <span class="breakdown-amount">${formatCurrency(amt)} (${Math.round(pct)}%)</span>
        </div>
        <div class="breakdown-bar-track">
          <div class="breakdown-bar-fill"
               style="width:${pct.toFixed(1)}%; background:${color};">
          </div>
        </div>
      `;
      breakdownList.appendChild(li);
    });
}

/* ─────────────────────────────────────
   9. ADD TRANSACTION
   Validates the form, creates a new
   transaction object, saves it, and
   re-renders everything.
───────────────────────────────────── */
function addTransaction() {
  const desc   = descInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const cat    = categorySelect.value;

  // Validation
  if (!desc) {
    showError('Please enter a description.');
    descInput.focus();
    return;
  }
  if (!amount || amount <= 0 || isNaN(amount)) {
    showError('Please enter a valid amount greater than 0.');
    amountInput.focus();
    return;
  }

  clearError();

  // Build the transaction object
  const transaction = {
    id:       Date.now(),          // unique ID using timestamp
    desc,
    amount:   parseFloat(amount.toFixed(2)),
    type:     currentType,
    category: cat,
    date:     new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    }),
  };

  transactions.push(transaction);
  saveToStorage();

  // Re-render everything
  renderTransactions();
  updateSummary();
  updateChart();

  // Reset the form
  descInput.value  = '';
  amountInput.value = '';
  descInput.focus();

  showToast(`${currentType === 'income' ? 'Income' : 'Expense'} added!`);
}

/* ─────────────────────────────────────
   10. DELETE TRANSACTION
   Removes a transaction by its id.
   Uses event delegation — one listener
   on the list handles all delete buttons.
───────────────────────────────────── */
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveToStorage();
  renderTransactions();
  updateSummary();
  updateChart();
  showToast('Transaction removed.');
}

/* ─────────────────────────────────────
   11. CLEAR ALL
   Removes every transaction after a
   confirmation prompt.
───────────────────────────────────── */
function clearAll() {
  if (transactions.length === 0) return;
  if (!confirm('Delete all transactions? This cannot be undone.')) return;
  transactions = [];
  saveToStorage();
  renderTransactions();
  updateSummary();
  updateChart();
  showToast('All transactions cleared.');
}

/* ─────────────────────────────────────
   12. DARK MODE
   Toggles between light and dark by
   setting data-theme on <html>.
   Saves the preference to localStorage.
───────────────────────────────────── */
function toggleTheme() {
  const html     = document.documentElement;
  const isDark   = html.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';

  html.setAttribute('data-theme', newTheme);
  themeIcon.textContent = isDark ? '☀' : '☾';
  localStorage.setItem('ft_theme', newTheme);

  // Update chart border colour to match the new background
  if (spendingChart) {
    const bgColor = getComputedStyle(html)
      .getPropertyValue('--bg-card').trim();
    spendingChart.data.datasets[0].borderColor = bgColor;
    spendingChart.update();
  }
}

function loadTheme() {
  const saved = localStorage.getItem('ft_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  themeIcon.textContent = saved === 'dark' ? '☾' : '☀';
}

/* ─────────────────────────────────────
   13. INCOME / EXPENSE TYPE TOGGLE
   Switches the active button styling
   and updates currentType.
───────────────────────────────────── */
function setType(type) {
  currentType = type;

  if (type === 'expense') {
    btnExpense.classList.add('active');
    btnIncome.classList.remove('active');
  } else {
    btnIncome.classList.add('active');
    btnExpense.classList.remove('active');
  }
}

/* ─────────────────────────────────────
   14. UTILITY FUNCTIONS
   Small helpers used throughout the app.
───────────────────────────────────── */

// Format a number as USD currency: 1234.5 → "$1,234.50"
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Prevent XSS: escape special characters before inserting into innerHTML
function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// Show inline form error
function showError(msg) { formError.textContent = msg; }
function clearError()   { formError.textContent = ''; }

// Show a brief toast notification at the bottom of the screen
let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

// Display today's date in the navbar: "Wed, Apr 8 2026"
function setTodayDate() {
  todayDateEl.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

/* ─────────────────────────────────────
   15. EVENT LISTENERS
   Wire up all user interactions.
───────────────────────────────────── */

// Add transaction button
addBtn.addEventListener('click', addTransaction);

// Allow pressing Enter in description or amount to submit
descInput.addEventListener('keydown',   e => { if (e.key === 'Enter') addTransaction(); });
amountInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTransaction(); });

// Income / Expense toggle buttons
btnExpense.addEventListener('click', () => setType('expense'));
btnIncome.addEventListener('click',  () => setType('income'));

// Delete buttons — event delegation on the list
transactionList.addEventListener('click', e => {
  const btn = e.target.closest('.txn-delete');
  if (btn) deleteTransaction(Number(btn.dataset.id));
});

// Clear all
clearBtn.addEventListener('click', clearAll);

// Dark mode toggle
themeToggle.addEventListener('click', toggleTheme);

/* ─────────────────────────────────────
   16. INITIALISE
   Runs once when the page loads.
   Load saved data, render everything.
───────────────────────────────────── */
function init() {
  loadTheme();
  setTodayDate();
  transactions = loadFromStorage();
  renderTransactions();
  updateSummary();
  updateChart();
}

init();