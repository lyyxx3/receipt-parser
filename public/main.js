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
});
