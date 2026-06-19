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
                    <div style="width: 44px;"></div>
                </div>

                <div class="login-content" style="padding: 20px 24px 40px; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; min-height: calc(100svh - 80px);">
                    
                    <!-- === ÉTAPE 1 : FORMULAIRE D'INSCRIPTION === -->
                    <div id="registerStep1" style="display: flex; flex-direction: column;">
                        <div class="login-branding" style="text-align: center; margin-bottom: 30px; margin-top: auto;">
                            <img src="assets/img/logo.png" alt="Distrax Logo" style="width: 72px; height: 72px; border-radius: 20px; margin: 0 auto 20px; box-shadow: 0 10px 25px color-mix(in srgb, var(--primary) 30%, transparent); object-fit: cover;">
                            <h1 style="font-size: 28px; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">Créer un compte</h1>
                            <p style="color: var(--text-muted); font-size: 15px;">Rejoignez l'aventure Dystrax !</p>
                        </div>

                        <div class="social-login" id="googleRegisterBtnContainer" style="margin-bottom: 24px; min-height: 52px; display: flex; justify-content: center;">
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
                                    <input type="tel" id="rPhoneInput" class="form-input" placeholder="Ex: +2250102030405" style="padding-left: 48px;" required>
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

                    <!-- === ÉTAPE 2 : VÉRIFICATION OTP === -->
                    <div id="registerStep2" style="display: none; flex-direction: column;">
                        <div class="login-branding" style="text-align: center; margin-bottom: 30px; margin-top: auto;">
                            <img src="assets/img/logo.png" alt="Distrax Logo" style="width: 72px; height: 72px; border-radius: 20px; margin: 0 auto 20px; box-shadow: 0 10px 25px color-mix(in srgb, var(--primary) 30%, transparent); object-fit: cover;">
                            <h1 style="font-size: 28px; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">Vérification</h1>
                            <p style="color: var(--text-muted); font-size: 15px;" id="otpMessage">Un code d'activation a été envoyé par SMS/WhatsApp.</p>
                        </div>

                        <form id="otpForm" style="display: flex; flex-direction: column; gap: 16px;">
                            <div class="form-group">
                                <label class="form-label">Code d'activation</label>
                                <div style="position: relative;">
                                    <i class="material-icons-round" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-light);">pin</i>
                                    <input type="text" id="otpInput" class="form-input" placeholder="Entrez le code à 6 chiffres" style="padding-left: 48px; font-size: 20px; letter-spacing: 8px; text-align: center;" maxlength="6" inputmode="numeric" required>
                                </div>
                            </div>

                            <button type="submit" class="otp-submit-btn" style="background: linear-gradient(135deg, var(--primary), var(--primary-light)); color: white; border: none; padding: 18px; border-radius: 16px; font-weight: 700; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s; box-shadow: 0 8px 25px color-mix(in srgb, var(--primary) 40%, transparent); margin-top: 8px;">
                                Vérifier
                            </button>
                        </form>

                        <button class="otp-back-btn" style="background: transparent; color: var(--text-muted); border: 1px solid var(--border-light); padding: 12px; border-radius: 12px; font-size: 14px; cursor: pointer; margin-top: 12px; text-align: center;">
                            ← Modifier les informations
                        </button>
                    </div>

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

        // ── ÉTAPE 1 : Inscription ──────────────────────────────
        const registerForm = this.querySelector('#registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = registerForm.querySelector('button[type="submit"]');
                const pseudo = this.querySelector('#pseudoInput').value.trim();
                const phone = this.querySelector('#rPhoneInput').value.trim();
                const password = this.querySelector('#rPasswordInput').value;

                const phoneRegex = /^\+?\d{8,15}$/;
                if (!pseudo || pseudo.length < 2) {
                    this._showToast('Le pseudo doit contenir au moins 2 caractères.', 'error');
                    return;
                }
                if (!phoneRegex.test(phone)) {
                    this._showToast('Numéro invalide (chiffres uniquement, 8-15 chiffres).', 'error');
                    return;
                }
                if (password.length < 6) {
                    this._showToast('Le mot de passe doit faire au moins 6 caractères.', 'error');
                    return;
                }

                btn.disabled = true;
                btn.innerHTML = '<i class="material-icons-round" style="animation: spin 1s linear infinite;">autorenew</i> Inscription...';

                try {
                    const { api } = await import('../../api.js');
                    await api.register(pseudo, phone, password);

                    // Sauvegarde les identifiants pour la connexion après OTP
                    this._pendingLogin = { phone, password };

                    // Passe à l'étape OTP
                    this._showOtpStep(phone);

                } catch (err) {
                    btn.disabled = false;
                    btn.innerHTML = "S'inscrire";
                    this._showToast(err.message, 'error');
                }
            });
        }

        // ── ÉTAPE 2 : Vérification OTP ─────────────────────────
        const otpForm = this.querySelector('#otpForm');
        if (otpForm) {
            otpForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = otpForm.querySelector('.otp-submit-btn');
                const otpCode = this.querySelector('#otpInput').value.trim();

                if (otpCode.length < 4) {
                    this._showToast('Veuillez entrer le code complet.', 'error');
                    return;
                }

                btn.disabled = true;
                btn.innerHTML = '<i class="material-icons-round" style="animation: spin 1s linear infinite;">autorenew</i> Vérification...';

                try {
                    const { api } = await import('../../api.js');
                    const phone = this._pendingLogin.phone;
                    await api.verifyOtp(phone, otpCode);

                    // OTP vérifié → connexion automatique
                    const { phone: p, password: pw } = this._pendingLogin;
                    await api.login(p, pw);

                    btn.style.background = '#10b981';
                    btn.innerHTML = '<i class="material-icons-round">check</i> Compte activé !';

                    setTimeout(() => {
                        this.hide();
                        this._resetAll();

                        import('../../utils/firebaseConfig.js').then(({ requestNotificationPermissionAndRegister }) => {
                            requestNotificationPermissionAndRegister().catch(() => {});
                        });

                        window.dispatchEvent(new CustomEvent('user-logged-in'));
                        const event = new CustomEvent('navigate-home', { bubbles: true, composed: true });
                        this.dispatchEvent(event);
                    }, 800);

                } catch (err) {
                    btn.disabled = false;
                    btn.innerHTML = 'Vérifier';
                    this._showToast(err.message, 'error');
                }
            });
        }

        // Bouton retour (étape 2 → étape 1)
        const otpBackBtn = this.querySelector('.otp-back-btn');
        if (otpBackBtn) {
            otpBackBtn.addEventListener('click', () => {
                this._showRegisterStep();
            });
        }

        // Google Sign-In
        const googleContainer = this.querySelector('#googleRegisterBtnContainer');

        const setupGoogle = () => {
            initializeGoogleAuth(
                (data) => {
                    this.hide();
                    window.dispatchEvent(new CustomEvent('user-logged-in'));
                    const event = new CustomEvent('navigate-home', { bubbles: true, composed: true });
                    this.dispatchEvent(event);
                },
                (err) => {
                    this._showToast('Échec de la connexion Google.', 'error');
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

    // ── Navigation entre étapes ──────────────────────────────────

    _showOtpStep(phone) {
        const step1 = this.querySelector('#registerStep1');
        const step2 = this.querySelector('#registerStep2');
        if (step1) step1.style.display = 'none';
        if (step2) step2.style.display = 'flex';

        // Message personnalisé
        const otpMsg = this.querySelector('#otpMessage');
        if (otpMsg) {
            otpMsg.textContent = `Un code d'activation a été envoyé au ${phone} par SMS/WhatsApp.`;
        }

        // Focus sur l'input OTP
        setTimeout(() => {
            const otpInput = this.querySelector('#otpInput');
            if (otpInput) otpInput.focus();
        }, 300);
    }

    _showRegisterStep() {
        const step1 = this.querySelector('#registerStep1');
        const step2 = this.querySelector('#registerStep2');
        if (step1) step1.style.display = 'flex';
        if (step2) step2.style.display = 'none';

        const otpInput = this.querySelector('#otpInput');
        if (otpInput) otpInput.value = '';

        const otpBtn = this.querySelector('.otp-submit-btn');
        if (otpBtn) {
            otpBtn.disabled = false;
            otpBtn.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
            otpBtn.innerHTML = 'Vérifier';
        }

        const regBtn = this.querySelector('#registerForm button[type="submit"]');
        if (regBtn) {
            regBtn.disabled = false;
            regBtn.innerHTML = "S'inscrire";
        }
    }

    _resetAll() {
        const registerForm = this.querySelector('#registerForm');
        if (registerForm) registerForm.reset();

        const otpInput = this.querySelector('#otpInput');
        if (otpInput) otpInput.value = '';

        const regBtn = this.querySelector('#registerForm button[type="submit"]');
        if (regBtn) {
            regBtn.disabled = false;
            regBtn.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
            regBtn.innerHTML = "S'inscrire";
        }

        const otpBtn = this.querySelector('.otp-submit-btn');
        if (otpBtn) {
            otpBtn.disabled = false;
            otpBtn.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
            otpBtn.innerHTML = 'Vérifier';
        }

        this._showRegisterStep();
        this._pendingLogin = null;
    }

    _showToast(message, type) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
    }

    show() {
        const page = this.querySelector('#registerPage');
        if (page) {
            clearTimeout(this.hideTimeout);
            page.style.display = 'block';
            document.body.style.overflow = 'hidden';
            setTimeout(() => page.classList.add('active'), 10);

            this._resetAll();
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
