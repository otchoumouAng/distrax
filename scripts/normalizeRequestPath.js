/**
 * Canonicalise le chemin avant que Vite/Windows ne traite un double slash
 * comme un chemin UNC. Conserve la query string et les caractères encodés.
 */
export function normalizeRequestPath(req, res, next) {
    const requestUrl = req.url || '';
    if (!requestUrl.startsWith('/')) return next();

    const queryIndex = requestUrl.indexOf('?');
    const pathname = queryIndex === -1 ? requestUrl : requestUrl.slice(0, queryIndex);
    const query = queryIndex === -1 ? '' : requestUrl.slice(queryIndex);
    const normalizedPath = pathname.replace(/\/{2,}/g, '/');
    if (normalizedPath === pathname) return next();

    // Redirection temporaire : conserver la méthode sans mémoriser l'adresse
    // du serveur de développement dans le cache du navigateur.
    res.statusCode = 307;
    res.setHeader('Location', normalizedPath + query);
    res.setHeader('Cache-Control', 'no-store');
    res.end();
}
