import gspread
from google.oauth2.service_account import Credentials
import urllib.request
import json

scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]
key_path = r"D:\Epostal\epostal-mcp-key.json\cool-clarity-479902-t0-9acaf4aa926c.json"
spreadsheet_id = "1AL0AHGleUZ1UmS2N3QAg3vM0z_E1ymJ8Eg9FfUneAD0"

try:
    credentials = Credentials.from_service_account_file(key_path, scopes=scopes)
    gc = gspread.authorize(credentials)
    sh = gc.open_by_key(spreadsheet_id)
    
    ws = sh.worksheet("Master_Users")
    
    # 1. Add dummy user
    test_email = "test_sync_agent@wu.ac.th"
    print(f"Adding test user {test_email} to Sheet...")
    ws.append_row(["U999", test_email, "Test Sync Agent", "Staff", "Active"])
    print("Added successfully.")
    
    # 2. Query live metadata
    url = "https://script.google.com/macros/s/AKfycbwblVyselMBmT8ygaRCPCVewszxBiGCM1RuN8VYBgYLTVQNu1L5QFtJbRA93B9dBuJP/exec"
    data = json.dumps({"action": "getMetaData"}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    
    with urllib.request.urlopen(req) as response:
        res_data = response.read().decode("utf-8")
        parsed = json.loads(res_data)
        
        meta = parsed.get("data", {})
        users = meta.get("users", [])
        
        found = any(u.get("Email") == test_email for u in users)
        print(f"\nLive API returns test user: {found}")
        print("Total users in live API:", len(users))
        
    # 3. Delete the dummy row to clean up
    rows = ws.get_all_values()
    del_row = None
    for idx, row in enumerate(rows):
        if row[1] == test_email:
            del_row = idx + 1
            break
    if del_row:
        print(f"Cleaning up: deleting row {del_row}...")
        ws.delete_rows(del_row)
        print("Cleaned up successfully.")
        
except Exception as e:
    print("Error:", e)
