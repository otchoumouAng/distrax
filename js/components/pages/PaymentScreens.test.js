import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ cancel: vi.fn(), scan: vi.fn(), confirm: vi.fn() }));
vi.mock('../../api.js', () => ({ api: { cancelBooking: mocks.cancel, scanCheckin: mocks.scan } }));
vi.mock('../../utils/confirm.js', () => ({ showConfirm: mocks.confirm }));
let TicketPage, ScannerPage;
beforeAll(async () => {
    globalThis.HTMLElement = class {};
    globalThis.customElements = { define: vi.fn() };
    ({TicketPage} = await import('./TicketPage.js'));
    ({ScannerPage} = await import('./ScannerPage.js'));
});
beforeEach(() => { vi.clearAllMocks(); mocks.confirm.mockResolvedValue(true); });
function ticketPage() {
    const page = new TicketPage();
    page._booking = {id:'booking-1',allowed_actions:['cancel']};
    page._ticket = {status:'active',qr_token:'opaque'};
    page._renderTicket = vi.fn();
    page.querySelector = vi.fn(() => ({disabled:false,textContent:''}));
    return page;
}
describe('annulation depuis le billet', () => {
    it('ne demande aucun remboursement lorsque le participant garde sa place', async () => {
        const page = ticketPage(); mocks.confirm.mockResolvedValue(false);
        await page._cancelBooking();
        expect(mocks.cancel).not.toHaveBeenCalled();
        expect(page._ticket.qr_token).toBe('opaque');
    });
    it('conserve le QR en cas de réponse incertaine et réutilise la même clé au nouvel essai', async () => {
        const page = ticketPage();
        mocks.cancel.mockRejectedValueOnce(new Error('Réseau interrompu')).mockResolvedValueOnce({id:'refund',status:'requested'});
        await page._cancelBooking();
        expect(page._ticket.status).toBe('active');
        await page._cancelBooking();
        expect(mocks.cancel.mock.calls[0][1].idempotencyKey).toBe(mocks.cancel.mock.calls[1][1].idempotencyKey);
        expect(page._ticket.qr_token).toBeNull();
        expect(page._ticket.status).toBe('void');
        expect(page._refund.status).toBe('requested');
    });
    it('ignore un second clic pendant la confirmation', async () => {
        const page = ticketPage();
        let resolveConfirm; mocks.confirm.mockImplementation(() => new Promise(resolve => {resolveConfirm=resolve;}));
        const first = page._cancelBooking();
        await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1));
        await page._cancelBooking();
        resolveConfirm(false); await first;
        expect(mocks.confirm).toHaveBeenCalledTimes(1);
        expect(mocks.cancel).not.toHaveBeenCalled();
    });
    it('respecte les actions autorisées par le serveur', async () => {
        const page = ticketPage();page._booking.allowed_actions=[];
        await page._cancelBooking();expect(mocks.confirm).not.toHaveBeenCalled();
    });
});
describe('validation d’entrée', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('ne montre pas de réussite sur erreur et conserve la clé pour réessayer', async () => {
        const page = new ScannerPage();const input={value:'12345678'};const button={};
        page._context={desireId:'event'};
        page.querySelector = selector => ({
            '#scanInput': input, '#scanSubmit': button,
        })[selector] || null;
        page._idleFeedback=vi.fn();page._renderSuccess=vi.fn();
        mocks.scan.mockRejectedValueOnce(new Error('Réseau interrompu')).mockResolvedValueOnce({organizer_credit:4500});
        await page._submit();expect(page._renderSuccess).not.toHaveBeenCalled();
        await page._submit();
        expect(mocks.scan.mock.calls[0][1].idempotencyKey).toBe(mocks.scan.mock.calls[1][1].idempotencyKey);
        expect(page._renderSuccess).toHaveBeenCalledWith({organizer_credit:4500});
        expect(input.value).toBe('');
    });

    it('attend le clic sur Valider après avoir lu le QR', async () => {
        const page = new ScannerPage();
        page._context = { desireId: 'event' };
        const submit = { hidden: true, focus: vi.fn() };
        const scanner = { hidden: false };
        const status = {};
        const more = { setAttribute: vi.fn(), removeAttribute: vi.fn() };
        page.querySelector = selector => ({
            '#scanOptions': { hidden: true },
            '#scanPrompt': status,
            '#scanDetected': {},
            '#scanMore': more,
            '#scanSubmit': submit,
            '#scanCameraBtn': scanner,
        })[selector] || null;
        page._renderSuccess = vi.fn();
        mocks.scan.mockResolvedValueOnce({});

        page._stageQr('ticket-qr');
        expect(status.textContent).toBe('QR détecté');
        expect(submit.hidden).toBe(false);
        expect(scanner.hidden).toBe(true);
        expect(mocks.scan).not.toHaveBeenCalled();

        await page._submit();
        expect(mocks.scan).toHaveBeenCalledOnce();
        expect(mocks.scan).toHaveBeenCalledWith(
            'event', expect.objectContaining({ qrToken: 'ticket-qr' }),
        );
    });

    it('arrête une caméra dont l’autorisation arrive après la fermeture du scanner', async () => {
        const page = new ScannerPage();
        const track = { stop: vi.fn() };
        const video = { srcObject: null };
        const container = { classList: { add: vi.fn(), remove: vi.fn() } };
        const button = { disabled: false };
        page.querySelector = selector => ({
            '#scanCamera': container, '#scanVideo': video, '#scanCameraBtn': button,
        })[selector] || null;
        let allowCamera;
        vi.stubGlobal('navigator', {
            mediaDevices: { getUserMedia: () => new Promise(resolve => { allowCamera = resolve; }) },
        });

        const opening = page._startCamera();
        page.hide();
        allowCamera({ getTracks: () => [track] });
        await opening;

        expect(track.stop).toHaveBeenCalledTimes(1);
        expect(container.classList.add).not.toHaveBeenCalled();
        expect(video.srcObject).toBeNull();
        expect(button.disabled).toBe(false);
    });
});
