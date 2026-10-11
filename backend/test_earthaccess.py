import earthaccess
import os

# Ensure no credentials are set
if 'EARTHDATA_USERNAME' in os.environ:
    del os.environ['EARTHDATA_USERNAME']
if 'EARTHDATA_PASSWORD' in os.environ:
    del os.environ['EARTHDATA_PASSWORD']

# Try to search without any login
print("Searching for IMERG data without login...")
try:
    results = earthaccess.search_data(
        short_name="IMERG",
        version="06",
        bounding_box=(90.41-0.5, 23.81-0.5, 90.41+0.5, 23.81+0.5),
        temporal=("2026-09-01", "2026-09-30")
    )
    print(f"Found {len(results)} granules")
    if results:
        print(f"First result: {results[0]}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()