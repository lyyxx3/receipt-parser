export const config = {
    api: {
        bodyParser: false, // Required for file uploads
    },
};

import formidable from "formidable";
import fs from "fs";

export default async function handler(req, res) {
    console.log("📩 Request received:", req.method);

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error("❌ Form parse error:", err);
            return res.status(500).json({ error: "Error parsing form data" });
        }

        console.log("📄 Uploaded file info:", files.file);

        // Temporary: Just read the file name
        const filePath = files.file.filepath || files.file[0]?.filepath;
        const fileName = files.file.originalFilename || files.file[0]?.originalFilename;

        console.log(`✅ File received: ${fileName}`);

        // You can now send this to Google Sheets or process it with Python

        res.status(200).json({ message: "File received", fileName });
    });
}
