const fileInput = document.getElementById('fileInput');
const ocrText = document.getElementById('ocrText');
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

  status.textContent = 'Preprocessing image...';
  try {
    const base64Image = await preprocessImage(file);
    status.textContent = 'Sending image for OCR...';

    // Call your backend API to parse and save
    const res = await fetch('/api/append', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ imageBase64: base64Image }),
    });

    const json = await res.json();

    if (res.ok) {
      lastParsed = json;
      estEl.textContent = json.merchant || 'Unknown';
      dtEl.textContent = json.date || 'Unknown';
      prEl.textContent = json.price || 'Unknown';
      parsed.style.display = 'block';
      status.textContent = 'Receipt parsed and saved successfully ✅';
    } else {
      status.textContent = 'Error: ' + (json.error || res.statusText);
      parsed.style.display = 'none';
    }
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    parsed.style.display = 'none';
  }
});

/**
 * Preprocess image to improve OCR accuracy:
 * - Resize large images
 * - Convert to grayscale
 * - Increase contrast
 * Returns base64 string of JPEG
 */
async function preprocessImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = e => {
      img.onload = () => {
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width *= scale;
          height *= scale;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);

        // Grayscale
        const imgData = ctx.getImageData(0, 0, width, height);
        for (let i = 0; i < imgData.data.length; i += 4) {
          const avg = 0.299 * imgData.data[i] + 0.587 * imgData.data[i+1] + 0.114 * imgData.data[i+2];
          imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = avg;
        }
        ctx.putImageData(imgData, 0, 0);

        // Increase contrast
        const contrast = 40; // tweak this for brightness/contrast
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        const imgData2 = ctx.getImageData(0, 0, width, height);
        for (let i = 0; i < imgData2.data.length; i += 4) {
          imgData2.data[i] = truncate(factor * (imgData2.data[i] - 128) + 128);
          imgData2.data[i+1] = truncate(factor * (imgData2.data[i+1] - 128) + 128);
          imgData2.data[i+2] = truncate(factor * (imgData2.data[i+2] - 128) + 128);
        }
        ctx.putImageData(imgData2, 0, 0);

        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);

    function truncate(value) {
      return Math.min(255, Math.max(0, value));
    }
  });
}
