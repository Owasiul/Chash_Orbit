import os
from app.core.config import settings
import earthaccess

print("Settings:")
print(f"  earthdata_username: {settings.earthdata_username}")
print(f"  earthdata_password: {settings.earthdata_password}")

# Set environment variables
if settings.earthdata_username:
    os.environ["EARTHDATA_USERNAME"] = settings.earthdata_username
    print(f"Set EARTHDATA_USERNAME to: {settings.earthdata_username}")
if settings.earthdata_password:
    os.environ["EARTHDATA_PASSWORD"] = settings.earthdata_password
    print(f"Set EARTHDATA_PASSWORD to: {settings.earthdata_password}")

# Try to login
print("\nTrying to login...")
try:
    print("Login with environment credentials...")
    earthaccess.login()
    print("Login successful!")
except Exception as e:
    print(f"Login failed: {e}")
    print(f"Error type: {type(e)}")

    # Try to see if we can at least search without login
    print("\nTrying search without login...")
    try:
        results = earthaccess.search_data(
            short_name="IMERG",
            version="06",
            bounding_box=(90.41-0.5, 23.81-0.5, 90.41+0.5, 23.81+0.5),
            temporal=("2026-09-01", "2026-09-30")
        )
        print(f"Search successful! Found {len(results)} granules")
    except Exception as e2:
        print(f"Search also failed: {e2}")