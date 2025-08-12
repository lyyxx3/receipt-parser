import fetch from 'node-fetch';
import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const { imageBase64 } = JSON.parse(req.body);

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // 1. Call OCR.space API
    const ocrApiKey = process.env.OCR_SPACE_API_KEY;
    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        apikey: ocrApiKey
      },
      body: new URLSearchParams({
        base64Image: `data:image/jpeg;base64,${imageBase64}`,
        language: 'eng'
      })
    });

    const ocrResult = await ocrResponse.json();
    const parsedText = ocrResult?.ParsedResults?.[0]?.ParsedText || '';

    if (!parsedText) {
      return res.status(500).json({ error: 'OCR failed' });
    }

    // 2. Extract info via regex
    const merchant = parsedText.split('\n')[0]?.trim() || 'Unknown';
    const dateMatch = parsedText.match(/\b\d{2}[-\/]\d{2}[-\/]\d{4}\b/);
    const priceMatch = parsedText.match(/\b\d+\.\d{2}\b/);

    const date = dateMatch ? dateMatch[0] : 'Unknown';
    const price = priceMatch ? priceMatch[0] : 'Unknown';

    // 3. Append to Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'Sheet1!A:C',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[merchant, date, price]]
      }
    });

    // 4. Return success
    res.status(200).json({ merchant, date, price });

  } catch (error) {
    console.error('Error in append.js:', error);
    res.status(500).json({ error: error.message });
  }
}
