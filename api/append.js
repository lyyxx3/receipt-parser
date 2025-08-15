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
    console.log('Processing receipt upload...');
    const { establishment, date, price, imageBase64 } = req.body;

    // Validate environment variables
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;
    const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
    const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n');
    const IMAGEBB_API_KEY = process.env.IMAGEBB_API_KEY;

    if (!SHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ 
        error: 'Missing Google Sheets API credentials in environment variables' 
      });
    }

    if (!IMAGEBB_API_KEY) {
      return res.status(500).json({ 
        error: 'Missing IMAGEBB_API_KEY in environment variables' 
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'No imageBase64 in request body' });
    }

    // Upload to ImageBB
    console.log('Uploading image to ImageBB...');
    
    const formData = new FormData();
    formData.append('image', imageBase64);

    const imagebbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMAGEBB_API_KEY}`, {
      method: 'POST',
      body: formData
    });

    if (!imagebbResponse.ok) {
      const errorText = await imagebbResponse.text();
      console.error('ImageBB error:', errorText);
      throw new Error(`ImageBB upload failed: ${imagebbResponse.status} ${imagebbResponse.statusText}`);
    }

    const imagebbData = await imagebbResponse.json();
    
    if (!imagebbData.success) {
      throw new Error(`ImageBB API error: ${imagebbData.error?.message || 'Unknown error'}`);
    }
    
    const imageUrl = imagebbData.data.url;
    console.log('Image uploaded to:', imageUrl);

    // Create JWT auth for Sheets
    const auth = new google.auth.JWT(
      GOOGLE_CLIENT_EMAIL,
      null,
      GOOGLE_PRIVATE_KEY,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    // Create IMAGE formula with ImageBB URL
    const imageFormula = `=IMAGE("${imageUrl}")`;

    // Append data to Google Sheet
    console.log('Appending to Google Sheet...');
    const values = [
      [
        imageFormula,                // IMAGE formula with ImageBB URL
        establishment || 'Unknown',
        date || 'Unknown',
        price || 'Unknown',
      ]
    ];

    const request = {
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:D',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values }
    };

    const response = await sheets.spreadsheets.values.append(request);
    
    console.log('Sheet append successful');
    res.status(200).json({ 
      success: true, 
      imageUrl: imageUrl,
      data: response.data 
    });

  } catch (error) {
    console.error('Error processing receipt:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.code || 'Unknown error'
    });
  }
}
