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
                        <div style="width: 72px; height: 72px; background: linear-gradient(135deg, var(--primary), var(--primary-light)); border-radius: 20px; display: flex; align-items: center; justify-content: center; color: white; margin: 0 auto 20px; box-shadow: 0 10px 25px color-mix(in srgb, var(--primary) 30%, transparent); flex-shrink: 0;">
                            <i class="material-icons-round" style="font-size: 36px;">interests</i>
                        </div>
                        <h1 style="font-size: 28px; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">Créer un compte</h1>
                        <p style="color: var(--text-muted); font-size: 15px;">Rejoignez l'aventure Distrax !</p>
                    </div>

                    <div class="social-login" style="margin-bottom: 24px;">
                        <button class="google-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 12px; background: var(--bg-card); border: 1px solid var(--border-light); padding: 16px; border-radius: 16px; font-size: 15px; font-weight: 600; color: var(--text-main); cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
                            <svg viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"></path>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"></path>
                            </svg>
                            S'inscrire avec Google
                        </button>
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
                const event = new CustomEvent('navigate-back', { bubbles: true, composed: true });
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
                        window.dispatchEvent(new CustomEvent('user-logged-in'));
                        const event = new CustomEvent('navigate-home', { bubbles: true, composed: true });
                        this.dispatchEvent(event);
                    }, 800);

                } catch (err) {
                    this._showError(btn, err.message);
                }
            });
        }

        const googleBtn = this.querySelector('.google-btn');
        if (googleBtn) {
            googleBtn.addEventListener('click', () => {
                alert("Redirection vers Google Auth en cours...");
            });
        }
    }

    _showError(btn, message) {
        btn.disabled = false;
        btn.style.background = '#ef4444';
        btn.innerHTML = `<i class="material-icons-round">error</i> ${message}`;
        setTimeout(() => {
            btn.style.background = '';
            btn.innerHTML = "S'inscrire";
        }, 3500);
    }

    show() {
        const page = this.querySelector('#registerPage');
        if (page) {
            clearTimeout(this.hideTimeout);
            page.style.display = 'block';
            document.body.style.overflow = 'hidden';
            setTimeout(() => page.classList.add('active'), 10);
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
