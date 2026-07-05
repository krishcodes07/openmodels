# 🌟 OpenModels

OpenModels is a premium, open-source AI playground and chat interface that allows users to connect with and chat across multiple AI models (such as GPT-4o, Gemini 2.5, DeepSeek, Llama, and more) using either platform-managed API keys or their own credentials.

Designed for developers, researchers, and AI enthusiasts, OpenModels features an **Interactive Preview Sandbox** for real-time web development previewing, a responsive mobile-friendly interface, web search capabilities, and local/guest persistence.

---

## ✨ Features

- **🔌 Multi-Provider Support**: Seamlessly switch between GitHub Models, Google Gemini, OpenAI, Anthropic, and other major providers.
- **⚡ Atomic Provider-Model Switcher**: An elegant, synchronized provider and model transition UI with live loaders.
- **🛠️ Interactive Preview Sandbox**: Runs standalone HTML, CSS, JavaScript, and SVG codes directly within an inline frame. Includes live-reload, error handling, copy, and file download support.
- **🔍 Web Search & Deep Think**: Enhance queries with real-time web search results (powered by Firecrawl) and Deep Thinking models (e.g., DeepSeek R1).
- **📂 Responsive Sidebar & Backdrop**: A fully responsive sidebar navigation that collapses into a drawer overlay on mobile viewports (<768px), accompanied by a blur backdrop.
- **📱 Mobile-Optimized Layouts**: Compact headers, scroll-independent setting tabs, and responsive dialogs designed specifically for viewports as small as 320px.
- **🔒 Secure API Key Management**: Bring your own API keys to bypass server rate limits. Keys are encrypted at rest using AES-256-GCM.
- **👤 Guest Session Persistence**: Chat instantly without signing up. Guest sessions save up to 5 messages to local storage and support AI title generation.

---

## 🛠️ Technology Stack

### Client (Frontend)
- **Framework**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS v4 (with harmonized CSS variables)
- **State Management**: Zustand
- **Markdown & Code**: React-Markdown, Remark-GFM, Prism Syntax Highlighter
- **Icons**: Lucide React

### Server (Backend)
- **Framework**: Express, Node.js, TypeScript
- **Database**: SQLite (managed with Prisma ORM)
- **Authentication**: JSON Web Token (JWT) with optional HTTP-only cookie storage
- **Security**: AES-256-GCM encryption for stored API keys
- **Media**: Multer memory storage for base64 image uploads

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/)

### Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/openmodels.git
   cd openmodels
   ```

2. **Configure the Server**
   - Navigate to the server folder:
     ```bash
     cd server
     ```
   - Install dependencies:
     ```bash
     npm install
     ```
   - Copy the environment template:
     ```bash
     cp .env.example .env
     ```
   - Edit the `.env` file to add your API keys (e.g., `GITHUB_TOKEN`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `FIRECRAWL_API_KEY`).
   - Run Prisma migrations to initialize the SQLite database:
     ```bash
     npm run db:push
     ```
   - Start the server in development mode:
     ```bash
     npm run dev
     ```

3. **Configure the Client**
   - Open a new terminal and navigate to the client folder:
     ```bash
     cd client
     ```
   - Install dependencies:
     ```bash
     npm install
     ```
   - Start the Vite development server:
     ```bash
     npm run dev
     ```

4. **Access the App**
   Open your browser and visit [http://localhost:5173](http://localhost:5173). The backend runs on [http://localhost:3001](http://localhost:3001).

---

## 🤝 Contributing

We welcome contributions of all kinds! Feel free to:
- Open issues for bug reports or feature requests.
- Submit Pull Requests to improve components, add new providers, or fix styling bugs.

---

## 📄 License

This project is open-source and licensed under the MIT License.
