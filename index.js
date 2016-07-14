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
var requests = require('request');

var app = express()

var pushNotificationDict = {"AlexRamos" : "8e70c1e0-d3ce-43a7-8a69-79477762bf33"}

var influencerMetricsDict = {
  "AlexRamos" : [0,0,1],
  'rmayer9999' : [0,0,1],
  'crowdamptester' : [0,0,1],
  'electionfails' : [0,0,1],
  'morggkatherinee' : [0,0,1] //total fans, total messages
}

var influencerIdToNameDict = { 
  'AlexRamos' : "Alex Ramos",
  'rmayer9999' : "Ruben Mayer",
  'crowdamptester': "CrowdAmp",
  'electionfails' : "Test Account",
  'morggkatherinee': "Morgan Katherine"
}

//var groupedMessageTestIds = ["+13108670121"] //"+15034966700"

var phoneNumberToInfluencerIdDict = {
  "+19804304321" : "electionfails",
  "+12512654321" : "electionfails",
  '+18184854321' : "electionfails",
  '+19197525252' : 'electionfails',
  '+16506678787' : 'morggkatherinee',
  '+19282278787' : 'morggkatherinee',
  '+17573478787' : 'morggkatherinee',
  '+12156078787': 'morggkatherinee',
  '+18589278787' : 'morggkatherinee',
  '+16786078787' : 'morggkatherinee'


}
var userContactInfoDict = {
  //'influencerId' : {"userId" : ["isUsingApp", "twilioSendNumber/AppNotificationId"]}
  'AlexRamos' : {},
  'rmayer9999' : {},
  'crowdamptester': {},
  'electionfails' : {},
  'morggkatherinee': {}
}

var serverUrl = "https://fierce-forest-11519.herokuapp.com/"

app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

var messageCount = 0


var test1 = 0
app.get('/test1', function(request, response) {
  test1 += 1
  console.log("Test1 COUNT: " + test1)
    response.redirect("https://www.youtube.com/watch?v=PrcdSszRtWo");
});

var test2 = 0
app.get('/test2', function(request, response) {
  test2 += 1
  console.log("Test2 COUNT: " + test2)
    response.redirect("https://www.youtube.com/watch?v=1ekZEVeXwek");
});



app.set('port', (process.env.PORT || 5000))
app.use(express.static(__dirname + '/public'))

app.get('/', function(request, response) {
    response.send("hello world");
});

app.get('/getTotalFans/:id', function(request, response) {
  response.send(influencerMetricsDict[request.params.id][0].toString())
})

app.get('/getTotalMessages/:id', function(request, response) {
    response.send(influencerMetricsDict[request.params.id][1].toString())
})

app.get('/getNewMessages/:id', function(request, response) {
  var totalUnreadMessages = 0
  firebase.database().ref("/" + request.params.id + "/GroupedMessageData").once('value', function(snapshot) {
    snapshot.forEach(function(childSnapshot) {
      if (childSnapshot.child('influencerDidRead').val() == false) {
        totalUnreadMessages += 1
      }
    })
    response.send(totalUnreadMessages.toString())
  })
    //response.send(influencerMetricsDict[request.params.id][2].toString())
})

app.post('/test', function(request, response) {
    console.log(request.body)
    console.log(request.body.content)
    response.sendStatus(200)
})

app.post('/shouldPromptInfluencerForAnswer', function(request, response) {
  console.log(request.body)
  var content = request.body.content
  var numberOfUsers = request.body.numberOfUsers
  var influencerId = request.body.influencerId
  var phraseId = request.body.phraseId 
  sendGroupedConversationToInfluencer(influencerId, content, numberOfUsers, phraseId)
  sendPushNotification([pushNotificationDict[influencerId]], "Message from " + numberOfUsers + " fans: " + content)
  response.sendStatus(200)

})

app.post('/shouldSendMessageToUsers', function(request, response) {
  console.log("shouleSendMessageToUsers")
  var content = request.body.content
  console.log("CONTENT: " + content)
  var type = request.body.type
  var influencerId = request.body.influencerId
  var userIdList = request.body.userIdList
  var mediaDownloadUrl = request.body.mediaDownloadUrl

  for (var i = 0; i < userIdList.length; i++) {  
    console.log("sendingMesage to userId: " + userIdList[i])  
    forwardMessageFromServerToUsers(influencerId, content, type, influencerId + "/IndividualMessageData/", userIdList[i], mediaDownloadUrl)
  }
  response.sendStatus(200)

})

app.get('/testPushNotifications', function(request, response) {
  sendPushNotification(["ec178ffe-5005-4a6b-bb62-80f4d640c515", "8e70c1e0-d3ce-43a7-8a69-79477762bf33"], "Notification from Online!")
  response.sendStatus(200)
})

//!
function forwardMessageFromServerToUsers(influencerId, content, type, firebasePath, userId, mediaDownloadUrl) {
  console.log("forwardingFirebaseSnapshotToUsers, userId: " + userId)
  var messageItemDict = {}
  if (type == "text") {
    messageItemDict = {
      "text": content,
      "senderId": userId,
      "sentByUser": false,
      "type": "text",
      "fileName": "",
      "hasBeenForwarded": true,
      "mediaDownloadUrl": ""
    }
  } else if (type == 'image') {
    messageItemDict = {
      "text": "",
      "senderId": userId,
      "sentByUser": false,
      "type": "image",
      "fileName": content,
      "hasBeenForwarded": true,
      "mediaDownloadUrl": mediaDownloadUrl
    }
  } else {
    return
  }


  addItemToFirebaseDatabase(firebasePath +  userId, undefined, messageItemDict)
  addItemToFirebaseDatabase(firebasePath +  userId, "userDidRead", false)

  if (!userContactInfoDict[influencerId][userId][0]) {
    if (type == "text") {
      sendMessageThroughTwilio(userId, userContactInfoDict[influencerId][userId][1], content, "")
    } else if (type == "image") {


      sendMessageThroughTwilio(userId, userContactInfoDict[influencerId][userId][1], "", mediaDownloadUrl)
    }
  }
}



app.get('/sendRequest', function(request, response) {
console.log("shouldSendRequest")
reqUrl = serverUrl + "test"

try {

  requests({
    url: reqUrl,
    method: "POST",
    json: { content: 'success!!! the secret code is yawilukaki' },
  },function (error, response, body) {
        if (!error) {
            console.log("body: " + response.body.test)
        } else {
          console.log("error: " + error)
        }
    });

} catch(err) {
  console.log("Error with request: " + err)
}
  response.send(200)
})

function forwardSnapshotToNLPDatabase(snapshot, influencerId, userId) {
  console.log("shouldForwardSnapshotToNLPDatabase " + snapshot)
  reqUrl = serverUrl +  "didReceiveMessage"

  var snapshotContent = ""
  if (snapshot.child("type").val() == "text") {
    snapshotContent = snapshot.child("text").val()
  } else if (snapshot.child("type").val() == "image") {
    snapshotContent =  snapshot.child("fileName").val()
  } else {
    return
  }

  if (!userId) {
    userId = snapshot.child("senderId").val()
  }

  try {
    requests({
      url: reqUrl,
      method: "POST",
      json: { 
         content: snapshotContent,
         type: snapshot.child("type").val(),
         userId: userId,
         influencerId: influencerId,
         sentByUser: snapshot.child("sentByUser").val(),
         mediaDownloadUrl: snapshot.child("mediaDownloadUrl").val()

       },


    },function (error, response, body) {
          if (!error) {
            console.log("response: " + response.body.content)
          } else {
            console.log("error: " + error)
          }
      });

  } catch(err) {
    console.log("Error with request: " + err)
  }

}

function postInfluencerDidRespondToPrompt(influencerId, snapshot) {
  console.log("PostingInfluencerDidRespondToPrompt request")
  var reqUrl = serverUrl + "influencerDidRespondToPrompt"
  
  var snapshotContent = ""
  if (snapshot.child("type").val() == "text") {
    snapshotContent = snapshot.child("text").val()
  } else if (snapshot.child("type").val() == "image") {
    snapshotContent =  snapshot.child("fileName").val()
  } else {
    return
  }

  try {
    requests({
      url: reqUrl,
      method: "POST",
      json: { 
         content: snapshotContent,
         type: snapshot.child("type").val(),
         phraseId: snapshot.child("senderId").val(),
         influencerId: influencerId,
         mediaDownloadUrl: snapshot.child("mediaDownloadUrl").val()
       },


    },function (error, response, body) {
          if (!error) {
            console.log("response: " + response.body.content)
          } else {
            console.log("error: " + error)
          }
      });

  } catch(err) {
    console.log("Error with postInfluencerDidRespondToPrompt request: " + err)
  }
}


firebase.initializeApp({
  databaseURL: 'https://crowdamp-messaging.firebaseio.com',
  serviceAccount: path.join(__dirname + '/CrowdAmpMessaging-5e5474ce420c.json')
});

  //app.use('/static', express.static('indexx'))
  //response.send('Hello00 World!')


app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
})


var conversationId = "33PeopleSent"
var messageText = "When is your next vine coming out?"



function sendGroupedConversationToInfluencer(influencerId, content, numberOfUsers, phraseId) {
  
  var conversationItemDict = {
    "conversationTitle" : "Message from " + numberOfUsers + " fans",
  }

  var messageItemDict = {
        "text": content,
        "senderId": phraseId,
        "sentByUser": true,
        "type": "text",
        "fileName": "",
        "mediaDownloadUrl": ""
    }

  addItemToFirebaseDatabase("/" + influencerId + "/GroupedMessageData/", phraseId, conversationItemDict)
  addItemToFirebaseDatabase("/" + influencerId + "/GroupedMessageData/" +  phraseId, "influencerDidRead", false)
  addItemToFirebaseDatabase("/" + influencerId + "/GroupedMessageData/" +  phraseId, "timestamp", firebase.database.ServerValue.TIMESTAMP)
  addItemToFirebaseDatabase("/" + influencerId + "/GroupedMessageData/" +  phraseId, undefined ,messageItemDict)

}



function listenForGroupedMessages() {
  firebase.database().ref('/').on('child_added', function(snapshot) {
    var influencerName = snapshot.key
    firebase.database().ref("/" + influencerName + "/GroupedMessageData").on('child_added', function(snapshot) {
      var snapshotPath = '/' + influencerName + '/GroupedMessageData' + '/' + snapshot.key 
      firebase.database().ref(snapshotPath).on('child_added', function(snapshot) {
        if (!snapshot.child("hasBeenForwarded").val() && !snapshot.child("sentByUser").val() && snapshot.child("type").val()) {
          addItemToFirebaseDatabase(snapshotPath + "/" + snapshot.key, "hasBeenForwarded", true) 
          if (!snapshot.child("sentByUser").val()) { //Checks that text was sent by influencer
            console.log(snapshot.child("senderId").val())
              postInfluencerDidRespondToPrompt(influencerName, snapshot)
          }
        }
      })
    })
  })
}

function forwardFirebaseSnapshotToUsers(snapshot, firebasePath, userId, influencerId) {
  console.log("forwardingFirebaseSnapshotToUsers, userId: " + userId)
  forwardSnapshotToNLPDatabase(snapshot, influencerId, userId)

  var messageItemDict = {
        "text": snapshot.child("text").val(),
        "senderId": userId,
        "sentByUser": false,
        "type": snapshot.child("type").val(),
        "fileName": snapshot.child("fileName").val(),
        "hasBeenForwarded": true,
        "mediaDownloadUrl": snapshot.child("mediaDownloadUrl").val()
    }
  addItemToFirebaseDatabase(firebasePath +  userId, undefined, messageItemDict)
  addItemToFirebaseDatabase(firebasePath +  userId, "userDidRead", false)

  if (!userContactInfoDict[influencerId][userId][0]) {
    sendMessageThroughTwilio(userId, userContactInfoDict[influencerId][userId][1], snapshot.child('text').val(), snapshot.child("mediaDownloadUrl").val())
  }  
}

function listenForMessageAll() {
  firebase.database().ref('/').on('child_added', function(snapshot) {
    var influencerId = snapshot.key
    firebase.database().ref('/' + influencerId + "/MessageAllData/sendToAll").on('child_added', function(snapshot) {
      if (!snapshot.child("hasBeenForwarded").val() && snapshot.key[0] == '-') {
          addItemToFirebaseDatabase('/' + influencerId + "/MessageAllData/sendToAll/" + snapshot.key, "hasBeenForwarded", true)
          console.log("ListeningForMessageAll " + snapshot.key + Object.keys(userContactInfoDict[influencerId]))
        if (!snapshot.child("sentByUser").val()) {
          for(key in userContactInfoDict[influencerId]) {
            forwardFirebaseSnapshotToUsers(snapshot,'/' + influencerId +"/IndividualMessageData/", key, influencerId)
          }
          var sendToAllResponseDict = {
                  "text": "Message sent succesfully to " + Object.keys(userContactInfoDict[influencerId]).length + " fans.",
                  "senderId": "sendToAll",
                  "sentByUser": true,
                  "type": "text",
                  "fileName": "",
                  "hasBeenForwarded": false,
                  "mediaDownloadUrl": ""
          }
          if (Object.keys(userContactInfoDict[influencerId]).length > 0) {
            addItemToFirebaseDatabase(influencerId + "/MessageAllData/sendToAll", undefined, sendToAllResponseDict)
          } 
        }
      }

    })
  })
}

function listenForNewMessages() {
  firebase.database().ref('/').on('child_added', function(snapshot) {
    var influencerId = snapshot.key
    //var snapshotPath = "/" + snapshot.key + 'AlexRamos/IndividualMessageData'
    firebase.database().ref(influencerId + '/IndividualMessageData').on('child_added', function(snapshot) {
      if (snapshot.child("isUsingApp").val() != null && snapshot.child("sendMessagesFrom").val() != null) { 
        userContactInfoDict[influencerId][snapshot.key] = [snapshot.child("isUsingApp").val(), snapshot.child("sendMessagesFrom").val()]
      }

      influencerMetricsDict[influencerId][0] += 1 

      var snapshotPath = influencerId + '/IndividualMessageData' + '/' + snapshot.key
      console.log(snapshotPath)
  		firebase.database().ref(snapshotPath).on('child_added', function(snapshot) {
  			//sendMessageToUser(snapshotPath ,snapshot.key, snapshot.child('text').val(), 'text')
      		console.log("LISTENING FOR MESSAGE: " + snapshot.child("text").val())
          console.log("senderId: " + snapshot.child("senderId").val())

          var userContactInfo = userContactInfoDict[influencerId][snapshot.child("senderId").val()]
          if(userContactInfo && userContactInfo[0] == false && snapshot.child("sentByUser").val() == false && snapshot.child("hasBeenForwarded").val() == false) {
            console.log("FORWARDING MESSAGE IN LISTENFORNEWMESSAGES")
            console.log("should forward message")
            console.log(snapshot.child("mediaDownloadUrl").val())
            sendMessageThroughTwilio(snapshot.child("senderId").val(), userContactInfo[1], snapshot.child("text").val(), snapshot.child("mediaDownloadUrl").val())
          }

          if (!snapshot.child("hasBeenForwarded").val() && userContactInfo) {
            forwardSnapshotToNLPDatabase(snapshot, influencerId)
          }
          if (userContactInfo && !snapshot.child('hasBeenForwarded').val()) {
            addItemToFirebaseDatabase('/' + influencerId + '/IndividualMessageData/' + snapshot.child("senderId").val() + "/" + snapshot.key, "hasBeenForwarded", true)
          }
          if (snapshot.child('text').val() != null) {
            influencerMetricsDict[influencerId][1] += 1 
          }

  		})
    });
  })
  console.log("starting listener")
}

//Adds item to firebase database referencePath is a string, itemDictionary is a dict, and itemId is string. No return value.
//If itemId is undefined, adds with auto generated id
function addItemToFirebaseDatabase(referencePath, itemId, itemDictionary) {
  try {

  if(itemId) {
    console.log("Adding Item to Firebase with id: " + itemId)
    messageRef = firebase.database().ref(referencePath).child(itemId)
    messageRef.set(itemDictionary)
  } else {
    messageRef = firebase.database().ref(referencePath).push()
    messageRef.set(itemDictionary)
  }
} catch(err) {
  console.log("error in add item to firebase: " + err)
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
 
function listenForPushIdUpdates() {
  firebase.database().ref('/PushIds').on('child_added', function(snapshot) {
    var influencerId = snapshot.key
      pushNotificationDict[influencerId] = snapshot.child("pushId").val()
  })
}

function sendPushNotification(userIds, content) { 
  var restApiKey = 'N2Y2MWU1MDMtOTk3Zi00MDkzLWI3NjEtYTU0N2UwYjFjMGRh';
  var params = {
    app_id: '3fe58d49-2025-4653-912f-8067adbecd7f',
    contents: {
      'en': content
    },
    include_player_ids: userIds,
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

  console.log("TWILIOWEBHOOKOUTBOUND")
        res.send()
        //res.sendStatus(200)                                                                                                                   
});

//receives inbound message requests from twilio
app.post('/twiliowebhook/', function (req, res) {
    console.log("MESSAGE BODY " + req.body.Body)
    if (req.body.Body != undefined) {
    var body = req.body.Body
    if (body == "") {
            body = "*User Sent Image*"
    }
    console.log("From: " + req.body.From)
    if(phoneNumberToInfluencerIdDict[req.body.To]) {
      var messageItemDict = {
            "text": req.body.Body,
            "senderId": req.body.From,
            "sentByUser": true,
            "type": "text",
            "fileName": "",
        }

      var influencerId = phoneNumberToInfluencerIdDict[req.body.To]

      firebase.database().ref(influencerId + "/IndividualMessageData/" +  req.body.From + "/sendMessagesFrom").once('value', function(snapshot) {
        
        if (snapshot.child("/").val() == null) {
          firebase.database().ref(influencerId + '/phoneNumbersInService').once('value', function(snapshot) {
            var numberOfUsersOnPhone = 10000
            var phoneNumberToSendFrom = ""
            snapshot.forEach(function(childSnapshot) {
              if (childSnapshot.child("/").val() < numberOfUsersOnPhone) {
                numberOfUsersOnPhone = childSnapshot.child("/").val()
                phoneNumberToSendFrom = childSnapshot.key
              }
            })

            //ADDED
            //phoneNumberToSendFrom = req.body.To

            console.log("phoneNumberToSendFrom: " + phoneNumberToSendFrom)
            addItemToFirebaseDatabase(influencerId + "/IndividualMessageData/" +  req.body.From, "sendMessagesFrom", phoneNumberToSendFrom)
            userContactInfoDict[influencerId][req.body.From] = [false, phoneNumberToSendFrom]
            addItemToFirebaseDatabase(influencerId + "/phoneNumbersInService/", phoneNumberToSendFrom, numberOfUsersOnPhone + 1)
            addItemToFirebaseDatabase(phoneNumberToInfluencerIdDict[req.body.To] + "/IndividualMessageData/" +  req.body.From, "userDidRead", true)
            addItemToFirebaseDatabase(phoneNumberToInfluencerIdDict[req.body.To] + "/IndividualMessageData/" +  req.body.From, "influencerDidRead", false)
            addItemToFirebaseDatabase(phoneNumberToInfluencerIdDict[req.body.To] + "/IndividualMessageData/" +  req.body.From, "timestamp", firebase.database.ServerValue.TIMESTAMP)
            addItemToFirebaseDatabase(phoneNumberToInfluencerIdDict[req.body.To] + "/IndividualMessageData/" +  req.body.From, "isUsingApp", false)
            addItemToFirebaseDatabase(phoneNumberToInfluencerIdDict[req.body.To] + "/IndividualMessageData/" +  req.body.From, undefined, messageItemDict)

            sendMessageThroughTwilio(req.body.From, req.body.To, "Hey! This is " + influencerIdToNameDict[influencerId] + " thanks for messaging me!!! I will be texting you from " + phoneNumberToSendFrom, "")
            setTimeout(function() {
              sendIntroFlow(req, phoneNumberToSendFrom)
// sendMessageThroughTwilio(req.body.From, phoneNumberToSendFrom, "Hey! this is " + influencerIdToNameDict[influencerId] + " again :)", "")
            }, 30000);
          })
        } else {
          userContactInfoDict[influencerId][req.body.From] = [false, snapshot.child("/").val()]
          addItemToFirebaseDatabase(phoneNumberToInfluencerIdDict[req.body.To] + "/IndividualMessageData/" +  req.body.From, "userDidRead", true)
          addItemToFirebaseDatabase(phoneNumberToInfluencerIdDict[req.body.To] + "/IndividualMessageData/" +  req.body.From, "influencerDidRead", false)
          addItemToFirebaseDatabase(phoneNumberToInfluencerIdDict[req.body.To] + "/IndividualMessageData/" +  req.body.From, "timestamp", firebase.database.ServerValue.TIMESTAMP)
          addItemToFirebaseDatabase(phoneNumberToInfluencerIdDict[req.body.To] + "/IndividualMessageData/" +  req.body.From, "isUsingApp", false)
          addItemToFirebaseDatabase(phoneNumberToInfluencerIdDict[req.body.To] + "/IndividualMessageData/" +  req.body.From, undefined, messageItemDict)
        }
     })
    }
    //sendMessageThroughTwilio(req.body.From, req.body.To, "Wooooo!", "")
    console.log("message number" + req.body.From)
  }
    //res.sendStatus()
      
        //res.sendStatus(200)                                                                                                                   
});

function sendIntroFlow(req, phoneNumberToSendFrom) {
  if (req.body.To == '+16506678787') {
    sendMessageThroughTwilio(req.body.From, phoneNumberToSendFrom, "Hey! this is Morgan, thanks for messaging me! I will try to answer messages as soon as I can :) Also, I can send you updates about what I'm up to. Sound cool?", "")

    //setTimeout(function() {
     // sendMessageThroughTwilio(req.body.From, req.body.To, "", "http://magnuscarlsen.com/assets/IMG_6405-e1417594107254-1024x919.jpg")
    //setTimeout(function() {
    //  sendMessageThroughTwilio(req.body.From, req.body.To, "I can also send you regular updates about Magnus' Life, and the things he posts on social media. Would you like that?", "")
    //}, 20000);
    //}, 10000);
    //forwardMessageFromServerToUsers('electionfails', 'magnus', 'text', firebasePath, req.body.From, '')

  } else {

    sendMessageThroughTwilio(req.body.From, req.body.To, "Hey B, thanks for messaging me this is ArianaBot <3", "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcSmeJSGr2yKOGUJF514n6isuRTjuvySdbyJD1lDKI0U3TMiAf-OHQ")
    sendMessageThroughTwilio(req.body.From, req.body.To, "Hey B, thanks for messaging me this is ArianaBot <3. I talk and act like Ariana Grande", "")

    setTimeout(function() {
      sendMessageThroughTwilio(req.body.From, req.body.To, "", "http://66.media.tumblr.com/1413af2a187cc227953599af9be8c5f9/tumblr_o9kwu6rB5i1tg72yro2_250.gif")
    setTimeout(function() {
      sendMessageThroughTwilio(req.body.From, req.body.To, "I can also send you regular updates about Ariana's Life. Would you like that?", "")
    }, 20000);
    }, 10000);
  }
}


function sendMessageThroughTwilio(to, from, text, media) {
  console.log("sending messageFromTwilio: " + to + from + text + media)
  console.log(media == "")
  if (media == "" || text == null) {
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
  } else if (media != null){
    console.log("sending media")
    twilio.messages.create({ 
        to: to, 
        from: from, 
        MediaUrl: media
    }, function(err, message) { 
      if (!err) {
        console.log(message.sid); 
      } else {
        console.log(err)
      }   
    });
  // } else {
  //   twilio.messages.create({ 
  //       to: to, 
  //       from: from, 
  //       body: text,
  //       mediaUrl: media
  //   }, function(err, message) { 
  //     if (!err) {
  //       console.log(message.sid); 
  //     } else {
  //       console.log(err)
  //     }   
  //   });
  }

}

listenForMessageAll()
listenForNewMessages();
listenForGroupedMessages()
listenForPushIdUpdates()

//sendTestRequest()

//sendMessageToUser("/MessageData/mgOVbPwSaPNxAskRztKFGZoTSqz1","-KKlIa_WDOmwDyloSPPD","heyyyyy", "text")
sendPushNotification(["ec178ffe-5005-4a6b-bb62-80f4d640c515", "8e70c1e0-d3ce-43a7-8a69-79477762bf33"], "Notification from Online!")

