from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials

scopes = [
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/drive'
]
key_path = r"D:\Epostal\epostal-mcp-key.json\cool-clarity-479902-t0-9acaf4aa926c.json"

try:
    credentials = Credentials.from_service_account_file(key_path, scopes=scopes)
    drive_service = build('drive', 'v3', credentials=credentials)
    
    # Search for script projects
    results = drive_service.files().list(
        q="mimeType = 'application/vnd.google-apps.script'",
        pageSize=50, 
        fields="nextPageToken, files(id, name, mimeType)"
    ).execute()
    items = results.get('files', [])
    
    print("Script projects found:")
    if not items:
        print("No script projects found.")
    for item in items:
        print(f"- {item['name']} (ID: {item['id']})")
except Exception as e:
    print("Error:", e)
