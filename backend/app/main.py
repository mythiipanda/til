import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env.local"))
load_dotenv()

from app.api.endpoints import router as api_router
from app.api.middleware.request_size import RequestSizeLimitMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    # Release pooled HTTP connections on shutdown.
    from app.services.supabase import aclose_shared_client as aclose_supabase_client
    from app.services.tools import aclose_shared_client as aclose_tools_client

    await aclose_tools_client()
    await aclose_supabase_client()


app = FastAPI(
    title="TDILEARNED API",
    description="Backend for TDILEARNED (Today I Learned) knowledge discovery application.",
    version="1.0.0",
    lifespan=lifespan,
)

# Guard against oversized URLs/bodies before handlers run
app.add_middleware(RequestSizeLimitMiddleware)

# Compress large JSON payloads (catalog, precomputed hubs) over the wire
app.add_middleware(GZipMiddleware, minimum_size=1024)

# Allow all CORS origins for client canvas, Cloudflare worker, and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
async def root():
    return {"message": "TDILEARNED Backend Active", "docs_url": "/docs", "health_url": "/api/v1/health"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
