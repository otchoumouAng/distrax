export class ForgotPasswordPage extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    render() {
        this.innerHTML = `
            <section class="page-section forgot-password-page" id="forgotPasswordPage" style="display: none; height: 100svh; background: var(--bg-main); z-index: 1000; position: fixed; top: 0; left: 0; width: 100%; overflow-y: auto; overflow-x: hidden;">
                
                <div class="login-header" style="padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; background: var(--glass-bg); backdrop-filter: blur(10px); z-index: 10;">
                    <button class="results-back-btn back-to-login" title="Retour" aria-label="Retour" style="background: var(--glass-bg); backdrop-filter: blur(10px);">
                        <i class="material-icons-round">arrow_back</i>
                    </button>
                    <div style="width: 44px;"></div>
                </div>

                <div class="login-content" style="padding: 20px 24px 40px; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; min-height: calc(100svh - 80px);">
                    
                    <div class="login-branding" style="text-align: center; margin-bottom: 30px; margin-top: auto;">
                        <div style="width: 72px; height: 72px; background: linear-gradient(135deg, var(--primary), var(--primary-light)); border-radius: 20px; display: flex; align-items: center; justify-content: center; color: white; margin: 0 auto 20px; box-shadow: 0 10px 25px color-mix(in srgb, var(--primary) 30%, transparent); flex-shrink: 0;">
                            <i class="material-icons-round" style="font-size: 36px;">lock_reset</i>
                        </div>
                        <h1 style="font-size: 28px; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">Mot de passe oublié</h1>
                        <p style="color: var(--text-muted); font-size: 15px;">Entrez votre numéro de téléphone pour recevoir un lien de réinitialisation</p>
                    </div>

                    <div id="forgotFormContainer" style="display: flex; flex-direction: column; gap: 16px;">
                        <form id="forgotForm" style="display: flex; flex-direction: column; gap: 16px;">
                            <div class="form-group">
                                <label class="form-label">Numéro de téléphone</label>
                                <div style="position: relative;">
                                    <i class="material-icons-round" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-light);">phone</i>
                                    <input type="tel" id="forgotPhoneInput" class="form-input" placeholder="Ex: 0102030405" style="padding-left: 48px;" required>
                                </div>
                            </div>
                            <button type="submit" id="forgotSubmitBtn" style="background: linear-gradient(135deg, var(--primary), var(--primary-light)); color: white; border: none; padding: 18px; border-radius: 16px; font-weight: 700; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s; box-shadow: 0 8px 25px color-mix(in srgb, var(--primary) 40%, transparent); margin-top: 8px;">
                                Envoyer le lien
                            </button>
                        </form>
                    </div>

                    <div id="forgotSuccessMessage" style="display: none; text-align: center; padding: 24px; background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border-light); margin-top: 16px;">
                        <i class="material-icons-round" style="font-size: 48px; color: #10b981;">check_circle</i>
                        <p style="color: var(--text-main); font-weight: 600; margin: 16px 0 8px;">Demande envoyée</p>
                        <p style="color: var(--text-muted); font-size: 14px;">Si ce numéro est associé à un compte, vous recevrez un lien pour réinitialiser votre mot de passe.</p>
                    </div>

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

        const form = this.querySelector('#forgotForm');
        const formContainer = this.querySelector('#forgotFormContainer');
        const successMessage = this.querySelector('#forgotSuccessMessage');
        const submitBtn = this.querySelector('#forgotSubmitBtn');

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const phone = this.querySelector('#forgotPhoneInput').value.trim();
                if (!phone) return;

                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="material-icons-round" style="animation: spin 1s linear infinite;">autorenew</i> Envoi...';

                try {
                    const { api } = await import('../../api.js');
                    await api.forgotPassword(phone);
                    if (formContainer) formContainer.style.display = 'none';
                    if (successMessage) successMessage.style.display = 'block';
                } catch (err) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Envoyer le lien';
                    submitBtn.style.background = '#ef4444';
                    submitBtn.textContent = err.message || 'Erreur';
                    setTimeout(() => {
                        submitBtn.style.background = '';
                        submitBtn.innerHTML = 'Envoyer le lien';
                    }, 3000);
                }
            });
        }
    }

    show() {
        const page = this.querySelector('#forgotPasswordPage');
        if (page) {
            page.style.display = 'block';
            document.body.style.overflow = 'hidden';
            this.querySelector('#forgotFormContainer').style.display = 'flex';
            this.querySelector('#forgotSuccessMessage').style.display = 'none';
            this.querySelector('#forgotForm').reset();
            const btn = this.querySelector('#forgotSubmitBtn');
            if (btn) {
                btn.disabled = false;
                btn.style.background = '';
                btn.innerHTML = 'Envoyer le lien';
            }
        }
    }

    hide() {
        const page = this.querySelector('#forgotPasswordPage');
        if (page) {
            page.style.display = 'none';
            document.body.style.overflow = '';
        }
    }
}

customElements.define('app-forgot-password-page', ForgotPasswordPage);
