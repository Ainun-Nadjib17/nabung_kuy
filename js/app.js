// ==================== APPLICATION LOGIC ====================

let savings = [];
let transactions = [];
let currentSavingId = null;
let frequencyChart = null;
let categoryChart = null;

// ==================== HELPER FUNCTIONS ====================

function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return Number(num).toLocaleString('id-ID');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

function getTodayString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function setToday(inputId) {
    const el = document.getElementById(inputId);
    if (el) el.value = getTodayString();
}

function dateToISO(dateStr) {
    if (!dateStr) return new Date().toISOString();
    const d = new Date(dateStr + 'T' + new Date().toTimeString().split(' ')[0]);
    return d.toISOString();
}

function getLast7DaysData() {
    const labels = [];
    const data = [];
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toISOString().split('T')[0];
        labels.push(dayNames[d.getDay()] + ' ' + d.getDate());

        const count = transactions.filter(t => {
            const tDate = new Date(t.date).toISOString().split('T')[0];
            return tDate === dayStr;
        }).length;
        data.push(count);
    }

    return { labels, data };
}

// ==================== DATA MANAGEMENT ====================

function loadData() {
    savings = JSON.parse(localStorage.getItem(getStorageKey('savings')) || '[]');
    transactions = JSON.parse(localStorage.getItem(getStorageKey('transactions')) || '[]');
}

function saveData() {
    localStorage.setItem(getStorageKey('savings'), JSON.stringify(savings));
    localStorage.setItem(getStorageKey('transactions'), JSON.stringify(transactions));
}

// ==================== AUTO SAVE CHECKER ====================

function checkAutoSave() {
    loadData();
    let changed = false;
    const now = new Date();

    savings.forEach(saving => {
        if (!saving.autoSave || !saving.autoSave.active || !saving.autoSave.amount) return;

        const lastRun = saving.autoSave.lastRun ? new Date(saving.autoSave.lastRun) : null;
        let shouldRun = false;

        if (!lastRun) {
            shouldRun = true;
        } else {
            const diffMs = now - lastRun;
            const diffHours = diffMs / (1000 * 60 * 60);
            const diffDays = diffHours / 24;

            switch (saving.autoSave.frequency) {
                case 'daily':
                    shouldRun = diffDays >= 1;
                    break;
                case 'weekly':
                    shouldRun = diffDays >= 7;
                    break;
                case 'monthly':
                    shouldRun = diffDays >= 30;
                    break;
            }
        }

        if (shouldRun) {
            saving.balance += saving.autoSave.amount;
            saving.autoSave.lastRun = now.toISOString();

            transactions.push({
                id: Date.now().toString() + '_auto_' + saving.id,
                savingId: saving.id,
                savingName: saving.name,
                type: 'income',
                amount: saving.autoSave.amount,
                note: `🤖 Auto save (${saving.autoSave.frequency === 'daily' ? 'Harian' : saving.autoSave.frequency === 'weekly' ? 'Mingguan' : 'Bulanan'})`,
                date: now.toISOString()
            });

            changed = true;
        }
    });

    if (changed) {
        saveData();
    }
}

// ==================== DASHBOARD ====================

function loadDashboard() {
    loadData();
    checkAutoSave();

    // Update greeting
    const hour = new Date().getHours();
    let greeting = 'Selamat datang!';
    if (hour < 12) greeting = 'Selamat pagi!';
    else if (hour < 15) greeting = 'Selamat siang!';
    else if (hour < 18) greeting = 'Selamat sore!';
    else greeting = 'Selamat malam!';

    const greetingEl = document.getElementById('greeting');
    if (greetingEl) greetingEl.textContent = `${greeting} ${currentUser?.name?.split(' ')[0] || ''}`;

    // Calculate stats
    const totalBalance = savings.reduce((sum, s) => sum + (s.balance || 0), 0);
    const totalGoals = savings.length;
    const avgProgress = savings.length > 0
        ? savings.reduce((sum, s) => sum + (s.target > 0 ? (s.balance / s.target) : 0), 0) / savings.length * 100
        : 0;

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const recentCount = transactions.filter(t => new Date(t.date) >= last7Days).length;

    // Update stats
    const totalBalanceEl = document.getElementById('totalBalance');
    const totalGoalsEl = document.getElementById('totalGoals');
    const progressRateEl = document.getElementById('progressRate');
    const recentTransactionsEl = document.getElementById('recentTransactions');

    if (totalBalanceEl) totalBalanceEl.textContent = `Rp ${formatNumber(totalBalance)}`;
    if (totalGoalsEl) totalGoalsEl.textContent = totalGoals;
    if (progressRateEl) progressRateEl.textContent = `${avgProgress.toFixed(0)}%`;
    if (recentTransactionsEl) recentTransactionsEl.textContent = recentCount;

    // Render recent savings
    const recentList = document.getElementById('recentSavingsList');
    if (recentList) {
        if (savings.length === 0) {
            recentList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p>Belum ada tabungan. <a href="tambah-tabungan.html">Buat sekarang!</a></p>
                </div>
            `;
        } else {
            const recent = [...savings].sort((a, b) => {
                const aTime = parseInt(a.id) || 0;
                const bTime = parseInt(b.id) || 0;
                return bTime - aTime;
            }).slice(0, 3);

            recentList.innerHTML = recent.map(s => {
                const progress = s.target > 0 ? (s.balance / s.target * 100) : 0;
                return `
                    <div class="saving-card" style="margin-bottom: 16px;">
                        <div class="saving-header">
                            <h4>${escapeHtml(s.name)}</h4>
                            <span class="badge ${s.balance >= s.target ? 'badge-success' : 'badge-info'}">
                                ${s.balance >= s.target ? '✓ Tercapai' : `${progress.toFixed(0)}%`}
                            </span>
                        </div>
                        <p class="saving-purpose">${escapeHtml(s.purpose)}</p>
                        <div class="progress-wrapper">
                            <div class="progress-info">
                                <span>Rp ${formatNumber(s.balance)}</span>
                                <span>Rp ${formatNumber(s.target)}</span>
                            </div>
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill" style="width: ${Math.min(progress, 100)}%"></div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

// ==================== CREATE SAVING ====================

function createSaving() {
    const name = document.getElementById('savingName').value.trim();
    const target = parseFloat(document.getElementById('savingTarget').value);
    const purpose = document.getElementById('savingPurpose').value.trim();
    const deadline = document.getElementById('savingDeadline')?.value;

    if (!name || !target || !purpose) {
        alert('Semua field wajib harus diisi!');
        return;
    }

    if (target < 1000) {
        alert('Target minimal Rp 1.000!');
        return;
    }

    // Show loading
    const saveText = document.getElementById('saveText');
    const saveLoading = document.getElementById('saveLoading');
    if (saveText) saveText.classList.add('hidden');
    if (saveLoading) saveLoading.classList.remove('hidden');

    const saving = {
        id: Date.now().toString(),
        name,
        target,
        purpose,
        deadline: deadline || null,
        balance: 0,
        autoSave: { active: false, amount: 0, frequency: 'daily', lastRun: null },
        createdAt: new Date().toISOString()
    };

    loadData();
    savings.push(saving);
    saveData();

    // Reset form
    document.getElementById('savingName').value = '';
    document.getElementById('savingTarget').value = '';
    document.getElementById('savingPurpose').value = '';
    if (document.getElementById('savingDeadline')) document.getElementById('savingDeadline').value = '';

    alert('Tabungan berhasil dibuat! 🎉');
    window.location.href = 'tabungan-saya.html';
}

// ==================== SAVINGS PAGE ====================

function loadSavingsPage() {
    loadData();
    checkAutoSave();
    renderSavings();
}

function renderSavings() {
    const container = document.getElementById('savingsContainer');
    const emptyState = document.getElementById('emptySavings');

    if (!container) return;

    if (savings.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    container.innerHTML = savings.map(saving => {
        const progress = saving.target > 0 ? (saving.balance / saving.target * 100) : 0;
        const progressClamped = Math.min(progress, 100);

        // --- Estimate time to reach target ---
        let estimationHtml = '';
        const remaining = saving.target - saving.balance;

        if (saving.balance >= saving.target) {
            estimationHtml = `
                <div class="estimation-badge estimation-success">
                    <span class="estimation-icon">🎉</span>
                    <span>Target sudah tercapai! Selamat!</span>
                </div>`;
        } else {
            // Calculate average income per week from transactions
            const savingTransactions = transactions
                .filter(t => t.savingId === saving.id && t.type === 'income')
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            if (savingTransactions.length >= 2) {
                const firstDate = new Date(savingTransactions[0].date);
                const lastDate = new Date(savingTransactions[savingTransactions.length - 1].date);
                const totalIncome = savingTransactions.reduce((sum, t) => sum + t.amount, 0);
                const daysDiff = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
                const avgPerDay = totalIncome / daysDiff;
                const avgPerWeek = avgPerDay * 7;
                const avgPerMonth = avgPerDay * 30;

                if (avgPerDay > 0) {
                    const daysToGoal = Math.ceil(remaining / avgPerDay);
                    const weeksToGoal = Math.ceil(remaining / avgPerWeek);
                    const monthsToGoal = (remaining / avgPerMonth).toFixed(1);

                    let timeText = '';
                    let subText = '';
                    if (weeksToGoal <= 1) {
                        timeText = 'Kurang dari 1 minggu lagi!';
                        subText = `~${daysToGoal} hari`;
                    } else if (weeksToGoal <= 4) {
                        timeText = `~${weeksToGoal} minggu lagi`;
                        subText = `~${daysToGoal} hari`;
                    } else if (weeksToGoal <= 52) {
                        timeText = `~${weeksToGoal} minggu lagi`;
                        subText = `(~${monthsToGoal} bulan)`;
                    } else {
                        const years = (weeksToGoal / 52).toFixed(1);
                        timeText = `~${monthsToGoal} bulan lagi`;
                        subText = `(~${years} tahun)`;
                    }

                    const targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() + daysToGoal);
                    const dateStr = targetDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

                    estimationHtml = `
                        <div class="estimation-badge estimation-active">
                            <div class="estimation-main">
                                <span class="estimation-icon">⏱️</span>
                                <div>
                                    <div class="estimation-time">${timeText}</div>
                                    <div class="estimation-sub">Tercapai ${subText} • 📅 Est. ${dateStr}</div>
                                </div>
                            </div>
                            <div class="estimation-rate">
                                Rata-rata: Rp ${formatNumber(Math.round(avgPerWeek))}/minggu
                            </div>
                        </div>`;
                }
            } else if (savingTransactions.length === 1) {
                estimationHtml = `
                    <div class="estimation-badge estimation-new">
                        <span class="estimation-icon">💡</span>
                        <span>Tambah tabungan lagi untuk melihat estimasi waktu</span>
                    </div>`;
            } else {
                estimationHtml = `
                    <div class="estimation-badge estimation-new">
                        <span class="estimation-icon">🚀</span>
                        <span>Mulai menabung untuk melihat estimasi waktu</span>
                    </div>`;
            }
        }

        return `
            <div class="saving-card">
                <div class="saving-header">
                    <h4>${escapeHtml(saving.name)}</h4>
                    ${saving.balance >= saving.target ? '<span class="badge badge-success">🎉 Tercapai!</span>' : ''}
                </div>
                <p class="saving-purpose">🎯 ${escapeHtml(saving.purpose)}</p>
                
                <div class="progress-wrapper">
                    <div class="progress-info">
                        <span>Rp ${formatNumber(saving.balance)} terkumpul</span>
                        <span>${progressClamped.toFixed(0)}%</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${progressClamped}%"></div>
                    </div>
                </div>

                ${estimationHtml}
                
                <div class="saving-stats">
                    <div class="saving-stat">
                        <div class="label">Terkumpul</div>
                        <div class="value">Rp ${formatNumber(saving.balance)}</div>
                    </div>
                    <div class="saving-stat">
                        <div class="label">Target</div>
                        <div class="value">Rp ${formatNumber(saving.target)}</div>
                    </div>
                </div>

                <div class="badges">
                    ${saving.autoSave && saving.autoSave.active ? `
                        <span class="badge badge-info">
                            🤖 ${saving.autoSave.frequency === 'daily' ? 'Harian' : saving.autoSave.frequency === 'weekly' ? 'Mingguan' : 'Bulanan'} 
                            Rp ${formatNumber(saving.autoSave.amount)}
                        </span>
                    ` : ''}
                    ${saving.deadline ? `<span class="badge badge-warning">📅 ${formatDateShort(saving.deadline)}</span>` : ''}
                </div>

                <div class="saving-actions">
                    <button class="btn-add" onclick="openAddBalance('${saving.id}')">➕ Tambah</button>
                    <button class="btn-withdraw" onclick="openWithdraw('${saving.id}')">➖ Tarik</button>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-auto" onclick="openAutoSave('${saving.id}')">🤖 Auto Save</button>
                    <button class="btn-history" onclick="showHistory('${saving.id}')">📜 History</button>
                </div>
                <button class="btn-delete" onclick="deleteSaving('${saving.id}')" style="background: #fee2e2; color: #991b1b; border: none; border-radius: 8px; padding: 10px; width: 100%; cursor: pointer; font-weight: 600; font-size: 13px; margin-top: 10px; transition: all 0.3s;" onmouseover="this.style.background='#991b1b'; this.style.color='white';" onmouseout="this.style.background='#fee2e2'; this.style.color='#991b1b';">🗑️ Hapus Tabungan</button>
            </div>
        `;
    }).join('');
}

// ==================== TRANSACTIONS ====================

function openAddBalance(savingId) {
    currentSavingId = savingId;
    document.getElementById('addAmount').value = '';
    document.getElementById('addNote').value = '';
    const addDateEl = document.getElementById('addDate');
    if (addDateEl) addDateEl.value = getTodayString();
    document.getElementById('addBalanceModal').classList.add('active');
}

function openWithdraw(savingId) {
    currentSavingId = savingId;
    document.getElementById('withdrawAmount').value = '';
    document.getElementById('withdrawNote').value = '';
    const withdrawDateEl = document.getElementById('withdrawDate');
    if (withdrawDateEl) withdrawDateEl.value = getTodayString();
    document.getElementById('withdrawModal').classList.add('active');
}

function confirmAddBalance() {
    const amount = parseFloat(document.getElementById('addAmount').value);
    const note = document.getElementById('addNote').value.trim();
    const dateVal = document.getElementById('addDate')?.value;

    if (!amount || amount <= 0) {
        alert('Jumlah harus lebih dari 0!');
        return;
    }

    if (!dateVal) {
        alert('Pilih tanggal nabung!');
        return;
    }

    loadData();
    const saving = savings.find(s => s.id === currentSavingId);
    if (!saving) {
        alert('Tabungan tidak ditemukan!');
        return;
    }

    saving.balance += amount;

    transactions.push({
        id: Date.now().toString(),
        savingId: currentSavingId,
        savingName: saving.name,
        type: 'income',
        amount,
        note: note || 'Menambah saldo',
        date: dateToISO(dateVal)
    });

    saveData();
    closeModal('addBalanceModal');
    renderSavings();

    alert(`Berhasil menambah Rp ${formatNumber(amount)} ke "${saving.name}" pada ${formatDateShort(dateVal)}! 💰`);
}

function confirmWithdraw() {
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const note = document.getElementById('withdrawNote').value.trim();
    const dateVal = document.getElementById('withdrawDate')?.value;

    if (!amount || amount <= 0) {
        alert('Jumlah harus lebih dari 0!');
        return;
    }

    if (!dateVal) {
        alert('Pilih tanggal penarikan!');
        return;
    }

    loadData();
    const saving = savings.find(s => s.id === currentSavingId);
    if (!saving) {
        alert('Tabungan tidak ditemukan!');
        return;
    }

    if (saving.balance < amount) {
        alert(`Saldo tidak mencukupi! Saldo tersedia: Rp ${formatNumber(saving.balance)}`);
        return;
    }

    saving.balance -= amount;

    transactions.push({
        id: Date.now().toString(),
        savingId: currentSavingId,
        savingName: saving.name,
        type: 'expense',
        amount,
        note: note || 'Menarik saldo',
        date: dateToISO(dateVal)
    });

    saveData();
    closeModal('withdrawModal');
    renderSavings();
    alert(`Berhasil menarik Rp ${formatNumber(amount)} dari "${saving.name}" pada ${formatDateShort(dateVal)}!`);
}

// ==================== DELETE SAVING ====================

function deleteSaving(savingId) {
    if (!confirm('Apakah kamu yakin ingin menghapus tabungan ini? Semua data transaksi terkait juga akan dihapus.')) {
        return;
    }

    loadData();
    savings = savings.filter(s => s.id !== savingId);
    transactions = transactions.filter(t => t.savingId !== savingId);
    saveData();
    renderSavings();
    alert('Tabungan berhasil dihapus!');
}

// ==================== AUTO SAVE ====================

function openAutoSave(savingId) {
    currentSavingId = savingId;
    loadData();
    const saving = savings.find(s => s.id === savingId);
    if (!saving) return;

    document.getElementById('autoSaveAmount').value = saving.autoSave?.amount || '';
    document.getElementById('autoSaveActive').checked = saving.autoSave?.active || false;

    const freq = saving.autoSave?.frequency || 'daily';
    const radio = document.querySelector(`input[name="autoFreq"][value="${freq}"]`);
    if (radio) radio.checked = true;

    document.getElementById('autoSaveModal').classList.add('active');
}

function saveAutoSave() {
    const amount = parseFloat(document.getElementById('autoSaveAmount').value);
    const active = document.getElementById('autoSaveActive').checked;
    const frequency = document.querySelector('input[name="autoFreq"]:checked')?.value || 'daily';

    if (active && (!amount || amount <= 0)) {
        alert('Jumlah auto save harus lebih dari 0!');
        return;
    }

    loadData();
    const saving = savings.find(s => s.id === currentSavingId);
    if (!saving) return;

    saving.autoSave = {
        active,
        amount: amount || 0,
        frequency,
        lastRun: saving.autoSave?.lastRun || null
    };

    saveData();
    closeModal('autoSaveModal');
    renderSavings();
    alert(active ? `Auto save ${frequency === 'daily' ? 'harian' : frequency === 'weekly' ? 'mingguan' : 'bulanan'} Rp ${formatNumber(amount)} berhasil diaktifkan! 🤖` : 'Auto save berhasil dinonaktifkan.');
}

// ==================== HISTORY ====================

function showHistory(savingId) {
    loadData();
    const saving = savings.find(s => s.id === savingId);
    const savingTransactions = transactions
        .filter(t => t.savingId === savingId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const list = document.getElementById('historyList');

    if (savingTransactions.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>Belum ada transaksi untuk tabungan ini</p></div>';
    } else {
        list.innerHTML = savingTransactions.map(t => `
            <div class="history-item">
                <div class="history-info">
                    <h5>${escapeHtml(t.note)}</h5>
                    <p>${formatDate(t.date)}</p>
                </div>
                <div class="history-amount ${t.type}">
                    ${t.type === 'income' ? '+' : '-'} Rp ${formatNumber(t.amount)}
                </div>
            </div>
        `).join('');
    }

    document.getElementById('historyModal').classList.add('active');
}

// ==================== SUMMARY PAGE ====================

function loadSummaryPage() {
    loadData();
    checkAutoSave();

    const totalSavings = savings.reduce((sum, s) => sum + (s.balance || 0), 0);
    const totalTargets = savings.reduce((sum, s) => sum + (s.target || 0), 0);
    const progress = totalTargets > 0 ? (totalSavings / totalTargets * 100) : 0;

    const totalSavingsEl = document.getElementById('totalSavings');
    const totalTargetsEl = document.getElementById('totalTargets');
    const progressPercentEl = document.getElementById('progressPercent');
    const totalTransactionsEl = document.getElementById('totalTransactions');

    if (totalSavingsEl) totalSavingsEl.textContent = `Rp ${formatNumber(totalSavings)}`;
    if (totalTargetsEl) totalTargetsEl.textContent = `Rp ${formatNumber(totalTargets)}`;
    if (progressPercentEl) progressPercentEl.textContent = `${progress.toFixed(1)}%`;
    if (totalTransactionsEl) totalTransactionsEl.textContent = transactions.length;

    renderCharts();
    renderTransactionTable();
}

function renderCharts() {
    // Chart 1: Frekuensi 7 Hari Terakhir
    const ctx1 = document.getElementById('frequencyChart');
    if (!ctx1) return;

    const last7Days = getLast7DaysData();

    if (frequencyChart) frequencyChart.destroy();
    frequencyChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: last7Days.labels,
            datasets: [{
                label: 'Jumlah Transaksi',
                data: last7Days.data,
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, precision: 0 }
                }
            }
        }
    });

    // Chart 2: Doughnut - Perbandingan Tabungan
    const ctx2 = document.getElementById('categoryChart');
    if (!ctx2) return;

    const chartColors = [
        'rgba(102, 126, 234, 0.8)',
        'rgba(118, 75, 162, 0.8)',
        'rgba(240, 147, 251, 0.8)',
        'rgba(245, 87, 108, 0.8)',
        'rgba(79, 172, 254, 0.8)',
        'rgba(67, 233, 123, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(239, 68, 68, 0.8)'
    ];

    if (categoryChart) categoryChart.destroy();

    if (savings.length === 0) {
        categoryChart = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['Belum ada tabungan'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['rgba(200, 200, 200, 0.5)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    } else {
        categoryChart = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: savings.map(s => s.name),
                datasets: [{
                    data: savings.map(s => s.balance || 0),
                    backgroundColor: savings.map((_, i) => chartColors[i % chartColors.length]),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 16,
                            usePointStyle: true,
                            font: { size: 13 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const value = context.raw || 0;
                                return ` ${context.label}: Rp ${formatNumber(value)}`;
                            }
                        }
                    }
                }
            }
        });
    }
}

function renderTransactionTable() {
    const tbody = document.getElementById('transactionTable');
    if (!tbody) return;

    const recentTransactions = [...transactions]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 20);

    if (recentTransactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: var(--gray);">
                    Belum ada transaksi
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = recentTransactions.map(t => `
        <tr>
            <td>${formatDateShort(t.date)}</td>
            <td>${escapeHtml(t.savingName)}</td>
            <td><span class="type-${t.type}">${t.type === 'income' ? '⬆ Masuk' : '⬇ Keluar'}</span></td>
            <td class="type-${t.type}">${t.type === 'income' ? '+' : '-'} Rp ${formatNumber(t.amount)}</td>
            <td>${escapeHtml(t.note)}</td>
        </tr>
    `).join('');
}

// ==================== SECURITY HELPER ====================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== CLICK OUTSIDE MODAL TO CLOSE ====================

document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
        e.target.classList.remove('active');
    }
});

// ==================== KEYBOARD SHORTCUTS ====================

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});
