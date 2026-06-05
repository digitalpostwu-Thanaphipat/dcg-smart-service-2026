import gspread
from google.oauth2.service_account import Credentials

# Define scope
scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

# Path to service account key
key_path = r"D:\Epostal\epostal-mcp-key.json\cool-clarity-479902-t0-9acaf4aa926c.json"
spreadsheet_id = "1V3DWTLUMVxrKS7GerXrZOb5cbFixhbB1YB8FTtcIZQ0"

try:
    credentials = Credentials.from_service_account_file(key_path, scopes=scopes)
    gc = gspread.authorize(credentials)
    sh = gc.open_by_key(spreadsheet_id)
    print("Successfully connected to the spreadsheet:", sh.title)
    
    # List all worksheets
    worksheets = sh.worksheets()
    print("Worksheets:")
    for ws in worksheets:
        print(f"- {ws.title} (Rows: {ws.row_count}, Cols: {ws.col_count})")
        # Print headers if worksheet has rows
        if ws.row_count > 0:
            try:
                headers = ws.row_values(1)
                print(f"  Headers: {headers}")
            except Exception as e:
                print(f"  Could not read headers: {e}")
except Exception as e:
    print("Error:", e)
