import urllib.request
import json
import sys

# Read API_URL from src/config.ts or use the exact one from src/config.ts
API_URL = "https://script.google.com/macros/s/AKfycbyhXXtSjtMvbeGWB4VEsFFo_zLQJ_3BGfXNpX1MByDC3EpuWCkEk-5VfCrUjODm-4jSFg/exec"

def fetch_metadata():
    print(f"Fetching metadata from active API: {API_URL}")
    payload = json.dumps({"action": "getMetaData"}).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as response:
            res_data = response.read().decode("utf-8")
            parsed = json.loads(res_data)
            
            # Print users
            print("Status:", parsed.get("status"))
            if parsed.get("status") == "success":
                users = parsed.get("data", {}).get("users", [])
                print(f"Total Users: {len(users)}")
                for u in users:
                    print(f"- UserID: {u.get('UserID')}, Email: {u.get('Email')}, FullName: {u.get('FullName')}, Role: {u.get('Role')}, Status: {u.get('Status')}")
            else:
                print("Error from API:", parsed.get("message"))
            
    except Exception as e:
        print(f"Error fetching metadata: {e}")
        sys.exit(1)

if __name__ == "__main__":
    fetch_metadata()
