let net = require('net')
let JsonSocket = require('json-socket');
let fs = require('fs')
let path = require('path')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let request = require('request')

const ROOT_DIR = path.resolve(process.cwd())
const SERVER_DIR = ROOT_DIR + '/server'
const CLIENT_DIR = ROOT_DIR + '/client'
const HTTP_SERVER = 'http://127.0.0.1:8080'

var port = 8001; //The same port that the server is listening on
var host = '127.0.0.1';
var socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
socket.connect(port, host);
socket.on('connect', function() { //Don't send until we're connected
    // TODO: initially need to download all content from the server directory as tar file
//    socket.sendMessage('request download file');

    socket.on('message', function(payload) {
        console.log(payload)
        let action = payload.action
        let p = payload.path
        switch (action) {
            case 'add':
                // add new file
                // send get request to the http server to get the file and write to the current dir
                let url = HTTP_SERVER + p
                console.log('url = ' + url)
/*
                let fileName =
                request(url).pipe(fs.createWriteStream(fileName))
*/
                //fs.createWriteStream(p)
                break;
            case 'addDir':
                // add new dir
                console.log('server added dir')
                var dirName = 'client/' + path.basename(p)
                console.log('dirName = ' + dirName);
                mkdirp(dirName)
                break;
            case 'change':
                // update an existing file
                break;
            case 'unlink':
                // delete an existing file
                break;
            case 'unlinkDir':
                // delete a dir
                break;
        }
    });
});