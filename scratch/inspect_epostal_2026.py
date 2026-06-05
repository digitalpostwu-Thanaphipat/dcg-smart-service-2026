import gspread
from google.oauth2.service_account import Credentials

scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]
key_path = r"D:\Epostal\epostal-mcp-key.json\cool-clarity-479902-t0-9acaf4aa926c.json"
spreadsheet_id = "1cJsSEs5wXof4jORuaonNn0mA9AfENzQoSw5s9D7J8SQ"

try:
    credentials = Credentials.from_service_account_file(key_path, scopes=scopes)
    gc = gspread.authorize(credentials)
    sh = gc.open_by_key(spreadsheet_id)
    print("Connected to spreadsheet:", sh.title)
    
    for ws in sh.worksheets():
        print(f"- {ws.title} (Rows: {ws.row_count}, Cols: {ws.col_count})")
except Exception as e:
    print("Error:", e)
