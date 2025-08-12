import { google } from "googleapis";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        const { store, date, total, items } = req.body;

        if (!store || !date || !total) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Google Sheets API authentication
        const auth = new google.auth.GoogleAuth({
            credentials: {
                type: process.env.GOOGLE_TYPE,
                project_id: process.env.GOOGLE_PROJECT_ID,
                private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                client_id: process.env.GOOGLE_CLIENT_ID,
                universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"]
        });

        const sheets = google.sheets({ version: "v4", auth });

        // Format the row to add
        const newRow = [
            new Date().toLocaleString("en-MY"), // timestamp
            store,
            date,
            total,
            items && items.length ? items.join(", ") : ""
        ];

        // Append to Google Sheet
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SHEET_ID,
            range: "Sheet1!A:E",
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [newRow]
            }
        });

        res.status(200).json({ message: "Data appended successfully" });

    } catch (err) {
        console.error("Google Sheets append error:", err);
        res.status(500).json({ error: "Failed to append data" });
    }
}
