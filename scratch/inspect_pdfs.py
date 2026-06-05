import fitz
import os

pdf_paths = [
    r"C:\Users\Admin\.gemini\antigravity-cli\brain\4918d738-d754-4e1a-8edb-215379efaec0\.tempmediaStorage\media_4918d738-d754-4e1a-8edb-215379efaec0_1780041572118.pdf",
    r"C:\Users\Admin\.gemini\antigravity-cli\brain\4918d738-d754-4e1a-8edb-215379efaec0\.tempmediaStorage\media_4918d738-d754-4e1a-8edb-215379efaec0_1780041577122.pdf",
    r"C:\Users\Admin\.gemini\antigravity-cli\brain\4918d738-d754-4e1a-8edb-215379efaec0\.tempmediaStorage\media_4918d738-d754-4e1a-8edb-215379efaec0_1780041583331.pdf"
]

out_path = r"D:\[DEV] __WUS_Track_DB\scratch\pdf_text.txt"

with open(out_path, "w", encoding="utf-8") as out:
    for idx, path in enumerate(pdf_paths):
        out.write(f"=== PDF {idx+1}: {os.path.basename(path)} ===\n")
        try:
            doc = fitz.open(path)
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text = page.get_text()
                out.write(f"--- Page {page_num+1} ---\n")
                out.write(text)
                out.write("\n")
        except Exception as e:
            out.write(f"Error opening or reading PDF: {e}\n")
        out.write("\n\n")

print("PDF text dumped successfully to scratch/pdf_text.txt")
