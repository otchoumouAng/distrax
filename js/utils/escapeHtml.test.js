import { describe, it, expect } from 'vitest';
import { escapeHtml, safeUrl } from './escapeHtml.js';

describe('escapeHtml', () => {
    it('returns empty string for null or undefined', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    it('returns empty string for non-string types', () => {
        expect(escapeHtml(123)).toBe('');
        expect(escapeHtml({})).toBe('');
    });

    it('escapes ampersand', () => {
        expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('escapes less-than and greater-than', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('escapes double and single quotes', () => {
        expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
        expect(escapeHtml("'test'")).toBe('&#39;test&#39;');
    });

    it('escapes all dangerous characters together', () => {
        expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
            '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
        );
    });

    it('leaves safe text unchanged', () => {
        expect(escapeHtml('Hello world')).toBe('Hello world');
        expect(escapeHtml('Café')).toBe('Café');
    });
});

describe('safeUrl', () => {
    it('returns empty string for null or undefined', () => {
        expect(safeUrl(null)).toBe('');
        expect(safeUrl(undefined)).toBe('');
    });

    it('returns empty string for non-string', () => {
        expect(safeUrl(123)).toBe('');
    });

    it('allows https URLs', () => {
        expect(safeUrl('https://example.com')).toBe('https://example.com');
        expect(safeUrl('  https://api.dystrax.com/path  ')).toBe('https://api.dystrax.com/path');
    });

    it('allows http URLs', () => {
        expect(safeUrl('http://localhost:8000')).toBe('http://localhost:8000');
    });

    it('rejects javascript: URLs', () => {
        expect(safeUrl('javascript:alert(1)')).toBe('');
    });

    it('rejects data: URLs', () => {
        expect(safeUrl('data:text/html,<script>')).toBe('');
    });

    it('rejects relative paths without scheme', () => {
        expect(safeUrl('/assets/img.png')).toBe('');
    });
});
