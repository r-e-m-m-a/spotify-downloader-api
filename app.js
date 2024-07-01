const express = require('express');
const ytdl = require('ytdl-core');
const ytsr = require('ytsr');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for all routes


app.get('/download', async (req, res) => {
    const search = req.query.search;
    if (!search) {
        return res.status(400).json({ error: 'Missing search query' });
    }

    try {
        const searchResults = await ytsr(search, { limit: 2 });
        if (!searchResults || !searchResults.items || searchResults.items.length === 0) {
            return res.status(404).json({ error: 'No videos found' });
        }

        const firstVideo = searchResults.items[0];
        const secondVideo = searchResults.items[1];
        if (firstVideo.type !== 'video' || secondVideo.type !== 'video') {
            return res.status(404).json({ error: 'No videos found' });
        }

        const videoUrl = firstVideo.url || secondVideo.url;
        const streamUrl = `${req.protocol}://${req.get('host')}/stream?videoUrl=${videoUrl}`;

        res.json({ stream: streamUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


const fileAccessTimes = {};

app.get('/stream', async (req, res) => {
    const videoUrl = req.query.videoUrl;

    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing videoUrl parameter' });
    }

    try {
        const info = await ytdl.getInfo(videoUrl);
        const title = info.videoDetails.title;
        const mp3Path = path.resolve(__dirname, 'downloads', `${title}.mp3`);

        const audioStream = ytdl(videoUrl, { filter: 'audioonly' });

        let starttime;
        audioStream.on('progress', (chunkLength, downloaded, total) => {
            if (!starttime) {
                starttime = Date.now();
            }
            const elapsed = (Date.now() - starttime) / 1000;
            const speed = downloaded / elapsed;
            const eta = (total - downloaded) / speed;
            console.log(`Progress: ${(downloaded / total * 100).toFixed(2)}%`);
            console.log(`Downloaded: ${(downloaded / (1024 * 1024)).toFixed(2)} MB`);
            console.log(`Speed: ${(speed / 1024).toFixed(2)} KB/s`);
            console.log(`ETA: ${eta.toFixed(2)} seconds`);
        });

        ffmpeg(audioStream)
            .audioCodec('libmp3lame')
            .audioBitrate(128)
            .save(mp3Path)
            .on('end', () => {
                console.log('Download and conversion complete');
                const streamUrl = `${req.protocol}://${req.get('host')}/play/${path.basename(mp3Path)}`;
                fileAccessTimes[mp3Path] = Date.now(); // Track access time
                return res.json({ stream_url: streamUrl });
            })
            .on('error', (err) => {
                console.error(err);
                return res.status(500).json({ error: 'Failed to download or convert' });
            });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to download' });
    }
});

app.get('/play/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.resolve(__dirname, 'downloads', filename);

    // Check if file exists and send it
    if (fs.existsSync(filepath)) {
        res.sendFile(filepath);
        
        // Schedule deletion after 10 minutes (600000 milliseconds)
        setTimeout(() => {
            if (fileAccessTimes[filepath]) {
                const lastAccessTime = fileAccessTimes[filepath];
                const currentTime = Date.now();
                const elapsedTime = currentTime - lastAccessTime;
                if (elapsedTime >= 600000) { // 10 minutes
                    fs.unlink(filepath, (err) => {
                        if (err) {
                            console.error(`Error deleting file ${filename}:`, err);
                        } else {
                            console.log(`Deleted file ${filename} after 10 minutes.`);
                            delete fileAccessTimes[filepath];
                        }
                    });
                }
            }
        }, 600000);
    } else {
        return res.status(404).json({ error: 'File not found' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    if (!fs.existsSync('downloads')) {
        fs.mkdirSync('downloads');
    }
    console.log(`Server is running on port ${PORT}`);
});