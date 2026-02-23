/**
 * Main Application - ties all modules together
 */

(function () {
    'use strict';

    // === Constants ===
    const LAST_READINGS_KEY = 'utility_last_readings';

    // === State ===
    let currentBillType = 'electricity';
    let lastResult = null;

    // === DOM Elements ===
    const elements = {
        // Tabs
        tabBtns: document.querySelectorAll('.tab-btn'),
        calculatorTab: document.getElementById('calculator-tab'),
        historyTab: document.getElementById('history-tab'),

        // Setup
        setupScreen: document.getElementById('setupScreen'),
        setupElecMain: document.getElementById('setupElecMain'),
        setupElecSub: document.getElementById('setupElecSub'),
        setupWaterMain: document.getElementById('setupWaterMain'),
        setupWaterSub: document.getElementById('setupWaterSub'),
        setupSaveBtn: document.getElementById('setupSaveBtn'),
        setupSkipBtn: document.getElementById('setupSkipBtn'),
        openSetup: document.getElementById('openSetup'),

        // Bill type
        billTypeBtns: document.querySelectorAll('.bill-type-btn'),

        // Bill info
        totalBill: document.getElementById('totalBill'),
        totalConsumption: document.getElementById('totalConsumption'),
        totalConsumptionLabel: document.getElementById('totalConsumptionLabel'),

        // Sub meter
        subMeterPrev: document.getElementById('subMeterPrev'),
        subMeterCurr: document.getElementById('subMeterCurr'),
        subConsumption: document.getElementById('subConsumption'),
        subConsumptionValue: document.getElementById('subConsumptionValue'),

        // OCR
        meterImage: document.getElementById('meterImage'),
        ocrStatus: document.getElementById('ocrStatus'),
        imagePreview: document.getElementById('imagePreview'),
        previewImg: document.getElementById('previewImg'),
        removeImage: document.getElementById('removeImage'),

        // Calculate
        calculateBtn: document.getElementById('calculateBtn'),

        // Results
        resultsSection: document.getElementById('resultsSection'),
        unit1Amount: document.getElementById('unit1Amount'),
        unit1Percent: document.getElementById('unit1Percent'),
        unit2Amount: document.getElementById('unit2Amount'),
        unit2Percent: document.getElementById('unit2Percent'),
        detailTotal: document.getElementById('detailTotal'),
        detailTotalConsumption: document.getElementById('detailTotalConsumption'),
        detailUnit2Consumption: document.getElementById('detailUnit2Consumption'),
        detailUnit1Consumption: document.getElementById('detailUnit1Consumption'),
        detailActualRate: document.getElementById('detailActualRate'),
        detailOfficialRate: document.getElementById('detailOfficialRate'),
        rateStatus: document.getElementById('rateStatus'),

        // Actions
        saveResult: document.getElementById('saveResult'),
        shareWhatsapp: document.getElementById('shareWhatsapp'),

        // History
        historyList: document.getElementById('historyList'),
        clearHistory: document.getElementById('clearHistory')
    };

    // === Last Readings Management ===
    function getLastReadings() {
        try {
            const data = localStorage.getItem(LAST_READINGS_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    function saveLastReadings(readings) {
        try {
            localStorage.setItem(LAST_READINGS_KEY, JSON.stringify(readings));
        } catch (e) {
            console.error('Error saving last readings:', e);
        }
    }

    function initSetup() {
        // Check if first time (no saved readings)
        const savedReadings = getLastReadings();
        if (!savedReadings) {
            showSetupScreen();
        } else {
            applyLastReadings(savedReadings);
        }

        // Save button
        elements.setupSaveBtn.addEventListener('click', () => {
            const readings = {
                electricity: {
                    sub: parseFloat(elements.setupElecSub.value) || 0
                },
                water: {
                    sub: parseFloat(elements.setupWaterSub.value) || 0
                }
            };
            saveLastReadings(readings);
            applyLastReadings(readings);
            hideSetupScreen();
            showToast('✅ הקריאות נשמרו בהצלחה!');
        });

        // Skip button
        elements.setupSkipBtn.addEventListener('click', () => {
            hideSetupScreen();
        });

        // Open setup from settings button
        elements.openSetup.addEventListener('click', () => {
            const saved = getLastReadings();
            if (saved) {
                elements.setupElecSub.value = saved.electricity?.sub || '';
                elements.setupWaterSub.value = saved.water?.sub || '';
            }
            showSetupScreen();
        });
    }

    function showSetupScreen() {
        elements.setupScreen.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function hideSetupScreen() {
        elements.setupScreen.style.display = 'none';
        document.body.style.overflow = '';
    }

    function applyLastReadings(readings) {
        if (!readings) return;

        const typeReadings = readings[currentBillType];
        if (typeReadings) {
            if (typeReadings.sub) {
                elements.subMeterPrev.value = typeReadings.sub;
                elements.subMeterPrev.dispatchEvent(new Event('input'));
            }
        }
    }

    // After successful calculation, auto-save current readings for next time
    function updateLastReadingsAfterCalc(result) {
        const readings = getLastReadings() || { electricity: {}, water: {} };
        readings[result.billType] = {
            sub: result.meters.sub.curr
        };
        saveLastReadings(readings);
    }

    // === Tab Navigation ===
    function initTabs() {
        elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;

                elements.tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                elements.calculatorTab.classList.toggle('active', tab === 'calculator');
                elements.historyTab.classList.toggle('active', tab === 'history');

                if (tab === 'history') {
                    renderHistory();
                }
            });
        });
    }

    // === Bill Type Selection ===
    function initBillType() {
        elements.billTypeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.billTypeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentBillType = btn.dataset.type;

                // Update consumption label
                const unit = RATES[currentBillType].unit;
                elements.totalConsumptionLabel.textContent = `צריכה כוללת מהחשבונית (${unit})`;
                elements.subConsumptionValue.textContent = '-';

                // Hide results when changing type
                elements.resultsSection.style.display = 'none';
                lastResult = null;

                // Clear fields and apply saved readings for new type
                elements.totalBill.value = '';
                elements.totalConsumption.value = '';
                elements.subMeterPrev.value = '';
                elements.subMeterCurr.value = '';
                elements.subConsumption.style.display = 'none';

                const savedReadings = getLastReadings();
                if (savedReadings) {
                    applyLastReadings(savedReadings);
                }
            });
        });
    }

    // === Live Consumption Display ===
    function initLiveConsumption() {
        const subInputs = [elements.subMeterPrev, elements.subMeterCurr];

        subInputs.forEach(input => {
            input.addEventListener('input', () => {
                const prev = parseFloat(elements.subMeterPrev.value);
                const curr = parseFloat(elements.subMeterCurr.value);

                if (!isNaN(prev) && !isNaN(curr) && curr >= prev) {
                    const consumption = curr - prev;
                    const unit = RATES[currentBillType].unit;
                    elements.subConsumptionValue.textContent = `${consumption} ${unit}`;
                    elements.subConsumption.style.display = 'flex';
                } else {
                    elements.subConsumption.style.display = 'none';
                }
            });
        });
    }

    // === OCR Image Upload ===
    function initOCR() {
        elements.meterImage.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const previewUrl = OCR.createPreviewUrl(file);
            elements.previewImg.src = previewUrl;
            elements.imagePreview.style.display = 'block';

            elements.ocrStatus.style.display = 'block';
            elements.ocrStatus.className = 'ocr-status loading';
            elements.ocrStatus.innerHTML = '<span class="spinner"></span> מזהה מספרים מהתמונה...';

            try {
                const result = await OCR.processImage(file, (progress) => {
                    elements.ocrStatus.innerHTML = `<span class="spinner"></span> מזהה... ${progress}%`;
                });

                if (result.found && result.bestMatch !== null) {
                    elements.subMeterCurr.value = result.bestMatch;
                    elements.subMeterCurr.dispatchEvent(new Event('input'));

                    elements.ocrStatus.className = 'ocr-status success';

                    let statusText = `✅ זוהה: ${result.bestMatch}`;
                    if (result.numbers.length > 1) {
                        statusText += ` (נמצאו גם: ${result.numbers.slice(1, 4).join(', ')})`;
                    }
                    statusText += '\nניתן לתקן ידנית אם הערך לא מדויק';
                    elements.ocrStatus.textContent = statusText;
                } else {
                    elements.ocrStatus.className = 'ocr-status error';
                    elements.ocrStatus.textContent = '❌ לא זוהו מספרים בתמונה. נסה תמונה ברורה יותר או הזן ידנית';
                }
            } catch (error) {
                elements.ocrStatus.className = 'ocr-status error';
                elements.ocrStatus.textContent = `❌ ${error.message}`;
            }
        });

        elements.removeImage.addEventListener('click', () => {
            elements.imagePreview.style.display = 'none';
            elements.ocrStatus.style.display = 'none';
            elements.meterImage.value = '';
            elements.previewImg.src = '';
        });
    }

    // === Calculate ===
    function initCalculate() {
        elements.calculateBtn.addEventListener('click', () => {
            const params = {
                billType: currentBillType,
                totalBill: parseFloat(elements.totalBill.value),
                totalConsumption: parseFloat(elements.totalConsumption.value),
                subMeterPrev: parseFloat(elements.subMeterPrev.value),
                subMeterCurr: parseFloat(elements.subMeterCurr.value)
            };

            const result = Calculator.calculate(params);

            if (!result.success) {
                showToast(result.error, 'error');
                return;
            }

            lastResult = result;
            displayResults(result);

            // Auto-save current readings for next time
            updateLastReadingsAfterCalc(result);
        });
    }

    // === Display Results ===
    function displayResults(result) {
        elements.resultsSection.style.display = 'block';

        setTimeout(() => {
            elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

        elements.unit1Amount.textContent = Calculator.formatCurrency(result.unit1.amount);
        elements.unit1Percent.textContent = Calculator.formatPercent(result.unit1.percent);
        elements.unit2Amount.textContent = Calculator.formatCurrency(result.unit2.amount);
        elements.unit2Percent.textContent = Calculator.formatPercent(result.unit2.percent);

        elements.detailTotal.textContent = Calculator.formatCurrency(result.totalBill);
        elements.detailTotalConsumption.textContent = `${result.totalConsumption} ${result.unitLabel}`;
        elements.detailUnit2Consumption.textContent = `${result.unit2.consumption} ${result.unitLabel}`;
        elements.detailUnit1Consumption.textContent = `${result.unit1.consumption} ${result.unitLabel}`;
        elements.detailActualRate.textContent = `${Calculator.formatCurrency(result.actualRatePerUnit)}/${result.unitLabel}`;

        if (result.officialRate) {
            elements.detailOfficialRate.textContent = result.officialRate.description;
        }

        if (result.rateCheck) {
            elements.rateStatus.style.display = 'block';
            elements.rateStatus.className = `rate-status ${result.rateCheck.status}`;
            elements.rateStatus.textContent = result.rateCheck.message;
        }
    }

    // === Save & Share ===
    function initActions() {
        elements.saveResult.addEventListener('click', () => {
            if (!lastResult) {
                showToast('אין תוצאה לשמירה', 'error');
                return;
            }

            const saved = Storage.save(lastResult);
            if (saved) {
                showToast('✅ נשמר בהצלחה!');
            } else {
                showToast('❌ שגיאה בשמירה', 'error');
            }
        });

        elements.shareWhatsapp.addEventListener('click', () => {
            if (!lastResult) {
                showToast('אין תוצאה לשליחה', 'error');
                return;
            }

            const message = Calculator.generateWhatsAppMessage(lastResult);
            const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
            window.open(url, '_blank');
        });
    }

    // === History ===
    function initHistory() {
        elements.clearHistory.addEventListener('click', () => {
            if (confirm('האם למחוק את כל ההיסטוריה?')) {
                Storage.clearAll();
                renderHistory();
                showToast('ההיסטוריה נמחקה');
            }
        });
    }

    function renderHistory() {
        const history = Storage.getAll();

        if (history.length === 0) {
            elements.historyList.innerHTML = `
                <div class="empty-history">
                    <span>📭</span>
                    <p>אין חישובים שמורים</p>
                </div>
            `;
            return;
        }

        elements.historyList.innerHTML = history.map(entry => {
            const icon = RATES[entry.billType]?.icon || '📄';
            const typeName = RATES[entry.billType]?.name || entry.billType;
            const date = Storage.formatDate(entry.date);

            return `
                <div class="history-item" data-id="${entry.id}">
                    <div class="history-item-header">
                        <div class="history-item-type">
                            ${icon} ${typeName}
                        </div>
                        <div class="history-item-date">${date}</div>
                    </div>
                    <div class="history-item-details">
                        <div class="history-detail">
                            <span class="history-detail-label">סה"כ חשבונית</span>
                            <span class="history-detail-value">${Calculator.formatCurrency(entry.totalBill)}</span>
                        </div>
                        <div class="history-detail">
                            <span class="history-detail-label">צריכה כוללת</span>
                            <span class="history-detail-value">${entry.totalConsumption} ${entry.unitLabel}</span>
                        </div>
                        <div class="history-detail">
                            <span class="history-detail-label">🏠 יחידה 1</span>
                            <span class="history-detail-value">${Calculator.formatCurrency(entry.unit1.amount)} (${Calculator.formatPercent(entry.unit1.percent)})</span>
                        </div>
                        <div class="history-detail">
                            <span class="history-detail-label">🏠 יחידה 2</span>
                            <span class="history-detail-value">${Calculator.formatCurrency(entry.unit2.amount)} (${Calculator.formatPercent(entry.unit2.percent)})</span>
                        </div>
                    </div>
                    <div class="history-item-actions">
                        <button class="history-delete-btn" onclick="App.deleteHistoryItem('${entry.id}')">🗑️ מחק</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // === Toast Notification ===
    function showToast(message, type = 'info') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // === Public API ===
    window.App = {
        deleteHistoryItem(id) {
            Storage.delete(id);
            renderHistory();
            showToast('הרשומה נמחקה');
        }
    };

    // === Initialize ===
    function init() {
        initSetup();
        initTabs();
        initBillType();
        initLiveConsumption();
        initOCR();
        initCalculate();
        initActions();
        initHistory();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
