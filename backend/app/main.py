import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env.local"))
load_dotenv()

from app.api.endpoints import router as api_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

app = FastAPI(
    title="Infinite Curiosity Engine API",
    description="Agentic, infinite-canvas discovery engine powered by Cerebras inference, Mistral precomputation, and edge media caching.",
    version="1.0.0",
)

# Allow all CORS origins for client canvas, Cloudflare worker, and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
async def root():
    return {"message": "Infinite Curiosity Engine Backend Active", "docs_url": "/docs", "health_url": "/api/v1/health"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
