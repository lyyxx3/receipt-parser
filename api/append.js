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

    // Call OCR.space API using native fetch
    const ocrRes = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { apikey: ocrApiKey },
      body: new URLSearchParams({
        base64Image: `data:image/jpeg;base64,${imageBase64}`,
        language: 'eng',
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

    // Simple parsing: merchant = first line, date & price via regex
    const merchant = parsedText.split('\n')[0]?.trim() || 'Unknown';
    const dateMatch = parsedText.match(/\b\d{2}[-\/]\d{2}[-\/]\d{4}\b/);
    const priceMatch = parsedText.match(/\b\d+\.\d{2}\b/);
    const date = dateMatch ? dateMatch[0] : 'Unknown';
    const price = priceMatch ? priceMatch[0] : 'Unknown';

    // Google Sheets append
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
    if (!creds.client_email) throw new Error('Invalid Google service account JSON');

    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
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
