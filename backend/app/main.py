from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router as api_router

app = FastAPI(
    title="BioVerify API",
    description="Zero-Trust Continuous Keystroke Behavioral Authentication Engine",
    version="1.0.0"
)

# Configure CORS to allow frontend connections
# For development, allow all origins. In production, lock this down.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include endpoint router
app.include_router(api_router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "BioVerify Engine",
        "docs_url": "/docs",
        "description": "Zero-Trust continuous endpoint identity verification via typing biometrics."
    }
