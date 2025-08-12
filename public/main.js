document.getElementById('receiptInput').addEventListener('change', async function () {
    const file = this.files[0];
    if (!file) {
        alert("Please select a file first.");
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    console.log("Uploading file to /api/append ...");

    try {
        const res = await fetch('/api/append', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        console.log("Server response:", data);

        if (res.ok) {
            alert(`✅ Upload successful: ${JSON.stringify(data)}`);
        } else {
            alert(`❌ Upload failed: ${data.error || "Unknown error"}`);
        }
    } catch (err) {
        console.error("Fetch error:", err);
        alert("❌ Could not upload file. Check console for details.");
    }
});
