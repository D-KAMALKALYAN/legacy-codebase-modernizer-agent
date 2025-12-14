
# 🧠 Legacy Code Modernization Assistant

A full-stack application that analyzes **legacy code snippets or small legacy codebases** and generates **modernization suggestions and refactoring guidance** using **LLM context prompting**.

This project is designed as a **versioned system**:

* **V1** focuses on simplicity, explainability, and end-to-end functionality
* **V2 and V3** progressively introduce advanced AI, DevOps, and enterprise features

---

## 🚀 What Problem Does This Solve?

Modernizing legacy software is difficult due to:

* Outdated languages and frameworks
* Poor documentation
* Large and complex codebases
* High manual effort and risk of regression

This tool helps developers **understand legacy code faster** and **plan modernization** by providing:

* Clear explanations of legacy patterns
* Suggestions for modern alternatives
* Structured modernization reports

---

## 🏗️ High-Level Architecture

```
Frontend (React)
   ↓
Backend API (Node.js + Express)
   ↓
AI Service (Python + FastAPI + LLM)
   ↓
Report Generator (Markdown / PDF)
```

Each component is independently evolvable and designed with future scalability in mind.

---

## 🧰 Tech Stack

### Frontend

* React
* JavaScript
* Axios / Fetch
* Tree-view UI for folder visualization

### Backend

* Node.js
* Express.js
* JWT-based authentication
* Multer (file uploads)

### AI Service

* Python
* FastAPI
* LLM APIs (OpenAI / Groq / Gemini / Claude)
* Prompt-based analysis (context prompting)

### Report Generation

* Markdown
* Optional PDF export

---

## 📦 Version Roadmap

### 🔹 Version 1 (Current – MVP)

**Core Focus:**
End-to-end functionality with minimal complexity.

**Features**

* User authentication (Register / Login)
* Upload legacy code via:

  * Copy-paste snippet
  * Folder upload
  * ZIP file upload
* File size and type validation
* Folder structure preview in UI
* LLM-based analysis using **context prompting**
* Modernization suggestions and explanations
* Report generation (Markdown / PDF)

**Explicitly NOT included in V1**

* No RAG
* No vector databases
* No Git repository scanning
* No Docker or CI/CD integration

---

### 🔹 Version 2 (Planned)

* Git repository scanning
* Retrieval-Augmented Generation (RAG)
* Vector databases (FAISS / Pinecone)
* Dockerized services
* Background job queues (Redis)
* Improved scalability for larger codebases

---

### 🔹 Version 3 (Planned)

* AST-based code parsing
* Automated refactoring suggestions
* Enterprise authentication (OAuth / SSO)
* CI/CD pipeline integration
* Advanced modernization metrics and insights

---

## 📁 Project Structure (V1)

```
legacy-modernizer/
├── frontend/          # React UI
├── backend/           # Node.js API
│   ├── uploads/       # Uploaded code (folders / zips)
│   └── reports/       # Generated reports
├── ai-service/        # Python FastAPI + LLM logic
├── docs/              # Architecture & design docs
└── README.md
```

---

## 🖥️ Folder Structure Preview (UI Feature)

When a user uploads a folder or ZIP file, the UI displays the detected structure before analysis:

```
project/
├── src/
│   ├── legacy_code.c
│   ├── helpers.c
│   └── config.txt
├── docs/
└── README.md
```

This allows users to verify that all files were uploaded correctly.

---

## 🔐 Authentication

* JWT-based authentication
* Protected routes for uploads and reports
* User-specific job and report access

---

## 📄 Output

The system generates:

* Human-readable modernization explanations
* Suggested refactoring approaches
* Migration guidance to modern technologies
* Exportable reports (Markdown / PDF)

---

## ▶️ Running the Project (V1 – Local)

### Backend

```bash
cd backend
npm install
npm start
```

### AI Service

```bash
cd ai-service
pip install -r requirements.txt
python app.py
```

### Frontend

```bash
cd frontend
npm install
npm start
```

---

## 📚 Documentation

Detailed design documents are available in the `/docs` folder:

* Architecture overview
* AI design decisions
* Upload and processing flow
* Versioning strategy

---

## 🎯 Project Goals

* Demonstrate full-stack system design
* Apply AI meaningfully without overengineering
* Build a scalable foundation for future enhancements
* Maintain clarity, explainability, and clean architecture

---

## 🧠 Author

**Kamal**
This project is built as a personal portfolio and learning initiative, with an emphasis on real-world engineering practices and scalable AI system design.

---

Just tell me the next step
