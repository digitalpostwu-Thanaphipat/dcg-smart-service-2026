import json

dump_path = r"D:\[DEV] __WUS_Track_DB\scratch\primary_sheet_dump.json"

with open(dump_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# Master_Services
print("=== Master_Services ===")
for row in data.get("Master_Services", []):
    print(row)

# Master_Departments
print("\n=== Master_Departments (Filtered) ===")
headers = data.get("Master_Departments", [])[0]
print("Headers:", headers)
for row in data.get("Master_Departments", [])[1:]:
    # Find rows matching D041, D042, D085, or containing similar terms
    dept_id = row[0]
    if dept_id in ["D041", "D042", "D085", "D083"]:
        print(row)
