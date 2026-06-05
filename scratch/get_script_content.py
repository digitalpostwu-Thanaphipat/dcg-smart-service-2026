import json
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials

scopes = [
    'https://www.googleapis.com/auth/script.projects',
    'https://www.googleapis.com/auth/drive'
]
key_path = r"D:\Epostal\epostal-mcp-key.json\cool-clarity-479902-t0-9acaf4aa926c.json"
spreadsheet_id = "1AL0AHGleUZ1UmS2N3QAg3vM0z_E1ymJ8Eg9FfUneAD0"

try:
    credentials = Credentials.from_service_account_file(key_path, scopes=scopes)
    script_service = build('script', 'v1', credentials=credentials)
    
    # Get project content
    content = script_service.projects().getContent(scriptId=spreadsheet_id).execute()
    files = content.get('files', [])
    print(f"Success! Found {len(files)} files in bound Apps Script project:")
    
    for f in files:
        print(f"\n--- File: {f.get('name')} ({f.get('type')}) ---")
        # Save to scratch folder
        file_name = f.get('name')
        file_type = f.get('type').lower()
        ext = "gs" if file_type == "server_js" else "html"
        out_file = fr"D:\[DEV] __WUS_Track_DB\scratch\bound_{file_name}.{ext}"
        
        with open(out_file, "w", encoding="utf-8") as out:
            out.write(f.get('source', ''))
        print(f"Saved to scratch/bound_{file_name}.{ext}")
except Exception as e:
    print("Error:", e)
