/** Décode les images et les trames vidéo dans le navigateur. */
export async function createQrReader(maxEdge) {
    const { default: jsQR } = await import('jsqr');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas indisponible');

    return (source, width, height) => {
        if (!width || !height) return null;
        const scale = Math.min(1, maxEdge / Math.max(width, height));
        const scaledWidth = Math.max(1, Math.round(width * scale));
        const scaledHeight = Math.max(1, Math.round(height * scale));
        if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
            canvas.width = scaledWidth;
            canvas.height = scaledHeight;
        }
        context.drawImage(source, 0, 0, scaledWidth, scaledHeight);
        const { data } = context.getImageData(0, 0, scaledWidth, scaledHeight);
        return jsQR(data, scaledWidth, scaledHeight)?.data || null;
    };
}

export async function readQrPhoto(file) {
    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const read = await createQrReader(1800);
        return read(image, image.naturalWidth, image.naturalHeight);
    } finally {
        URL.revokeObjectURL(url);
    }
}
