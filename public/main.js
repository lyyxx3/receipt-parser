document.addEventListener('DOMContentLoaded', () => {
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
  
    // reset UI
    ocrText.textContent = '';
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
      //ocrText.textContent = text;
  
      // parse
      const parsedFields = parseReceiptText(text);
      lastParsed = parsedFields;
  
      estEl.textContent = parsedFields.establishment || 'Unknown';
      dtEl.textContent = parsedFields.date || 'Unknown';
      prEl.textContent = parsedFields.price || 'Unknown';
      deEl.textContent = parsedFields.details || '';
      parsed.style.display = 'block';
  
      saveBtn.disabled = false;
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
  
  /* Improved parsing heuristics */
  function parseReceiptText(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
    // 1) establishment = first line with letters only (letters, spaces, &, ', ., -)
    let establishment = '';
    for (const line of lines) {
      if (/^[\p{L}\s&'.-]+$/u.test(line)) {
        establishment = line;
        break;
      }
    }
    if (!establishment) establishment = lines[0] || '';
  
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
  
    // 3) price detection — find money amounts near keywords
    const keywords = ['total', 'subtotal', 'amount', 'balance', 'sum', 'payment', 'net'];
    const priceCandidates = [];
    const moneyRe = /(?:RM|MYR|\$|USD|€|EUR|£|GBP)?\s*([0-9]{1,3}(?:[.,][0-9]{2})?)/ig;
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      let m;
      while ((m = moneyRe.exec(line)) !== null) {
        const rawMoney = m[0].trim();
        let normalizedVal = parseFloat(rawMoney.replace(/[^\d.,]/g, '').replace(',', '.'));
        if (isNaN(normalizedVal)) continue;
  
        let score = 0;
        for (const kw of keywords) {
          if (line.includes(kw)) score += 10;
        }
        if (line.includes('cash')) score -= 20;
        if (line.includes('change')) score -= 20;
        if (line.includes('received')) score -= 20;
  
        priceCandidates.push({val: normalizedVal, raw: rawMoney, score, index: i});
      }
    }
  
    priceCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.val !== a.val) return b.val - a.val;
      return b.index - a.index;
    });
  
    const price = priceCandidates.length ? priceCandidates[0].raw : '';
  
    const details = lines.slice(1,5).join(' | ');
  
    return { establishment, date, price, details };
  }
});
