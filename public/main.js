document.getElementById('receiptInput').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64 = e.target.result.split(',')[1];

    const response = await fetch('/api/append', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: base64 })
    });

    const result = await response.json();
    if (result.error) {
      alert('Error: ' + result.error);
    } else {
      alert(`✅ Receipt added:\nMerchant: ${result.merchant}\nDate: ${result.date}\nPrice: ${result.price}`);
    }
  };

  reader.readAsDataURL(file);
});
