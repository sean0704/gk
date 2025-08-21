// Guyton-Klinger Simulator - Dynamic Table Inputs
console.log('Loading Guyton-Klinger simulator with dynamic inputs...');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing simulator...');
    
    // --- CACHE DOM ELEMENTS ---
    const form = document.getElementById('calculatorForm');
    const resultsContainer = document.getElementById('simulationResults');
    const simulationYearsInput = document.getElementById('simulationYears');
    const tableContainer = document.getElementById('data-input-table-container');

    if (!form || !simulationYearsInput || !tableContainer) {
        console.error('Essential form elements not found!');
        return;
    }

    // --- DEFAULT DATA ---
    const defaultReturns = [-7.08, -11.22, -31.91, 11.79, 7.33, 28.59, 8.86, 0.36, -38.49, 30.81, 22.06, -3.82, 14.54, 18.10, 18.94, 9.47, 12.05, 9.54, -4.61, 29.74, 6.95, 28.97, -12.88, 18.54, 25.64];
    const defaultInflations = [0, 3.4, 2.8, 1.6, 2.3, 2.7, 3.4, 3.2, 2.9, 3.8, -0.4, 1.6, 3.2, 2.1, 1.5, 1.6, 0.1, 1.3, 2.1, 2.4, 1.8, 1.2, 4.7, 8.0, 4.1];

    // --- DYNAMIC TABLE GENERATION ---
    function generateInputTable() {
        const years = parseInt(simulationYearsInput.value, 10) || 0;
        if (years <= 0 || years > 100) return;

        let tableHTML = `
            <div class="form-group">
                <label class="form-label">年度數據序列 (Annual Data Series)</label>
                <div class="dynamic-table-wrapper">
                    <table class="dynamic-input-table">
                        <thead>
                            <tr>
                                <th>年份</th>
                                <th>投報率 (%)</th>
                                <th>通膨率 (%)</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        for (let i = 0; i < years; i++) {
            const year = 2000 + i;
            const returnValue = defaultReturns[i] !== undefined ? defaultReturns[i] : 7;
            const inflationValue = defaultInflations[i] !== undefined ? defaultInflations[i] : 2;
            tableHTML += `
                <tr>
                    <td>${year}</td>
                    <td><input type="number" class="form-control input-sm" id="return-year-${i}" value="${returnValue}" step="0.01" required></td>
                    <td><input type="number" class="form-control input-sm" id="inflation-year-${i}" value="${inflationValue}" step="0.01" required></td>
                </tr>
            `;
        }

        tableHTML += `</tbody></table></div></div>`;
        tableContainer.innerHTML = tableHTML;
    }

    // --- EVENT LISTENERS ---
    simulationYearsInput.addEventListener('input', generateInputTable);
    form.addEventListener('submit', runSimulationHandler);

    // --- MAIN SIMULATION HANDLER ---
    function runSimulationHandler(e) {
        e.preventDefault();
        console.log('Form submitted - starting simulation...');
        
        try {
            // 1. Read initial parameters
            const initialAssets = parseFloat(document.getElementById('initialAssets').value);
            const initialWithdrawalRate = parseFloat(document.getElementById('initialWithdrawalRate').value);
            const simulationYears = parseInt(simulationYearsInput.value, 10);

            // 2. Read data from the dynamic table
            const annualReturns = [];
            const annualInflations = [];
            for (let i = 0; i < simulationYears; i++) {
                const retVal = parseFloat(document.getElementById(`return-year-${i}`).value);
                const infVal = parseFloat(document.getElementById(`inflation-year-${i}`).value);
                if (isNaN(retVal) || isNaN(infVal)) {
                    throw new Error(`第 ${2000 + i} 年的輸入值無效，請檢查表格。`);
                }
                annualReturns.push(retVal);
                annualInflations.push(infVal);
            }

            // 3. Run simulation logic
            const results = calculateSimulation({
                initialAssets,
                initialWithdrawalRate,
                simulationYears,
                annualReturns,
                annualInflations
            });

            // 4. Display results
            displayResults(results);

        } catch (error) {
            console.error('Simulation error:', error);
            alert('計算過程中發生錯誤: ' + error.message);
            resultsContainer.innerHTML = '';
        }
    }

    // --- CORE CALCULATION LOGIC ---
    function calculateSimulation(params) {
        const { initialAssets, initialWithdrawalRate, simulationYears, annualReturns, annualInflations } = params;
        const simulationData = [];
        let lastYearActualWithdrawal = initialAssets * (initialWithdrawalRate / 100);

        const lowerGuardrail = initialWithdrawalRate * 1.2;
        const upperGuardrail = initialWithdrawalRate * 0.8;

        for (let i = 0; i < simulationYears; i++) {
            const yearData = {};
            yearData.year = i;
            yearData.startWorth = (i === 0) ? initialAssets : simulationData[i - 1].endWorth;
            
            if (i === 0) {
                yearData.inflation = 0;
                yearData.plannedWithdrawal = lastYearActualWithdrawal;
                yearData.rule = '初始提領';
                yearData.actualWithdrawal = yearData.plannedWithdrawal;
            } else {
                yearData.inflation = annualInflations[i];
                const prevReturn = simulationData[i - 1].returnRate;
                const inflationToApply = Math.min(yearData.inflation, 6.0);
                const plannedWithdrawalWithInflation = lastYearActualWithdrawal * (1 + inflationToApply / 100);
                const plannedRateWithInflation = (plannedWithdrawalWithInflation / yearData.startWorth) * 100;
                
                if (prevReturn < 0 && plannedRateWithInflation > initialWithdrawalRate) {
                    yearData.plannedWithdrawal = lastYearActualWithdrawal;
                    yearData.rule = '通膨(凍結)';
                } else {
                    yearData.plannedWithdrawal = plannedWithdrawalWithInflation;
                    yearData.rule = '通膨';
                }
                
                yearData.plannedRate = (yearData.plannedWithdrawal / yearData.startWorth) * 100;
                yearData.actualWithdrawal = yearData.plannedWithdrawal;

                if (yearData.plannedRate > lowerGuardrail) {
                    yearData.rule = '保本';
                    yearData.actualWithdrawal = yearData.plannedWithdrawal * 0.9;
                } else if (yearData.plannedRate < upperGuardrail) {
                    yearData.rule = '繁榮';
                    yearData.actualWithdrawal = yearData.plannedWithdrawal * 1.1;
                }
            }

            yearData.actualRate = (yearData.actualWithdrawal / yearData.startWorth) * 100;
            yearData.postWithdrawalBalance = yearData.startWorth - yearData.actualWithdrawal;
            yearData.returnRate = annualReturns[i];
            yearData.endWorth = yearData.postWithdrawalBalance * (1 + yearData.returnRate / 100);

            simulationData.push(yearData);
            lastYearActualWithdrawal = yearData.actualWithdrawal;
        }
        return simulationData;
    }

    // --- DISPLAY RESULTS ---
    function displayResults(results) {
        const formatCurrency = (num) => `NT$ ${Math.round(num).toLocaleString('zh-TW')}`;
        const formatPercent = (num) => `${(num || 0).toFixed(2)}%`;
        const formatRule = (rule) => {
            let className = '';
            let ruleText = rule;
            if (rule === '保本') { className = 'rule-lower'; ruleText = '保本 (CPR)'; }
            if (rule === '繁榮') { className = 'rule-upper'; ruleText = '繁榮 (PR)'; }
            if (rule === '通膨') { className = 'rule-normal'; ruleText = '通膨 (Inflation)'; }
            if (rule === '通膨(凍結)') { className = 'rule-info'; ruleText = '通膨(凍結) (Freeze)'; }
            return `<span class="rule-cell ${className}">${ruleText}</span>`;
        };
        const formatReturn = (rate) => {
            const className = rate < 0 ? 'text-danger' : 'text-success';
            return `<span class="${className}">${formatPercent(rate)}</span>`;
        };

        let tableHTML = `
            <div class="card">
                <div class="card__header">
                    <h2>模擬結果 Simulation Results</h2>
                </div>
                <div class="card__body table-responsive">
                    <table class="results-table">
                        <thead>
                            <tr>
                                <th>年份</th>
                                <th>年初淨值</th>
                                <th>通膨率</th>
                                <th>計畫提領率</th>
                                <th>觸發規則</th>
                                <th>實際提領金額</th>
                                <th>實際提領率</th>
                                <th>年底投報率</th>
                                <th>年底淨值</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        results.forEach(data => {
            tableHTML += `
                <tr>
                    <td>${2000 + data.year}</td>
                    <td>${formatCurrency(data.startWorth)}</td>
                    <td>${data.year > 0 ? formatPercent(data.inflation) : 'N/A'}</td>
                    <td>${formatPercent(data.plannedRate)}</td>
                    <td>${formatRule(data.rule)}</td>
                    <td>${formatCurrency(data.actualWithdrawal)}</td>
                    <td>${formatPercent(data.actualRate)}</td>
                    <td>${formatReturn(data.returnRate)}</td>
                    <td>${formatCurrency(data.endWorth)}</td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table></div></div>`;
        resultsContainer.innerHTML = tableHTML;
        resultsContainer.style.display = 'block';
        resultsContainer.classList.add('fade-in');
        setTimeout(() => {
            resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    // --- INITIALIZE ---
    generateInputTable();
    console.log('Guyton-Klinger simulator initialized successfully');
});