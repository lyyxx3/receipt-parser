import { google } from "googleapis";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { store_name, date, subtotal, tax, total, items } = req.body;

    if (!store_name || !total) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Convert items array into a readable string
    let itemsFormatted = "";
    if (Array.isArray(items)) {
      itemsFormatted = items
        .map(
          (item) =>
            `${item.product || "Unknown"} x${item.quantity || 1} ($${item.price || 0})`
        )
        .join(", ");
    } else {
      itemsFormatted = "No items listed";
    }

    // Auth with Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.SPREADSHEET_ID;

    // Append the row
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Sheet1!A:F", // Matches 6 columns: Store | Date | Subtotal | Tax | Total | Items
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            store_name,
            date || "",
            subtotal || "",
            tax || "",
            total,
            itemsFormatted,
          ],
        ],
      },
    });

    res.status(200).json({ message: "Saved to Google Sheets" });
  } catch (error) {
    console.error("Google Sheets Append Error:", error);
    res.status(500).json({ error: "Failed to save data" });
  }
}
