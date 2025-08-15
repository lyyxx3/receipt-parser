import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).send({ message: 'Only POST requests allowed' });
    }

    const { imageBase64, sheetId, sheetRange } = req.body;
    if (!imageBase64) {
      return res.status(400).send({ message: 'No imageBase64 in request body' });
    }

    // 1. Auth with Google
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_KEY), // put JSON in env var
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets'
      ]
    });
    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // 2. Convert base64 to buffer
    const buffer = Buffer.from(imageBase64, 'base64');

    // 3. Upload to Drive
    const fileMetaData = {
      name: `receipt-${Date.now()}.png`,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID] // folder ID in your Drive
    };
    const media = {
      mimeType: 'image/png',
      body: Buffer.from(buffer)
    };

    const file = await drive.files.create({
      resource: fileMetaData,
      media: {
        mimeType: 'image/png',
        body: buffer
      },
      fields: 'id'
    });

    const fileId = file.data.id;

    // 4. Make public
    await drive.permissions.create({
      fileId: fileId,
      requestBody: { role: 'reader', type: 'anyone' }
    });

    // 5. Create IMAGE formula
    const publicUrl = `https://drive.google.com/uc?id=${fileId}`;
    const formula = `=IMAGE("${publicUrl}")`;

    // 6. Save to Google Sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: sheetRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[formula]]
      }
    });

    return res.status(200).json({ success: true, imageUrl: publicUrl });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: error.message });
  }
}
