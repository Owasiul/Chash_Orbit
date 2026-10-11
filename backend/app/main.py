from fastapi import FastAPI
from app.api.endpoints import power, smap, gpm, modis

app = FastAPI(title="Field Shift API", description="API for Field Shift - NASA Space Apps 2026")

# Include routers
app.include_router(power.router, prefix="/api/power", tags=["POWER"])
app.include_router(smap.router, prefix="/api/smap", tags=["SMAP"])
app.include_router(gpm.router, prefix="/api/gpm", tags=["GPM"])
app.include_router(modis.router, prefix="/api/modis", tags=["MODIS"])

@app.get("/")
async def root():
    return {"message": "Welcome to the Field Shift API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}