import fs from 'fs';
import path from 'path';

/**
 * Converts a local file path/url (e.g. /uploads/...) to a Base64 data URL
 * so that cloud LLMs (Gemini, Groq, OpenRouter, Nvidia) can read the image data.
 *
 * Path: from server/src/lib → ../../uploads → server/uploads
 */
export function localUrlToBase64(url: string): string {
  try {
    if (url.includes('/uploads/')) {
      const filename = url.split('/uploads/').pop();
      if (!filename) return url;

      const filePath = path.join(__dirname, '../../uploads', filename);
      console.log(`[Vision] Converting local image: ${filename} (exists: ${fs.existsSync(filePath)})`);

      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const ext = path.extname(filename).toLowerCase().replace('.', '');
        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
        const b64 = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
        console.log(`[Vision] Converted to base64 (${(b64.length / 1024).toFixed(0)}KB data URL)`);
        return b64;
      } else {
        console.error(`[Vision] File not found at: ${filePath}`);
      }
    }
  } catch (err) {
    console.error('[Vision] Failed to convert local URL to base64:', err);
  }
  return url;
}
