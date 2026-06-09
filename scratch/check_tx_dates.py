import gspread
from google.oauth2.service_account import Credentials

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
    print("Connected to primary spreadsheet:", sh.title)
    
    for name in ["Tx_InternalRun", "Tx_InternalSort", "Tx_ExternalPost"]:
        ws = sh.worksheet(name)
        rows = ws.get_all_values()
        print(f"\nSheet {name} - Total rows: {len(rows)}")
        if len(rows) > 1:
            headers = rows[0]
            print(f"Headers: {headers}")
            # Print last 5 rows
            print("Last 5 rows:")
            for row in rows[-5:]:
                print(row)
        else:
            print("Empty or header-only sheet")
            
except Exception as e:
    print("Error:", e)
