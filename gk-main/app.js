// Guyton-Klinger Simulator - Mix-and-match data version
console.log('Loading Guyton-Klinger simulator...');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing simulator...');
    
    // --- CACHE DOM ELEMENTS ---
    const form = document.getElementById('calculatorForm');
    const resultsContainer = document.getElementById('simulationResults');
    const simulationYearsInput = document.getElementById('simulationYears');
    const tableContainer = document.getElementById('data-input-table-container');
    const investmentAssetSelector = document.getElementById('investmentAsset');
    const inflationDataSelector = document.getElementById('inflationData');

    if (!form || !simulationYearsInput || !tableContainer || !investmentAssetSelector || !inflationDataSelector) {
        console.error('Essential form elements not found!');
        return;
    }

    // --- DATA HANDLING ---
    async function loadData(investmentName, inflationName) {
        const investmentPath = `./data/investments/${investmentName}.json`;
        const inflationPath = `./data/inflation/${inflationName}.json`;

        try {
            const [investmentResponse, inflationResponse] = await Promise.all([
                fetch(investmentPath),
                fetch(inflationPath)
            ]);

            if (!investmentResponse.ok) throw new Error(`Failed to load investment data from ${investmentPath}`);
            if (!inflationResponse.ok) throw new Error(`Failed to load inflation data from ${inflationPath}`);

            const investmentData = await investmentResponse.json();
            const inflationData = await inflationResponse.json();

            return { investmentData, inflationData };

        } catch (error) {
            console.error('Data loading error:', error);
            throw error;
        }
    }

    function combineData(investmentData, inflationData) {
        const inflationMap = new Map(inflationData.map(item => [item.year, item.inflation]));
        const combined = [];

        for (const investmentItem of investmentData) {
            if (inflationMap.has(investmentItem.year)) {
                combined.push({
                    year: investmentItem.year,
                    return: investmentItem.return,
                    inflation: inflationMap.get(investmentItem.year)
                });
            }
        }
        return combined;
    }

    // --- DYNAMIC TABLE GENERATION ---
    function generateInputTable(annualData) {
        if (!annualData || annualData.length === 0) {
            tableContainer.innerHTML = '<p class="text-danger">沒有可用的重疊數據。請嘗試不同的數據組合。</p>';
            return;
        }

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

        annualData.forEach((data, i) => {
            tableHTML += `
                <tr>
                    <td>${data.year}</td>
                    <td><input type="number" class="form-control input-sm" id="return-year-${i}" value="${data.return}" step="0.01" required></td>
                    <td><input type="number" class="form-control input-sm" id="inflation-year-${i}" value="${data.inflation}" step="0.01" required></td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table></div></div>`;
        tableContainer.innerHTML = tableHTML;
    }
    
    // --- FORM UPDATE LOGIC ---
    async function updateForm() {
        const selectedInvestment = investmentAssetSelector.value;
        const selectedInflation = inflationDataSelector.value;

        try {
            const { investmentData, inflationData } = await loadData(selectedInvestment, selectedInflation);
            const combinedData = combineData(investmentData, inflationData);
            
            simulationYearsInput.value = combinedData.length;
            simulationYearsInput.readOnly = true;
            generateInputTable(combinedData);
            resultsContainer.innerHTML = '';

        } catch (error) {
            tableContainer.innerHTML = `<p class="text-danger">無法載入數據集，請檢查檔案、網路連線或主控台錯誤訊息。</p>`;
        }
    }

    // --- EVENT LISTENERS ---
    investmentAssetSelector.addEventListener('change', updateForm);
    inflationDataSelector.addEventListener('change', updateForm);
    form.addEventListener('submit', runSimulationHandler);

    // --- MAIN SIMULATION HANDLER ---
    function runSimulationHandler(e) {
        e.preventDefault();
        console.log('Form submitted - starting simulation...');
        
        try {
            const initialAssets = parseFloat(document.getElementById('initialAssets').value);
            const initialWithdrawalRate = parseFloat(document.getElementById('initialWithdrawalRate').value);
            const simulationYears = parseInt(simulationYearsInput.value, 10);

            if (simulationYears === 0) {
                throw new Error("沒有可用數據進行模擬，請選擇其他數據集。");
            }

            const annualData = [];
            for (let i = 0; i < simulationYears; i++) {
                const year = document.querySelector(`#data-input-table-container table tbody tr:nth-child(${i + 1}) td:first-child`).textContent;
                const retVal = parseFloat(document.getElementById(`return-year-${i}`).value);
                const infVal = parseFloat(document.getElementById(`inflation-year-${i}`).value);
                if (isNaN(retVal) || isNaN(infVal)) {
                    throw new Error(`第 ${year} 年的輸入值無效，請檢查表格。`);
                }
                annualData.push({ year: parseInt(year), return: retVal, inflation: infVal });
            }

            const results = calculateSimulation({ initialAssets, initialWithdrawalRate, simulationYears, annualData });
            displayResults(results);

        } catch (error) {
            console.error('Simulation error:', error);
            alert('計算過程中發生錯誤: ' + error.message);
            resultsContainer.innerHTML = '';
        }
    }

    // --- CORE CALCULATION LOGIC ---
    function calculateSimulation(params) {
        const { initialAssets, initialWithdrawalRate, simulationYears, annualData } = params;
        const simulationData = [];
        let lastYearActualWithdrawal = initialAssets * (initialWithdrawalRate / 100);

        const lowerGuardrail = initialWithdrawalRate * 1.2;
        const upperGuardrail = initialWithdrawalRate * 0.8;

        for (let i = 0; i < simulationYears; i++) {
            const yearData = {};
            yearData.year = annualData[i].year;
            yearData.startWorth = (i === 0) ? initialAssets : simulationData[i - 1].endWorth;
            
            if (i === 0) {
                yearData.inflation = 0; // First year inflation is not used for adjustment
                yearData.plannedWithdrawal = lastYearActualWithdrawal;
                yearData.rule = '初始提領';
                yearData.actualWithdrawal = yearData.plannedWithdrawal;
            } else {
                yearData.inflation = annualData[i].inflation;
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
            yearData.returnRate = annualData[i].return;
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
                    <td>${data.year}</td>
                    <td>${formatCurrency(data.startWorth)}</td>
                    <td>${data.inflation !== 0 ? formatPercent(data.inflation) : 'N/A'}</td>
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
    updateForm();
    console.log('Guyton-Klinger simulator initialized successfully');
});
