from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any
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
        "format": "JSON",
        "api_key": settings.nasa_power_api_key  # Use the API key from settings
    }

    try:
        response = requests.get(
            "https://power.larc.nasa.gov/api/temporal/daily/point",
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
                "end": end,
                "source": "NASA POWER"
            },
            "data": parameters
        }
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch data from NASA POWER: {str(e)}")