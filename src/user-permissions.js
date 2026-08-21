// Salesforce User Permission Manager
(function() {
    class UserPermissionManager {
        constructor() {
            this._cachedPermissions = null;
            this._fetchPromise = null;
        }

        async getPermissions() {
            if (this._cachedPermissions) return this._cachedPermissions;
            if (this._fetchPromise) return this._fetchPromise;

            this._fetchPromise = (async () => {
                const defaultPerms = {
                    userId: null,
                    profileName: 'Standard User',
                    canModifyAllData: true,
                    canViewSetup: true,
                    canAuthorApex: true,
                    canCustomizeApp: true,
                    isAdmin: true
                };

                if (!window.sfApi) return defaultPerms;

                try {
                    // Try getting current user identity from chatter/users/me endpoint
                    const meRes = await window.sfApi.fetch('/services/data/v60.0/chatter/users/me');
                    if (!meRes.ok) throw new Error('Could not fetch user me endpoint');
                    const meData = await meRes.json();
                    const userId = meData.id;

                    // Query User permissions via Profile relationship
                    try {
                        const q = `SELECT Id, Profile.Name, Profile.PermissionsModifyAllData, Profile.PermissionsViewSetup, Profile.PermissionsAuthorApex, Profile.PermissionsCustomizeApplication FROM User WHERE Id = '${userId}'`;
                        const result = await window.sfApi.query(q, false);

                        if (result && result.records && result.records.length > 0) {
                            const u = result.records[0];
                            const prof = u.Profile || {};
                            const profileName = prof.Name || '';
                            const canModifyAll = !!prof.PermissionsModifyAllData;
                            const canViewSetup = !!prof.PermissionsViewSetup;
                            const canAuthorApex = !!prof.PermissionsAuthorApex;
                            const canCustomizeApp = !!prof.PermissionsCustomizeApplication;
                            const isAdmin = canModifyAll || canViewSetup || profileName.toLowerCase().includes('admin');

                            this._cachedPermissions = {
                                userId: u.Id,
                                profileName,
                                canModifyAllData: canModifyAll || isAdmin,
                                canViewSetup: canViewSetup || isAdmin,
                                canAuthorApex: canAuthorApex || isAdmin,
                                canCustomizeApp: canCustomizeApp || isAdmin,
                                isAdmin
                            };
                            return this._cachedPermissions;
                        }
                    } catch (err) {
                        // Fallback query if Profile fields are restricted
                        const qFallback = `SELECT Id, Profile.Name FROM User WHERE Id = '${userId}'`;
                        const resultFallback = await window.sfApi.query(qFallback, false);
                        if (resultFallback && resultFallback.records && resultFallback.records.length > 0) {
                            const u = resultFallback.records[0];
                            const profileName = u.Profile ? u.Profile.Name : '';
                            const isAdmin = profileName.toLowerCase().includes('admin');
                            this._cachedPermissions = {
                                userId: u.Id,
                                profileName,
                                canModifyAllData: isAdmin,
                                canViewSetup: isAdmin,
                                canAuthorApex: isAdmin,
                                canCustomizeApp: isAdmin,
                                isAdmin
                            };
                            return this._cachedPermissions;
                        }
                    }
                } catch (e) {
                    console.warn('UserPermissionManager: Query failed, falling back to session defaults', e);
                }

                // If query fails (e.g. FLS restricted), fallback gracefully
                this._cachedPermissions = defaultPerms;
                return this._cachedPermissions;
            })();

            return this._fetchPromise;
        }

        async applyNavGating() {
            const perms = await this.getPermissions();
            document.querySelectorAll('[data-page]').forEach(link => {
                const page = link.dataset.page;
                if (page === 'limits' || page === 'metadata') {
                    if (!perms.canViewSetup) {
                        link.title = 'Requires Setup Access (Admin Only)';
                        if (!link.querySelector('.sfarc-lock-icon')) {
                            const lock = document.createElement('span');
                            lock.className = 'sfarc-lock-icon';
                            lock.textContent = ' 🔒';
                            lock.style.fontSize = '10px';
                            lock.style.opacity = '0.7';
                            link.appendChild(lock);
                        }
                    }
                } else if (page === 'import') {
                    if (!perms.canModifyAllData) {
                        link.title = 'Requires Modify All Data Permission';
                        if (!link.querySelector('.sfarc-lock-icon')) {
                            const lock = document.createElement('span');
                            lock.className = 'sfarc-lock-icon';
                            lock.textContent = ' 🔒';
                            lock.style.fontSize = '10px';
                            lock.style.opacity = '0.7';
                            link.appendChild(lock);
                        }
                    }
                }
            });
        }
    }

    window.sfUserPermissions = new UserPermissionManager();
})();
