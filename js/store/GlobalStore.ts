import type { AppState, FilterState } from '../types/index.js';

// Pattern Pub/Sub simple et robuste pour la gestion d'état
// On évite le Proxy pour des raisons de compatibilité TypeScript

/* eslint-disable @typescript-eslint/no-explicit-any */
type Listener = (value: any) => void;

class Store {
    private _state: AppState;
    private listeners: { [key: string]: Set<Listener> } = {};

    constructor(initialState: AppState) {
        this._state = { ...initialState };

        this._state.theme = 'light';
    }

    // Accès à l'état (getter)
    get state(): Readonly<AppState> {
        return this._state;
    }

    /**
     * Modifier une propriété du state et notifier les abonnés
     */
    public setState<K extends keyof AppState>(key: K, value: AppState[K]): void {
        const oldVal = this._state[key];
        if (oldVal === value) return;

        this._state[key] = value;

        // Persistance locale pour le thème
        if (key === 'theme') {
            localStorage.setItem('dystrax-theme', value as string);
        }

        this.notify(key as string, value);
    }

    /**
     * S'abonner aux changements d'une propriété spécifique de l'état
     * @returns Une méthode d'unsubscribe
     */
    public subscribe<K extends keyof AppState>(key: K, callback: (value: AppState[K]) => void): () => void {
        if (!this.listeners[key as string]) {
            this.listeners[key as string] = new Set();
        }
        this.listeners[key as string].add(callback as Listener);

        // Exécuter le callback immédiatement avec la valeur actuelle
        callback(this._state[key]);

        // Retourner la fonction d'unsubscribe
        return () => {
            const subs = this.listeners[key as string];
            if (subs) subs.delete(callback as Listener);
        };
    }

    private notify(key: string, value: any) {
        const subs = this.listeners[key];
        if (subs) {
            subs.forEach(cb => cb(value));
        }
    }

    /**
     * Helper pour mettre à jour un sous-filtre sans écraser tout l'objet filters
     */
    public updateFilter(filterKey: keyof FilterState, value: string | null) {
        this.setState('filters', {
            ...this._state.filters,
            [filterKey]: value
        });
    }
}

// État Initial par défaut de l'application
const initialState: AppState = {
    theme: 'light',
    user: null,
    filters: {
        category: null,
        prix: null,
        date: null,
        distance: null
    },
    isMobile: window.innerWidth <= 768
};

// Singleton : un seul Store global exporté
export const GlobalStore = new Store(initialState);

// Écouteur pour la responsivité
window.addEventListener('resize', () => {
    const isMobileNow = window.innerWidth <= 768;
    if (GlobalStore.state.isMobile !== isMobileNow) {
        GlobalStore.setState('isMobile', isMobileNow);
    }
});
