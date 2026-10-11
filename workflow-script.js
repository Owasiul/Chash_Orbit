export const meta = {
  name: 'create-field-shift-structure',
  description: 'Create the basic file structure for Field Shift frontend and backend',
  phases: [
    { title: 'Create Frontend Files', detail: 'Create frontend files with basic boilerplate' },
    { title: 'Create Backend Files', detail: 'Create backend files with basic boilerplate' }
  ]
};

// Simple list of files to create
const filesToCreate = [
  // ---------- Frontend files (9 total) ----------
  { path: 'frontend/app/layout.tsx', content: `import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`},
  { path: 'frontend/app/page.tsx', content: `export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-4">Field Shift</h1>
      <p className="text-lg text-center max-w-2xl">
        Rotate smarter. Build soil. Adapt with NASA data.
      </p>
      <div className="mt-8 space-x-4">
        <a href="/setup" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Open a sample farm
        </a>
        <a href="/setup" className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Pin my field
        </a>
      </div>
    </main>
  );
}`},
  { path: 'frontend/app/setup/page.tsx', content: `export default function Setup() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Setup Your Field</h1>
      <p className="mb-6">Let's get started by telling us about your farm.</p>
      {/* Setup wizard steps will go here */}
      <div className="alert alert-info">
        Setup wizard implementation coming soon...
      </div>
    </div>
  );
}`},
  { path: 'frontend/app/field/page.tsx', content: `export default function FieldObservatory() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Field Observatory</h1>
      <p className="mb-6">View NASA data for your field.</p>
      <div className="alert alert-info">
        Field observatory implementation coming soon...
      </div>
    </div>
  );
}`},
  { path: 'frontend/app/crops/page.tsx', content: `export default function CropLibrary() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Crop Library</h1>
      <p className="mb-6">Explore crops suitable for your region.</p>
      <div className="alert alert-info">
        Crop library implementation coming soon...
      </div>
    </div>
  );
}`},
  { path: 'frontend/app/planner/page.tsx', content: `export default function RotationPlanner() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Rotation Planner</h1>
      <p className="mb-6">Plan your crop rotation strategy.</p>
      <div className="alert alert-info">
        Rotation planner implementation coming soon...
      </div>
    </div>
  );
}`},
  { path: 'frontend/app/compare/page.tsx', content: `export default function ComparePlans() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Compare Strategies</h1>
      <p className="mb-6">See how different rotation strategies compare.</p>
      <div className="alert alert-info">
        Comparison implementation coming soon...
      </div>
    </div>
  );
}`},
  { path: 'frontend/app/learn/page.tsx', content: `export default function LearnPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Learn About NASA Data</h1>
      <p className="mb-6">Understand how we use NASA data to help farmers.</p>
      <div className="alert alert-info">
        Learn page implementation coming soon...
      </div>
    </div>
  );
}`},
  // NOTE: the closing } of the component must be INSIDE the template literal
  { path: 'frontend/app/plan/[id]/page.tsx', content: `export default function PlanDetail() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Your Rotation Plan</h1>
      <p className="mb-6">View your customized rotation plan.</p>
      <div className="alert alert-info">
        Plan detail implementation coming soon...
      </div>
    </div>
  );
}`},

  // ---------- Backend files ----------
  { path: 'backend/app/__init__.py', content: `"""Field Shift backend application package."""` },
  { path: 'backend/app/api/__init__.py', content: `"""API package."""` },
  { path: 'backend/app/api/endpoints/__init__.py', content: `"""NASA data source endpoint modules."""` },
  { path: 'backend/app/core/__init__.py', content: `"""Core configuration and utilities."""` },
  { path: 'backend/app/services/__init__.py', content: `"""Service layer: NASA data access and calculations."""` },
  { path: 'backend/app/main.py', content: `from fastapi import FastAPI
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
    return {"status": "healthy"}`},
  { path: 'backend/app/api/endpoints/power.py', content: `from fastapi import APIRouter, HTTPException, Query
import requests

from app.core.config import settings

router = APIRouter()


@router.get("/")
async def get_power_data(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    start: str = Query(..., description="Start date (YYYYMMDD)"),
    end: str = Query(..., description="End date (YYYYMMDD)")
):
    """
    Fetch data from NASA POWER API
    """
    # Validate date format (basic validation)
    if not (len(start) == 8 and start.isdigit() and len(end) == 8 and end.isdigit()):
        raise HTTPException(status_code=400, detail="Dates must be in YYYYMMDD format")

    # Prepare parameters
    params = {
        "parameters": "T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN,WS2M",
        "community": "AG",
        "latitude": str(lat),
        "longitude": str(lon),
        "start": start,
        "end": end,
        "format": "JSON"
    }

    try:
        response = requests.get(
            settings.nasa_power_base_url,
            params=params,
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        # Extract and format the data
        parameters = data.get('properties', {}).get('parameter', {})

        return {
            "meta": {
                "lat": lat,
                "lon": lon,
                "start": start,
                "end": end
            },
            "data": parameters
        }
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch data from NASA POWER: {str(e)}")`},
  { path: 'backend/app/api/endpoints/smap.py', content: `from fastapi import APIRouter, HTTPException, Query
import earthaccess

router = APIRouter()


@router.get("/")
async def get_smap_data(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    start: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end: str = Query(..., description="End date (YYYY-MM-DD)")
):
    """
    Fetch soil moisture data from NASA SMAP (via earthaccess)
    """
    try:
        # Login using environment variables (provided by user)
        earthaccess.login(strategy="environment")

        # Search for SMAP data
        results = earthaccess.search_data(
            short_name="SPL4SMGP",  # SMAP L4 Global Soil Moisture Geophysical
            version="003",
            bounding_box=(lon - 0.5, lat - 0.5, lon + 0.5, lat + 0.5),  # 1-degree box around point
            temporal=(start, end)
        )

        if not results:
            return {
                "meta": {
                    "lat": lat,
                    "lon": lon,
                    "start": start,
                    "end": end
                },
                "data": {
                    "soil_moisture": None,
                    "message": "No SMAP data found for the specified location and time period"
                }
            }

        # For simplicity, we return the first granule's basic info
        # In a real implementation, we would process the data
        return {
            "meta": {
                "lat": lat,
                "lon": lon,
                "start": start,
                "end": end,
                "granules_found": len(results)
            },
            "data": {
                "message": f"Found {len(results)} SMAP granules. Data processing implementation coming soon.",
                "note": "In production, this would return actual soil moisture values"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accessing SMAP data: {str(e)}")`},
  { path: 'backend/app/api/endpoints/gpm.py', content: `from fastapi import APIRouter, HTTPException, Query
import earthaccess

router = APIRouter()


@router.get("/")
async def get_gpm_data(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    start: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end: str = Query(..., description="End date (YYYY-MM-DD)")
):
    """
    Fetch precipitation data from NASA GPM IMERG (via earthaccess)
    """
    try:
        # Login using environment variables
        earthaccess.login(strategy="environment")

        # Search for GPM data
        results = earthaccess.search_data(
            short_name="IMERG",  # GPM IMERG Final Precipitation
            version="06",
            bounding_box=(lon - 0.5, lat - 0.5, lon + 0.5, lat + 0.5),
            temporal=(start, end)
        )

        if not results:
            return {
                "meta": {
                    "lat": lat,
                    "lon": lon,
                    "start": start,
                    "end": end
                },
                "data": {
                    "precipitation": None,
                    "message": "No GPM data found for the specified location and time period"
                }
            }

        return {
            "meta": {
                "lat": lat,
                "lon": lon,
                "start": start,
                "end": end,
                "granules_found": len(results)
            },
            "data": {
                "message": f"Found {len(results)} GPM granules. Data processing implementation coming soon.",
                "note": "In production, this would return actual precipitation values"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accessing GPM data: {str(e)}")`},
  { path: 'backend/app/api/endpoints/modis.py', content: `from fastapi import APIRouter, HTTPException, Query
import earthaccess

router = APIRouter()


@router.get("/")
async def get_modis_data(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    start: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end: str = Query(..., description="End date (YYYY-MM-DD)")
):
    """
    Fetch vegetation data from NASA MODIS (via earthaccess)
    """
    try:
        # Login using environment variables
        earthaccess.login(strategy="environment")

        # Search for MODIS NDVI data
        results = earthaccess.search_data(
            short_name="MOD13Q1",  # MODIS/Terra Vegetation Indices 16-Day L3 Global 250m
            version="061",
            bounding_box=(lon - 0.5, lat - 0.5, lon + 0.5, lat + 0.5),
            temporal=(start, end)
        )

        if not results:
            return {
                "meta": {
                    "lat": lat,
                    "lon": lon,
                    "start": start,
                    "end": end
                },
                "data": {
                    "ndvi": None,
                    "message": "No MODIS data found for the specified location and time period"
                }
            }

        return {
            "meta": {
                "lat": lat,
                "lon": lon,
                "start": start,
                "end": end,
                "granules_found": len(results)
            },
            "data": {
                "message": f"Found {len(results)} MODIS granules. Data processing implementation coming soon.",
                "note": "In production, this would return actual NDVI values"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accessing MODIS data: {str(e)}")`},
  { path: 'backend/app/core/config.py', content: `from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings (loaded from environment / .env file)."""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    # NASA API settings
    nasa_power_base_url: str = "https://power.larc.nasa.gov/api/temporal/daily/point"

    # Earthdata credentials (provided via environment variables)
    earthdata_username: Optional[str] = None
    earthdata_password: Optional[str] = None

    # API settings
    api_v1_prefix: str = "/api"
    project_name: str = "Field Shift"
    project_version: str = "0.1.0"


settings = Settings()`},
  { path: 'backend/app/core/security.py', content: `# Security utilities for Field Shift API
# In a production implementation, this would include:
# - Input validation and sanitization
# - Rate limiting
# - Authentication (if needed)
# - CORS configuration
# For now, we rely on FastAPI's built-in features and NASA's public APIs


def validate_latitude(lat: float) -> bool:
    """Validate latitude is within valid range"""
    return -90 <= lat <= 90


def validate_longitude(lon: float) -> bool:
    """Validate longitude is within valid range"""
    return -180 <= lon <= 180


def validate_date_format(date_str: str) -> bool:
    """Validate date string is in YYYYMMDD or YYYY-MM-DD format"""
    if len(date_str) == 8 and date_str.isdigit():
        return True  # YYYYMMDD
    if len(date_str) == 10 and date_str[4] == '-' and date_str[7] == '-':
        return True  # YYYY-MM-DD
    return False`},
  { path: 'backend/app/services/nasa_service.py', content: `"""
Service layer for interacting with NASA APIs
This acts as a facade over the individual data sources
"""
from typing import Dict, Any


class NASAService:
    """Service for fetching data from various NASA sources"""

    def get_power_data(self, lat: float, lon: float, start: str, end: str) -> Dict[str, Any]:
        """Fetch data from NASA POWER API"""
        return {
            "source": "POWER",
            "lat": lat,
            "lon": lon,
            "start": start,
            "end": end,
            "data": {
                "message": "POWER data implementation coming soon"
            }
        }

    def get_smap_data(self, lat: float, lon: float, start: str, end: str) -> Dict[str, Any]:
        """Fetch soil moisture data from NASA SMAP"""
        return {
            "source": "SMAP",
            "lat": lat,
            "lon": lon,
            "start": start,
            "end": end,
            "data": {
                "message": "SMAP data implementation coming soon"
            }
        }

    def get_gpm_data(self, lat: float, lon: float, start: str, end: str) -> Dict[str, Any]:
        """Fetch precipitation data from NASA GPM IMERG"""
        return {
            "source": "GPM",
            "lat": lat,
            "lon": lon,
            "start": start,
            "end": end,
            "data": {
                "message": "GPM data implementation coming soon"
            }
        }

    def get_modis_data(self, lat: float, lon: float, start: str, end: str) -> Dict[str, Any]:
        """Fetch vegetation data from NASA MODIS"""
        return {
            "source": "MODIS",
            "lat": lat,
            "lon": lon,
            "start": start,
            "end": end,
            "data": {
                "message": "MODIS data implementation coming soon"
            }
        }`},
  { path: 'backend/app/services/calculation_service.py', content: `"""
Service for calculating crop fitness, rotation scores, and recommendations
Based on the decision engine described in the specification
"""
from typing import List, Dict, Any


class CalculationService:
    """Service for performing agricultural calculations"""

    def calculate_climate_fit(self, crop_properties: Dict[str, Any], climate_profile: Dict[str, Any]) -> float:
        """
        Calculate climate fit score (0-100) for a crop given the climate profile
        """
        # Placeholder implementation
        # In reality, this would compare crop tolerance to climate metrics
        return 75.0  # Placeholder score

    def calculate_water_fit(self, crop_properties: Dict[str, Any], water_availability: Dict[str, Any]) -> float:
        """
        Calculate water fit score (0-100) for a crop given water availability
        """
        # Placeholder implementation
        return 75.0

    def calculate_soil_fit(self, crop_properties: Dict[str, Any], soil_conditions: Dict[str, Any]) -> float:
        """
        Calculate soil fit score (0-100) for a crop given soil conditions
        """
        # Placeholder implementation
        return 75.0

    def calculate_rotation_quality(self, rotation: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate quality metrics for a rotation sequence
        Returns dict with diversity, nitrogenBalance, soilCover, pestBreak, waterLoad, climateHedge
        """
        # Placeholder implementation
        return {
            "diversity": 75.0,
            "nitrogenBalance": 75.0,
            "soilCover": 75.0,
            "pestBreak": 75.0,
            "waterLoad": 75.0,
            "climateHedge": 75.0
        }

    def calculate_overall_score(
        self,
        soil_score: float,
        water_score: float,
        climate_score: float,
        income_score: float,
        weights: Dict[str, float]
    ) -> float:
        """
        Calculate weighted overall score
        """
        # Normalize weights to sum to 1.0
        total_weight = sum(weights.values())

        if total_weight == 0:
            return 0.0

        normalized_weights = {key: value / total_weight for key, value in weights.items()}

        overall = 0.0
        overall += normalized_weights.get("soil", 0.0) * soil_score
        overall += normalized_weights.get("water", 0.0) * water_score
        overall += normalized_weights.get("climate", 0.0) * climate_score
        overall += normalized_weights.get("income", 0.0) * income_score

        return overall`},
];

// Create all files in parallel
async function createFile({ path, content }) {
  // NOTE: this only works while file contents contain no backticks
  // or \${ sequences (currently true for all files above)
  await agent(`Write the following content to the file at ${path}:\n\n\`\`\`\n${content}\n\`\`\``);
  return { path, status: "created" };
}

// Main execution
const frontendFiles = filesToCreate.filter(f => f.path.startsWith('frontend/'));
const backendFiles = filesToCreate.filter(f => f.path.startsWith('backend/'));

phase('Create Frontend Files');
const frontendResults = await parallel(frontendFiles.map(createFile));

phase('Create Backend Files');
const backendResults = await parallel(backendFiles.map(createFile));

// Return results
return { frontendResults, backendResults };