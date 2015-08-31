let fs = require('fs')
let path = require('path')
let express = require('express')
let morgan = require('morgan')
let nodeify = require('bluebird-nodeify')
let mime = require('mime-types')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let net = require('net')
let JsonSocket = require('json-socket')
let chokidar = require('chokidar')

require('songbird')

const NODE_ENV = process.env.NODE_ENV
const PORT = process.env.PORT || 8000
const TCP_PORT = 8001
const ROOT_DIR = path.resolve(process.cwd()) + '/server'

let app = express()

if (NODE_ENV === 'development') {
    app.use(morgan('dev'))
}

app.listen(PORT, ()=> console.log(`LISTENING @ http://127.0.0.1:${PORT}`))

app.get('*', setFileMeta, sendHeaders, (req, res) => {
    if (res.body) {
        res.json(res.body)
        return
    }

    fs.createReadStream(req.filePath).pipe(res)
})

app.head('*', setFileMeta, sendHeaders, (req, res) => res.end())

app.delete('*', setFileMeta, (req, res, next) => {
    async ()=> {
        if (!req.stat) {
            return res.send(400, 'Invalid Path')
        }
        if (req.stat.isDirectory()) {
            await rimraf.promise(req.filePath)
        } else {
            await fs.promise.unlink(req.filePath)
        }
        res.end()
    }().catch(next)
})

app.put('*', setFileMeta, setDirDetails, (req, res, next) => {
    async ()=> {
        if (req.stat) return res.send(405, 'File exists')
        await mkdirp.promise(req.dirPath)

        if (!req.isDir) req.pipe(fs.createWriteStream(req.filePath))
        res.end()
    }().catch(next)
})

app.post('*', setFileMeta, setDirDetails, (req, res, next) => {
    async ()=> {
        if (!req.stat) return res.send(405, 'File does not exist')
        if (req.isDir) return res.send(405, 'Path is a directory')

        await fs.promise.truncate(req.filePath, 0)
        req.pipe(fs.createWriteStream(req.filePath))
        res.end()
    }().catch(next)
})


// Create an TCP server
var tcpServer = net.createServer()
tcpServer.listen(TCP_PORT)
console.log('TCT server listening on port 8001')
tcpServer.on('connection', function(socket) { //This is a standard net.Socket
    console.log('client connected')
    socket = new JsonSocket(socket); //Now we've decorated the net.Socket to be a JsonSocket
    console.log('ROOT_DIR: ' + ROOT_DIR)
    chokidar.watch(ROOT_DIR, {ignored: /[\/\\]\./})
/*
        .on('add', function(path) { console.log('File', path, 'has been added'); })
        .on('change', function(path) { console.log('File', path, 'has been changed'); })
        .on('unlink', function(path) { console.log('File', path, 'has been removed'); })
        .on('addDir', function(path) { console.log('Directory', path, 'has been added'); })
        .on('unlinkDir', function(path) { console.log('Directory', path, 'has been removed'); })
*/
        .on('all', (event, path) => {
            console.log(event, path)
            socket.sendMessage(generatePayload(event, path))
        })

    socket.on('message', function (message) {
        console.log('server on message')
        console.log(message)
        socket.sendMessage('payload')
    })
})

function generatePayload(event, path) {
    return {
        "action": event,
        "path": path,
        "updated": new Date().getTime()
    }
}

function setDirDetails(req, res, next) {
    let filePath = req.filePath
    let endsWithSlash = filePath.charAt(filePath.length - 1) === path.sep
    let hasExt = path.extname(filePath) !== ''
    req.isDir = endsWithSlash || !hasExt
    req.dirPath = req.isDir ? filePath : path.dirname(filePath)
    next()
}

function setFileMeta(req, res, next) {
    req.filePath = path.resolve(req.url)
    if (req.filePath.indexOf(ROOT_DIR) !== 0) {
        res.send(400, 'Invalid Path')
        return
    }
    fs.promise.stat(req.filePath)
        .then(stat => req.stat = stat, () => req.stat = null)
        .nodeify(next)
}

function sendHeaders(req, res, next) {
    nodeify(async ()=> {
        if (req.stat.isDirectory()) {
            let files = await fs.promise.readdir(req.filePath)
            res.body = JSON.stringify(files)
            res.setHeader('Content-Length', res.body.length)
            res.setHeader('Content-Type', 'application/json')
            return
        }

        res.setHeader('Content-Length', req.stat.size)
        let contentType = mime.contentType(path.extname(req.filePath))
        res.setHeader('Content-Type', contentType)

    }(), next)
}