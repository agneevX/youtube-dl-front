const {settings} = require('./settings.json');
const fs = require('fs')
const path = require('path');
let express = require('express');
const {download, getDownloadInfo} = require('./youtubedl')
const bodyParser = require('body-parser');
const {writeDatabase, readDatabase} = require('./helpers');
const app = express();
const port = settings.port;

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());

app.use('/', express.static(path.join(__dirname,"../web/dist/")));
app.use('/media/videos', express.static('videos'));
app.use('/media/music', express.static('music'));

app.get('/', function(req,res) {
    res.sendFile('index.html', { root: path.join(__dirname, '../web/dist') });
});

app.get('/items', async (req,res) => {
    try{
        const database = await readDatabase();

        if(database != null){
            res.json(database);
        }
        else{
            res.sendStatus(204);
        }
    }
    catch(error){
        console.log(error);
        res.sendStatus(500);
    }
});

app.get('/items/:id', async (req,res) => {
    try{
        const database = await readDatabase();
        let item = null;
        let found = false;

        if(database != null){
            database.videos.forEach(el => {
                if(el.id === req.params.id){
                    found = true;
                    item = el;
                }
            });
        }

        if(found)
            res.json(item);
        else
            res.sendStatus(404);
    }
    catch(error){
        console.log(error);
        res.sendStatus(500);
    }

});

app.get('/info/:id', async (req,res) => {
    try{
        // console.log(req.params.id);
        const info = await getDownloadInfo(req.params.id);

        if(info != null)
            res.json(info);
    }
    catch(error){
        console.log(error);
        res.sendStatus(500);
    }
});

app.get('/file/:id', async (req,res) => {
    try{
        const db = await readDatabase();
        let file = null;
        let found = false;

        if(db != null){
            db.videos.forEach(async el => {
                if(el.id === req.params.id){
                    file = path.join(__dirname, el.fileLocation, el.fileName);
                    found = fs.existsSync(file);
                }
            });

            if(found)
                res.download(file);
            else
                res.sendStatus(404);
        }
    }
    catch(error){
        console.log('error downloading file');
        res.sendStatus(500);
    }
});

app.post('/download', async (req,res) => {
    try{
        const downloadResult = await download(req.body.url, {
            format: req.body.videoQuality,
            audioFormat: req.body.soundQuality,
            audioOnly: req.body.audioOnly,
            playlist: req.body.playlist
        });

        if(downloadResult.success){
            const database = await readDatabase();

            if(req.body.playlist){
                console.log(downloadResult.info);
                res.status(201).send(downloadResult.info);
            }
            else if(database != null){

                database.videos.push(downloadResult.info);

                await writeDatabase(database);

                res.status(201).send(downloadResult.info);
            }
        }
    }
    catch(error){
        console.log(error);
        res.json(error);
    }
});

app.delete('/items/:id', async (req,res) => {
    try{
        let found = false;
        const database = await readDatabase();

        if(database != null){
            database.videos.forEach(async (el, index) => {
                if(el.id === req.params.id){
                    found = true;
                    console.log(`File: ${el.id} has been deleted`);

                    database.videos.splice(index, 1);
                    await writeDatabase(database);
                    fs.unlinkSync(`${el.fileLocation}/${el.fileName}`);
                }
            });

            if(found)
                res.sendStatus(200);
            else
                res.sendStatus(404);
        }
    }
    catch(error){
        res.sendStatus(500);
    }


});

const http = require('http');
const httpServer = http.createServer(app);

httpServer.listen(port, () => {
    console.log(`HTTP Server running on port ${port}`);
});