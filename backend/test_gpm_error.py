import earthaccess
import os

# 1. AUTHENTICATE (fixes LoginAttemptFailure)
#    This will look for a .netrc file or EARTHDATA_USERNAME / EARTHDATA_PASSWORD
#    environment variables. If not found, it will prompt you interactively.
try:
    auth = earthaccess.login()
    if not auth.authenticated:
        raise RuntimeError("Earthdata Login authentication failed.")
    print("Authentication successful.")
except Exception as e:
    print(f"Login error: {e}")
    # Consider exiting here if data access is mandatory.

print("Searching for GPM (IMERG) data...")

try:
    # 2. USE CORRECT SHORT_NAME AND VERSION (fixes empty results)
    #    GPM_3IMERGDF = Final Run Daily IMERG, Version 07 is current.
    results = earthaccess.search_data(
        short_name="GPM_3IMERGDF",   # corrected from "IMERG"
        version="07",                # corrected from "06"
        bounding_box=(90.41-0.5, 23.81-0.5, 90.41+0.5, 23.81+0.5),
        temporal=("2026-09-01", "2026-09-30")
    )
    print(f"Success! Found {len(results)} granules")

    if len(results) > 0:
        print(f"First result: {results[0]}")
    else:
        print("No granules found. Check the date range and region.")

except EOFError as e:
    # 3. HANDLE NETWORK ERRORS GRACEFULLY
    print(f"Network error (EOFError): {e}")
    print("The connection to the NASA server was interrupted. "
          "Please check your internet connection and try again.")
except Exception as e:
    print(f"An unexpected error occurred: {type(e).__name__}: {e}")