document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const ocrProgress = document.getElementById('ocrProgress');
  const parsed = document.getElementById('parsed');
  const estEl = document.getElementById('est');
  const dtEl = document.getElementById('dt');
  const prEl = document.getElementById('pr');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');

  let lastParsed = null;

  // Parse receipt text to extract merchant, date, and price
  function parseReceiptText(text) {
    console.log('Raw OCR text:', text);
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let establishment = 'Unknown';
    let date = 'Unknown';
    let price = 'Unknown';

    // Extract establishment (usually first few lines)
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      // Look for lines that don't contain numbers or common receipt words
      if (line.length > 2 && 
          !line.match(/^\d/) && 
          !line.toLowerCase().includes('receipt') &&
          !line.toLowerCase().includes('tel') &&
          !line.toLowerCase().includes('phone') &&
          !line.toLowerCase().includes('address')) {
        establishment = line;
        break;
      }
    }

    // Extract date patterns
    const datePatterns = [
      /\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b/g,
      /\b(\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{2,4})\b/gi,
      /\b((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s+\d{2,4})\b/gi
    ];
    
    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        date = matches[0];
        break;
      }
    }

    // Extract price (look for total, amount, etc.)
    const pricePatterns = [
      /total[\s:]*\$?(\d+\.?\d*)/gi,
      /amount[\s:]*\$?(\d+\.?\d*)/gi,
      /\$(\d+\.?\d{2})/g,
      /(\d+\.\d{2})$/gm
    ];
    
    for (const pattern of pricePatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        // Extract just the number part
        const match = matches[0];
        const numberMatch = match.match(/(\d+\.?\d*)/);
        if (numberMatch) {
          price = '$' + numberMatch[1];
          break;
        }
      }
    }

    return { establishment, date, price };
  }

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
  
    parsed.style.display = 'none';
    saveBtn.disabled = true;
    status.textContent = 'Running OCR... (this runs in your browser)';
    ocrProgress.style.display = 'block';
    ocrProgress.value = 0;
  
    try {
      // Convert file to base64
      const imageBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64Data = reader.result.split(',')[1]; // strip "data:image/jpeg;base64,"
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
  
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (m.progress) ocrProgress.value = m.progress;
        }
      });
  
      ocrProgress.style.display = 'none';
  
      const parsedFields = parseReceiptText(text);
  
      // Ensure imageBase64 is stored with parsed data
      lastParsed = { 
        establishment: parsedFields.establishment || 'Unknown',
        date: parsedFields.date || 'Unknown',
        price: parsedFields.price || 'Unknown',
        imageBase64 
      };
  
      estEl.textContent = lastParsed.establishment;
      dtEl.textContent = lastParsed.date;
      prEl.textContent = lastParsed.price;
  
      parsed.style.display = 'block';
      saveBtn.disabled = false;
      status.textContent = 'Parsed. Review then tap "Save to Google Sheet".';
  
    } catch (err) {
      status.textContent = 'OCR failed: ' + err.message;
      ocrProgress.style.display = 'none';
    }
  });

  // Save button event listener
  saveBtn.addEventListener('click', async () => {
    if (!lastParsed) {
      status.textContent = 'No data to save!';
      return;
    }

    saveBtn.disabled = true;
    status.textContent = 'Saving to Google Sheet...';

    try {
      const response = await fetch('/api/append', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(lastParsed)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        status.textContent = 'Successfully saved to Google Sheet!';
        status.style.color = 'green';
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (err) {
      console.error('Save error:', err);
      status.textContent = 'Save failed: ' + err.message;
      status.style.color = 'red';
    } finally {
      saveBtn.disabled = false;
      // Reset status color after 3 seconds
      setTimeout(() => {
        status.style.color = '';
      }, 3000);
    }
  });
});
