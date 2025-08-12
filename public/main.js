document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("file-input");
  const statusEl = document.getElementById("status");
  const resultEl = document.getElementById("result");
  const merchantEl = document.getElementById("merchant");
  const dateEl = document.getElementById("date");
  const priceEl = document.getElementById("price");

  if (!fileInput) {
    console.error("❌ file-input element not found in DOM.");
    return;
  }

  fileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    statusEl.textContent = "⏳ Processing receipt...";
    resultEl.style.display = "none";

    try {
      const reader = new FileReader();

      reader.onload = async function (e) {
        const base64 = e.target.result.split(",")[1];

        const response = await fetch("/api/append", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 }),
        });

        const result = await response.json();

        if (response.ok) {
          merchantEl.textContent = result.merchant || "Unknown";
          dateEl.textContent = result.date || "Unknown";
          priceEl.textContent = result.price || "Unknown";

          statusEl.textContent = "✅ Receipt processed successfully!";
          resultEl.style.display = "block";
        } else {
          throw new Error(result.error || "Failed to process receipt");
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("❌ Error uploading file:", error);
      statusEl.textContent = "❌ " + error.message;
      resultEl.style.display = "none";
    }
  });
});
