import { google } from 'googleapis';

const sheets = google.sheets('v4');

// Load Google credentials from env vars
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n');

if (!SHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
  throw new Error('Missing Google Sheets API credentials in environment variables');
}

const auth = new google.auth.JWT(
  GOOGLE_CLIENT_EMAIL,
  null,
  GOOGLE_PRIVATE_KEY,
  ['https://www.googleapis.com/auth/spreadsheets']
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed, POST only' });
    return;
  }

  try {
    const { establishment, date, price, imageBase64 } = req.body;

    if (!imageBase64) {
      res.status(400).json({ error: 'No imageBase64 in request body' });
      return;
    }

    // Authenticate with Google Sheets API
    await auth.authorize();

    // Prepare values to append
    const values = [
      [
        new Date().toISOString(),    // Timestamp
        imageBase64,
        establishment || 'Unknown',
        date || 'Unknown',
        price || 'Unknown',
      ]
    ];

    const request = {
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:E',  // Adjust sheet name and range if needed
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values },
      auth
    };

    await sheets.spreadsheets.values.append(request);

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Google Sheets append error:', error);
    res.status(500).json({ error: error.message });
  }
}
