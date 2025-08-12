async function parseReceiptText(text) {
    const response = await fetch('/api/parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });

    if (!response.ok) {
        throw new Error(`Parser API error: ${response.status}`);
    }

    return await response.json();
}

document.getElementById('fileInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const { createWorker } = Tesseract;
    const worker = await createWorker('eng');

    const { data } = await worker.recognize(file);
    console.log("OCR Output:", data.text);

    try {
        // 1. Send OCR text to Python parser
        const parsedData = await parseReceiptText(data.text);
        console.log("Parsed Receipt:", parsedData);

        // 2. Append structured data to Google Sheets
        const appendRes = await fetch('/api/append', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsedData)
        });

        if (!appendRes.ok) {
            throw new Error(`Append API error: ${appendRes.status}`);
        }

        alert("Receipt data saved successfully!");
    } catch (error) {
        console.error(error);
        alert("Error processing receipt");
    }

    await worker.terminate();
});
