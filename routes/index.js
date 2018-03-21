module.exports = function(app) {
  app.get('/start_server', require('./video-server').startServer)
  app.get('/stop_server', require('./video-server').stopServer)
  app.use('/test', (req, res) => {
    console.log(req.body)
    res.send(req.body)
  })
}
