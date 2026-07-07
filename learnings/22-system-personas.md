# System Prompt Personas & Gallery Implementation Learnings

## Overview
We implemented the **Custom Personas & System Prompt Gallery** feature, allowing users to browse a library of pre-built personas and create, upload icons for, and converse with custom ones.

## 1. Database & Seeding Architecture
- **Schema Expansion**: Added the `Persona` model with an optional relation to `User` (for user-created templates) and a one-to-many relation to `Conversation` via `personaId`.
- **JSON-Driven Seeding**: Built-in system personas are stored in a centralized JSON file (`server/src/features/personas/prebuilt_personas.json`).
- **Dynamic Syncing**: Created an upsert-like sync loop on startup:
  - Pre-built templates are loaded from the JSON.
  - Deleted entries are automatically pruned from the database.
  - Existing entries are updated in place to match description, image URL, and prompt changes.
  - New entries are appended safely without breaking foreign key relations in active chats.

## 2. Dynamic Instruction Interception
- **System Injection**: During stream creation, regeneration, or edits, the server inspects the active conversation's `personaId`. If present, its custom prompt is retrieved and prepended as the primary `SYSTEM` prompt to the LLM completion API payload.

## 3. Sidebar Integration & Desktop View
- **Layout Unification**: Wrapped the personas gallery and full-screen creation view in the standard application layout structure containing the `Sidebar` component.
- **Persistent Visibility**: The chat history sidebar is now persistently visible on the left side on desktop viewports.
- **Header Toggle Control**: Added a toggle button (`PanelLeft`) in the header that displays when the sidebar is collapsed, matching the primary chat workspace behavior.

## 4. Mobile Responsiveness & Form Adaptability
- **Drawer Transformation**: On mobile viewports (widths under `768px`), the sidebar automatically collapses into a backdrop-shadowed drawer menu, accessible by the menu button in the header.
- **Responsive Padding & Spacing**: Form elements and layouts use responsive classes (`px-4 sm:px-6`, `py-6 sm:py-8`, and `gap-2 sm:gap-4`) to maximize readable area on screen sizes down to 320px.
- **Avatar Uploader Scaling**: The circular image uploader scales from `w-20 h-20` on mobile viewports to `w-24 h-24` on desktop, maintaining usability.

## 5. Circular Avatar Upload & Canvas Compression
- **No-Storage Uploads**: Implemented client-side file reading to convert uploaded avatar images to Base64 data URLs.
- **HTML5 Canvas Processing**: Before saving, the file is automatically:
  - Center-cropped to a perfect 1:1 square.
  - Scaled down to `200x200` pixels.
  - Compressed as JPEG at `85%` quality.
- This creates tiny, fast-loading image payloads (typically under 10KB) stored directly in the SQLite `String` column, bypassing the need for dedicated asset/S3 buckets.
- Fallback text badges automatically render the first two uppercase letters of the persona name if no image URL is present.

## 6. Gallery UI Improvements (v2)
- **Search & Filter**: Added a search input with real-time filtering across persona name and description. Clear button appears when query is active. Empty-state messaging shown when no results match.
- **Tab Navigation Redesign**: Replaced plain text tabs with a pill-style segmented control using `bg-bg-secondary` container and `bg-accent/15` active state. Added icons (`Bot`, `User`) to tabs for visual clarity.
- **Persona Card Enhancements**:
  - Cards now use `rounded-2xl` with `bg-bg-secondary/60 backdrop-blur-sm` for glassmorphism effect.
  - Gradient overlay (`from-accent/5 to-transparent`) fades in on hover for visual depth.
  - Lift effect (`hover:-translate-y-0.5`) with shadow transition (`shadow-sm hover:shadow-md`).
  - "Start Chat" CTA is hidden by default and reveals with `opacity-0 group-hover:opacity-100` + slide-up animation.
  - Avatar ring effect on hover (`ring-2 ring-transparent group-hover:ring-accent/30`).
  - Staggered animation delay per card (`animationDelay: ${i * 40}ms`).
- **Responsive Grid**: Upgraded from 2-column to 3-column layout at `lg` breakpoint (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`).
- **Creation Form Polish**:
  - Added `Wand2` icon to form header for visual distinction.
  - Character count warnings change to `text-warning` color when nearing limits (18/20, 70/80, 900/1000).
  - Submit button disabled when required fields are empty (`disabled={!name.trim() || ...}`).
  - Error display includes `X` icon for dismissible-style messaging.
  - Avatar upload area increased to `w-24 h-24 sm:w-28 sm:h-28` with hover scale on the edit badge.
- **Empty States**:
  - Search empty: magnifying glass icon with query reference text.
  - Custom empty: larger gradient icon, "Get Started" CTA with arrow animation.
  - Auth-gated: gradient background on shield icon, clearer copy about benefits.

## 7. Local Persona Image Hosting
- **Problem**: Prebuilt personas used Wikimedia `thumb/` URLs which broke due to hotlinking restrictions and incorrect path formats.
- **Solution**: Created `client/public/personas/` folder with 12 local `.jpg` files. Updated `prebuilt_personas.json` to use `/personas/*.jpg` paths served by Vite from `client/public/`.
- **Image resolution in components**: The condition `imageUrl.startsWith('http') || imageUrl.startsWith('data:')` was too restrictive — it excluded local paths like `/personas/elon-musk.jpg`. Simplified to just `imageUrl ?` (truthy check) in all three locations:
  - `Sidebar.tsx` — conversation list items
  - `ChatHeader.tsx` — active persona badge
  - `ChatMessages.tsx` — assistant message bubbles
- **Category field**: Added `category` to `Persona` model in Prisma schema and `prebuilt_personas.json`. Categories: Innovators, History, Fiction, Companion. Filtered via pill tabs in personas page UI.
