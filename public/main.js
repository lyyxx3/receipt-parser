document.getElementById("upload-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById("receipt");
    if (!fileInput.files.length) {
        alert("Please select a receipt image first.");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async () => {
        const base64Image = reader.result.split(",")[1]; // remove prefix

        try {
            // Step 1: Send image to parser.py
            const parserRes = await fetch("/api/parser.py", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: base64Image })
            });

            if (!parserRes.ok) throw new Error("Parser API error");

            const parsedData = await parserRes.json();
            console.log("Parsed receipt data:", parsedData);

            // Step 2: Send parsed data to append.js (Google Sheets)
            const appendRes = await fetch("/api/append.js", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(parsedData)
            });

            if (!appendRes.ok) throw new Error("Append API error");

            const sheetResponse = await appendRes.json();
            console.log("Google Sheets response:", sheetResponse);

            alert("✅ Receipt uploaded and saved successfully!");

        } catch (err) {
            console.error(err);
            alert("❌ Error processing receipt. Check console for details.");
        }
    };

    reader.readAsDataURL(file);
});
