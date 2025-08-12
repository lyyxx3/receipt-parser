import json
import re
import base64
import requests
from io import BytesIO
from PIL import Image, ImageEnhance, ImageFilter

OCR_API_KEY = "K86891758288957"
OCR_URL = "https://vision.googleapis.com/v1/images:annotate"

def preprocess_image(image_bytes):
    """Enhance receipt image before OCR for better accuracy."""
    img = Image.open(BytesIO(image_bytes)).convert("L")  # grayscale
    img = img.filter(ImageFilter.SHARPEN)
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2)  # boost contrast
    output = BytesIO()
    img.save(output, format="JPEG")
    return output.getvalue()

def ocr_google(image_bytes):
    """Send image to Google Vision API and return extracted text."""
    img_b64 = base64.b64encode(image_bytes).decode("utf-8")
    payload = {
        "requests": [
            {
                "image": {"content": img_b64},
                "features": [{"type": "TEXT_DETECTION"}]
            }
        ]
    }
    response = requests.post(f"{OCR_URL}?key={OCR_API_KEY}", json=payload)
    result = response.json()
    try:
        return result["responses"][0]["fullTextAnnotation"]["text"]
    except KeyError:
        return ""

def extract_receipt_info(text):
    """Extract store name, date, total, and items from OCR text."""
    store_name = text.split("\n")[0].strip()
    
    date_match = re.search(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b", text)
    date = date_match.group(1) if date_match else "Unknown"

    total_match = re.search(r"TOTAL\s*[\$:RM]*\s*([0-9]+(?:\.[0-9]{2})?)", text, re.IGNORECASE)
    total = total_match.group(1) if total_match else "Unknown"

    items = []
    for line in text.split("\n"):
        if re.match(r".+\s+\d+\.\d{2}$", line.strip()):
            items.append(line.strip())

    return {
        "store": store_name,
        "date": date,
        "total": total,
        "items": items
    }

def handler(request, context):
    try:
        body = json.loads(request.body)
        image_data = base64.b64decode(body.get("image", ""))

        # Step 1: Preprocess image
        processed_img = preprocess_image(image_data)

        # Step 2: OCR
        ocr_text = ocr_google(processed_img)

        # Step 3: Extract structured info
        parsed_data = extract_receipt_info(ocr_text)

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(parsed_data)
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
