(() => {
    const titleTarget = document.getElementById("typewriterText");
    const cursor = document.getElementById("typewriterCursor");
    const secondary = document.getElementById("secondaryContent");

    const shiftKey = document.getElementById("keyBoxShift");
    const spaceKey = document.getElementById("keyBoxSpace");

    function markOnboardingComplete() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ sfarcHasSeenOnboarding: true, sfarcHasSeenOnboarding_v16: true, sfarc_needs_onboarding: false });
        }
    }

    function launchComet() {
        if (document.body.classList.contains("launching")) return;
        markOnboardingComplete();

        document.body.classList.add("launching");

        setTimeout(() => {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.getCurrent) {
                chrome.tabs.getCurrent((tab) => {
                    if (tab && tab.id) chrome.tabs.remove(tab.id);
                    else window.close();
                });
            } else {
                window.close();
            }
        }, 420);
    }

    const keysPressed = {
        Shift: false,
        Space: false
    };

    function updateKeyStates() {
        shiftKey.classList.toggle("active", keysPressed.Shift);
        spaceKey.classList.toggle("active", keysPressed.Space);

        if (keysPressed.Shift && keysPressed.Space) {
            launchComet();
        }
    }

    let index = 0;
    const titleText = "Welcome to Salesforce Comet";

    function typeTitle() {
        if (index < titleText.length) {
            titleTarget.textContent += titleText[index];
            index += 1;

            const character = titleText[index - 1];
            const delay = character === " " ? 70 : 52;

            setTimeout(typeTitle, delay);
        } else {
            setTimeout(() => {
                cursor.style.display = "none";
                secondary.classList.add("visible");
            }, 420);
        }
    }

    window.addEventListener("keydown", (event) => {
        if (event.key === "Shift") {
            keysPressed.Shift = true;
        }

        if (event.code === "Space") {
            keysPressed.Space = true;
            event.preventDefault();
        }

        updateKeyStates();
    });

    window.addEventListener("keyup", (event) => {
        if (event.key === "Shift") {
            keysPressed.Shift = false;
        }

        if (event.code === "Space") {
            keysPressed.Space = false;
        }

        updateKeyStates();
    });

    window.addEventListener("blur", () => {
        keysPressed.Shift = false;
        keysPressed.Space = false;
        updateKeyStates();
    });

    window.addEventListener("DOMContentLoaded", () => {
        markOnboardingComplete();
        setTimeout(typeTitle, 520);
    });
})();
