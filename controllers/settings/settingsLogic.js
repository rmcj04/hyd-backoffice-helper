const saveOptions = () => {
    const clientStat = document.getElementById('customerRefStatsSwitcher').checked;
    const delta = document.getElementById('deltaSwitcher').checked;

    chrome.storage.sync.set(
        { displayClientStat: clientStat,displayDelta: delta },
        () => {
            // Update status to let user know options were saved.
            const status = document.getElementById('status');
            status.textContent = 'Настройки сохранены';
            setTimeout(() => {
                status.textContent = '';
            }, 750);
        }
    );
};

const restoreOptions = () => {
    chrome.storage.sync.get(
        { displayClientStat: true, displayDelta: true },
        (items) => {
            document.getElementById('customerRefStatsSwitcher').checked = items.displayClientStat;
            document.getElementById('deltaSwitcher').checked = items.displayDelta;
        }
    );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);