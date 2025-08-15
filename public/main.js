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

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
  
    parsed.style.display = 'none';
    saveBtn.disabled = true;
    status.textContent = 'Processing receipt with Veryfi AI...';
    ocrProgress.style.display = 'block';
    ocrProgress.value = 0.2; // Show some progress immediately
  
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

      ocrProgress.value = 0.4;
      status.textContent = 'Sending to Veryfi for processing...';
  
      // Send to Veryfi API
      const response = await fetch('/api/veryfi-ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64 })
      });

      ocrProgress.value = 0.8;

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Veryfi processing failed');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error('Veryfi processing failed');
      }

      ocrProgress.value = 1.0;
      ocrProgress.style.display = 'none';

      // Use Veryfi's parsed data
      const veryfiData = result.data;
      
      // Store parsed data with imageBase64
      lastParsed = { 
        establishment: veryfiData.establishment || 'Unknown',
        date: veryfiData.date || 'Unknown',
        price: veryfiData.price || 'Unknown',
        imageBase64,
        // Store additional Veryfi data
        confidence: veryfiData.confidence,
        subtotal: veryfiData.subtotal,
        tax: veryfiData.tax,
        category: veryfiData.category
      };
  
      estEl.textContent = lastParsed.establishment;
      dtEl.textContent = lastParsed.date;
      prEl.textContent = lastParsed.price;
  
      parsed.style.display = 'block';
      saveBtn.disabled = false;
      
      // Show confidence if available
      const confidenceText = veryfiData.confidence ? 
        ` (Confidence: ${Math.round(veryfiData.confidence * 100)}%)` : '';
      status.textContent = `Parsed successfully!${confidenceText} Review and save.`;
      status.style.color = 'green';

      // Log additional details for debugging
      console.log('Veryfi parsing results:', veryfiData);
      if (veryfiData.line_items && veryfiData.line_items.length > 0) {
        console.log('Line items found:', veryfiData.line_items);
      }
  
    } catch (err) {
      console.error('Processing error:', err);
      status.textContent = 'Processing failed: ' + err.message + '. Try with a clearer image.';
      status.style.color = 'red';
      ocrProgress.style.display = 'none';
      
      // Reset color after 5 seconds
      setTimeout(() => {
        status.style.color = '';
      }, 5000);
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
    status.style.color = '';

    try {
      const response = await fetch('/api/append', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          establishment: lastParsed.establishment,
          date: lastParsed.date,
          price: lastParsed.price,
          imageBase64: lastParsed.imageBase64
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        status.textContent = 'Successfully saved to Google Sheet!';
        status.style.color = 'green';
        
        // Optional: Clear the form after successful save
        setTimeout(() => {
          fileInput.value = '';
          parsed.style.display = 'none';
          saveBtn.disabled = true;
          lastParsed = null;
        }, 2000);
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
