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
    
    # 1. Update D083 to D085 in Master_Departments worksheet
    ws = sh.worksheet("Master_Departments")
    rows = ws.get_all_values()
    
    found_row = None
    for idx, row in enumerate(rows):
        if row[0] == "D083":
            found_row = idx + 1
            break
            
    if found_row:
        print(f"Found D083 at row {found_row}. Updating to D085...")
        ws.update_cell(found_row, 1, "D085")
        print("Updated successfully in Sheet.")
    else:
        print("D083 not found in sheet. Checking for D085...")
        for idx, row in enumerate(rows):
            if row[0] == "D085":
                found_row = idx + 1
                break
        if found_row:
            print(f"D085 already exists at row {found_row}.")
        else:
            print("Neither D083 nor D085 found in sheet.")
            
    # 2. Fetch live metadata
    url = "https://script.google.com/macros/s/AKfycbwblVyselMBmT8ygaRCPCVewszxBiGCM1RuN8VYBgYLTVQNu1L5QFtJbRA93B9dBuJP/exec"
    data = json.dumps({"action": "getMetaData"}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    
    with urllib.request.urlopen(req) as response:
        res_data = response.read().decode("utf-8")
        parsed = json.loads(res_data)
        
        meta = parsed.get("data", {})
        depts = meta.get("departments", [])
        services = meta.get("services", [])
        
        print("\n=== Live API Check after sheet update ===")
        print(f"Total departments returned: {len(depts)}")
        print(f"Total services returned: {len(services)}")
        
        target_ids = ["D041", "D042", "D083", "D085"]
        found_targets = [d for d in depts if d.get("DeptID") in target_ids]
        print("Found target depts in live API:", found_targets)
        
        print("Live services:", [s.get("ServiceID") for s in services])
        
except Exception as e:
    print("Error:", e)
