# 🛡️ Bug Hunter AI

Bug Hunter AI is an advanced, AI-powered bug and vulnerability detection platform designed to scan your codebase, identify security flaws, detect logic bugs, and provide actionable fixes using static analysis and Google Gemini AI.

Featuring a beautiful, modern user interface, Bug Hunter AI provides detailed reporting, team collaboration features, and automated workflows.

---

## 🏗️ Architecture Overview

The project is structured into three main layers:

1. **Frontend (`/app`, `/components`)**: A premium dashboard built with **Next.js (App Router)**, **Tailwind CSS**, and **Framer Motion** for sleek micro-interactions and transitions. Charts are rendered using **Recharts**.
2. **Backend Services (`/backend`)**: A robust API built with **Node.js, Express, and TypeScript**. It manages authentication (JWT + Google OAuth), user onboarding, repository synchronization, scans, reports, and Google Drive storage archiving. Data is persisted in **PostgreSQL** via **Prisma ORM**.
3. **AI Service (`/ai-service`)**: A lightweight **FastAPI (Python)** server that interfaces with language models and custom detectors.

---

## 🛠️ Prerequisites

Make sure you have the following installed on your machine:
- **Node.js** (v18 or higher)
- **PostgreSQL** database instance
- **Python** (3.10 or higher, optional if running the AI Python service)
- **Gemini API Key** (for AI reviews)

---

## 🚀 Getting Started

Follow these steps to set up the project locally:

### 1. Setup Environment Variables
Copy the template `.env.example` to create your local environment file:
```bash
cp .env.example .env
```
Open `.env` and fill in the required credentials:
- **`DATABASE_URL`**: Your PostgreSQL connection string.
- **`GEMINI_API_KEY`**: Your Google Gemini API Key.
- **`JWT_SECRET`**: A strong random secret key.
- Add Google OAuth and Google Drive API credentials if you want to enable those services.

### 2. Install Dependencies
Install the package dependencies from the root directory:
```bash
npm install
```

### 3. Setup the Database
Generate the Prisma Client and run the database migrations:
```bash
# Generate Prisma client
npm run db:generate

# Run migrations to set up schema
npm run db:migrate
```

---

## ⚙️ Running the Applications

To run the complete platform, you need to spin up the frontend, backend, and (optionally) the AI service.

### 🛡️ Running the Frontend & Backend (Node.js)

Open two terminal windows/tabs in the root directory:

*   **Terminal 1: Start Next.js Frontend**
    ```bash
    npm run dev
    ```
    This launches the client dashboard at [http://localhost:3000](http://localhost:3000).

*   **Terminal 2: Start Express Backend API**
    ```bash
    npm run backend:dev
    ```
    This launches the Express API server at [http://localhost:4000](http://localhost:4000).

---

### 🐍 Running the AI Python Service (FastAPI)

If you plan to utilize or test the Python-based AI service:

1. Navigate to the `ai-service` folder:
   ```bash
   cd ai-service
   ```
2. Create and activate a virtual environment:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install the requirements:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --port 8000 --reload
   ```
   The service will be live on [http://localhost:8000](http://localhost:8000).

---

## 📜 Available NPM Scripts

You can run the following scripts in the root directory:

| Script | Description |
| :--- | :--- |
| `npm run dev` | Runs the Next.js development server. |
| `npm run backend:dev` | Runs the Express backend server with live reload (`tsx`). |
| `npm run build` | Builds the Next.js production bundle. |
| `npm run start` | Starts the production Next.js application. |
| `npm run db:generate` | Generates the Prisma client. |
| `npm run db:migrate` | Runs Prisma development migrations. |
| `npm run db:deploy` | Applies production migrations. |
| `npm run format` | Runs Prettier to auto-format files. |
| `npm run lint` | Lints the codebase using ESLint. |
| `npm run test:check` | Runs lint checks and TypeScript verification. |

---

## 📁 Repository Structure

```
├── ai-service/          # FastAPI Python service
├── app/                 # Next.js app router pages & layouts
├── backend/             # Express API (controllers, routes, services)
├── components/          # Reusable React components & Shadcn UI elements
├── hooks/               # Custom React hooks
├── lib/                 # Shared client utility files
├── prisma/              # Prisma schema & migrations
├── public/              # Static assets (logos, images, etc.)
└── styles/              # Global styling configurations
```

---

Happy Hunting! 🎯
