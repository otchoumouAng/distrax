export class ResetPasswordPage extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    _getTokenFromHash() {
        const hash = window.location.hash.replace('#', '');
        const base = hash.split('?')[0];
        if (base !== 'reset-password') return null;
        const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
        const params = new URLSearchParams(query);
        return params.get('token');
    }

    render() {
        this.innerHTML = `
            <section class="page-section reset-password-page" id="resetPasswordPage" style="display: none; height: 100svh; background: var(--bg-main); z-index: 1000; position: fixed; top: 0; left: 0; width: 100%; overflow-y: auto; overflow-x: hidden;">
                
                <div class="login-header" style="padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; background: var(--glass-bg); backdrop-filter: blur(10px); z-index: 10;">
                    <button class="results-back-btn back-to-login" title="Retour" aria-label="Retour" style="background: var(--glass-bg); backdrop-filter: blur(10px);">
                        <i class="material-icons-round">arrow_back</i>
                    </button>
                    <div style="width: 44px;"></div>
                </div>

                <div class="login-content" style="padding: 20px 24px 40px; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; min-height: calc(100svh - 80px);">
                    
                    <div class="login-branding" style="text-align: center; margin-bottom: 30px; margin-top: auto;">
                        <div style="width: 72px; height: 72px; background: linear-gradient(135deg, var(--primary), var(--primary-light)); border-radius: 20px; display: flex; align-items: center; justify-content: center; color: white; margin: 0 auto 20px; box-shadow: 0 10px 25px color-mix(in srgb, var(--primary) 30%, transparent); flex-shrink: 0;">
                            <i class="material-icons-round" style="font-size: 36px;">key</i>
                        </div>
                        <h1 style="font-size: 28px; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">Nouveau mot de passe</h1>
                        <p style="color: var(--text-muted); font-size: 15px;">Choisissez un nouveau mot de passe sécurisé</p>
                    </div>

                    <div id="resetNoToken" style="display: none; text-align: center; padding: 24px; background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border-light);">
                        <i class="material-icons-round" style="font-size: 48px; color: var(--text-muted);">link_off</i>
                        <p style="color: var(--text-main); margin: 16px 0 8px;">Lien invalide ou expiré</p>
                        <p style="color: var(--text-muted); font-size: 14px;">Demandez un nouveau lien depuis la page « Mot de passe oublié ».</p>
                        <a href="#forgot-password" class="go-to-forgot" style="display: inline-block; margin-top: 16px; color: var(--primary); font-weight: 600;">Mot de passe oublié</a>
                    </div>

                    <form id="resetForm" style="display: flex; flex-direction: column; gap: 16px;">
                        <input type="hidden" id="resetTokenInput" value="">
                        <div class="form-group">
                            <label class="form-label">Nouveau mot de passe</label>
                            <div style="position: relative;">
                                <i class="material-icons-round" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-light);">lock</i>
                                <input type="password" id="resetPasswordInput" class="form-input" placeholder="••••••••" style="padding-left: 48px;" required minlength="6">
                                <i class="material-icons-round toggle-password" style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: var(--text-light); cursor: pointer;">visibility_off</i>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Confirmer le mot de passe</label>
                            <div style="position: relative;">
                                <i class="material-icons-round" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-light);">lock</i>
                                <input type="password" id="resetConfirmInput" class="form-input" placeholder="••••••••" style="padding-left: 48px;" required minlength="6">
                                <i class="material-icons-round toggle-password-2" style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: var(--text-light); cursor: pointer;">visibility_off</i>
                            </div>
                        </div>
                        <button type="submit" id="resetSubmitBtn" style="background: linear-gradient(135deg, var(--primary), var(--primary-light)); color: white; border: none; padding: 18px; border-radius: 16px; font-weight: 700; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s; box-shadow: 0 8px 25px color-mix(in srgb, var(--primary) 40%, transparent); margin-top: 8px;">
                            Réinitialiser le mot de passe
                        </button>
                    </form>

                    <p style="text-align: center; margin-top: 24px; color: var(--text-muted); font-size: 14.5px; margin-bottom: auto; padding-bottom: 20px;">
                        <a href="#login" class="go-to-login" style="color: var(--primary); font-weight: 700; text-decoration: none;">Retour à la connexion</a>
                    </p>
                </div>
            </section>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const backBtn = this.querySelector('.back-to-login');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('navigate-login', { bubbles: true, composed: true }));
            });
        }

        const goToLogin = this.querySelector('.go-to-login');
        if (goToLogin) {
            goToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('navigate-login', { bubbles: true, composed: true }));
            });
        }

        const goToForgot = this.querySelector('.go-to-forgot');
        if (goToForgot) {
            goToForgot.addEventListener('click', (e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('navigate-forgot-password', { bubbles: true, composed: true }));
            });
        }

        const toggle1 = this.querySelector('.toggle-password');
        const pwd1 = this.querySelector('#resetPasswordInput');
        if (toggle1 && pwd1) {
            toggle1.addEventListener('click', () => {
                const type = pwd1.getAttribute('type') === 'password' ? 'text' : 'password';
                pwd1.setAttribute('type', type);
                toggle1.textContent = type === 'password' ? 'visibility_off' : 'visibility';
            });
        }
        const toggle2 = this.querySelector('.toggle-password-2');
        const pwd2 = this.querySelector('#resetConfirmInput');
        if (toggle2 && pwd2) {
            toggle2.addEventListener('click', () => {
                const type = pwd2.getAttribute('type') === 'password' ? 'text' : 'password';
                pwd2.setAttribute('type', type);
                toggle2.textContent = type === 'password' ? 'visibility_off' : 'visibility';
            });
        }

        const form = this.querySelector('#resetForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const tokenInput = this.querySelector('#resetTokenInput');
                const token = tokenInput ? tokenInput.value.trim() : this._getTokenFromHash();
                const newPassword = this.querySelector('#resetPasswordInput').value;
                const confirmPassword = this.querySelector('#resetConfirmInput').value;

                if (newPassword !== confirmPassword) {
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Les deux mots de passe ne correspondent pas.', type: 'error' }, bubbles: true, composed: true }));
                    return;
                }
                if (!token) {
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Lien invalide ou expiré.', type: 'error' }, bubbles: true, composed: true }));
                    return;
                }

                const submitBtn = this.querySelector('#resetSubmitBtn');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="material-icons-round" style="animation: spin 1s linear infinite;">autorenew</i> Enregistrement...';

                try {
                    const { api } = await import('../../api.js');
                    await api.resetPassword(token, newPassword);
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Mot de passe mis à jour. Vous pouvez vous connecter.', type: 'success' }, bubbles: true, composed: true }));
                    window.dispatchEvent(new CustomEvent('navigate-login', { bubbles: true, composed: true }));
                } catch (err) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Réinitialiser le mot de passe';
                    submitBtn.style.background = '#ef4444';
                    submitBtn.textContent = err.message || 'Erreur';
                    setTimeout(() => {
                        submitBtn.style.background = '';
                        submitBtn.innerHTML = 'Réinitialiser le mot de passe';
                    }, 3000);
                }
            });
        }
    }

    show() {
        const page = this.querySelector('#resetPasswordPage');
        if (!page) return;

        const token = this._getTokenFromHash();
        const tokenInput = this.querySelector('#resetTokenInput');
        if (tokenInput) tokenInput.value = token || '';

        const noTokenEl = this.querySelector('#resetNoToken');
        const formEl = this.querySelector('#resetForm');

        if (!token) {
            if (noTokenEl) noTokenEl.style.display = 'block';
            if (formEl) formEl.style.display = 'none';
        } else {
            if (noTokenEl) noTokenEl.style.display = 'none';
            if (formEl) formEl.style.display = 'flex';
        }

        page.style.display = 'block';
        document.body.style.overflow = 'hidden';
        const btn = this.querySelector('#resetSubmitBtn');
        if (btn) {
            btn.disabled = false;
            btn.style.background = '';
            btn.innerHTML = 'Réinitialiser le mot de passe';
        }
    }

    hide() {
        const page = this.querySelector('#resetPasswordPage');
        if (page) {
            page.style.display = 'none';
            document.body.style.overflow = '';
        }
    }
}

customElements.define('app-reset-password-page', ResetPasswordPage);
