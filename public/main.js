const fileInput = document.getElementById('fileInput');
const ocrText = document.getElementById('ocrText');
const ocrProgress = document.getElementById('ocrProgress');
const parsed = document.getElementById('parsed');
const estEl = document.getElementById('est');
const dtEl = document.getElementById('dt');
const prEl = document.getElementById('pr');
const deEl = document.getElementById('de');
const saveBtn = document.getElementById('saveBtn');
const status = document.getElementById('status');

let lastParsed = null;

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  // show progress
  ocrText.textContent = '';
  parsed.style.display = 'none';
  status.textContent = 'Running OCR... (this runs in your browser)';
  ocrProgress.style.display = 'block';

  try {
    const { data: { text } } = await Tesseract.recognize(file, 'eng', {
      logger: m => {
        // m.progress: 0..1
        if (m.progress) ocrProgress.value = m.progress;
      }
    });

    ocrProgress.style.display = 'none';
    ocrText.textContent = text;

    // parse
    const parsedFields = parseReceiptText(text);
    lastParsed = parsedFields;
    estEl.textContent = parsedFields.establishment || 'Unknown';
    dtEl.textContent = parsedFields.date || 'Unknown';
    prEl.textContent = parsedFields.price || 'Unknown';
    deEl.textContent = parsedFields.details || '';
    parsed.style.display = 'block';
    status.textContent = 'Parsed. Review then tap "Save to Google Sheet".';

  } catch (err) {
    console.error(err);
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
      body: JSON.stringify(lastParsed)
    });
    const j = await res.json();
    if (res.ok) {
      status.textContent = 'Saved to Google Sheet ✅';
    } else {
      status.textContent = 'Save failed: ' + (j.error || res.statusText);
    }
  } catch (err) {
    status.textContent = 'Save error: ' + err.message;
  }
});

/* Very simple parsing heuristics. Improve later as needed. */
function parseReceiptText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 1) establishment = first non-empty line that looks like a name
  let establishment = lines[0] || '';

  // 2) date detection (dd/mm/yyyy or dd-mm-yyyy or yyyy-mm-dd)
  let date = '';
  const dateRe1 = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/;
  const dateRe2 = /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/;
  for (const l of lines) {
    const d1 = l.match(dateRe1);
    const d2 = l.match(dateRe2);
    if (d1) { date = d1[0]; break; }
    if (d2) { date = d2[0]; break; }
  }

  // 3) price detection - look for currency or biggest decimal value
  let price = '';
  const priceCandidates = [];
  const moneyRe = /(?:RM|MYR|\$|USD|€|EUR|£|GBP)?\s*([0-9]{1,3}(?:[.,][0-9]{2})?)/ig;
  for (const l of lines) {
    let m;
    while ((m = moneyRe.exec(l)) !== null) {
      priceCandidates.push(m[0].trim());
    }
  }
  // pick the largest numeric candidate (simple heuristic)
  if (priceCandidates.length) {
    const normalized = priceCandidates.map(s => {
      const raw = s.replace(/[^\d.,]/g,'').replace(',','.');
      return {orig:s, val: parseFloat(raw) || 0};
    });
    normalized.sort((a,b)=>b.val - a.val);
    price = normalized[0].orig;
  }

  const details = lines.slice(1,5).join(' | '); // first few lines as context
  return { establishment, date, price, details };
}

