/** Le QR lu n'est validé qu'après confirmation de l'organisateur. */
import { createQrReader, readQrPhoto } from '../../utils/qrReader.js';
import {
    SCAN_TARGET_KEY,
    clearOrganizerTarget,
    normalizeScanInput,
    readOrganizerTarget,
    scanErrorMessage,
} from '../../utils/organizerView.js';
import '../ui/scanner.css';

const scanIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/></svg>';
const checkIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const moreIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/></svg>';

function newIdempotencyKey() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16);
    });
}

export class ScannerPage extends HTMLElement {
    constructor() {
        super();
        this._context = {};
        this._lastValue = '';
        this._idempotencyKey = null;
        this._submitting = false;
        this._qrToken = null;
        this._cameraSession = null;
        this._photoRequest = null;
    }

    connectedCallback() {
        this.innerHTML = `
            <section class="page-section scan-page" id="scanPage" hidden>
                <header class="scan-header">
                    <button class="scan-icon" id="scanBack" type="button" aria-label="Retour">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6m-6-6h12"/></svg>
                    </button>
                    <h1>Scanner un billet</h1>
                    <button class="scan-icon" id="scanMore" type="button" aria-label="Options de lecture" aria-controls="scanOptions" aria-expanded="false">${moreIcon}</button>
                </header>
                <div class="scan-body" id="scanBody"></div>
            </section>`;
        this.querySelector('#scanBack').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
        });
    }

    show(context = {}) {
        const stored = readOrganizerTarget(SCAN_TARGET_KEY);
        clearOrganizerTarget(SCAN_TARGET_KEY);
        this._context = { desireId: context.desireId || stored || null };
        this.querySelector('#scanPage').hidden = false;
        this._beginScan();
    }

    hide() {
        this._stopCamera();
        this._photoRequest = null;
        this._qrToken = null;
        this._context = {};
        const page = this.querySelector('#scanPage');
        if (page) page.hidden = true;
    }

    disconnectedCallback() {
        this.hide();
    }

    _beginScan() {
        this._stopCamera();
        this._photoRequest = null;
        this._qrToken = null;
        this._lastValue = '';
        this._idempotencyKey = null;
        this._renderForm();
        if (!this._captureInstead) this._startCamera();
    }

    _renderForm() {
        const body = this.querySelector('#scanBody');
        if (!body) return;
        this._captureInstead = !globalThis.isSecureContext
            || typeof globalThis.navigator?.mediaDevices?.getUserMedia !== 'function';
        body.innerHTML = `
            <div class="scan-camera" id="scanCamera">
                <video id="scanVideo" playsinline muted aria-label="Aperçu de la caméra"></video>
            </div>
            <div class="scan-viewport">
                <div class="scan-aim">
                    <svg class="scan-reticle" viewBox="0 0 240 240" aria-hidden="true">
                        <path d="M3 36V18A15 15 0 0 1 18 3h18m168 0h18a15 15 0 0 1 15 15v18m0 168v18a15 15 0 0 1-15 15h-18m-168 0H18a15 15 0 0 1-15-15v-18"/>
                    </svg>
                    <span class="scan-check" id="scanDetected" hidden>${checkIcon}</span>
                </div>
                <p id="scanPrompt" role="status">Cadrez le QR</p>
            </div>
            <div class="scan-controls">
                <p id="scanFeedback" class="scan-feedback" role="status" hidden></p>
                <div class="scan-options" id="scanOptions" hidden>
                    <button id="scanPhotoBtn" type="button">Importer une photo</button>
                    <label for="scanInput">Code de secours</label>
                    <input id="scanInput" type="text" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="8 chiffres">
                </div>
                <input id="scanCapture" type="file" accept="image/*" capture="environment" hidden>
                <input id="scanPhoto" type="file" accept="image/*" hidden>
                <button class="scan-primary" id="scanCameraBtn" type="button">Scanner</button>
                <button class="scan-primary" id="scanSubmit" type="button" hidden>Valider</button>
            </div>`;

        const input = this.querySelector('#scanInput');
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this._submit();
            }
        });
        input.addEventListener('input', () => {
            this._lastValue = '';
            this._idempotencyKey = null;
            this._updateControls();
        });
        const options = this.querySelector('#scanOptions');
        const more = this.querySelector('#scanMore');
        more.hidden = false;
        more.innerHTML = moreIcon;
        more.setAttribute('aria-label', 'Options de lecture');
        more.setAttribute('aria-controls', 'scanOptions');
        more.setAttribute('aria-expanded', 'false');
        more.onclick = () => {
            if (this._qrToken) {
                if (!this._submitting) this._beginScan();
                return;
            }
            options.hidden = !options.hidden;
            more.setAttribute('aria-expanded', String(!options.hidden));
            if (!options.hidden) this._stopCamera();
            this._updateControls();
        };

        const capture = this.querySelector('#scanCapture');
        const photo = this.querySelector('#scanPhoto');
        this.querySelector('#scanCameraBtn').addEventListener('click', () => {
            if (this._captureInstead) capture.click();
            else this._startCamera();
        });
        this.querySelector('#scanPhotoBtn').addEventListener('click', () => photo.click());
        this.querySelector('#scanSubmit').addEventListener('click', () => this._submit());
        for (const picker of [capture, photo]) {
            picker.addEventListener('change', () => {
                const file = picker.files?.[0];
                picker.value = '';
                this._scanPhoto(file);
            });
        }
    }

    _updateControls() {
        const options = this.querySelector('#scanOptions');
        const manual = !options.hidden && this.querySelector('#scanInput').value.trim();
        const ready = Boolean(this._qrToken || manual);
        this.querySelector('#scanSubmit').hidden = !ready;
        this.querySelector('#scanCameraBtn').hidden = ready || Boolean(this._cameraSession?.stream);
    }

    _feedback(message, error = false) {
        const feedback = this.querySelector('#scanFeedback');
        if (!feedback) return;
        feedback.textContent = message;
        feedback.hidden = !message;
        feedback.classList.toggle('scan-feedback--error', error);
    }

    _idleFeedback(message) {
        this._feedback(message, true);
    }

    async _submit() {
        if (this._submitting) return;
        const input = this.querySelector('#scanInput');
        const parsed = normalizeScanInput(this._qrToken ?? input?.value);
        if (!parsed.kind) {
            this._idleFeedback('Scannez un billet.');
            return;
        }
        const context = this._context;
        if (!context.desireId) {
            this._idleFeedback('Aucune publication sélectionnée.');
            return;
        }
        this._stopCamera();
        this._photoRequest = null;
        this._feedback('');

        if (this._lastValue !== parsed.value || !this._idempotencyKey) {
            this._lastValue = parsed.value;
            this._idempotencyKey = newIdempotencyKey();
        }
        const idempotencyKey = this._idempotencyKey;

        this._submitting = true;
        const button = this.querySelector('#scanSubmit');
        button.disabled = true;
        button.textContent = 'Validation…';
        try {
            const { api } = await import('../../api.js');
            if (this._context !== context) return;
            const payload = parsed.kind === 'backup_code'
                ? { backupCode: parsed.value }
                : { qrToken: parsed.value };
            const checkin = await api.scanCheckin(context.desireId, {
                ...payload,
                idempotencyKey,
            });
            if (this._context !== context) return;
            this._renderSuccess(checkin);
            if (input) input.value = '';
            this._lastValue = '';
            this._idempotencyKey = null;
        } catch (error) {
            if (this._context === context) this._idleFeedback(scanErrorMessage(error));
        } finally {
            this._submitting = false;
            button.disabled = false;
            button.textContent = 'Valider';
        }
    }

    _renderSuccess() {
        this._qrToken = null;
        this.querySelector('#scanMore').hidden = true;
        const body = this.querySelector('#scanBody');
        body.innerHTML = `
            <div class="scan-viewport scan-done" role="status">
                <span class="scan-check">${checkIcon}</span>
                <h2>Billet validé</h2>
            </div>
            <div class="scan-controls">
                <button class="scan-primary" id="scanNext" type="button">Scanner le suivant</button>
            </div>`;
        const next = this.querySelector('#scanNext');
        next.addEventListener('click', () => this._beginScan());
        next.focus();
    }

    async _startCamera() {
        const container = this.querySelector('#scanCamera');
        const video = this.querySelector('#scanVideo');
        const button = this.querySelector('#scanCameraBtn');
        if (!container || !video || !button || this._cameraSession || this._submitting) return;

        this._photoRequest = null;
        this._feedback('');
        const session = { container, video, button, stream: null, timer: null };
        this._cameraSession = session;
        button.disabled = true;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } },
                audio: false,
            });
            if (this._cameraSession !== session) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            session.stream = stream;
            video.srcObject = stream;
            await video.play();
            if (this._cameraSession !== session) return;
            container.classList.add('open');
            button.hidden = true;
            const read = await createQrReader(720);
            this._detectFrame(session, read);
        } catch {
            if (this._cameraSession !== session) return;
            this._cameraFallback('Caméra indisponible.');
        }
    }

    _detectFrame(session, read) {
        if (this._cameraSession !== session) return;
        const { video } = session;
        try {
            const raw = video.readyState >= 2 ? read(video, video.videoWidth, video.videoHeight) : null;
            if (raw) {
                this._stageQr(raw);
                return;
            }
            session.timer = setTimeout(() => this._detectFrame(session, read), 250);
        } catch {
            this._cameraFallback('Lecture vidéo interrompue.');
        }
    }

    _cameraFallback(message) {
        this._stopCamera();
        this._captureInstead = true;
        this._idleFeedback(message);
    }

    async _scanPhoto(photo) {
        if (!photo || this._submitting) return;
        this._stopCamera();
        const request = {};
        this._photoRequest = request;
        this._feedback('Lecture…');
        try {
            const raw = await readQrPhoto(photo);
            if (this._photoRequest !== request) return;
            if (raw) this._stageQr(raw);
            else this._idleFeedback('QR introuvable.');
        } catch {
            if (this._photoRequest === request) this._idleFeedback('Image illisible.');
        } finally {
            if (this._photoRequest === request) this._photoRequest = null;
        }
    }

    _stageQr(raw) {
        this._stopCamera();
        this._qrToken = raw;
        this._feedback('');
        this.querySelector('#scanOptions').hidden = true;
        this.querySelector('#scanPrompt').textContent = 'QR détecté';
        this.querySelector('#scanDetected').hidden = false;
        const more = this.querySelector('#scanMore');
        more.innerHTML = scanIcon;
        more.setAttribute('aria-label', 'Rescanner');
        more.removeAttribute('aria-expanded');
        more.removeAttribute('aria-controls');
        this._updateControls();
        this.querySelector('#scanSubmit').focus();
    }

    _stopCamera() {
        const session = this._cameraSession;
        this._cameraSession = null;
        if (!session) return;
        clearTimeout(session.timer);
        session.stream?.getTracks().forEach(track => track.stop());
        session.video.srcObject = null;
        session.container.classList.remove('open');
        session.button.disabled = false;
        session.button.hidden = false;
    }
}

customElements.define('app-scan-page', ScannerPage);
