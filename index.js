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

var phoneNumberToInfluencerIdDict = {
  "+19804304321" : "AlexRamos"
}

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

//Adds item to firebase database referencePath is a string, itemDictionary is a dict, and itemId is string. No return value.
//If itemId is undefined, adds with auto generated id
function addItemToFirebaseDatabase(referencePath, itemId, itemDictionary) {
  if(itemId) {
    console.log("Adding Item to Firebase with id: " + itemId)
    messageRef = firebase.database().ref(referencePath).child(itemId)
    messageRef.set(itemDictionary)
  } else {
    messageRef = firebase.database().ref(referencePath).push()
    messageRef.set(itemDictionary)
  }
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

//receives inbound message requests from twilio
app.post('/twiliowebhook/', function (req, res) {
    console.log("MESSAGE BODY " + req.body.Body)
    var body = req.body.Body
    if (body == "") {
            body = "*User Sent Image*"
    }
    console.log("From: " + req.body.From)
    if(phoneNumberToInfluencerIdDict[req.body.To]) {
      phoneNumberInfoDict = {
            "text": req.body.Body,
            "senderId": req.body.From,
            "sentByUser": false,
            "type": "text",
            "fileName": req.body.MediaUrl,
            "messageSentTo": req.body.From,
            "messageSentFromApp": false //Should change to one of 100 phone numbers
        }
      addItemToFirebaseDatabase(phoneNumberToInfluencerIdDict[req.body.To] + "/IndividualMessageData", req.body.From, phoneNumberInfoDict)
    }


    sendMessageThroughTwilio(req.body.From, req.body.To, "This is a message", "")
    console.log("message number" + req.body.From)
    res.send()
      
        //res.sendStatus(200)                                                                                                                   
});

function sendMessageThroughTwilio(to, from, text, media) {
  if (media == "") {
    twilio.messages.create({ 
      to: to, 
      from: from, 
      body: text
    }, function(err, message) { 
      if (!err) {
        console.log(message.sid); 
      } else {
        console.log(err)
      }
    })
  } else {
    twilio.messages.create({ 
        to: to, 
        from: from, 
        body: text,
        mediaUrl: media
    }, function(err, message) { 
      if (!err) {
        console.log(message.sid); 
      } else {
        console.log(err)
      }
    });
  }

}





startListeners();

//sendMessageToUser("/MessageData/mgOVbPwSaPNxAskRztKFGZoTSqz1","-KKlIa_WDOmwDyloSPPD","heyyyyy", "text")
sendPushNotification(["8e70c1e0-d3ce-43a7-8a69-79477762bf33"], "Notification from Online!")

