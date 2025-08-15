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
    const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID; // Optional, for higher rate limits

    if (!SHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ 
        error: 'Missing Google Sheets API credentials in environment variables' 
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'No imageBase64 in request body' });
    }

    // Upload to Imgur with multiple fallbacks
    console.log('Uploading image to Imgur...');
    
    const clientIds = [
      'c9a6efb3d7932fd',
      '546c25a59c58ad7', 
      '1ceddedc03a5d71'
    ];

    let imageUrl = null;

    // Try each client ID
    for (const clientId of clientIds) {
      try {
        console.log(`Trying Imgur with client ID: ${clientId}`);
        
        const response = await fetch('https://api.imgur.com/3/image', {
          method: 'POST',
          headers: {
            'Authorization': `Client-ID ${clientId}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: imageBase64,
            type: 'base64',
            title: `Receipt ${Date.now()}`
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            imageUrl = data.data.link;
            console.log('Success with client ID:', clientId);
            console.log('Image uploaded to:', imageUrl);
            break;
          }
        }
      } catch (error) {
        console.log(`Failed with client ID ${clientId}:`, error.message);
        continue;
      }
    }

    // Try without client ID as last resort
    if (!imageUrl) {
      try {
        console.log('Trying without client ID...');
        const response = await fetch('https://api.imgur.com/3/image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: imageBase64,
            type: 'base64'
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            imageUrl = data.data.link;
            console.log('Success without client ID');
            console.log('Image uploaded to:', imageUrl);
          }
        }
      } catch (error) {
        console.log('Failed without client ID:', error.message);
      }
    }

    if (!imageUrl) {
      throw new Error('All Imgur upload methods failed');
    }

    // Create JWT auth for Sheets
    const auth = new google.auth.JWT(
      GOOGLE_CLIENT_EMAIL,
      null,
      GOOGLE_PRIVATE_KEY,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    // Create IMAGE formula with Imgur URL
    const imageFormula = `=IMAGE("${imageUrl}")`;

    // Append data to Google Sheet
    console.log('Appending to Google Sheet...');
    const values = [
      [
        imageFormula,                // IMAGE formula with Imgur URL
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
