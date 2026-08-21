// settings-preview.js
// Renders the floating icon on the settings page for preview purposes

function initPreview() {
    console.log('[Settings Preview] Initializing...');

    // Create the button if it doesn't exist
    if (!document.getElementById('sfarc-toggle')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'sfarc-toggle';
        toggleBtn.title = 'Salesforce Comet (Preview)';
        toggleBtn.style.cssText = 'position: fixed !important; z-index: 2147483647 !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; padding: 0 !important; margin: 0 !important; box-shadow: 2px 0 10px rgba(0, 0, 0, 0.2) !important; font-size: 20px !important;';

        // Add click listener to show it works
        toggleBtn.addEventListener('click', () => {
            // For preview, maybe just animate it or show a toast?
            // Or toggle a dummy panel if we wanted to go that far.
            const toast = document.getElementById('sfarc-toast');
            if (toast) {
                const span = toast.querySelector('span');
                const originalText = span.textContent;
                span.textContent = "Toggle clicked (Preview)";
                toast.classList.add('sfarc-show');
                setTimeout(() => {
                    toast.classList.remove('sfarc-show');
                    setTimeout(() => span.textContent = originalText, 500);
                }, 1500);
            }
        });

        document.body.appendChild(toggleBtn);
        console.log('[Settings Preview] Button created');
    }

    updatePreview();
}

function updatePreview() {
    const toggleBtn = document.getElementById('sfarc-toggle');
    if (!toggleBtn) return;

    // We access 'currentSettings' from settings.js (shared scope)
    // If not available, we wait or use defaults
    const s = (typeof currentSettings !== 'undefined') ? currentSettings : {
        iconVisible: true,
        iconPosition: 'right',
        iconOffset: 50,
        iconStyle: 'arrow',
        iconBgColor: '#2196f3',
        iconColor: '#ffffff'
    };

    if (!s.iconVisible) {
        toggleBtn.style.display = 'none';
        return;
    } else {
        toggleBtn.style.display = 'flex';
    }

    // Reset positioning styles
    toggleBtn.style.removeProperty('top');
    toggleBtn.style.removeProperty('bottom');
    toggleBtn.style.removeProperty('left');
    toggleBtn.style.removeProperty('right');
    toggleBtn.style.removeProperty('transform');
    toggleBtn.style.removeProperty('border-left');
    toggleBtn.style.removeProperty('border-right');
    toggleBtn.style.removeProperty('border-top');
    toggleBtn.style.removeProperty('border-bottom');
    toggleBtn.style.removeProperty('border-radius');
    toggleBtn.style.removeProperty('width');
    toggleBtn.style.removeProperty('height');

    const offset = s.iconOffset + '%';

    if (s.iconPosition === 'right') {
        toggleBtn.style.setProperty('top', offset, 'important');
        toggleBtn.style.setProperty('right', '0', 'important');
        toggleBtn.style.setProperty('transform', 'translateY(-50%)', 'important');
        toggleBtn.style.setProperty('border-top-right-radius', '0', 'important');
        toggleBtn.style.setProperty('border-bottom-right-radius', '0', 'important');
        toggleBtn.style.setProperty('border-top-left-radius', '10px', 'important');
        toggleBtn.style.setProperty('border-bottom-left-radius', '10px', 'important');
        toggleBtn.style.setProperty('border-right', 'none', 'important');
        toggleBtn.style.setProperty('width', '30px', 'important');
        toggleBtn.style.setProperty('height', '50px', 'important');
        toggleBtn.innerHTML = '&#9664;'; // Left arrow
    } else if (s.iconPosition === 'left') {
        toggleBtn.style.setProperty('top', offset, 'important');
        toggleBtn.style.setProperty('left', '0', 'important');
        toggleBtn.style.setProperty('transform', 'translateY(-50%)', 'important');
        toggleBtn.style.setProperty('border-top-left-radius', '0', 'important');
        toggleBtn.style.setProperty('border-bottom-left-radius', '0', 'important');
        toggleBtn.style.setProperty('border-top-right-radius', '10px', 'important');
        toggleBtn.style.setProperty('border-bottom-right-radius', '10px', 'important');
        toggleBtn.style.setProperty('border-left', 'none', 'important');
        toggleBtn.style.setProperty('width', '30px', 'important');
        toggleBtn.style.setProperty('height', '50px', 'important');
        toggleBtn.innerHTML = '&#9654;'; // Right arrow
    } else if (s.iconPosition === 'bottom') {
        toggleBtn.style.setProperty('left', offset, 'important');
        toggleBtn.style.setProperty('bottom', '0', 'important');
        toggleBtn.style.setProperty('transform', 'translateX(-50%)', 'important');
        toggleBtn.style.setProperty('border-bottom-left-radius', '0', 'important');
        toggleBtn.style.setProperty('border-bottom-right-radius', '0', 'important');
        toggleBtn.style.setProperty('border-top-left-radius', '10px', 'important');
        toggleBtn.style.setProperty('border-top-right-radius', '10px', 'important');
        toggleBtn.style.setProperty('border-bottom', 'none', 'important');
        toggleBtn.style.setProperty('width', '50px', 'important');
        toggleBtn.style.setProperty('height', '30px', 'important');
        toggleBtn.innerHTML = '&#9650;'; // Up arrow
    } else if (s.iconPosition === 'top') {
        toggleBtn.style.setProperty('left', offset, 'important');
        toggleBtn.style.setProperty('top', '0', 'important');
        toggleBtn.style.setProperty('transform', 'translateX(-50%)', 'important');
        toggleBtn.style.setProperty('border-top-left-radius', '0', 'important');
        toggleBtn.style.setProperty('border-top-right-radius', '0', 'important');
        toggleBtn.style.setProperty('border-bottom-left-radius', '10px', 'important');
        toggleBtn.style.setProperty('border-bottom-right-radius', '10px', 'important');
        toggleBtn.style.setProperty('border-top', 'none', 'important');
        toggleBtn.style.setProperty('width', '50px', 'important');
        toggleBtn.style.setProperty('height', '30px', 'important');
        toggleBtn.innerHTML = '&#9660;'; // Down arrow
    }

    // Apply Custom Colors
    // Apply Custom Colors
    const bgColor = s.iconBgColor || '#2196f3'; // Default Blue
    const iconColor = s.iconColor || '#ffffff'; // Default White
    toggleBtn.style.setProperty('background', bgColor, 'important');
    toggleBtn.style.setProperty('color', iconColor, 'important');

    // Apply Transparency & Blur
    const opacity = (s.iconOpacity !== undefined ? s.iconOpacity : 100) / 100;
    const blur = (s.iconBlur || 0) + 'px';
    toggleBtn.style.setProperty('opacity', opacity, 'important');
    if (s.iconBlur > 0) {
        toggleBtn.style.setProperty('backdrop-filter', `blur(${blur})`, 'important');
        toggleBtn.style.setProperty('-webkit-backdrop-filter', `blur(${blur})`, 'important');
    } else {
        toggleBtn.style.removeProperty('backdrop-filter');
        toggleBtn.style.removeProperty('-webkit-backdrop-filter');
    }

    // Apply Custom Icon Type
    const iconType = s.iconStyle || 'arrow';
    if (iconType === 'bug') {
        toggleBtn.innerHTML = '<i class="fa-solid fa-bug"></i>';
    } else if (iconType === 'flash') {
        toggleBtn.innerHTML = '<i class="fa-solid fa-bolt"></i>';
    } else if (iconType === 'search') {
        toggleBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
    } else if (iconType === 'star') {
        toggleBtn.innerHTML = '<i class="fa-solid fa-star"></i>';
    } else if (iconType === 'rocket') {
        toggleBtn.innerHTML = '<i class="fa-solid fa-rocket"></i>';
    } else if (iconType === 'code') {
        toggleBtn.innerHTML = '<i class="fa-solid fa-code"></i>';
    } else if (iconType === 'wrench') {
        toggleBtn.innerHTML = '<i class="fa-solid fa-wrench"></i>';
    } else {
        // Keep arrows from position logic above
    }

    // Ensure critical positioning
    toggleBtn.style.setProperty('position', 'fixed', 'important');
    toggleBtn.style.setProperty('z-index', '2147483647', 'important');
}

// Init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPreview);
} else {
    initPreview();
}
