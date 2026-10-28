# FoodVerse AI - Python backend (FastAPI)

## Run on your laptop

Needs Python 3.10+ and Node.js 18+.

```bash
# 1. Python backend
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
copy .env.example .env         # Mac/Linux: cp .env.example .env  -> then put your AI key in .env
uvicorn main:app --reload --port 8000
```
Check http://localhost:8000/docs (interactive API page).

```bash
# 2. Frontend (new terminal, project root)
npm install
# Windows PowerShell:  $env:PYTHON_API_URL="http://localhost:8000"; npm run dev
# Mac/Linux:           PYTHON_API_URL=http://localhost:8000 npm run dev
```
Open the URL shown (usually http://localhost:8080). All AI features now run through Python.

Endpoints: `/recognize`, `/freshness`, `/hygiene`, `/kitchen`, `/meal-plan`, `/health`.
