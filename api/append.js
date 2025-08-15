import { google } from 'googleapis';

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed, POST only' });
    return;
  }

  try {
    console.log('Request body:', req.body);
    const { establishment, date, price, imageBase64 } = req.body;

    // Validate environment variables
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;
    const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
    const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n');

    if (!SHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      console.error('Missing environment variables:', {
        hasSheetId: !!SHEET_ID,
        hasEmail: !!GOOGLE_CLIENT_EMAIL,
        hasKey: !!GOOGLE_PRIVATE_KEY
      });
      return res.status(500).json({ 
        error: 'Missing Google Sheets API credentials in environment variables' 
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'No imageBase64 in request body' });
    }

    // Create JWT auth
    const auth = new google.auth.JWT(
      GOOGLE_CLIENT_EMAIL,
      null,
      GOOGLE_PRIVATE_KEY,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    // Authenticate
    await auth.authorize();

    const sheets = google.sheets({ version: 'v4', auth });

    // For now, we'll store a placeholder for the image since storing base64 directly 
    // in sheets can be problematic due to size limits
    const imageText = `[Image Data: ${imageBase64.length} characters]`;

    // Prepare values to append
    const values = [
      [
        new Date().toISOString(),    // Timestamp
        imageText,                   // Image placeholder (you may want to upload to Drive instead)
        establishment || 'Unknown',
        date || 'Unknown',
        price || 'Unknown',
      ]
    ];

    console.log('Attempting to append to sheet:', SHEET_ID);

    const request = {
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:E',  // Adjust sheet name if needed
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values }
    };

    const response = await sheets.spreadsheets.values.append(request);
    
    console.log('Sheet append successful:', response.data);
    res.status(200).json({ success: true, data: response.data });

  } catch (error) {
    console.error('Google Sheets append error:', error);
    
    // More detailed error logging
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.errors) {
      console.error('Error details:', error.errors);
    }
    
    res.status(500).json({ 
      error: error.message,
      details: error.code || 'Unknown error'
    });
  }
}
