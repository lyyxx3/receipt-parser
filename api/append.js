import { google } from 'googleapis';
import { Readable } from 'stream';

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
    const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!SHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      console.error('Missing environment variables:', {
        hasSheetId: !!SHEET_ID,
        hasEmail: !!GOOGLE_CLIENT_EMAIL,
        hasKey: !!GOOGLE_PRIVATE_KEY,
        hasDriveFolder: !!DRIVE_FOLDER_ID
      });
      return res.status(500).json({ 
        error: 'Missing Google API credentials in environment variables' 
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'No imageBase64 in request body' });
    }

    // Create JWT auth with both Drive and Sheets permissions
    const auth = new google.auth.JWT(
      GOOGLE_CLIENT_EMAIL,
      null,
      GOOGLE_PRIVATE_KEY,
      [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
      ]
    );

    // Authenticate
    await auth.authorize();

    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // Step 1: Upload image to Google Drive
    console.log('Uploading image to Google Drive...');
    const buffer = Buffer.from(imageBase64, 'base64');
    
    // Convert buffer to readable stream
    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null); // End the stream
    
    const fileMetadata = {
      name: `receipt-${Date.now()}.png`,
      ...(DRIVE_FOLDER_ID && { parents: [DRIVE_FOLDER_ID] })
    };

    const media = {
      mimeType: 'image/png',
      body: bufferStream
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });

    const fileId = file.data.id;
    console.log('Image uploaded with ID:', fileId);

    // Step 2: Make the file publicly accessible
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    // Step 3: Create the public URL and IMAGE formula
    const publicUrl = `https://drive.google.com/uc?id=${fileId}`;
    const imageFormula = `=IMAGE("${publicUrl}")`;

    // Step 4: Append data to Google Sheet (without timestamp)
    console.log('Appending to Google Sheet...');
    const values = [
      [
        imageFormula,                // IMAGE formula for the receipt
        establishment || 'Unknown',
        date || 'Unknown',
        price || 'Unknown',
      ]
    ];

    const request = {
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:D',  // Updated range since we removed timestamp
      valueInputOption: 'USER_ENTERED',  // This allows formulas to be processed
      insertDataOption: 'INSERT_ROWS',
      resource: { values }
    };

    const response = await sheets.spreadsheets.values.append(request);
    
    console.log('Sheet append successful');
    res.status(200).json({ 
      success: true, 
      imageUrl: publicUrl,
      data: response.data 
    });

  } catch (error) {
    console.error('Error processing receipt:', error);
    
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
