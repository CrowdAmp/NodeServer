var express = require('express')
var fs = require("fs");
var path = require("path");
var firebase = require('firebase');
var nodemailer = require('nodemailer');
var schedule = require('node-schedule');
var Promise = require('promise');
var escape = require('escape-html');
var bodyParser = require('body-parser')
var twilioSID = 'ACc060b1c85097363382c735e4b4f8cc4b'
var twilioAuthToken = '035de675b2b6997806537a86ee70458e'
var twilio = require('twilio')(twilioSID, twilioAuthToken)

var app = express()

app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

var messageCount = 0





app.set('port', (process.env.PORT || 5000))
app.use(express.static(__dirname + '/public'))

app.get('/', function(request, response) {
    response.sendFile((path.join(__dirname + '/static/index.html')));
});


firebase.initializeApp({
  databaseURL: 'https://crowdamp-messaging.firebaseio.com',
  serviceAccount: path.join(__dirname + '/CrowdAmpMessaging-5e5474ce420c.json')
});

  //app.use('/static', express.static('indexx'))
  //response.send('Hello00 World!')


app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
})



function startListeners() {
  firebase.database().ref("/MessageData").on('child_added', function(snapshot) {
    var snapshotPath = '/MessageData' + '/' + snapshot.key
    console.log(snapshotPath)
		firebase.database().ref(snapshotPath).on('child_added', function(snapshot) {
    		
			//sendMessageToUser(snapshotPath ,snapshot.key, snapshot.child('text').val(), 'text')
    		console.log(snapshot.child("text").val())
		})
  });
  console.log("starting listener")
}


function sendMessageToUser(snapshotPath,userId, messageContent, messageType) {
  messageRef = firebase.database().ref(snapshotPath).push()
	var messageItem = {
            "text": messageContent,
            "senderId": userId,
            "sentByUser": false,
            "type": "text",
            "fileName": ""
        }
        //ADD TIMESTAMP
    messageRef.set(messageItem)
    //sendPushNotification()
}

var onesignal = require('node-opensignal-api');
var onesignal_client = onesignal.createClient();
 

function sendPushNotification(userIds, content) { 
  var restApiKey = 'N2Y2MWU1MDMtOTk3Zi00MDkzLWI3NjEtYTU0N2UwYjFjMGRh';
  var params = {
    app_id: '3fe58d49-2025-4653-912f-8067adbecd7f',
    contents: {
      'en': content
    },
    include_player_ids: ["8e70c1e0-d3ce-43a7-8a69-79477762bf33"],
    isIos: true
  };
  onesignal_client.notifications.create(restApiKey, params, function (err, response) {
    if (err) {
        console.log('Encountered error', err);
      } else {
        console.log(response);
      }
  });
}


app.post('/twiliowebhookoutbound/', function (req, res) {


        res.send()
        //res.sendStatus(200)                                                                                                                   
});


app.post('/twiliowebhook/', function (req, res) {
        console.log("AAAAAAA")
        console.log("MESSAGE BODY " + req.body.Body)
        var body = req.body.Body
        if (body == "") {
                body = "*User Sent Image*"
        }
        console.log("From: " + req.body.From)
        sendMessageThroughTwilio(req.body.From, req.body.To)
        console.log("message number" + req.body.From)
        res.send()
      
        //res.sendStatus(200)                                                                                                                   
});

function sendMessageThroughTwilio(to, from) {
twilio.messages.create({ 
    to: to, 
    from: from, 
    body: "Hey Jenny! Good luck on the bar exam! one two three four five six seven eight nine ten 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 aaaaaaasasasasasasasasasasasasasasasasasasa sdsdsdsdsdsdsdsdsdsdsdsdsdsds"
}, function(err, message) { 
  if (!err) {
    console.log(message.sid); 
  } else {
    console.log(err)
  }
});

}



function sendTwilioMessage(pageID, senderID, content, type) {
  console.log("SENDING TWILLIO MESSAGE: "+ pageID)
  var sentMessages = 0
  var totalMessages = Math.floor(content.length/155)
  if (content.length % 155 != 0) {
    totalMessages += 1 
  }

  var splitContent = content.split(" ") 
  console.log("Split content: "+ splitContent)
  console.log(splitContent.length)
  var nextMessage = splitContent[0]
  for (var i = 1; i < splitContent.length; i++) {
    console.log(nextMessage)
    if (nextMessage.length + splitContent[i].length + 1 < 155) {
      nextMessage += " " + splitContent[i]
    } else {
      console.log("did send segmented message: " + nextMessage)
      sentMessages++
        sendMessageRequestToTwilio(pageID, senderID, nextMessage + " " + sentMessages.toString() + "/" + totalMessages.toString() , type)
      nextMessage = splitContent[i]
    }
  }

  if (nextMessage.length != 0){
    if (totalMessages > 1) {
      sentMessages++
      nextMessage = nextMessage + " " + sentMessages.toString() + "/" + totalMessages.toString()
    }
      sendMessageRequestToTwilio(pageID, senderID, nextMessage , type)
  }

}


function sendMessageRequestToTwilio(pageID, senderID, content, type) {
  sendPostRequestToBrain('didSendMessage', pageID, senderID, content, type, function(response) {// endpoint, pageID, messagedUsers, content, type, resultHandler
    console.log("Post Request response: " + response.reply)
  })
  if (type == 'text'){
    twilio.sendMessage({
//    twilio.sms.messages.create({
      to:senderID,
      from:pageID,
      body: content
  }, function(error, message) {
      if (!error) {
          console.log('Success! The SID for this SMS message is:');
          console.log(message.sid);
          console.log('Message sent on:');
          console.log(message.dateCreated);
      } else {
          console.log('Oops! There was an error.');
      }
  });
  } else if(type == 'image'){
      twilio.sendMessage({
        to:senderID,
        mediaUrl: content,
        from:pageID

    }, function(error, message) {
        if (!error) {
            console.log('Success! The SID for this SMS message is:');
            console.log(message.sid);
            console.log('Message sent on:');
            console.log(message.dateCreated);
        } else {
            console.log('Oops! There was an error.');
          console.log(error)
        }
    })
  }

}




startListeners();

//sendMessageToUser("/MessageData/mgOVbPwSaPNxAskRztKFGZoTSqz1","-KKlIa_WDOmwDyloSPPD","heyyyyy", "text")
sendPushNotification(["8e70c1e0-d3ce-43a7-8a69-79477762bf33"], "Notification from Online!")

