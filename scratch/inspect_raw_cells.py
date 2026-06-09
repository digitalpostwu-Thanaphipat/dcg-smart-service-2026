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
    ws = sh.worksheet("Tx_InternalRun")
    
    last_row = ws.row_count
    # Find the actual last populated row by scanning backwards
    all_vals = ws.col_values(1)
    last_populated = len(all_vals)
    print(f"Last populated row: {last_populated}")
    
    # Get values with both FORMATTED and UNFORMATTED options for the last few rows
    formatted = ws.get(f"B{last_populated-5}:B{last_populated}", value_render_option="FORMATTED_VALUE")
    unformatted = ws.get(f"B{last_populated-5}:B{last_populated}", value_render_option="UNFORMATTED_VALUE")
    
    print("\nFormatted Values (what you see):")
    print(formatted)
    print("\nUnformatted Values (raw Excel serial numbers or dates):")
    print(unformatted)
    
except Exception as e:
    print("Error:", e)
