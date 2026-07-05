# Learnings: Vision Fix

Implemented `specs/05-vision-fix.md`.

---

## Root Cause: Wrong File Path in `localUrlToBase64`

The function in `server/src/lib/images.ts` used `path.join(__dirname, '../../../uploads', filename)`.

From `server/src/lib/`:
- `../../../uploads` resolves to `openmodels/uploads` (project root) — **DOES NOT EXIST**
- `../../uploads` resolves to `server/uploads` — **CORRECT**

Because the file was never found, `localUrlToBase64` silently returned the original `http://localhost:3001/uploads/...` URL. Remote LLM APIs (Gemini, Nvidia, etc.) cannot resolve `localhost`, so they returned 400/404/500 errors.

**Fix**: Changed the path to `../../uploads` and added debug logging so future issues are immediately visible in the server console.

## UI Fix: Image Thumbnails in Chat

- Replaced the large grid layout (`grid grid-cols-1 sm:grid-cols-2`) with compact `120×90px` thumbnails.
- Images flow right-to-left using `flex-row-reverse` to align with the user bubble's right-alignment.
- Only 2px padding around each image as requested.

## Important Notes

- **NVIDIA NIM**: Most fallback models (Llama 3.3, Nemotron, etc.) do NOT support vision. Only models with `vision` or `vl` in their ID support image input. Sending images to text-only models will still fail with 400/500 errors — this is expected behavior.
- **Gemini/OpenRouter**: Their OpenAI-compatible endpoints support `data:image/...;base64,...` format in `image_url.url` field, which is what we produce.
