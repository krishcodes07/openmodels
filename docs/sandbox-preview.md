# Interactive Preview Sandbox

The OpenModels client includes a custom **Interactive Preview Sandbox** (`client/src/features/chat/SandboxPanel.tsx`) that compiles and executes standalone code snippets (HTML, CSS, JavaScript, and SVG) in real time inside a secure iframe environment.

---

## 🚀 Sandbox Features

The Sandbox panel splits into two primary interfaces:
1. **Interactive Preview**: Live rendering of code with automatic scripts execution and utility features.
2. **Code Editor**: A Monaco Editor instance allowing real-time edits, code folding, and autocomplete.

### Additional Utilities
- **Draggable Resizing**: Users can grab the left border to resize the sandbox from `320px` to `85%` of the viewport width. Setting states are saved to `localStorage` (`sandboxWidth`).
- **Reset Code**: Instantly restores the user's modifications back to the original LLM response text.
- **Direct Downloads**: Generates client-side blob URLs matching the output syntax extension (e.g. `.html`, `.svg`, `.js`) for easy saving.
- **Copy**: Direct Clipboard API integration.
- **Hot Reloading / Auto Compile**: Debounces updates for `800ms` after typing in the code editor, then re-injects the preview DOM to refresh.

---

## ⚙️ Compilation Template

The sandbox constructs the iframe document dynamically using the `getIframeSrcDoc` compiler helper.

### 🌐 HTML / JS / CSS Compiler
If the compiled string does not contain core wrapper elements like `<!doctype html>`, `<html>`, or `<body>`, the sandbox injects it into a premium boiler-plate framework:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    
    <!-- Injected Global CDNs -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background-color: #ffffff;
        color: #1f2937;
        padding: 1.5rem;
      }
    </style>
  </head>
  <body>
    <!-- USER GENERATED CODE -->
    ${code}
    
    <!-- Automatic Lucide Icon Initializer -->
    <script>
      setTimeout(() => {
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }, 100);
    </script>
  </body>
</html>
```

### 🎨 SVG Rendering
If the code is identified as SVG (using language tags or starting with `<svg`), the compiler formats it inside a canvas helper centered in the preview screen:

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        margin: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background-color: #f5f5f7;
        background-image: radial-gradient(#d1d1d6 1px, transparent 1px);
        background-size: 20px 20px;
        overflow: auto;
      }
      svg {
        max-width: 95vw;
        max-height: 95vh;
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.08));
      }
    </style>
  </head>
  <body>
    ${code}
  </body>
</html>
```

---

## 🔒 Security & Sandbox Isolation

To prevent malicious cross-site scripting (XSS) or browser redirection exploits, the preview iframe uses strict HTML5 `sandbox` flags:

```html
<iframe
  srcDoc={srcDoc}
  sandbox="allow-scripts allow-modals"
  className="flex-1 border-none w-full bg-white"
/>
```

- **`allow-scripts`**: Permits JavaScript executions inside the iframe (necessary for interactive widgets).
- **`allow-modals`**: Allows alert popups or modals.
- **Omission of `allow-same-origin`**: **Crucial for security**. Without this flag, the iframe is treated as a separate unique origin. It cannot access cookies, localStorage, indexedDB, or the parent window objects of the host client application. This fully sandboxes model outputs from tampering with credentials or sessions.
