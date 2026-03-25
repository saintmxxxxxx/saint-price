/* ==========================================================================
   Saint Price - App Logic (Persistencia en LocalStorage)
   ========================================================================== */

// State
let transactions = [];
let expensesChartInstance = null;

// Constants
const CATEGORIES = {
    income: ['Salario', 'Negocios', 'Inversión', 'Regalo', 'Otros'],
    expense: ['Comida', 'Transporte', 'Vivienda', 'Ocio', 'Salud', 'Educación', 'Otros']
};

const ICONS = {
    income: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>`,
    expense: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>`
};

// DOM Elements
const totalBalanceEl = document.getElementById('totalBalance');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const transactionsListEl = document.getElementById('transactionsList');

const btnIncome = document.getElementById('btnIncome');
const btnExpense = document.getElementById('btnExpense');

const modal = document.getElementById('transactionModal');
const closeModalBtn = document.getElementById('closeModal');
const transactionForm = document.getElementById('transactionForm');
const modalTitle = document.getElementById('modalTitle');
const transactionType = document.getElementById('transactionType');
const categorySelect = document.getElementById('category');

// ==========================================================================
// Initialization & Render
// ==========================================================================
async function init() {
    setupEventListeners();
    await fetchTransactions();
}

async function fetchTransactions() {
    const token = localStorage.getItem('saintPriceToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const res = await fetch('http://localhost:8008/api/transactions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.status === 401) {
            localStorage.removeItem('saintPriceToken');
            window.location.href = 'login.html';
            return;
        }

        const data = await res.json();
        
        if (!res.ok) throw new Error(data.detail || 'Error de conexión');
        
        transactions = data;
        updateUI();
    } catch (err) {
        console.error('Initial fetch failed:', err);
    }
}

function updateUI() {
    // Calcular Saldo, Ingresos y Gastos
    const income = transactions
        .filter(t => t.type === 'income')
        .reduce((acc, t) => acc + t.amount, 0);
        
    const expense = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + t.amount, 0);

    const balance = income - expense;

    // Actualizar Textos
    totalBalanceEl.textContent = formatCurrency(balance);
    totalIncomeEl.textContent = formatCurrency(income);
    totalExpenseEl.textContent = formatCurrency(expense);

    // Renderizar Lista y Gráfica
    renderTransactionsList();
    renderExpensesChart();
}

function renderExpensesChart() {
    const ctx = document.getElementById('expensesChart').getContext('2d');
    
    // Preparar datos
    const expenses = transactions.filter(t => t.type === 'expense');
    
    const expByCategory = {};
    CATEGORIES.expense.forEach(c => expByCategory[c] = 0);
    
    expenses.forEach(t => {
        if (expByCategory[t.category] !== undefined) {
             expByCategory[t.category] += t.amount;
        } else {
             expByCategory[t.category] = t.amount;
        }
    });

    const labels = [];
    const data = [];
    
    for (const [cat, amt] of Object.entries(expByCategory)) {
        if (amt > 0) {
            labels.push(cat);
            data.push(amt);
        }
    }

    if (expensesChartInstance) {
        expensesChartInstance.destroy();
    }

    // Configuración visual (UI/UX Pro Max)
    const brandExpenseColor = 'rgba(212, 175, 55, 0.85)'; // Luxury Gold
    const gridColor = 'rgba(255, 255, 255, 0.05)';
    const textColor = '#94A3B8'; // Slate 400

    expensesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gastos por Categoría',
                data: data,
                backgroundColor: brandExpenseColor,
                borderRadius: 4,
                barThickness: 'flex',
                maxBarThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(2, 6, 23, 0.95)',
                    titleColor: '#F8FAFC',
                    bodyColor: '#F8FAFC',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return new Intl.NumberFormat('es-MX', {
                                style: 'currency',
                                currency: 'MXN'
                            }).format(Math.abs(context.parsed.y));
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { 
                        color: textColor,
                        callback: function(value) {
                            return '$' + value;
                        }
                    },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor },
                    border: { display: false }
                }
            }
        }
    });
}

function renderTransactionsList() {
    transactionsListEl.innerHTML = '';

    if (transactions.length === 0) {
        transactionsListEl.innerHTML = `
            <div class="empty-state">
                <p>No hay movimientos aún. Agrega un ingreso o gasto para empezar.</p>
            </div>
        `;
        return;
    }

    // Ordenar de más reciente a más antiguo (limitado a 5 recientes)
    const recentTransactions = [...transactions]
        .sort((a, b) => (b.txn_time || b.timestamp) - (a.txn_time || a.timestamp))
        .slice(0, 5);

        recentTransactions.forEach(t => {
        const item = document.createElement('div');
        item.classList.add('transaction-item');
        
        const isInc = t.type === 'income';
        const iconClass = isInc ? 'inc' : 'exp';
        const sign = isInc ? '+' : '-';

        item.innerHTML = `
            <div class="txn-left">
                <div class="txn-icon ${iconClass}">
                    ${isInc ? ICONS.income : ICONS.expense}
                </div>
                <div class="txn-info">
                    <h4>${t.memo || t.description}</h4>
                    <span>${t.category} • ${formatDate(t.txn_time || t.timestamp)}</span>
                </div>
            </div>
            <div class="txn-amount ${iconClass}">
                ${sign}${formatCurrency(t.amount)}
            </div>
        `;

        transactionsListEl.appendChild(item);
    });
}

// ==========================================================================
// Event Listeners
// ==========================================================================
function setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('saintPriceToken');
        window.location.href = 'login.html';
    });

    // Abrir Modal
    btnIncome.addEventListener('click', () => openModal('income'));
    btnExpense.addEventListener('click', () => openModal('expense'));

    // Cerrar Modal
    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(); // Click Backdrop
    });

    // Enviar Formulario
    transactionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveTransaction();
    });
}

// ==========================================================================
// Form & Modal Logic
// ==========================================================================
function openModal(type) {
    const isIncome = type === 'income';
    
    // Configurar Textos y Tipos
    modalTitle.textContent = isIncome ? 'Añadir Ingreso' : 'Añadir Gasto';
    transactionType.value = type;
    
    // Llenar Categorías
    categorySelect.innerHTML = '';
    const categories = isIncome ? CATEGORIES.income : CATEGORIES.expense;
    
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });

    // Limpiar Inputs
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';

    // Mostrar Animación de Entrada
    modal.style.display = 'flex'; // Reset display just in case
    setTimeout(() => {
        modal.classList.add('active');
        document.getElementById('amount').focus(); // Accessibility focus management
    }, 10);
}

function closeModal() {
    modal.classList.remove('active');
    setTimeout(() => {
        transactionForm.reset();
    }, 300); // Wait for transition
}

async function saveTransaction() {
    const type = document.getElementById('transactionType').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const description = document.getElementById('description').value.trim();
    const category = document.getElementById('category').value;

    if (!amount || amount <= 0 || !description) return;

    const token = localStorage.getItem('saintPriceToken');
    const btnSubmit = document.getElementById('submitTransaction');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Guardando...';

    try {
        const res = await fetch('http://localhost:8008/api/transactions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ type, amount, category, description })
        });
        
        if (!res.ok) throw new Error('Error guardando');
        const newTx = await res.json();
        
        // Add internally and update ui
        transactions.unshift(newTx);
        updateUI();
        closeModal();
    } catch (err) {
        alert('Hubo un error al guardar la transacción');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Guardar';
    }
}

// ==========================================================================
// Utils
// ==========================================================================
function formatCurrency(num) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(Math.abs(num)); // We handle the sign manually in UI
}

function formatDate(timestamp) {
    const d = new Date(timestamp);
    const options = { day: '2-digit', month: 'short' };
    return d.toLocaleDateString('es-MX', options);
}

// Iniciar app
document.addEventListener('DOMContentLoaded', init);
