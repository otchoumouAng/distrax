/**
 * Lambda: S3 trigger on originals/* → generate thumb (300px) and medium (800px) WebP.
 * Bucket structure: originals/<path>.<ext> → thumb/<path>.webp, medium/<path>.webp
 */

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const { Readable } = require('stream');

const BUCKET = process.env.BUCKET_NAME || process.env.S3_BUCKET_NAME;
const THUMB_MAX_WIDTH = 300;
const MEDIUM_MAX_WIDTH = 800;
const WEBP_QUALITY = 85;

const s3 = new S3Client({});

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * From key "originals/2025/abc-123.jpg" → base path "2025/abc-123" and ext ".jpg"
 */
function parseOriginalsKey(key) {
  if (!key || !key.startsWith('originals/')) return null;
  const withoutPrefix = key.slice('originals/'.length);
  const lastDot = withoutPrefix.lastIndexOf('.');
  const basePath = lastDot > 0 ? withoutPrefix.slice(0, lastDot) : withoutPrefix;
  const ext = lastDot > 0 ? withoutPrefix.slice(lastDot) : '';
  return { basePath, ext };
}

async function processImage(sourceKey) {
  const parsed = parseOriginalsKey(sourceKey);
  if (!parsed) {
    console.warn('Key not under originals/:', sourceKey);
    return;
  }
  const { basePath } = parsed;

  const getCmd = new GetObjectCommand({ Bucket: BUCKET, Key: sourceKey });
  const obj = await s3.send(getCmd);
  const body = obj.Body;
  if (!body) {
    console.warn('Empty body for', sourceKey);
    return;
  }
  const buffer = await streamToBuffer(body);

  const image = sharp(buffer);
  const meta = await image.metadata();
  const contentType = (meta.format || 'jpeg').toLowerCase();
  const isImage = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'avif'].includes(contentType);
  if (!isImage) {
    console.warn('Not an image, skip:', sourceKey, 'format:', contentType);
    return;
  }

  const thumbKey = `thumb/${basePath}.webp`;
  const mediumKey = `medium/${basePath}.webp`;

  const thumbBuffer = await sharp(buffer)
    .resize(THUMB_MAX_WIDTH, null, { withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: thumbKey,
    Body: thumbBuffer,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000',
  }));
  console.log('Written', thumbKey);

  const mediumBuffer = await sharp(buffer)
    .resize(MEDIUM_MAX_WIDTH, null, { withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: mediumKey,
    Body: mediumBuffer,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000',
  }));
  console.log('Written', mediumKey);
}

exports.handler = async (event) => {
  if (!BUCKET) {
    console.error('BUCKET_NAME or S3_BUCKET_NAME not set');
    throw new Error('Missing BUCKET_NAME');
  }
  for (const record of event.Records || []) {
    if (record.s3?.bucket?.name !== BUCKET) continue;
    const key = decodeURIComponent((record.s3?.object?.key || '').replace(/\+/g, ' '));
    if (!key.startsWith('originals/')) continue;
    try {
      await processImage(key);
    } catch (err) {
      console.error('Error processing', key, err);
      throw err;
    }
  }
  return { statusCode: 200 };
};
