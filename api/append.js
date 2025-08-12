export const config = {
    api: { bodyParser: false },
};

import formidable from "formidable";
import { execFile } from "child_process";
import path from "path";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const form = formidable({ multiples: false });

    form.parse(req, (err, fields, files) => {
        if (err) {
            return res.status(500).json({ error: "Error parsing form" });
        }

        const filePath = files.file.filepath;
        const pythonPath = path.join(process.cwd(), "api", "parser.py");

        execFile(
            "python3",
            [pythonPath, filePath],
            { env: { ...process.env } }, // Pass API key
            (error, stdout, stderr) => {
                if (error) {
                    console.error(stderr);
                    return res.status(500).json({ error: "Python script failed" });
                }

                try {
                    const parsedData = JSON.parse(stdout);
                    res.status(200).json(parsedData);
                } catch (parseError) {
                    console.error(parseError);
                    res.status(500).json({ error: "Invalid JSON from parser" });
                }
            }
        );
    });
}
