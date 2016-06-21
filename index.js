var express = require('express')
var fs = require("fs");
var path = require("path");




var app = express()

app.set('port', (process.env.PORT || 5000))
app.use(express.static(__dirname + '/public'))

app.get('/', function(request, response) {
    response.sendFile((path.join(__dirname + '/static/index.html')));
});


  //app.use('/static', express.static('indexx'))
  //response.send('Hello00 World!')


app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
})
