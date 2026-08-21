// Salesforce Auto-Login Injector
// Check for pending auto-login data
chrome.storage.local.get(['sfiAutoLogin'], (result) => {
    if (result.sfiAutoLogin) {
        const loginData = result.sfiAutoLogin;

        // Remove data immediately to prevent reuse/security risk
        chrome.storage.local.remove('sfiAutoLogin');

        // Check timestamp (expiration - 30 seconds)
        const now = Date.now();
        if (now - loginData.timestamp > 30000) {
            console.log('SFI: Login data expired');
            return;
        }

        // Fill credentials with retry logic
        const fillCredentials = () => {
            // Standard Salesforce Login Fields
            const usernameField = document.getElementById('username');
            const passwordField = document.getElementById('password');
            const loginBtn = document.getElementById('Login');

            if (usernameField && passwordField && loginBtn) {
                // Fill username if empty
                if (!usernameField.value) {
                    usernameField.value = loginData.username;
                    usernameField.dispatchEvent(new Event('input', { bubbles: true }));
                    usernameField.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Fill password
                passwordField.value = loginData.password;
                passwordField.dispatchEvent(new Event('input', { bubbles: true }));
                passwordField.dispatchEvent(new Event('change', { bubbles: true }));

                // Small delay before clicking to let Salesforce JS process the input events
                setTimeout(() => {
                    loginBtn.click();
                }, 150);

                return true; // success
            }
            return false; // fields not found
        };

        // Attempt to fill immediately, then retry with polling + observer
        const startFill = () => {
            if (fillCredentials()) return;

            // Retry with polling (every 300ms, up to 10 seconds)
            let attempts = 0;
            const maxAttempts = 33;
            const interval = setInterval(() => {
                attempts++;
                if (fillCredentials() || attempts >= maxAttempts) {
                    clearInterval(interval);
                    if (observer) observer.disconnect();
                }
            }, 300);

            // Also use MutationObserver as a faster fallback
            const observer = new MutationObserver(() => {
                if (fillCredentials()) {
                    clearInterval(interval);
                    observer.disconnect();
                }
            });

            observer.observe(document.body || document.documentElement, {
                childList: true,
                subtree: true
            });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startFill);
        } else {
            startFill();
        }
    }
});
