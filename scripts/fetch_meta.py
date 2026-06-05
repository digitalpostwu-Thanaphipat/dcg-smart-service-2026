import urllib.request
import json
import sys

API_URL = "https://script.google.com/macros/s/AKfycbwblVyselMBmT8ygaRCPCVewszxBiGCM1RuN8VYBgYLTVQNu1L5QFtJbRA93B9dBuJP/exec"

def fetch_metadata():
    print("Fetching metadata from live API...")
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
            
            # Save to scratch/meta.json
            out_file = "scratch/meta.json"
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(parsed, f, ensure_ascii=False, indent=2)
            print(f"Success! Metadata saved to {out_file}")
            
    except Exception as e:
        print(f"Error fetching metadata: {e}")
        sys.exit(1)

if __name__ == "__main__":
    fetch_metadata()
