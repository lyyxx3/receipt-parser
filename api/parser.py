import re
from flask import Request

def parse_receipt_text(text):
    # --- Store Name ---
    # Assume store name is the first line of text with letters (and maybe & or -)
    store_pattern = re.compile(r"^[A-Z][A-Z\s\-\&]{2,}$", re.MULTILINE)
    store_match = store_pattern.search(text)
    store_name = store_match.group(0).strip() if store_match else None

    # --- Date ---
    date_pattern = re.compile(
        r"\b(\d{1,2}[\/\-\s]\d{1,2}[\/\-\s]\d{2,4}|\d{4}[\/\-\s]\d{1,2}[\/\-\s]\d{1,2})\b"
    )
    date_match = date_pattern.search(text)
    date = date_match.group(0) if date_match else None

    # --- Totals ---
    total_pattern = re.compile(r"(?:Grand\s*Total|Total\s*Amount|Total)\s*[:\-]?\s*\$?\s*(\d+\.\d{2})", re.IGNORECASE)
    subtotal_pattern = re.compile(r"(?:Sub\s*Total|Subtotal)\s*[:\-]?\s*\$?\s*(\d+\.\d{2})", re.IGNORECASE)
    tax_pattern = re.compile(r"(?:Tax|GST|VAT)\s*[:\-]?\s*\$?\s*(\d+\.\d{2})", re.IGNORECASE)

    total = float(total_pattern.search(text).group(1)) if total_pattern.search(text) else None
    subtotal = float(subtotal_pattern.search(text).group(1)) if subtotal_pattern.search(text) else None
    tax = float(tax_pattern.search(text).group(1)) if tax_pattern.search(text) else None

    # --- Items ---
    # Matches: "ItemName  2  5.99" or "ItemName  $5.99"
    item_pattern = re.compile(
        r"^([A-Za-z0-9\s\-\&]+?)\s+(\d+)?\s*\$?(\d+\.\d{2})$",
        re.MULTILINE
    )

    items = []
    for match in item_pattern.finditer(text):
        name = match.group(1).strip()
        qty = int(match.group(2)) if match.group(2) else 1
        price = float(match.group(3))
        items.append({
            "product": name,
            "quantity": qty,
            "price": price
        })

    return {
        "store_name": store_name,
        "date": date,
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
        "items": items
    }

def handler(request: Request):
    data = request.get_json()
    if not data or "text" not in data:
        return {"error": "Missing 'text' field"}, 400

    parsed_data = parse_receipt_text(data["text"])
    return parsed_data, 200
