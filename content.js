
function waitForElement(selector, callback) {
    const element = document.querySelector(selector);
    if (element) {
        callback();
    } else {
        setTimeout(() => waitForElement(selector, callback), 500);
    }
}

function checkIsPaymentsPage() {
    let targetSelector = "#R7302135388147866 > div.t-BreadcrumbRegion-top > div.t-BreadcrumbRegion-body > div.t-BreadcrumbRegion-breadcrumb > ul > li > h1";
    return !!document.querySelector(targetSelector);
}

// Функция для добавления бейджа в ячейку без нарушения верстки
function addBadgeToCell(cell, badge) {
    const wrapperClass = 'badge-wrapper';
    let wrapper = cell.querySelector(`.${wrapperClass}`);
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = wrapperClass;
        while (cell.firstChild) {
            wrapper.appendChild(cell.firstChild);
        }
        cell.appendChild(wrapper);
    }
    wrapper.querySelector(`.${badge.className}`)?.remove();
    wrapper.appendChild(badge);
}

// Основная логика после загрузки таблицы
const tableSelector = 'table.a-IRR-table[aria-label*="Payments"]';
waitForElement(tableSelector, () => {
    const paymentData = {};
    let timeDeltas = []; // Массив для хранения всех дельт

    function analyzeTable(cellsIndexes) {
        Object.keys(paymentData).forEach(key => delete paymentData[key]);
        const rows = document.querySelectorAll(`${tableSelector} tbody tr`);
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');

            if (cells.length > 5) {
                const customerRefId = cells[cellsIndexes.get("Customer Reference Id")].innerText.trim();
                const state = cells[cellsIndexes.get("State")].innerText.trim().toLowerCase();
                if (!paymentData[customerRefId]) {
                    paymentData[customerRefId] = {};
                }
                if (!paymentData[customerRefId][state]) {
                    paymentData[customerRefId][state] = 0;
                }
                paymentData[customerRefId][state]++;
            }
        });
    }

    async function isFeatureEnabled(feature)
    {
        let items = await chrome.storage.sync.get(['displayClientStat', 'displayDelta']);

        let features = {displayClientStat: true, displayDelta: true, ...items};

        switch (feature) {
            case "customerStats":
                return features.displayClientStat === true;
            case "delta":
                return features.displayDelta === true;
            default:
                console.log("unknown feature")
                return false;
        }

    }

    function displayBadges(customerRefIdCellId) {
        const idCells = document.querySelectorAll(`${tableSelector} tbody tr td:nth-child(${customerRefIdCellId})`);
        idCells.forEach(cell => {
            const customerRefId = cell.innerText.trim();
            const stats = paymentData[customerRefId];
            if (stats) {
                const badge = document.createElement('div');
                badge.className = 'customer-id-badge';
                let badgeText = '';
                for (const state in stats) {
                    badgeText += `x${stats[state]} ${state} `;
                }
                badge.textContent = badgeText.trim();
                addBadgeToCell(cell, badge);
            }
        });
    }

    function calculateAndDisplayTimes(cellsIndexes) {
        const rows = document.querySelectorAll(`${tableSelector} tbody tr`);
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');

            if (cells.length > 4) {
                const finalizedCell = cells[cellsIndexes.get("Finalized")];
                const createdText = cells[cellsIndexes.get("Created")].innerText.trim().replace('\n', ' ');
                const finalizedText = finalizedCell.innerText.trim().replace('\n', ' ');
                const createdDate = new Date(createdText);
                const finalizedDate = new Date(finalizedText);

                if (!isNaN(createdDate) && !isNaN(finalizedDate)) {
                    const diffMs = finalizedDate - createdDate;
                    timeDeltas.push(diffMs); // <-- СОХРАНЯЕМ ДЕЛЬТУ В МАССИВ
                    const diffSeconds = (diffMs / 1000).toFixed(1);
                    const badge = document.createElement('div');
                    badge.className = 'time-diff-badge';
                    badge.textContent = `(Δ ${diffSeconds}s)`;
                    addBadgeToCell(finalizedCell, badge);
                }
            }
        });
    }

    // <-- НОВИНКА: Функция для отображения средней дельты -->
    function displayAverageDelta(deltas) {
        const table = document.querySelector(tableSelector);
        if (!table) return;

        // Ищем место для вставки - контейнер над таблицей
        const container = table.closest('.a-IRR-container');
        if (!container) return;

        let avgDisplay = document.getElementById('average-delta-display');
        // Если элемента еще нет, создаем и вставляем его
        if (!avgDisplay) {
            avgDisplay = document.createElement('div');
            avgDisplay.id = 'average-delta-display';
            // Вставляем наш элемент перед таблицей
            container.prepend(avgDisplay);
        }

        if (deltas.length === 0) {
            avgDisplay.textContent = 'Нет данных для расчета средней дельты';
            return;
        }

        const sum = deltas.reduce((acc, val) => acc + val, 0);
        const averageMs = sum / deltas.length;
        const averageSeconds = (averageMs / 1000).toFixed(2); // Среднее с точностью до 2 знаков

        avgDisplay.textContent = `Среднее время обработки: ${averageSeconds} с. (на ${deltas.length} платежах)`;
    }

    function findCells(neededCells){

        let processedCells = [...document.querySelectorAll(".a-IRR-header > .a-IRR-headerLink")].map(cell => cell.innerText);

        let out = new Map();

        neededCells.forEach(cell => {

            if(processedCells.indexOf(cell) !== -1){
                out.set(`${cell}`, processedCells.indexOf(cell));
            }
            else
            {

                chrome.runtime.sendMessage({notifyTitle: "Произошла ошибка", notifyMessage: `Добавь в репорт колонку ${cell}`})

                out.set(`${cell}`, -1);
            }

        })

        return out;
    }


    function setRenderDoneFlag()
    {
        let table = document.querySelector(tableSelector);

        let element = document.createElement("div");
        element.setAttribute("id", "render-done");

        table.appendChild(element);
    }

    function checkRenderDoneFlagIsExists()
    {
        return !!document.querySelector('#render-done');
    }

    function run() {
        if (checkIsPaymentsPage()) {

            const cellsIndexes = findCells(["Customer Reference Id", "Created", "Finalized", "State"]);
            timeDeltas = [];
            analyzeTable(cellsIndexes);


            isFeatureEnabled('customerStats').then(isEnabled => {
                if(isEnabled)
                {
                    displayBadges(cellsIndexes.get("Customer Reference Id") + 1); // +1 из-за того, что нумерация элементов в DOM идет не с нуля
                }
            })


            isFeatureEnabled('delta').then(isEnabled => {
                if(isEnabled)
                {
                    calculateAndDisplayTimes(cellsIndexes);
                    displayAverageDelta(timeDeltas);
                }
            })

            setRenderDoneFlag()
        }
    }

    run();


    setInterval(() => {

        if(!checkRenderDoneFlagIsExists())
        {
            console.log('rerender triggered')
            run();
        }

    }, 2000)

});