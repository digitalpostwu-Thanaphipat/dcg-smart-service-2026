import urllib.request
import json

url = "https://script.google.com/macros/s/AKfycbwblVyselMBmT8ygaRCPCVewszxBiGCM1RuN8VYBgYLTVQNu1L5QFtJbRA93B9dBuJP/exec"
data = json.dumps({"action": "getMetaData"}).encode("utf-8")

req = urllib.request.Request(
    url,
    data=data,
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req) as response:
        res_data = response.read().decode("utf-8")
        parsed = json.loads(res_data)
        
        with open(r"D:\[DEV] __WUS_Track_DB\scratch\live_metadata.json", "w", encoding="utf-8") as f:
            json.dump(parsed, f, ensure_ascii=False, indent=2)
            
        print("Success! Live metadata status:", parsed.get("status"))
        if parsed.get("status") == "success":
            meta = parsed.get("data", {})
            print(f"- Users: {len(meta.get('users', []))}")
            print(f"- Departments: {len(meta.get('departments', []))}")
            print(f"- Services: {len(meta.get('services', []))}")
except Exception as e:
    print("Error:", e)
