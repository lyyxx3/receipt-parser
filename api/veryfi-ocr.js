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
    const { imageBase64 } = req.body;

    // Validate Veryfi credentials
    const VERYFI_CLIENT_ID = process.env.VERYFI_CLIENT_ID;
    const VERYFI_CLIENT_SECRET = process.env.VERYFI_CLIENT_SECRET;
    const VERYFI_USERNAME = process.env.VERYFI_USERNAME;
    const VERYFI_API_KEY = process.env.VERYFI_API_KEY;

    if (!VERYFI_CLIENT_ID || !VERYFI_CLIENT_SECRET || !VERYFI_USERNAME || !VERYFI_API_KEY) {
      return res.status(500).json({ 
        error: 'Missing Veryfi API credentials in environment variables' 
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'No imageBase64 in request body' });
    }

    console.log('Processing receipt with Veryfi...');

    // Prepare the request to Veryfi
    const veryfiUrl = 'https://api.veryfi.com/api/v8/partner/documents/';
    
    const requestBody = {
      file_data: imageBase64,
      file_name: `receipt-${Date.now()}.png`,
      categories: ['Grocery', 'Restaurant', 'Gas & Automotive', 'Office Supplies', 'Other'],
      auto_delete: false // Keep for your records
    };

    const response = await fetch(veryfiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'CLIENT-ID': VERYFI_CLIENT_ID,
        'AUTHORIZATION': `apikey ${VERYFI_USERNAME}:${VERYFI_API_KEY}`,
        'X-Veryfi-Request-Timestamp': Math.floor(Date.now() / 1000).toString(),
        'User-Agent': 'Receipt Parser App'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Veryfi API error:', errorText);
      throw new Error(`Veryfi API error: ${response.status} ${response.statusText}`);
    }

    const veryfiData = await response.json();
    console.log('Veryfi response received');

    // Extract the key information from Veryfi's response
    const parsedData = {
      establishment: veryfiData.vendor?.name || 
                    veryfiData.vendor?.raw_name || 
                    veryfiData.merchant || 
                    'Unknown',
      date: veryfiData.date || 
            veryfiData.document_date || 
            'Unknown',
      price: veryfiData.total ? veryfiData.total.toString() : 'Unknown', // Remove $ sign
      rawText: veryfiData.ocr_text || '',
      confidence: veryfiData.confidence || 0,
      // Additional useful fields
      subtotal: veryfiData.subtotal,
      tax: veryfiData.tax,
      tip: veryfiData.tip,
      category: veryfiData.category,
      line_items: veryfiData.line_items || []
    };

    res.status(200).json({ 
      success: true, 
      data: parsedData,
      raw_veryfi_data: veryfiData // Include full response for debugging
    });

  } catch (error) {
    console.error('Veryfi OCR error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Veryfi OCR processing failed'
    });
  }
}
