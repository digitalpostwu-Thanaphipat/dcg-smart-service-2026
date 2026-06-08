import json

try:
    with open(r"D:\[DEV] __WUS_Track_DB\scratch\primary_sheet_dump.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    for sheet_name in ["Tx_InternalRun", "Tx_InternalSort", "Tx_ExternalPost"]:
        if sheet_name in data:
            sheet_data = data[sheet_name]
            if len(sheet_data) > 0:
                print(f"Sheet: {sheet_name}")
                print(f"  Headers: {sheet_data[0]}")
                if len(sheet_data) > 1:
                    print(f"  First Row: {sheet_data[1]}")
            else:
                print(f"Sheet: {sheet_name} is empty")
        else:
            print(f"Sheet: {sheet_name} not found")
except Exception as e:
    print("ERROR:", e)
