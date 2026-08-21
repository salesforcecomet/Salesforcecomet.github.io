/* global React */
let h = React.createElement;

/**
 * Reusable SLDS Page Header Component
 *
 * This component provides a consistent header across all pages with support for
 * customizable navigation items and utility actions (slot-like functionality).
 *
 * @param {Object} props - Component properties
 * @param {string} props.pageTitle - The main title to display in the header (left side)
 * @param {string} [props.subTitle] - Optional subtitle displayed in the center (flexi-truncate)
 * @param {string} props.orgName - The Salesforce org name
 * @param {string} props.sfLink - Link to the Salesforce org home
 * @param {string} props.sfHost - The Salesforce host (used for localStorage keys)
 * @param {number} props.spinnerCount - Number of active loading operations
 * @param {string} props.userInitials - User's initials for avatar
 * @param {string} props.userFullName - User's full name
 * @param {string} props.userName - User's username
 * @param {string} [props.userError] - Optional error message to display instead of username (shows warning icon)
 * @param {string} [props.userInfo] - User's full information
 * @param {string} [props.userError] - Optional error message to display in the popover
 * @param {string} [props.userErrorDescription] - Optional error description to display in the popover
 * @param {Array} [props.navItems] - Optional array of navigation items (slot)
 * @param {Array} [props.utilityItems] - Optional array of utility items (slot)
 * @param {string} [props.backLink] - Optional link for the back button (replaces home icon when provided)
 *
 * Example usage:
 *
 * h(PageHeader, {
 *   pageTitle: "Data Export",
 *   orgName: model.orgName,
 *   sfLink: model.sfLink,
 *   sfHost: model.sfHost,
 *   spinnerCount: model.spinnerCount,
 *   userInitials: model.userInitials,
 *   userFullName: model.userFullName,
 *   userName: model.userName,
 *   navItems: [
 *     h("li", {className: "slds-builder-header__nav-item"},
 *       h("button", {onClick: this.onNavClick}, "My Nav Item")
 *     )
 *   ],
 *   utilityItems: [
 *     h("div", {className: "slds-builder-header__utilities-item"},
 *       h("a", {href: "#", onClick: this.onAgentforce},
 *         h("span", {}, "Agentforce")
 *       )
 *     )
 *   ]
 * })
 */
// Positions the static active-pill indicator after the header renders.
function navListRef(el) {
  if (el && window.__sfarcNavSlide) {
    window.__sfarcNavSlide.position(el, -1);
    window.__sfarcNavSlide.bind(el);
  }
}

export function PageHeader(props) {
  const {
    pageTitle,
    orgName,
    sfLink,
    sfHost,
    spinnerCount = 0,
    userInitials,
    userFullName,
    userName,
    userError = null,
    userErrorDescription = null,
    navItems = [],
    utilityItems = [],
    subTitle,
    backLink,
    onToggleHelp,
    showHelp = true,
    helpTitle = "Help"
  } = props;

  if (typeof React.useEffect === 'function') {
    React.useEffect(() => {
      if (window.sfUserPermissions) {
        window.sfUserPermissions.applyNavGating();
      }
    }, []);
  } else {
    setTimeout(() => {
      if (window.sfUserPermissions) {
        window.sfUserPermissions.applyNavGating();
      }
    }, 0);
  }

  // Filter out any legacy standalone buttons from utilityItems if passed
  const filteredUtilityItems = utilityItems.filter(item => {
    if (!item) return false;
    const key = item.key;
    return key !== "agentforce-btn" && key !== "help-btn";
  });

  const leftUtilityItems = filteredUtilityItems.filter(item => item && item.key === 'header-templates');
  const rightUtilityItems = filteredUtilityItems.filter(item => item && item.key !== 'header-templates');

  // Check if header color override is enabled and get custom color
  let customHeaderStyle = {};
  try {
    const overrideColorsOption = JSON.parse(localStorage.getItem("overrideColorsOption") || "[]");
    const shouldOverride = overrideColorsOption.find(item => item.name === "header")?.checked;
    if (shouldOverride && sfHost) {
      const customColor = localStorage.getItem(sfHost + "_customFavicon");
      if (customColor) {
        customHeaderStyle = {
          backgroundColor: customColor
        };
      }
    }
  } catch (e) {
    // If parsing fails, just use default styles
    console.error("Error reading color override settings:", e);
  }

  return h("div", { className: "slds-builder-header_container" },
    h("header", { className: "slds-builder-header sfir-header-override", style: customHeaderStyle },
      // Navigation slot (optional)
      navItems.length > 0
        ? h("nav", { className: "slds-builder-header__item slds-builder-header__nav sfir-border-none" },
          h("ul", { className: "slds-builder-header__nav-list", ref: navListRef },
            h("li", { className: "sfir-nav-slider sfir-nav-slider-init", key: "sfir-nav-slider", "aria-hidden": "true" }),
            ...navItems
          )
        ) : null,

      // Left: Page Title (optional)
      pageTitle ? h("div", { className: "slds-builder-header__item sfir-border-none" },
        h("div", { className: "slds-builder-header__item-label slds-media slds-media_center" },
          h("div", { className: "slds-text-heading_small slds-media__body" }, pageTitle)
        )
      ) : null,

      // Left side: Custom utility controls slot (e.g. Templates, etc.)
      h("div", { id: "sfir-header-utility-slot", className: "slds-builder-header__item sfir-border-none", style: { display: "flex", alignItems: "center", gap: "6px" } },
        ...leftUtilityItems
      ),

      // Center: Dead-centered Title with Comet Icon
      h("div", { className: "sfir-header-center-title-container" },
        h("img", {
          src: (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL("icons/icon-48.png") : "icons/icon-48.png",
          className: "sfir-header-title-logo",
          alt: "Comet Logo"
        }),
        h("span", { className: "sfir-header-title-text" }, "Salesforce Comet ")
      ),

      // Right side: Utilities / Org Badge and profile/help
      h("div", { className: "slds-builder-header__item slds-builder-header__utilities sfir-border-none" },
        // Tooling API and QueryAll toggles (shifted to the right)
        ...rightUtilityItems,

        // Org Badge (shifted from the left)
        h("div", { className: "slds-builder-header__utilities-item sfir-border-none" },
          h("a", { href: sfLink, title: "Home" },
            h("span", { className: "slds-badge slds-badge_lightest" },
              h("span", { className: "slds-badge__icon slds-badge__icon_left" },
                backLink ? h("a", {
                  href: backLink,
                  title: "Back to Record",
                  className: "sfir-icon-link",
                  onClick: (e) => e.stopPropagation()
                },
                  h("svg", { viewBox: "0 0 24 24", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { marginRight: "4px", flexShrink: 0 } },
                    h("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    h("polyline", { points: "12 19 5 12 12 5" })
                  )
                ) : h("svg", { viewBox: "0 0 24 24", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { marginRight: "4px", flexShrink: 0 } },
                  h("path", { d: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }),
                  h("polyline", { points: "9 22 9 12 15 12 15 22" })
                )
              ),
              h("span", { className: "sfir-org-badge-text" }, orgName)
            )
          )
        ),

        // Single Badge Capsule with action icons (Help, User Avatar)
        h("div", { className: "slds-builder-header__utilities-item sfir-border-none slds-p-horizontal_xxx-small" },
          h("div", { className: "sfir-header-single-badge" },

            // Help icon button
            (onToggleHelp && showHelp !== false) ? h("div", {
              className: "sfir-badge-action-btn",
              role: "button",
              tabIndex: 0,
              title: helpTitle,
              onClick: onToggleHelp
            },
              h("svg", { className: "sfir-badge-action-icon", viewBox: "0 0 24 24", width: "22", height: "22", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                h("path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }),
                h("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
              )
            ) : null,

            // User Avatar Item
            // NOTE: title is only set for the error state — the custom popover below
            // replaces the native tooltip, so both never overlap on hover.
            h("div", { className: "sfir-badge-action-btn sfir-badge-avatar-btn sfir-display-popover-trigger", title: userError || undefined },
              userError
                ? h("span", { className: "sfir-badge-avatar-text sfir-badge-avatar-error" },
                  h("svg", { className: "sfir-badge-action-icon", viewBox: "0 0 24 24", width: "22", height: "22", fill: "none", stroke: "var(--slds-g-color-error-1)", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                    h("path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" }),
                    h("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
                    h("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
                  )
                )
                : h("span", { className: "sfir-badge-avatar-text" }, userInitials || "VG"),
              h("section", {
                className: "sfir-display-popover-target slds-popover slds-nubbin_top-right",
                style: { position: "absolute", right: "0px", top: "calc(100% + 8px)" }
              },
                h("div", { id: "popover-body-id", className: "slds-popover__body" },
                  h("p", {},
                    h("strong", { className: "slds-truncate" }, userError || userFullName)
                  ),
                  h("p", { className: "slds-truncate" }, userErrorDescription || userName)
                )
              )
            )
          )
        )
      )
    )
  );
}

