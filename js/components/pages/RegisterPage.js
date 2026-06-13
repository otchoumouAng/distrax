import { initializeGoogleAuth, renderGoogleButton } from '../../utils/googleAuth.js';

export class RegisterPage extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    render() {
        this.innerHTML = `
            <section class="page-section register-page" id="registerPage" style="display: none; height: 100svh; background: var(--bg-main); z-index: 1000; position: fixed; top: 0; left: 0; width: 100%; overflow-y: auto; overflow-x: hidden;">
                
                <div class="login-header" style="padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; background: var(--glass-bg); backdrop-filter: blur(10px); z-index: 10;">
                    <button class="results-back-btn back-to-home" title="Fermer" aria-label="Fermer" style="background: var(--glass-bg); backdrop-filter: blur(10px);">
                        <i class="material-icons-round">close</i>
                    </button>
                    <div style="width: 44px;"></div> <!-- Spacer -->
                </div>

                <div class="login-content" style="padding: 20px 24px 40px; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; min-height: calc(100svh - 80px);">
                    
                    <div class="login-branding" style="text-align: center; margin-bottom: 30px; margin-top: auto;">
                        <img src="assets/img/logo.png" alt="Distrax Logo" style="width: 72px; height: 72px; border-radius: 20px; margin: 0 auto 20px; box-shadow: 0 10px 25px color-mix(in srgb, var(--primary) 30%, transparent); object-fit: cover;">
                        <h1 style="font-size: 28px; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">Créer un compte</h1>
                        <p style="color: var(--text-muted); font-size: 15px;">Rejoignez l'aventure Dystrax !</p>
                    </div>

                    <div class="social-login" id="googleRegisterBtnContainer" style="margin-bottom: 24px; min-height: 52px; display: flex; justify-content: center;">
                        <!-- Le bouton Google sera injecté ici -->
                    </div>

                    <div class="divider" style="display: flex; align-items: center; text-align: center; margin-bottom: 24px; color: var(--text-muted); font-size: 14px; font-weight: 500;">
                        <div style="flex: 1; height: 1px; background: var(--border-light);"></div>
                        <span style="padding: 0 16px;">OU Classique</span>
                        <div style="flex: 1; height: 1px; background: var(--border-light);"></div>
                    </div>

                    <form id="registerForm" style="display: flex; flex-direction: column; gap: 16px;">
                        <div class="form-group">
                            <label class="form-label">Pseudo</label>
                            <div style="position: relative;">
                                <i class="material-icons-round" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-light);">person</i>
                                <input type="text" id="pseudoInput" class="form-input" placeholder="Comment on vous appelle ?" style="padding-left: 48px;" required>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Numéro de téléphone</label>
                            <div style="position: relative;">
                                <i class="material-icons-round" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-light);">phone</i>
                                <input type="tel" id="rPhoneInput" class="form-input" placeholder="Ex: 0102030405" style="padding-left: 48px;" required>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Mot de passe</label>
                            <div style="position: relative;">
                                <i class="material-icons-round" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-light);">lock</i>
                                <input type="password" id="rPasswordInput" class="form-input" placeholder="••••••••" style="padding-left: 48px;" required>
                                <i class="material-icons-round toggle-password" style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: var(--text-light); cursor: pointer;">visibility_off</i>
                            </div>
                        </div>

                        <button type="submit" style="background: linear-gradient(135deg, var(--primary), var(--primary-light)); color: white; border: none; padding: 18px; border-radius: 16px; font-weight: 700; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s; box-shadow: 0 8px 25px color-mix(in srgb, var(--primary) 40%, transparent); margin-top: 8px;">
                            S'inscrire
                        </button>
                    </form>

                    <p style="text-align: center; margin-top: 24px; color: var(--text-muted); font-size: 14.5px; margin-bottom: auto; padding-bottom: 20px;">
                        Déjà un compte ? 
                        <a href="#login" class="go-to-login" style="color: var(--primary); font-weight: 700; text-decoration: none;">Se connecter</a>
                    </p>
                </div>
            </section>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const backBtn = this.querySelector('.back-to-home');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const event = new CustomEvent('navigate-home', { bubbles: true, composed: true });
                this.dispatchEvent(event);
            });
        }

        const goToLogin = this.querySelector('.go-to-login');
        if (goToLogin) {
            goToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                const event = new CustomEvent('navigate-login', { bubbles: true, composed: true });
                this.dispatchEvent(event);
            });
        }

        const togglePasswordBtn = this.querySelector('.toggle-password');
        const passwordInput = this.querySelector('#rPasswordInput');
        if (togglePasswordBtn && passwordInput) {
            togglePasswordBtn.addEventListener('click', () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                togglePasswordBtn.textContent = type === 'password' ? 'visibility_off' : 'visibility';
            });
        }

        const form = this.querySelector('#registerForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = form.querySelector('button[type="submit"]');
                const pseudo = this.querySelector('#pseudoInput').value.trim();
                const phone = this.querySelector('#rPhoneInput').value.trim();
                const password = this.querySelector('#rPasswordInput').value;

                // ── Validation côté client ──────────────────────────
                const phoneRegex = /^\+?\d{8,15}$/;
                if (!pseudo || pseudo.length < 2) {
                    this._showError(btn, 'Le pseudo doit contenir au moins 2 caractères.');
                    return;
                }
                if (!phoneRegex.test(phone)) {
                    this._showError(btn, 'Numéro invalide (chiffres uniquement, 8-15 chiffres).');
                    return;
                }
                if (password.length < 6) {
                    this._showError(btn, 'Le mot de passe doit faire au moins 6 caractères.');
                    return;
                }
                // ───────────────────────────────────────────────────

                btn.disabled = true;
                btn.innerHTML = '<i class="material-icons-round" style="animation: spin 1s linear infinite;">autorenew</i> Inscription...';

                try {
                    const { api } = await import('../../api.js');
                    await api.register(pseudo, phone, password);
                    // Connexion automatique après inscription
                    await api.login(phone, password);

                    btn.style.background = '#10b981';
                    btn.innerHTML = '<i class="material-icons-round">check</i> Compte créé !';

                    setTimeout(() => {
                        this.hide();

                        form.reset();
                        btn.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
                        btn.innerHTML = "S'inscrire";
                        btn.disabled = false;

                        import('../../utils/firebaseConfig.js').then(({ requestNotificationPermissionAndRegister }) => {
                            requestNotificationPermissionAndRegister().catch(() => {});
                        });

                        window.dispatchEvent(new CustomEvent('user-logged-in'));
                        const event = new CustomEvent('navigate-home', { bubbles: true, composed: true });
                        this.dispatchEvent(event);
                    }, 800);

                } catch (err) {
                    this._showError(btn, err.message);
                }
            });
        }

        const googleContainer = this.querySelector('#googleRegisterBtnContainer');
        const btn = form ? form.querySelector('button[type="submit"]') : null;

        const setupGoogle = () => {
            initializeGoogleAuth(
                (data) => {
                    this.hide();
                    window.dispatchEvent(new CustomEvent('user-logged-in'));
                    const event = new CustomEvent('navigate-home', { bubbles: true, composed: true });
                    this.dispatchEvent(event);
                },
                (err) => {
                    this._showError(btn, 'Échec de la connexion Google.');
                }
            );
            renderGoogleButton(googleContainer, 'signup_with');
        };

        if (window.google) {
            setupGoogle();
        } else {
            const checkGoogle = setInterval(() => {
                if (window.google) {
                    clearInterval(checkGoogle);
                    setupGoogle();
                }
            }, 100);
            setTimeout(() => clearInterval(checkGoogle), 5000);
        }
    }

    _showError(btn, message) {
        btn.disabled = false;
        btn.innerHTML = "S'inscrire";
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type: 'error' } }));
    }

    show() {
        const page = this.querySelector('#registerPage');
        if (page) {
            clearTimeout(this.hideTimeout);
            page.style.display = 'block';
            document.body.style.overflow = 'hidden';
            setTimeout(() => page.classList.add('active'), 10);
            
            const form = this.querySelector('#registerForm');
            if (form) form.reset();
            const btn = this.querySelector('#registerForm button[type="submit"]');
            if (btn) {
                btn.disabled = false;
                btn.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
                btn.innerHTML = "S'inscrire";
            }
            const pwd = this.querySelector('#registerPasswordInput');
            if (pwd) pwd.setAttribute('type', 'password');
            const toggle = this.querySelector('.toggle-password');
            if (toggle) toggle.textContent = 'visibility_off';
        }
    }

    hide() {
        const page = this.querySelector('#registerPage');
        if (page) {
            page.classList.remove('active');
            this.hideTimeout = setTimeout(() => {
                page.style.display = 'none';
                document.body.style.overflow = '';
            }, 300);
        }
    }
}

customElements.define('app-register-page', RegisterPage);
