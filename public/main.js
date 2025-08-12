document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("file-input");

    if (!fileInput) {
        console.error("❌ file-input element not found in DOM.");
        return;
    }

    fileInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const formData = new FormData();
            formData.append("file", file);

            // Send to backend API
            const response = await fetch("/api/append", {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }

            const result = await response.json();
            console.log("✅ Server response:", result);
            alert("✅ Receipt processed and added to Google Sheets!");
        } catch (error) {
            console.error("❌ Error uploading file:", error);
            alert("❌ Failed to process receipt. See console for details.");
        }
    });
});
