import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const { api } = vi.hoisted(() => ({
    api: {
        getDesire: vi.fn(),
        getBoostPayment: vi.fn(),
        isAuthenticated: vi.fn(() => true),
        checkoutBoost: vi.fn(),
    },
}));

vi.mock('../../api.js', () => ({ api }));

let BoostPage;

beforeAll(async () => {
    globalThis.HTMLElement = class {};
    globalThis.customElements = { define: vi.fn() };
    ({ BoostPage } = await import('./BoostPage.js'));
});

describe('BoostPage — paiement', () => {
    afterEach(() => vi.unstubAllGlobals());

    function createPage() {
        const page = new BoostPage();
        const status = { textContent: '', hidden: true };
        const button = { textContent: '', disabled: true };
        page._desireId = 'publication';
        page._selectedPlanId = '24h';
        page._price = 1500;
        page.querySelector = selector => selector === '#boostCheckoutStatus' ? status : button;
        return { page, status, button };
    }

    it('bloque le paiement et affiche le motif donné par le serveur', async () => {
        const reason = 'La date de cette activité est passée.';
        api.getDesire.mockResolvedValue({ boost_unavailable_reason: reason });
        api.getBoostPayment.mockResolvedValue(null);
        const { page, status, button } = createPage();

        await page._loadEligibility('publication', Promise.resolve());

        expect(status.textContent).toBe(reason);
        expect(status.hidden).toBe(false);
        expect(button.disabled).toBe(true);
    });

    it('autorise la reprise d’un paiement pour une activité éligible', async () => {
        api.getDesire.mockResolvedValue({ boost_unavailable_reason: null });
        api.getBoostPayment.mockResolvedValue({
            status: 'pending', price_xof: 1500, checkout_url: 'https://pay.jeko.africa/pay',
        });
        const { page, button } = createPage();

        await page._loadEligibility('publication', Promise.resolve());

        expect(button.disabled).toBe(false);
        expect(button.textContent).toMatch(/^Reprendre le paiement/);
    });

    it.each([
        ['CinetPay', 'https://checkout.cinetpay.com/payment/test'],
        ['Jèko', 'https://pay.jeko.africa/pay_request/pr/test'],
    ])('redirige vers le checkout %s après le clic sur Payer le boost', async (_provider, checkoutUrl) => {
        const { page, button } = createPage();
        const listeners = {};
        button.addEventListener = (event, handler) => { listeners[event] = handler; };
        page.querySelectorAll = () => [];
        const renderQuery = page.querySelector;
        page.querySelector = selector => (
            ['#boostCheckoutStatus', '#boostLaunchBtn'].includes(selector) ? renderQuery(selector) : null
        );

        const assign = vi.fn();
        const setItem = vi.fn();
        vi.stubGlobal('window', { location: { assign } });
        vi.stubGlobal('sessionStorage', { setItem });
        api.checkoutBoost.mockResolvedValue({
            id: 'paiement-test',
            status: 'pending',
            price_xof: 1500,
            checkout_url: checkoutUrl,
        });
        page._renderCheckout(null);
        page.setupEventListeners();

        expect(button.textContent).toBe('Payer le boost');
        await listeners.click();

        expect(api.checkoutBoost).toHaveBeenLastCalledWith(expect.objectContaining({
            desire_id: 'publication', duration_id: '24h', zone: 'commune',
        }));
        expect(setItem).toHaveBeenCalledWith(
            'distrax-pending-boost',
            JSON.stringify({ id: 'paiement-test', desireId: 'publication' }),
        );
        expect(assign).toHaveBeenCalledTimes(1);
        expect(assign).toHaveBeenCalledWith(checkoutUrl);
    });
});
