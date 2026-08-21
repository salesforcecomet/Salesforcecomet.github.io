// quick-settings.js

document.addEventListener('DOMContentLoaded', () => {
    // Advanced Settings Button
    const advBtn = document.getElementById('open-advanced-settings');
    if (advBtn) {
        advBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const idx = (tabs && tabs[0]) ? tabs[0].index + 1 : undefined;
                chrome.tabs.create({ url: 'src/settings.html', index: idx });
            });
        });
    }
});
