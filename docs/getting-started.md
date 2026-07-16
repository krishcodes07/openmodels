# Getting Started with OpenModels

This guide walks you through setting up OpenModels in your local environment.

---

## 📋 Prerequisites

Before starting, make sure you have the following installed:
- **Node.js**: v18.0.0 or higher
- **npm** or **Yarn**
- **PostgreSQL Database**: A running instance (or an external URL like Neon, Supabase, etc.)

---

## 🛠️ Step-by-Step Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/openmodels.git
cd openmodels
```

### 2. Install Root Orchestration Dependencies
At the project root, install the dev dependency used to run the server and client concurrently:
```bash
npm install
```

### 3. Configure Environment Variables
Copy the env template from the project root into a `.env` file:
```bash
cp .env.example .env
```
Open `.env` and fill out the fields. At a minimum, set:
- `DATABASE_URL`: Your PostgreSQL connection string.
- `JWT_SECRET` & `JWT_REFRESH_SECRET`: Random 32-character strings.
- `ENCRYPTION_KEY`: A 32-byte hex-encoded string (64 characters) used for AES-256-GCM encryption. You can generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **Provider API Keys**: (Optional) Add default keys for Nvidia, Groq, Gemini, etc. Users can also enter their own keys in their UI profile.

---

## 🗄️ Database Setup (Prisma)

Navigate to the `server/` folder to run migrations and initialize the schema:

```bash
cd server
npm install
```

### Apply Database Schema
Generate the Prisma client and push the schema directly to your PostgreSQL database (ideal for development):
```bash
npx prisma generate
npx prisma db push
```

### (Optional) Database Studio
You can inspect the database tables and entries at any time using:
```bash
npx prisma studio
```

---

## 🚀 Running the Application

Return to the root directory and start both the Express backend and the Vite frontend concurrently:

```bash
cd ..
npm run dev
```

The terminal output will display status logs for both sides:
- **Frontend URL**: [http://localhost:5173](http://localhost:5173)
- **Backend API URL**: [http://localhost:3001](http://localhost:3001)

---

## 🧪 Verifying the Installation

1. Open your browser and go to `http://localhost:5173`.
2. Select **Create Account** or start chatting immediately in **Guest Mode**.
3. (Optional) Run the API health check to verify backend availability:
   ```bash
   curl http://localhost:3001/api/health
   ```
   *Expected Response:*
   ```json
   { "status": "ok", "timestamp": "2026-07-16T13:40:00.000Z" }
   ```
