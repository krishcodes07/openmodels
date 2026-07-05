# Inline Search Citations, Unified Versioning Toolbar, Scrolling Fix, and Premium VS Code Syntax Highlighting

## Achievements
We have successfully implemented all requirements specified in `specs/08-small-features-added.md` along with high-fidelity syntax highlighting, with a clean compilation build:

1. **Inline Clickable Source Citations**:
   - Built a regex preprocessor inside `ChatMessages.tsx` to rewrite text citations like `[Source 1]` into secure https mock link URIs (`https://source.citation/1`) to prevent default markdown/React sanitization from stripping them to empty strings (`href=""`).
   - Overrode ReactMarkdown's default `a` anchor component tag to intercept both standard URL links containing `Source N` text and the custom citation mock URIs.
   - We query the message's `sources` JSON payload to map the citation indices to actual source URLs. If successful, we render a beautiful, circular favicon badge linking to the source. If `sources` is empty/unavailable, we fallback to rendering a clean, non-clickable index badge.

2. **Unified Action Toolbar**:
   - Consolidated the separate version switcher card `< 1 / 2 >` and the action buttons card (Copy, Regenerate, Sources) into a unified, premium single-pill toolbar underneath assistant responses.
   - Positioned the previous/next chevron buttons on the left of the Copy button.

3. **Settings Scrolling Fix**:
   - Removed scrolling restrictions on the Settings page caused by the global body element's `overflow: hidden` styling constraint.
   - Converted the Settings page root wrapper from `min-h-screen` to `h-screen overflow-y-auto`, restoring native scroll functionality.

4. **Premium VS Code Syntax Highlighting**:
   - Integrated `react-syntax-highlighter` using the Prism engine and the `vscDarkPlus` theme to achieve pixel-perfect VS Code style highlighting.
   - Styled code block cards with a dedicated VS Code header tab (`#252526`), code area (`#1e1e1e`), and neat border margins.
   - Overrode the `pre` component in `ReactMarkdown` to pass through code directly, avoiding double-nested `<pre>` cards and borders.

5. **Premium Markdown Style**:
   - Refactored the custom `.prose` typography styles inside `index.css` to align with the visual standards of industry-leading models (ChatGPT, Gemini, Claude).
   - Designed clean font weights, border-bottom separators for subsections, nested list-item indents, rounded table frames, distinct inline code tags, and blockquotes.

## Learnings & Patterns
- **ReactMarkdown & Custom Protocol Sanitization**: React's link sanitizers and markdown parsers automatically strip custom/unregistered URL schemes (like `source-citation://`) for security, rendering them as `href=""`. To pass metadata inside markdown links safely, use custom paths on standard secure protocols (like `https://source.citation/N`) which will bypass sanitizers.
- **ReactMarkdown Code Block Nesting**: ReactMarkdown wraps block codes with an outer `<pre>` container by default. When rendering custom code blocks with their own headers and copy buttons, we must override the `pre` renderer (`pre: (props) => <>{props.children}</>`) to dissolve the outer wrapper and prevent nested styling issues.
- **Scroll Hijacking Mitigation**: In applications using `body { overflow: hidden }` to restrict viewport scrolling to the chat pane, any side routes or full-screen panels must configure their own scrolling containers (`overflow-y-auto`) to avoid non-scrolling UI bugs.
