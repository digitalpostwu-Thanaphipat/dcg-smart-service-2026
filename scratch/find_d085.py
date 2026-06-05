import json

with open(r"D:\[DEV] __WUS_Track_DB\scratch\primary_sheet_dump.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for sheet_name, rows in data.items():
    for r_idx, row in enumerate(rows):
        row_str = str(row)
        if "D085" in row_str or "D083" in row_str:
            print(f"Sheet '{sheet_name}' Row {r_idx+1}: {row}")
