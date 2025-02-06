const express = require('express');
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();
const app = express();
app.use(express.json());

// Serve static files from root directory
app.use(express.static(__dirname));

// Extract file ID from URL
function extractFileId(input) {
    // If already a file ID
    if (/^[a-zA-Z0-9_-]+$/.test(input)) {
        return input;
    }
    try {
        const url = new URL(input);

        // Handle different URL patterns
        if (url.hostname === 'drive.google.com') {
            // Pattern: /file/d/{id}
            const fileMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (fileMatch) return fileMatch[1];
        }
    } catch (error) {
        console.error('Error parsing URL:', error);
    }
    return input;
}

// Get file details endpoint
app.post('/api/get-file-details', async (req, res) => {
    try {
        const rawFileId = req.body.fileId;
        console.log('Raw file ID/URL:', rawFileId);
        const fileId = extractFileId(rawFileId);
        console.log('Extracted file ID:', fileId);

        if (!fileId) {
            return res.status(400).json({
                success: false,
                error: 'Invalid file ID or URL'
            });
        }

        // Initialize Google Auth with Rclone's default client ID and secret
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID || '202264815644.apps.googleusercontent.com',
            process.env.GOOGLE_CLIENT_SECRET || 'X4Z3ca8xfWDb1Voo-F9a7ZxJ'
        );
        oauth2Client.setCredentials({
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN
        });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Fetch file details
        try {
            const response = await drive.files.get({
                fileId: fileId,
                fields: 'id, name, size, mimeType'
            });

            const file = response.data;

            // Format response
            res.json({
                success: true,
                file: {
                    id: file.id,
                    name: file.name,
                    size: parseInt(file.size || 0),
                    sizeFormatted: formatSize(parseInt(file.size || 0)),
                    type: file.mimeType
                }
            });
        } catch (error) {
            if (error.message.includes('File not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found. Please check the file ID or sharing settings.'
                });
            }
            throw error; // Re-throw other errors
        }
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.stack
        });
    }
});

// Serve test page
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'test.html'));
});

// Root endpoint with API info
app.get('/', (req, res) => {
    res.json({
        name: 'CinemazBD Drive API',
        version: '1.0.0',
        endpoints: {
            getFileDetails: {
                url: '/api/get-file-details',
                method: 'POST',
                body: {
                    fileId: 'Google Drive file ID or URL'
                }
            },
            test: {
                url: '/test',
                method: 'GET',
                description: 'Test page for API'
            }
        },
        example: {
            curl: `curl -X POST http://localhost:${PORT}/api/get-file-details \\
                -H "Content-Type: application/json" \\
                -d '{"fileId": "your_file_id"}'`,
            response: {
                success: true,
                file: {
                    id: "file_id",
                    name: "example.mp4",
                    size: 1073741824,
                    sizeFormatted: "1.00 GB",
                    type: "video/mp4"
                }
            }
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Helper function to format file size
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
