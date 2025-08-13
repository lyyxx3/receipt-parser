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
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (m.progress) ocrProgress.value = m.progress;
        }
      });

      ocrProgress.style.display = 'none';

      const parsedFields = parseReceiptText(text);
      lastParsed = parsedFields;

      estEl.textContent = parsedFields.establishment || 'Unknown';
      dtEl.textContent = parsedFields.date || 'Unknown';
      prEl.textContent = parsedFields.price || 'Unknown';
      parsed.style.display = 'block';

      saveBtn.disabled = false;
      status.textContent = 'Parsed. Review then tap "Save to Google Sheet".';

    } catch (err) {
      status.textContent = 'OCR failed: ' + err.message;
      ocrProgress.style.display = 'none';
    }
  });

  saveBtn.addEventListener('click', async () => {
    if (!lastParsed) return;
    status.textContent = 'Saving...';
    try {
      const res = await fetch('/api/append', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        bod
