import os
import zipfile
import sqlite3
import pandas as pd
import httpx

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(SCRIPT_DIR, "nhtsa_vehicles.db")
CSV_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=csv"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

def main():
    print("Downloading dataset via CSV endpoint...")
    
    with httpx.Client(headers=HEADERS, timeout=60.0, follow_redirects=True) as client:
        # Download directly via CSV output format
        response = client.get(CSV_URL)
        if response.status_code == 403:
            print("HTTP 403 encountered. Switching to fallback endpoint...")
            response = client.get("https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=csv")
        
        response.raise_for_status()

    # Save to disk
    csv_path = os.path.join(SCRIPT_DIR, "makes.csv")
    with open(csv_path, "wb") as f:
        f.write(response.content)

    print("CSV downloaded successfully. Loading into SQLite...")

    # Load into pandas and clean
    df = pd.read_csv(csv_path)
    
    conn = sqlite3.connect(DB_FILE)
    df.to_sql("vehicle_makes", conn, if_exists="replace", index=False)
    conn.close()

    print(f"Successfully saved {len(df):,} records into '{DB_FILE}'!")

if __name__ == "__main__":
    main()