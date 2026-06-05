from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials

scopes = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
]
key_path = r"D:\Epostal\epostal-mcp-key.json\cool-clarity-479902-t0-9acaf4aa926c.json"
spreadsheet_id = "1AL0AHGleUZ1UmS2N3QAg3vM0z_E1ymJ8Eg9FfUneAD0"

try:
    credentials = Credentials.from_service_account_file(key_path, scopes=scopes)
    
    # Check spreadsheet metadata
    sheets_service = build('sheets', 'v4', credentials=credentials)
    spreadsheet = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    print("Spreadsheet Title:", spreadsheet.get("properties", {}).get("title"))
    
    # Check developerMetadata
    dev_meta = spreadsheet.get("developerMetadata", [])
    print("Developer Metadata:", dev_meta)
    
    # Also list worksheets
    for sheet in spreadsheet.get("sheets", []):
        props = sheet.get("properties", {})
        print(f"Sheet: {props.get('title')} (ID: {props.get('sheetId')}, GridProperties: {props.get('gridProperties')})")
        
except Exception as e:
    print("Error:", e)
