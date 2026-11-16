// CI-owned HTTP endpoints, independent of third-party source availability.
const http = require('node:http')

const base = 'http://lx-ios-fixture.test:18765'
const dataSize = 16000 * 12 * 2
const wave = Buffer.alloc(44 + dataSize)
wave.write('RIFF', 0); wave.writeUInt32LE(36 + dataSize, 4); wave.write('WAVEfmt ', 8)
wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22)
wave.writeUInt32LE(16000, 24); wave.writeUInt32LE(32000, 28)
wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34); wave.write('data', 36); wave.writeUInt32LE(dataSize, 40)

const server = http.createServer((req, res) => {
  console.log(req.method, req.url)
  const pathname = new URL(req.url, base).pathname
  const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
  if (pathname === '/search') return json(200, { songs: [{ name: 'HTTP fixture', source: 'kw' }] })
  if (pathname === '/source') {
    if (req.headers['user-agent'] !== 'lx-music/mobile' || req.headers.ver !== '2.0.0' ||
        req.headers['source-ver'] !== '1' || req.headers.tag !== Buffer.from('ios-http-fixture').toString('hex')) {
      return json(400, { code: 1, msg: 'Script headers or buffer encoding were changed in transit' })
    }
    return json(200, { code: 0, data: base + '/audio.wav' })
  }
  if (pathname !== '/audio.wav') return json(404, { code: 1, msg: 'Fixture not found' })
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '')
  const start = range ? Number(range[1]) : 0
  const end = range && range[2] ? Math.min(Number(range[2]), wave.length - 1) : wave.length - 1
  if (start > end || start >= wave.length) {
    res.writeHead(416, { 'Content-Range': `bytes */${wave.length}` }); return res.end()
  }
  const headers = { 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 }
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${wave.length}`
  res.writeHead(range ? 206 : 200, headers)
  res.end(req.method === 'HEAD' ? undefined : wave.subarray(start, end + 1))
})
server.listen(18765, '127.0.0.1', () => console.log('HTTP fixture ready at ' + base))
