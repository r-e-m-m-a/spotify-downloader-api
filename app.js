// const express = require('express');
// const ytdl = require('ytdl-core');
// const ffmpeg = require('fluent-ffmpeg');
// const path = require('path');
// const fs = require('fs');

// const app = express();
// app.use(express.json());

// app.post('/download', async (req, res) => {
//     const videoUrl = req.body.video_url;

//     if (!videoUrl) {
//         return res.status(400).json({ error: 'Missing video_url parameter' });
//     }

//     try {
//         const info = await ytdl.getInfo(videoUrl);
//         const title = info.videoDetails.title;
//         const mp3Path = path.resolve(__dirname, 'src', `${title}.mp3`);

//         const audioStream = ytdl(videoUrl, { filter: 'audioonly' });
//         ffmpeg(audioStream)
//             .audioCodec('libmp3lame')
//             .audioBitrate(192)
//             .save(mp3Path)
//             .on('end', () => {
//                 return res.json({ stream_url: `/stream/${path.basename(mp3Path)}` });
//             })
//             .on('error', (err) => {
//                 console.error(err);
//                 return res.status(500).json({ error: 'Failed to download or convert' });
//             });
//     } catch (err) {
//         console.error(err);
//         return res.status(500).json({ error: 'Failed to download' });
//     }
// });

// app.get('/stream/:filename', (req, res) => {
//     const filename = req.params.filename;
//     const filepath = path.resolve(__dirname, 'src', filename);
//     res.sendFile(filepath);
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//     if (!fs.existsSync('src')) {
//         fs.mkdirSync('src');
//     }
//     console.log(`Server is running on port ${PORT}`);
// });


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


// app.get('/stream', async (req, res) => {
//     // const videoUrl = req.body.video_url;
//     const videoUrl = req.query.videoUrl;

//     if (!videoUrl) {
//         return res.status(400).json({ error: 'Missing video_url parameter' });
//     }

//     try {
//         const info = await ytdl.getInfo(videoUrl);
//         const title = info.videoDetails.title;
//         const mp3Path = path.resolve(__dirname, 'src', `${title}.mp3`);

//         const audioStream = ytdl(videoUrl, { filter: 'audioonly' });

//         let starttime;
//         audioStream.on('progress', (chunkLength, downloaded, total) => {
//             if (!starttime) {
//                 starttime = Date.now();
//             }
//             const elapsed = (Date.now() - starttime) / 1000;
//             const speed = downloaded / elapsed;
//             const eta = (total - downloaded) / speed;
//             console.log(`Progress: ${(downloaded / total * 100).toFixed(2)}%`);
//             console.log(`Downloaded: ${(downloaded / (1024 * 1024)).toFixed(2)} MB`);
//             console.log(`Speed: ${(speed / 1024).toFixed(2)} KB/s`);
//             console.log(`ETA: ${eta.toFixed(2)} seconds`);
//         });

//         ffmpeg(audioStream)
//             .audioCodec('libmp3lame')
//             .audioBitrate(128)
//             .save(mp3Path)
//             .on('end', () => {
//                 console.log('Download and conversion complete');
//                 return res.json({ stream_url: `${req.protocol}://${req.get('host')}/play/${path.basename(mp3Path)}` });
//             })
//             .on('error', (err) => {
//                 console.error(err);
//                 return res.status(500).json({ error: 'Failed to download or convert' });
//             });
//     } catch (err) {
//         console.error(err);
//         return res.status(500).json({ error: 'Failed to download' });
//     }
// });

// app.get('/play/:filename', (req, res) => {
//     const filename = req.params.filename;
//     const filepath = path.resolve(__dirname, 'src', filename);
//     res.sendFile(filepath);
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//     if (!fs.existsSync('src')) {
//         fs.mkdirSync('src');
//     }
//     console.log(`Server is running on port ${PORT}`);
// });



app.get('/stream', async (req, res) => {
    const videoUrl = req.query.videoUrl;

    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing video_url parameter' });
    }

    try {
        const info = await ytdl.getInfo(videoUrl);
        const title = info.videoDetails.title;

        const audioStream = ytdl(videoUrl, { filter: 'audioonly' });

        res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');

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
            .format('mp3')
            .pipe(res, { end: true })
            .on('end', () => {
                console.log('Download and conversion complete');
            })
            .on('error', (err) => {
                console.error(err);
                res.status(500).json({ error: 'Failed to download or convert' });
            });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to download' });
    }
});


app.get('/play/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.resolve(__dirname, 'src', filename);
    res.sendFile(filepath);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    if (!fs.existsSync('src')) {
        fs.mkdirSync('src');
    }
    console.log(`Server is running on port ${PORT}`);
});