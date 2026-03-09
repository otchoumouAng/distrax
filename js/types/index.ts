// Types pour l'ensemble de l'application Distrax

export type AppTheme = 'light' | 'dark';

export interface User {
    id: string;
    pseudo: string;
    phone?: string;
    token?: string;
    avatarUrl?: string;
}

export interface FilterState {
    category: string | null;
    prix: string | null;
    date: string | null;
    distance: string | null;
}

export interface AppState {
    theme: AppTheme;
    user: User | null;
    filters: FilterState;
    isMobile: boolean;
}
