import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed, use POST' });
    }

    let data;
    if (typeof req.body === 'string') {
      data = JSON.parse(req.body);
    } else {
      data = req.body;
    }

    const { imageBase64 } = data;
    if (!imageBase64) {
      return res.status(400).json({ error: 'No imageBase64 in request body' });
    }

    const ocrApiKey = process.env.OCR_SPACE_API_KEY;
    if (!ocrApiKey) throw new Error('OCR_SPACE_API_KEY env var missing');

    // Call OCR.space API with the preprocessed base64 image
    const ocrRes = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { apikey: ocrApiKey },
      body: new URLSearchParams({
        base64Image: `data:image/jpeg;base64,${imageBase64}`,
        language: 'eng',
        isTable: 'false',
        scale: 'true',
        OCREngine: '2'
      }),
    });

    const ocrJson = await ocrRes.json();
    if (ocrJson.IsErroredOnProcessing) {
      throw new Error('OCR API error: ' + (ocrJson.ErrorMessage?.join('; ') || 'Unknown error'));
    }

    const parsedText = ocrJson?.ParsedResults?.[0]?.ParsedText || '';
    if (!parsedText) {
      throw new Error('No parsed text from OCR');
    }

    // Parse lines
    const lines = parsedText.split('\n').map(l => l.trim()).filter(Boolean);

    // Merchant: first line with mostly letters
    let merchant = 'Unknown';
    for (const line of lines.slice(0, 5)) {
      const digitCount = (line.match(/\d/g) || []).length;
      const letterCount = (line.match(/[A-Za-z]/g) || []).length;
      if (letterCount > digitCount && letterCount > 3) {
        merchant = line;
        break;
      }
    }

    // Date patterns
    const datePatterns = [
      /\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/,       // 26/01/2015 or 26-01-2015
      /\b\d{4}[\/\-]\d{2}[\/\-]\d{2}\b/,       // 2015/01/26 or 2015-01-26
      /\b\d{1,2} \w{3} \d{4}\b/,                // 26 Jan 2015
      /\b\w{3} \d{1,2}, \d{4}\b/,               // Jan 26, 2015
    ];
    let date = 'Unknown';
    for (const pattern of datePatterns) {
      for (const line of lines) {
        const match = line.match(pattern);
        if (match) {
          date = match[0];
          break;
        }
      }
      if (date !== 'Unknown') break;
    }

    // Price candidates
    const priceKeywords = /total|sum|amount|subtotal|grand|balance/i;
    let candidates = [];

    for (const line of lines) {
      if (priceKeywords.test(line)) {
        const nums = line.match(/\d+[.,]\d{2}/g);
        if (nums) candidates.push(...nums);
      }
    }

    // fallback: any decimal numbers in receipt
    if (candidates.length === 0) {
      for (const line of lines) {
        const nums = line.match(/\d+[.,]\d{2}/g);
        if (nums) candidates.push(...nums);
      }
    }

    // Normalize numbers and pick max
    let price = 'Unknown';
    if (candidates.length > 0) {
      const normalized = candidates.map(s => parseFloat(s.replace(',', '.'))).filter(n => !isNaN(n));
      if (normalized.length > 0) {
        price = normalized.reduce((a, b) => (b > a ? b : a), 0).toFixed(2);
      }
    }

    // Save to Google Sheets
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
    if (!creds.client_email) throw new Error('Invalid Google service account JSON');

    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'Sheet1!A:C',
      valueInputOption: 'RAW',
      requestBody: { values: [[merchant, date, price]] },
    });

    return res.status(200).json({ merchant, date, price });
  } catch (error) {
    console.error('Error in /api/append:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
