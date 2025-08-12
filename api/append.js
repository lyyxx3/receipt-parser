import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { store, date, total, items } = req.body;

    if (!store || !date || !total) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:D',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          [store, date, total, JSON.stringify(items)]
        ]
      }
    });

    res.status(200).json({ message: 'Data appended successfully' });
  } catch (error) {
    console.error('Error appending data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
