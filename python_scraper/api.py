import sys
import asyncio
from fastapi import FastAPI
from pydantic import BaseModel

from scraper import extrair_leads
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Define a política de loop de eventos para Windows, se necessário.
# Para Python 3.8 e superior no Windows, use WindowsProactorEventLoopPolicy
# ou WindowsSelectorEventLoopPolicy. Proactor é geralmente recomendado para I/O.
if sys.platform.startswith('win') and sys.version_info >= (3, 8):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
# Note: For Python versions prior to 3.8, you might need:
# elif sys.platform.startswith('win'):
#     asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


# Carrega variáveis do .env
load_dotenv()

app = FastAPI()

# Libera acesso CORS (para frontend externo, tipo React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Conexão com o MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://vidalet_adm788:xtXIoY1Ki0xEX2jG@cluster0.boz3afl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
client = AsyncIOMotorClient(MONGO_URI)
db = client["leadsdb"]
collection = db["leads"]

class LeadRequest(BaseModel):
    nicho: str
    cidade: str
    quantidade: int = 20
    userId: str

@app.post("/api/leads/generate")
async def generate_leads(req: LeadRequest):
    try:
        print(f"[DEBUG] Requisição recebida: {req}")
        
        leads = await extrair_leads(req.nicho, req.cidade, req.quantidade, req.userId)
        print(f"[DEBUG] Leads extraídos: {len(leads)}")

        for lead in leads:
            await collection.insert_one(lead)
            lead.pop('_id', None)
        return {"success": True, "total": len(leads), "leads": leads}

    except Exception as e:
        import traceback
        print("[ERRO] Ocorreu um erro:", e)
        traceback.print_exc()
        return {"success": False, "error": str(e)}