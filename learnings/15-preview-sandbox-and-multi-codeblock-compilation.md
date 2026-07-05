# Interactive Code Preview Sandbox & Multi-Code Block Merging

## Context & Objectives
To enable a rich, interactive preview sandbox (similar to Claude Artifacts) that allows users to instantly visualize web code (HTML, CSS, JavaScript, SVG) in an adjacent side-by-side panel sliding out from the right.

## Key Learnings & Decisions

### 1. Restriction to HTML Entries
- **Decision:** The "Preview Sandbox" button is now restricted to only show on HTML code blocks (including code blocks with document tags like `<!DOCTYPE html>` or `<html>`).
- **Rationale:** Since HTML represents the visual entryway of a page, it acts as the primary toggle for sandbox previews.

### 2. Multi-Code Block Integration
- **Concept:** Assistants often output related HTML, CSS, and JS across three distinct markdown code blocks instead of one consolidated snippet.
- **Implementation:** Added a Markdown preprocessor/parser (`parseCodeBlocks`) inside `ChatMessages.tsx` that scans the entire parent message content for code blocks.
- **Merging logic:** 
  - HTML content is injected directly into the `<body>`.
  - CSS content is wrapped inside a `<style>` block in the `<head>`.
  - JS/JavaScript content is placed in a `<script>` tag before the closing `</body>` tag.
- This creates a fully unified document, allowing the editor tab to display and modify everything in one unified viewport.

### 3. JavaScript Execution in Sandboxed Iframes
- **Origin Isolation (CORS/CDN):** Without the `allow-same-origin` token inside the iframe's `sandbox` property, scripts loaded via CDN (like Tailwind CSS and Lucide Icons) are blocked or restricted. Adding `allow-same-origin` resolves this.
- **Ready State & CDN Race Condition:** Inline JavaScript can execute before external CDNs are fully ready. Wrapping the script inside a ready-state loader (running it on `DOMContentLoaded` or after interactive state with a short buffer) guarantees library initializations succeed.
- **Re-Execution on Code Edit (Iframe Key Debounce):** Browsers block script re-execution if the iframe's `srcdoc` property is updated without remounting the frame. Added a typing debounce (800ms) and tab-switching key increment to automatically remount the iframe and re-run modified scripts cleanly.
