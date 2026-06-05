import json
import gspread
from google.oauth2.service_account import Credentials

scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]
key_path = r"D:\Epostal\epostal-mcp-key.json\cool-clarity-479902-t0-9acaf4aa926c.json"
# The other spreadsheet ID
spreadsheet_id = "1AL0AHGleUZ1UmS2N3QAg3vM0z_E1ymJ8Eg9FfUneAD0"

try:
    credentials = Credentials.from_service_account_file(key_path, scopes=scopes)
    gc = gspread.authorize(credentials)
    sh = gc.open_by_key(spreadsheet_id)
    print("Connected to primary spreadsheet:", sh.title)
    
    data = {}
    for ws in sh.worksheets():
        title = ws.title
        rows = ws.get_all_values()
        data[title] = rows
        print(f"Read {len(rows)} rows from {title}")
        
    with open(r"D:\[DEV] __WUS_Track_DB\scratch\primary_sheet_dump.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Dumped to scratch/primary_sheet_dump.json successfully")
except Exception as e:
    print("Error:", e)
