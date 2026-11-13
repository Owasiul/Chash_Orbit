from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, List
import earthaccess
import re

router = APIRouter()

def validate_date_format(date_str: str) -> bool:
    """Validate date is in YYYYMMDD format"""
    return bool(re.match(r'^\d{8}$', date_str))

def convert_to_iso_date(date_str: str) -> str:
    """Convert YYYYMMDD to YYYY-MM-DD"""
    if validate_date_format(date_str):
        return f"{date_str[0:4]}-{date_str[4:6]}-{date_str[6:8]}"
    raise ValueError(f"Invalid date format: {date_str}. Expected YYYYMMDD")

@router.get("/")
async def get_modis_data(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    start: str = Query(..., description="Start date (YYYYMMDD)"),
    end: str = Query(..., description="End date (YYYYMMDD)")
):
    """
    Fetch vegetation/NDVI data from NASA MODIS (via earthaccess)
    Returns metadata about available granules.
    """
    try:
        # Validate date format
        if not (validate_date_format(start) and validate_date_format(end)):
            raise HTTPException(status_code=400, detail="Dates must be in YYYYMMDD format")

        # Convert dates to YYYY-MM-DD for earthaccess
        start_iso = convert_to_iso_date(start)
        end_iso = convert_to_iso_date(end)

        # Search for MODIS data (no authentication required for search)
        results = earthaccess.search_data(
            short_name="MOD13Q1",  # MODIS/Terra Vegetation Indices 16-Day L3 Global 250m
            version="006",
            bounding_box=(lon-0.5, lat-0.5, lon+0.5, lat+0.5),  # 1-degree box around point
            temporal=(start_iso, end_iso)
        )

        if not results:
            return {
                "meta": {
                    "lat": lat,
                    "lon": lon,
                    "start": start,
                    "end": end,
                    "start_iso": start_iso,
                    "end_iso": end_iso
                },
                "data": {
                    "granules": [],
                    "count": 0,
                    "message": "No MODIS data found for the specified location and time period"
                }
            }

        # Extract useful metadata from each granule (limit to first 5 for brevity)
        granules_info = []
        for granule in results[:5]:
            granules_info.append({
                "url": granule.data_links(0) if granule.data_links() else None,
                "size": granule.size,
                "created": str(granule.created) if hasattr(granule, 'created') else None,
                "title": granule.title
            })

        return {
            "meta": {
                "lat": lat,
                "lon": lon,
                "start": start,
                "end": end,
                "start_iso": start_iso,
                "end_iso": end_iso
            },
            "data": {
                "granules": granules_info,
                "count": len(results),
                "message": f"Found {len(results)} MODIS granules. This endpoint returns metadata. For actual NDVI values, data download and processing is required (requires Earthdata credentials)."
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accessing MODIS data: {str(e)}")