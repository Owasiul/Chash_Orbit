from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # NASA API settings
    nasa_power_base_url: str = "https://power.larc.nasa.gov/api/temporal/daily/point"
    nasa_power_api_key: Optional[str] = None  # For NASA POWER API (if needed)
    nasa_api_key: Optional[str] = None        # From NASA_API_KEY in .env (not used)

    # Earthdata credentials (provided via environment variables)
    earthdata_username: Optional[str] = None
    earthdata_password: Optional[str] = None
    earthdata_token: Optional[str] = None     # From EARTHDATA_TOKEN in .env (not used)

    # API settings
    api_v1_prefix: str = "/api"
    project_name: str = "Field Shift"
    project_version: str = "0.1.0"

    class Config:
        env_file = "../.env"
        case_sensitive = False
        extra = 'allow'

settings = Settings()