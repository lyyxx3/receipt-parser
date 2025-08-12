// api/append.js
const { google } = require('googleapis');

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Only POST allowed' });
    }

    // parse incoming JSON
    const { establishment, date, price, details } = req.body || {};

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_SHEET_ID) {
      return res.status(500).json({ error: 'Server not configured' });
    }

    // load service account from env var (we'll store full JSON text in env)
    const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const client = new google.auth.JWT(
      key.client_email,
      null,
      key.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    await client.authorize();

    const sheets = google.sheets({ version: 'v4', auth: client });

    const now = new Date().toLocaleString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1!A:E',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[ establishment || '', date || '', price || '', details || '', now ]]
      }
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: err.message || String(err) });
  }
};

