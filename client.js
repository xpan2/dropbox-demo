let net = require('net')
let JsonSocket = require('json-socket');
let fs = require('fs')
let path = require('path')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let request = require('request')
let argv = require('yargs').argv
var tar = require('tar')

require('songbird')

const ROOT_DIR = argv.dir || path.resolve(process.cwd()) + '/server'
const HTTP_SERVER = 'http://127.0.0.1:8000/'

var port = 8001; //The same port that the server is listening on
var host = '127.0.0.1';
var socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
socket.connect(port, host);
socket.on('connect', function() { //Don't send until we're connected
    async ()=> {
        await rimraf.promise(path.resolve(process.cwd()) + '/client/source')

        let options = {
            url: HTTP_SERVER,
            headers: {'Accept': 'application/x-gtar'}
        }
        let extract = tar.Extract({path: ROOT_DIR})
        request(options, HTTP_SERVER).pipe(extract)
    }()

    socket.on('message', function(payload) {
        console.log(payload)
        let action = payload.action
        let p = payload.path
        let fileName = 'client/' + path.relative(ROOT_DIR, p);
        let url = HTTP_SERVER + p
        console.log('fileName = ' + fileName);
        switch (action) {
            case 'add':
                // add new file
                // send get request to the http server to get the file and write to the current dir
                request(url).pipe(fs.createWriteStream(fileName))
                break;
            case 'addDir':
                // add new dir
                mkdirp(fileName)
                break;
            case 'change':
                // update an existing file
                async ()=> {
                    await fs.promise.truncate(fileName, 0)
                    request(url).pipe(fs.createWriteStream(fileName))
                }()
                break;
            case 'unlink':
                // delete an existing file
                fs.unlink(fileName)
                break;
            case 'unlinkDir':
                // delete a dir
                async ()=> {
                    await rimraf.promise(fileName)
                }()
                break;
        }
    });
});