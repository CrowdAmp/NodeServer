//Adding comments
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
var _ = require('underscore')
var twilioForTwiml = require('twilio');
var Twitter = require("node-twitter-api")
var oauth = require('oauth')
var sha = require('./sha1.js');


var app = express()


//Used for iOS push notifications with OneSignal Module. each entry represents a differen app. 
var pushNotificationDict = {"AlexRamos" : "8e70c1e0-d3ce-43a7-8a69-79477762bf33"}

//Dict used to keep track of total fans and total messages for each influencer, used to report this within the iOS App: [total fans, total messages, 1]
var influencerMetricsDict = {
  "AlexRamos" : [0,0,1],
  'rmayer9999' : [0,0,1],
  'crowdamptester' : [0,0,1],
  'electionfails' : [0,0,1],
  'morggkatherinee' : [0,0,1],
  'kyleexum' : [0,0,1],
  'belieberbot' : [0,0,1],
  'jvrionis' : [0,0,1],
  'ChantellePaige' : [0,0,1],
  'indibot' : [0,0,1],
  'trumpbot' : [0,0,1]//
}

//Stores the user-facing name for each influencer
var influencerIdToNameDict = { 
  'AlexRamos' : "Alex Ramos",
  'rmayer9999' : "Ruben Mayer",
  'crowdamptester': "CrowdAmp",
  'electionfails' : "Test Account",
  'morggkatherinee': "Morgan Katherine",
  'kyleexum' : "Kyle Exum",
  'belieberbot' : "Belieber Bot",
  'jvrionis' : "John Vrionis",
  'ChantellePaige' : 'Chantelle Paige',
  'indibot' : "Indi the Fitness Bot",
  'trumpbot' : 'Trump Bot'
}

//var groupedMessageTestIds = ["+13108670121"] //"+15034966700"

/*Stores which phone number corresponds to which influencer. 
Each influencer has several phone numbers because twilio rate limits 
total messages that can be sent by each influencer */
var phoneNumberToInfluencerIdDict = {
  "+19804304321" : "electionfails",
  "+12512654321" : "electionfails",
  '+18184854321' : "electionfails",
  '+19197525252' : 'electionfails',
  '+16506678787' : 'morggkatherinee',
  '+19282278787' : 'morggkatherinee',
  '+17573478787' : 'morggkatherinee',
  '+12156078787' : 'morggkatherinee',
  '+18589278787' : 'morggkatherinee',
  '+16786078787' : 'morggkatherinee',
  '+18632678787' : 'morggkatherinee',
  '+14243478787' : 'morggkatherinee',
  '+13343778787' : 'morggkatherinee',
  '+18313378787' : 'morggkatherinee',
  '+16468768787' : 'morggkatherinee',
  '+14243476767' : 'morggkatherinee',
  '+17738256767' : 'morggkatherinee',
  '+18702936767' : 'morggkatherinee',
  '+19253926767' : 'morggkatherinee',
  '+16147586767' : 'morggkatherinee',
  '+19144255757' : 'morggkatherinee',
  '+13014175757' : 'morggkatherinee',
  '+12028385757' : 'morggkatherinee',
  '+16672135757' : 'morggkatherinee',
  '+18058745757' : 'morggkatherinee',
  '+18608214181' : 'kyleexum',
  '+18608214179' : 'kyleexum',
  '+18608214140' : 'kyleexum',
  '+18608214195' : 'kyleexum',
  '+18608214127' : 'kyleexum',
  '+18608214189' : 'kyleexum',
  '+18604214155' : 'kyleexum',
  '+18608214199' : 'kyleexum',
  '+18608214185' : 'kyleexum',
  '+18607173153' : 'kyleexum',
  '+18607173126' : 'kyleexum',
  '+18607173194' : 'kyleexum',
  '+18603702198' : 'kyleexum',
  '+18603702136' : 'kyleexum',
  '+18603081572' : 'kyleexum',
  '+18603081503' : 'kyleexum',
  '+12568134679' : 'jvrionis',
  '+12562026194' : 'jvrionis',
  '+14155236304' : 'ChantellePaige',
  '+14155236421' : 'ChantellePaige',
  '+14155236440' : 'ChantellePaige',
  '+14155230073' : 'ChantellePaige',
  '+14155236442' : 'ChantellePaige',
  '+14155236425' : 'ChantellePaige',
  '+14155236426' : 'ChantellePaige',
  '+14155236438' : 'ChantellePaige',
  '+14155236444' : 'ChantellePaige',
  '+14155236301' : 'ChantellePaige'

}

/* IMPORTANT:
  Stores the contact info for all the users in live memory. Each influencer has its own
  sub - dictionary. The makeup of this dict:

  {influencerId : { userId : [ isUsingApp // this boolean is true if the user is using iOS app, false otherwise , userId // either phone number or app id] }}
  
  The dict is populated when the program starts up, in the function listenForNewMessages
  Using live memory is a problem... not scalable, already reached limit 
*/
var userContactInfoDict = {
  //'influencerId' : {"userId" : ["isUsingApp", "twilioSendNumber/AppNotificationId"]}
  'AlexRamos' : {},
  'rmayer9999' : {},
  'crowdamptester': {},
  'electionfails' : {},
  'morggkatherinee': {},
  'kyleexum' : {},
  'belieberbot' : {},
  'jvrionis' : {},
  'ChantellePaige' : {},
  'indibot' : {},
  'trumpbot' : {}

}

var indiBotPurchaseIds = []

//URL of python server
var serverUrl = "https://fierce-forest-11519.herokuapp.com/"

app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

var messageCount = 0


//Test Func
var test1 = 0
app.get('/test1', function(request, response) {
  test1 += 1
  console.log("Test1 COUNT: " + test1)
    response.redirect("https://morgan-katherine-makeup.myshopify.com/products/personal-make-up-kit");
});

//For full bots, changes value shoyldSendAwayMessage. If shouldSendAwayMessage == true, the bot sends a message like "I am asleep"
app.get('/changeAwayVariable', function(request, response) {
  shouldSendAwayMessage = !shouldSendAwayMessage
  response.send("The value of the away variable is " + shouldSendAwayMessage);
});

var test2 = 0
app.get('/test2', function(request, response) {
  test2 += 1
  console.log("Test2 COUNT: " + test2)
    response.redirect("https://www.youtube.com/watch?v=1ekZEVeXwek");
});

app.get('/indiapp', function(request, response) {
    response.redirect("https://itunes.apple.com/us/app/indi-the-fitness-bot/id1140304645?mt=8");
});



app.set('port', (process.env.PORT || 5000))
app.use(express.static(__dirname + '/public'))

app.get('/', function(request, response) {
    response.send("hello world");
});


//Allows users to log in with twitter the userId parameter is used to store user-specific twitter credentials through callback
var _requestSecret = undefined
app.get('/twitterLogin/:userId', function(req, res) {
var twitter = new Twitter({
        consumerKey: "BF2zgayzrJs0Ee6BYmHeX1ZkZ",
        consumerSecret: "YOKrZCJO5ZLNYt4riMCQXhk3ToIZSnay90YX1JMXFeLUC3TLmj",
        callback: "https://peaceful-mountain-72739.herokuapp.com/twitterCallback/" + req.params.userId
    });

  twitter.getRequestToken(function(err, requestToken, requestSecret) {
      if (err)
          res.status(500).send(err);
      else {
          _requestSecret = requestSecret;
          res.redirect("https://api.twitter.com/oauth/authenticate?oauth_token=" + requestToken);
      }
  });
})

//Sends a message to users prompting for a Login with Twitter
app.get('/promptTwitterLogin/:influencerId/:message', function(req, res) {
  for(var key in userContactInfoDict[influencerId]) {
    timeout += 500
    staggeredForwardMessageFromServerToUsers(timeout, req.params.influencerId, req.params.message + "/" + key, "text", req.params.influencerId + "/IndividualMessageData/", key, "")
  }

  console.log("InfluencerId: " + req.params.influencerId + req.params.message)
  res.sendStatus(200)
})

//Twitter callback, Twitter calls it after a user is logged in succesfully, 
//stores user twiter credentials on firebase and send thank you message.
app.get('/twitterCallback/:userId', function(req, res) {
  var twitter = new Twitter({
        consumerKey: "BF2zgayzrJs0Ee6BYmHeX1ZkZ",
        consumerSecret: "YOKrZCJO5ZLNYt4riMCQXhk3ToIZSnay90YX1JMXFeLUC3TLmj",
        callback: "https://peaceful-mountain-72739.herokuapp.com/twitterCallback/" + req.params.userId
    });

  var requestToken = req.query.oauth_token,
      verifier = req.query.oauth_verifier;

      twitter.getAccessToken(requestToken, _requestSecret, verifier, function(err, accessToken, accessSecret) {
          if (err)
              res.status(500).send(err);
          else
              twitter.verifyCredentials(accessToken, accessSecret, function(err, user) {
                  if (err)
                      res.status(500).send(err);
                  else
                      console.log("Twitter access token: " + accessToken)
                      console.log("Twitter access secret: " + accessSecret)
                      addItemToFirebaseDatabase('TwitterData/electionfails/' +  req.params.userId, "accessToken", accessToken)
                      addItemToFirebaseDatabase('TwitterData/electionfails/' +  req.params.userId, "accessSecret", accessSecret)


                      res.send("Thank You B!!!");
              });
      });
  });

//Endpoint used by iOS app to get total fans by influencerId
app.get('/getTotalFans/:id', function(request, response) {
  console.log("GET TOTAL FANS: " + influencerMetricsDict[request.params.id])
  response.send(influencerMetricsDict[request.params.id][0].toString())
})

//Endpoint used by iOS app to get total messages by influencerId
app.get('/getTotalMessages/:id', function(request, response) {
    response.send(influencerMetricsDict[request.params.id][1].toString())
})
 
//Endpoint used by iOS app to know how many unread "grouped messages" each influencer has
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

//Used for Facebook invites, not really relevant anymore.  
app.get('/didShare/:id', function(request, response) {
  console.log("GET TOTAL FANS: " + influencerMetricsDict[request.params.id])
  response.send("20")
})

//This endpoint is used when users authorize the app to tweet automatically them, or to remove this authorization
//Authorization data is stored on Twitter
app.get('/updateTwitterAuthorization/:influencerid/:id/:status', function(request, response) {
  var influencerId = request.params.influencerid
  var userId = request.params.id
  var authStatus = request.params.status

  if (authStatus == 'true') {
    authStatus = true
  } else {
    authStatus = false 
  }
  //addItemToFirebaseDatabase('belieberbot/TwitterData/' + userId, "hasAuthorization", false)

  addItemToFirebaseDatabase(influencerId + "/TwitterData/" + userId, "hasAuthorization", authStatus)
  response.send("Changed Status of " + userId + " to " + authStatus + " " + influencerId)
})

//Test notification
app.post('/test', function(request, response) {
    console.log(request.body)
    console.log(request.body.content)
    response.sendStatus(200)
})

//Endpoint called by Python server to send the influencer a new "grouped message". 
//E.g. if 150 users say "What is your dog's name?" the Python server would call this endpoint prompting the influencer for a response
app.post('/shouldPromptInfluencerForAnswer', function(request, response) {
  console.log(request.body)
  var content = request.body.content
  var numberOfUsers = request.body.numberOfUsers
  var influencerId = request.body.influencerId
  var phraseId = request.body.phraseId 
  sendGroupedConversationToInfluencer(influencerId, content, numberOfUsers, phraseId)
  console.log("should send notification to " + influencerId + " with Key: " + pushNotificationDict[influencerId])
  if (pushNotificationDict[influencerId] != undefined) {
    sendPushNotification([pushNotificationDict[influencerId][0]], [pushNotificationDict[influencerId][1]],"Message from " + numberOfUsers + " fans: " + content)
  }
  response.sendStatus(200)

})

//Uses Firebase to send "grouped message" to influencer 
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


//Endpoint called by the Python server to send a message to a list of users 
//Used to reply to users. 
//TODO: add rate limmiting 
app.post('/shouldSendMessageToUsers', function(request, response) {
  var content = request.body.content
  console.log("CONTENT: " + content)
  var type = request.body.type
  var influencerId = request.body.influencerId
  var userIdList = request.body.userIdList
  var mediaDownloadUrl = request.body.mediaDownloadUrl
  console.log("shouleSendMessageToUsers" + mediaDownloadUrl)


  for (var i = 0; i < userIdList.length; i++) {  
    console.log("sendingMesage to userId: " + userIdList[i])  
    forwardMessageFromServerToUsers(influencerId, content, type, influencerId + "/IndividualMessageData/", userIdList[i], mediaDownloadUrl)
  }
  response.sendStatus(200)

})

//Sends message that came from server to users by adding to Firebase
//If user is connected via SMS, uses Twilio API
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
  addItemToFirebaseDatabase(firebasePath +  userId, "timestamp", firebase.database.ServerValue.TIMESTAMP)

  if (!userContactInfoDict[influencerId][userId][0]) {
    if (type == "text") {
      sendMessageThroughTwilio(userId, userContactInfoDict[influencerId][userId][1], content, "")
    } else if (type == "image") {


      sendMessageThroughTwilio(userId, userContactInfoDict[influencerId][userId][1], "", mediaDownloadUrl)
    }
  } else {
    if (pushNotificationDict[userId] != undefined) {
      sendPushNotification([pushNotificationDict[userId][0]], [pushNotificationDict[userId][1]], getPushNotificationMessage(userId))
    }
  }
}

app.get('/testPushNotifications', function(request, response) {
  sendPushNotification(["ec178ffe-5005-4a6b-bb62-80f4d640c515", "8e70c1e0-d3ce-43a7-8a69-79477762bf33"], "Notification from Online!")
  response.sendStatus(200)
})

//Calls endpoint in Python server to create a new user 
function reportNewUserToServer(influencerId, userId, device) {
  reqUrl = serverUrl + "recordNewUser"
  console.log("reportingNewUserToServer")
  try {
    requests({
      url: reqUrl,
      method: "POST",
      json: { 
         userId : userId,
         influencerId: influencerId,
         device: device
       },
    },function (error, response, body) {
          if (!error) {
            console.log("response: " + response.body.content)
          } else {
            console.log("error reporting new user: " + error)
          }
      });

  } catch(err) {
    console.log("Error with request: " + err)
  }

}

//Used to send app-specific iOS push notification messages
function getPushNotificationMessage(userId) {
  influencerId = pushNotificationDict[userId][2]
  if (influencerId == 'belieberbot') {
    return "You have a new message from JB!"
  } else if (influencerId == 'trumpbot') {
    return "You have a new message from Donald Trump 😉"
  } else if (influencerId == 'indibot') {
    return "You have a new message from Indi! 💪😬🏋"
  } else {
    return "You just received a new message!"
  }
}


//TESTING FUNC, not used
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
          console.log("error1: " + error)
        }
    });

} catch(err) {
  console.log("Error with request: " + err)
}
  response.send(200)
})

//Forwards Firebase data snapshots to Python Server
//Used when user or influencer sends a message from the iOS app, so that the data is stored and processed by the NLP server 
function forwardSnapshotToNLPDatabase(snapshot, influencerId, userId) {
  console.log("shouldForwardSnapshotToNLPDatabase " + snapshot.child("text").val())
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

  //adds information regarding user payment
  if (indiBotPurchaseIds.indexOf(userId) == -1) {
    console.log("Adding *** for indiBot " + userId)
    snapshotContent += "***"
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
            console.log("error2: " + error)
          }
      });

  } catch(err) {
    console.log("Error with request: " + err)
  }

}

//When an influencer responds to a "grouped message" this is forwarded on to the Python Server. 
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
            console.log("error3: " + error)
          }
      });

  } catch(err) {
    console.log("Error with postInfluencerDidRespondToPrompt request: " + err)
  }
}

//Initializes connection with Firebase database
firebase.initializeApp({
  databaseURL: 'https://crowdamp-messaging.firebaseio.com',
  serviceAccount: path.join(__dirname + '/CrowdAmpMessaging-5e5474ce420c.json')
});

  //app.use('/static', express.static('indexx'))
  //response.send('Hello00 World!')

//API point used by twilio. Sends voice messages for users that call the number. 
app.post('/twiliovoice', function(request,response) {

  var twiml = new twilioForTwiml.TwimlResponse();
      twiml.say('Hi, thank you for calling! This number only accepts messages. Please hang up and send a text', {
      voice:'woman',
      language:'en-gb'
    });

      response.writeHead(200, {'Content-Type': 'text/xml'});
      response.end(twiml.toString());
})

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
})


var conversationId = "33PeopleSent"
var messageText = "When is your next vine coming out?"


//Uses Firebase api to listen for any 'grouped message' updates, and forward to corresponding servers or users
function listenForGroupedMessages() {
  firebase.database().ref('/').on('child_added', function(snapshot) {
    var influencerName = snapshot.key
    firebase.database().ref("/" + influencerName + "/GroupedMessageData").on('child_added', function(snapshot) {
      var snapshotPath = '/' + influencerName + '/GroupedMessageData' + '/' + snapshot.key 
      firebase.database().ref(snapshotPath).on('child_added', function(snapshot) {
        if (!snapshot.child("hasBeenForwarded").val() && !snapshot.child("sentByUser").val() && snapshot.child("type").val()) {
          addItemToFirebaseDatabase(snapshotPath + "/" + snapshot.key, "hasBeenForwarded", true) //Prevents messages from being forwarded twice 
          if (!snapshot.child("sentByUser").val()) { //Checks that text was sent by influencer
            console.log(snapshot.child("senderId").val())
              postInfluencerDidRespondToPrompt(influencerName, snapshot)
          }
        }
      })
    })
  })
}

//Forwards firebase data snapshot message to relevant users. Used for "message all"
//If users are not using iOS app, also forwards via SMS message
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

//Rate limmited messaging forwarding. Only used by Twitter
function staggeredForwardMessageFromServerToUsers(timeout, influencerId, content, type, firebasePath , userId, imageDownload) {
  setTimeout(function() {
    forwardMessageFromServerToUsers(influencerId, content, type, firebasePath, userId, "")
  }, timeout)
}

//Sends message and push notification to users. 
function sendStaggeredMessage(key, timeout, snapshot, influencerId) {
    var userId = key
    setTimeout(function() {
    forwardFirebaseSnapshotToUsers(snapshot,'/' + influencerId +"/IndividualMessageData/", key, influencerId)
    if (pushNotificationDict[userId] != undefined) {
      sendPushNotification([pushNotificationDict[userId][0]], [pushNotificationDict[influencerId][1]] ,getPushNotificationMessage(userId))
    }
  }, timeout)
}

//Checks for any changes in the "message all" firebase database. If an influencer has sent a "message all," takes care of forwarding
//the message to all their fans. 
function listenForMessageAll() {
  firebase.database().ref('/').on('child_added', function(snapshot) {
    var influencerId = snapshot.key
    firebase.database().ref('/' + influencerId + "/MessageAllData/sendToAll").on('child_added', function(snapshot) {
      if (!snapshot.child("hasBeenForwarded").val() && snapshot.key[0] == '-') {
          addItemToFirebaseDatabase('/' + influencerId + "/MessageAllData/sendToAll/" + snapshot.key, "hasBeenForwarded", true)
          console.log("ListeningForMessageAll " + snapshot.key + Object.keys(userContactInfoDict[influencerId]))
        if (!snapshot.child("sentByUser").val()) {
          var timeout = 0

          //Rate limmiting prevents Twilio from rejecting requests 
          for(var key in userContactInfoDict[influencerId]) {
            timeout += 500
            sendStaggeredMessage(key, timeout, snapshot, influencerId)
          }
          
          //Once message has been sent, sends confirmation to influencer. 

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

//Used for bots, sends away message if necessary 
var shouldSendAwayMessage = false
function sendAwayMessageIfNecessary(snapshot, influencerId) {
  if (shouldSendAwayMessage == true && influencerId == 'belieberbot') {
    forwardMessageFromServerToUsers(influencerId, "Hey, robots need sleep too! I'm away rignt now, but I'll get back to you as soon as I can ;)", "text", influencerId + "/IndividualMessageData/", snapshot.child("senderId").val(), "") 
  } else if (shouldSendAwayMessage == true && influencerId == 'indibot') {
    forwardMessageFromServerToUsers(influencerId, "Hey, bots need sleep too! I'm updating my servers right now, but I'll get back to you as soon as I can :)", "text", influencerId + "/IndividualMessageData/", snapshot.child("senderId").val(), "") 

  }
}

//Checks firebase for new messages on the user end (IndividualMessageData endpoint)
//Runs through entire database on startup, and adds user info to userContactInfoDict
//Keeps track of wether messages have been forwarded before if they have not:
// - sends SMS to users if they are not on app
// - sends message info to Python DB
// - Marks the message as "forwarded" 
function listenForNewMessages() {
  firebase.database().ref('/').on('child_added', function(snapshot) {
    var influencerId = snapshot.key
    //var snapshotPath = "/" + snapshot.key + 'AlexRamos/IndividualMessageData'
    firebase.database().ref(influencerId + '/IndividualMessageData').on('child_added', function(snapshot) {
      if (snapshot.child("isUsingApp").val() != null && snapshot.child("sendMessagesFrom").val() != null) { 
        userContactInfoDict[influencerId][snapshot.key] = [snapshot.child("isUsingApp").val(), snapshot.child("sendMessagesFrom").val()]
      } 

      if (snapshot.child("isUsingApp").val() == null && userContactInfoDict[influencerId][snapshot.key] == undefined && snapshot.key[0] != '+') {
        console.log("ADDING USER FROM APP:: " + snapshot.key)
        userContactInfoDict[influencerId][snapshot.key] = [true, "sendMessagesFromApp"]
      }

      influencerMetricsDict[influencerId][0] += 1 
 

      var snapshotPath = influencerId + '/IndividualMessageData' + '/' + snapshot.key
      console.log(snapshotPath)
  		firebase.database().ref(snapshotPath).on('child_added', function(snapshot) {
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
            sendAwayMessageIfNecessary(snapshot, influencerId)
            if(influencerId == "indibot" && snapshot.child("sentByUser").val()) {
              //sendMessageThroughTwilio("+13108670121", "+19804304321", "Indibpt just received a message, get off yo ass and reply!", "")
              //sendMessageThroughTwilio("+16507223660", "+19804304321", "IndiBot just received a message. NO TYPOS", "")              
              //sendMessageThroughTwilio("+15034966700", "+19804304321", "Indibot just received a message, tell Ruben or reply", "")
            }
          }
          if (userContactInfo && !snapshot.child('hasBeenForwarded').val()) {
            addItemToFirebaseDatabase('/' + influencerId + '/IndividualMessageData/' + snapshot.child("senderId").val() + "/" + snapshot.key, "hasBeenForwarded", true)
            if (pushNotificationDict[snapshot.child("senderId").val()] != undefined) {
              sendPushNotification([pushNotificationDict[snapshot.child("senderId").val()][0]], [pushNotificationDict[snapshot.child("senderId").val()][1]], getPushNotificationMessage(snapshot.child("senderId").val()))
            } 
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

// Not used 
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
 
//populates pushID dict. PushIDs2 is called like that because ids were migrated  
function listenForPushIdUpdates() {
  firebase.database().ref('/PushIds').on('child_added', function(snapshot) {
    var influencerId = snapshot.key
     var pushIdDict = {}
     var refPath
      if (snapshot.key == 'kyleexum' || snapshot.key == 'morggkatherinee' || snapshot.key == 'ChantellePaige') {
        pushIdDict = {
          "pushId" : snapshot.child("pushId").val(),
          "onesignalToken" : "3fe58d49-2025-4653-912f-8067adbecd7f",
          "influencer" : "crowdamp",
        }
        refPath = "/PushIds2/CROWDAMP"
        //console.log("WOULD SEND PUSH TO: " + snapshot.key)
        //sendPushNotification([snapshot.child("pushId").val()], "Belieber Bot just sent you a new message!")
      } else {
        pushIdDict = {
          "pushId" : snapshot.child("pushId").val(),
          "onesignalToken" : "3fe58d49-2025-4653-912f-8067adbecd7f",
          "influencer" : "belieberbot",
        }
        refPath = "/PushIds2/BELIEBERBOT"

      }
      addItemToFirebaseDatabase(refPath, snapshot.key, pushIdDict)
  })
}

function listenForPushIdUpdates2() {
  firebase.database().ref('/PushIds2').on('child_added', function(snapshot) {
    console.log("ADDING pushid1" + snapshot.key)
    var influencerId = snapshot.key
    firebase.database().ref('/PushIds2/' + influencerId).on('child_added', function(snapshot) {
      console.log("ADDING pushid2")
      pushNotificationDict[snapshot.key] = [snapshot.child("pushId").val(), snapshot.child("onesignalToken").val(), snapshot.child("influencer").val()]
    })
  })
}

//Used for a specific app test, measured purchases
function listenForIndiPurchases() {
  firebase.database().ref('/indibot/upgrades').on('child_added', function(snapshot) {
    console.log("ADDING PURCHASE KEY " + snapshot.key)
    indiBotPurchaseIds.push(snapshot.key)
  })
}


//Sends intro messages to full bot apps
function listenForNewUserUpdates(platform) {
  firebase.database().ref('belieberbot/' + platform).on('child_added', function(snapshot) {
    var userId = snapshot.key
    if (snapshot.child("hasRecorded").val() == null || snapshot.child("hasRecorded").val() == false) {
       firebase.database().ref('belieberbot/IndividualMessageData/' + userId).once("value", function(snapshot) {
        console.log("NUM Children: for trumpbot" + snapshot.numChildren())
        if (snapshot.numChildren() < 5) {
          console.log("LISTENING FOR New user UPDATES")
          addItemToFirebaseDatabase('belieberbot/' + platform + '/' + userId, "hasRecorded", true)
          forwardMessageFromServerToUsers("belieberbot", "Hey, it's JB bot. I talk like Justin Bieber and send you updates about him. Would you be down?", "text", "belieberbot/IndividualMessageData/", userId, "") 
          forwardMessageFromServerToUsers("belieberbot", "It might take me a few minutes to reply, but I will definitely get back to you! Turn on push notifications so that you get my messages?", "text", "belieberbot/IndividualMessageData/", userId, "") 
          reportNewUserToServer("belieberbot", userId, "iOS")
        }
      })

    }
  })

  firebase.database().ref('trumpbot/' + platform).on('child_added', function(snapshot) {
    var userId = snapshot.key
    if (snapshot.child("hasRecorded").val() == null || snapshot.child("hasRecorded").val() == false) {
       firebase.database().ref('trumpbot/IndividualMessageData/' + userId).once("value", function(snapshot) {
        console.log("NUM Children: for belieberbot" + snapshot.numChildren())
        if (snapshot.numChildren() < 5) {
          console.log("LISTENING FOR New user UPDATES")
          addItemToFirebaseDatabase('trumpbot/' + platform + '/' + userId, "hasRecorded", true)
          forwardMessageFromServerToUsers("trumpbot", "Hi I am Trump Bot I am going to MAKE TEXTING GREAT AGAIN! Tap on the star to see what I think about your friends, or message me!", "text", "trumpbot/IndividualMessageData/", userId, "") 
          forwardMessageFromServerToUsers("trumpbot", "I'm very busy, so it might take me a while to reply but I will definitely get back to you. Turn on push notifications so you know when you received my message?", "text", "trumpbot/IndividualMessageData/", userId, "") 
          reportNewUserToServer("trumpbot", userId, "iOS")
        }
      })
    }
  })

    firebase.database().ref('indibot/' + platform).on('child_added', function(snapshot) {
    var userId = snapshot.key
    if (snapshot.child("hasRecorded").val() == null || snapshot.child("hasRecorded").val() == true) {
      console.log("LISTENING FOR New user UPDATES")
      addItemToFirebaseDatabase('indibot/' + platform + '/' + userId, "hasRecorded", true)
      forwardMessageFromServerToUsers("indibot", "Hi I am Indi Bot I will be your fitness companion!", "text", "indibot/IndividualMessageData/", userId, "") 
      forwardMessageFromServerToUsers("indibot", "It might take me a few minutes to reply, but I will definitely get back to you!", "text", "indibot/IndividualMessageData/", userId, "") 
      forwardMessageFromServerToUsers("indibot", "If at any time you want to Tweet or share a screenshot of this conversation on Facebook, simply reply SHARE", "text", "indibot/IndividualMessageData/", userId, "") 
      reportNewUserToServer("indibot", userId, "iOS")
    }
  })
}

//Uses OneSignal SDK for iOS push notifications 
function sendPushNotification(userIds, app_id ,content) { 
  var restApiKey = 'N2Y2MWU1MDMtOTk3Zi00MDkzLWI3NjEtYTU0N2UwYjFjMGRh';
  if (app_id == undefined) {
    app_id = ['3fe58d49-2025-4653-912f-8067adbecd7f']
  }
    console.log("SHOULD SEND PUSH NOTIFICATION", userIds, app_id, content)

  var params = {
    app_id: app_id[0],
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

/*receives inbound message requests from twilio, if the message is from a new user, sends intro message and
assings a phone number to the new user. 
*/
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

            //forwardMessageFromServerToUsers(phoneNumberToInfluencerIdDict[req.body.To], "You've reached " + influencerIdToNameDict[phoneNumberToInfluencerIdDict[req.body.To]]  + "! This is an automatic message to let you know know that you can text me directly at: " , "text", "/IndividualMessageData/" +  req.body.From, req.body.From, '')
            reportNewUserToServer(phoneNumberToInfluencerIdDict[req.body.To], req.body.From, "sms")
            sendMessageThroughTwilio(req.body.From, req.body.To, "You've reached " + influencerIdToNameDict[phoneNumberToInfluencerIdDict[req.body.To]]  + "! This is an automatic message to let you know know that you can text me directly at: " + phoneNumberFormatter(phoneNumberToSendFrom) + ". The purpose of this message is to filter any SPAM that I would otherwise recieve.", "")
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

function phoneNumberFormatter(phoneNumber) {
  if (phoneNumber.length == 12) {
    return "(" + phoneNumber.substring(2,5) + ") " + phoneNumber.substring(5,8) + '-' + phoneNumber.substring(8,12)
  } else {
    return phoneNumber
  }
}

//Sends influencer-specific introductory messages 
function sendIntroFlow(req, phoneNumberToSendFrom) {
  if (req.body.To == '+12562026194') {
    forwardMessageFromServerToUsers("jvrionis", "Hey! this is John, thanks for messaging me! I will try to answer messages as soon as I can :) Also, I can send you updates about cool deals I'm working on. Sound cool?", "text", "jvrionis/IndividualMessageData/", req.body.From, "") 


  } else if (req.body.To == '+14155236304') {
    forwardMessageFromServerToUsers("ChantellePaige", "Hey! This is Chantelle, thanks for messaging me. I'm so excited to chat! I'll try to get back to you asap!!! :D And guess what!?! I have some exciting new stuff going on, wanna hear about it? ;)", "text", "ChantellePaige/IndividualMessageData/", req.body.From, "") 
  } else if (req.body.To == '+16506678787') {
    forwardMessageFromServerToUsers("morggkatherinee", "Hey! this is Morgan, thanks for messaging me! I will try to answer messages as soon as I can :) Also, I can send you updates about what I'm up to. Sound cool?", "text", "morggkatherinee/IndividualMessageData/", req.body.From, "") 

  } else if (req.body.To == '+18608214181'){ 
    //sendMessageThroughTwilio(req.body.From, phoneNumberToSendFrom, "Hey! It's Kyle Exum. I'll try to respond to your messages when I can :)", "")
    forwardMessageFromServerToUsers("kyleexum", "Hey! It's Kyle Exum. I'll try to respond to your messages when I can :)", "text", "kyleexum/IndividualMessageData/", req.body.From, "") 

  } else if (false) {

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

//Calls twilio API to send text message 
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

//Not called much
function registerNewUsers() {
 // {"userId" : ["isUsingApp", "twilioSendNumber/AppNotificationId"]}
 console.log("registering new users")
  for (var key in userContactInfoDict) {
      console.log(userContactInfoDict[key])
    for (var key in userContactInfoDict[key]) {
      console.log("registering new users" + user)
      console.log(userContactInfoDict[influencer[user]])
    }
  }
}

//Interacts with Twitter API to publish tweets 
function sendTweet(screenName, userToken, userSecret, content, containsMedia, mediaFileName) {

var a = new oauth.OAuth("https://twitter.com/oauth/request_token",
  "https://twitter.com/oauth/access_token",
  "BF2zgayzrJs0Ee6BYmHeX1ZkZ",
  "YOKrZCJO5ZLNYt4riMCQXhk3ToIZSnay90YX1JMXFeLUC3TLmj",
  "1.0",
  "asdf",
  "HMAC-SHA1");

if (containsMedia) {
  a.post("https://upload.twitter.com/1.1/media/upload.json", userToken, userSecret, {media:fs.readFileSync(mediaFileName).toString("base64")} ,"" , function (e, data, res){
      if (e) {
          console.error(e);
      } else {
          try{
              data = JSON.parse(data);
          }catch (e){
              console.error("Error Json : " + e);
          }
          console.log(data.media_id);

          a.post("https://api.twitter.com/1.1/statuses/update.json", userToken, userSecret, {status:content, media_ids:[data.media_id_string]}, "", function (e, data, response){
              if (e) {
                console.error("Error for " + screenName + ": " + e);
              }else {
                console.log("Tweeted for " + screenName)
              }
            })
        }

    })
  } else {
    a.post("https://api.twitter.com/1.1/statuses/update.json", userToken, userSecret, {status:content}, "", function (e, data, response){
        if (e) {
          console.error("Error for " + screenName + ": " + e);
        } else {
          console.log("Tweeted for " + screenName)
      }
    })
  }
}

//Sends a twitter message for every registered user. only ever implemented for belieberbot
function tweetAll(message, containsFile, fileName) {
  firebase.database().ref("/belieberbot/TwitterData").once('value', function(snapshot) {
    snapshot.forEach(function(childSnapshot) {
      //console.log(childSnapshot.key)
      if (childSnapshot.child("hasAuthorization").val()) {
        sendTweet(childSnapshot.key, childSnapshot.child("token").val(), childSnapshot.child("secret").val(), "LOL Bieber Bot made me laugh 😂 What would you ask him? tinyurl.com/BieberBotApp", true, "./bieberMarryGifFinal.gif")
        console.log("Sending tweet for: " + childSnapshot.key) 
      }
    })
  })
}

//Main:
listenForNewUserUpdates("TwitterData")
listenForNewUserUpdates("FacebookData")  
listenForPushIdUpdates()
listenForMessageAll()
listenForNewMessages();
listenForGroupedMessages()
listenForPushIdUpdates2() 
listenForIndiPurchases()
//spanmArnav()
//sendTestRequest()

//LOL used to troll fiends 
function staggeredSpam(timeout, key) {
  setTimeout(function() {
    sendMessageThroughTwilio('+16507969353', key, "Never tag me on facebook again you Bitch", "")  
  }, timeout)
}

// ^ same as previous (this is my friend Arnav that I was telling you about hahaah)
function spamArnav() {
  var timeout = 0
  for (key in phoneNumberToInfluencerIdDict) {
    console.log(key)
    staggeredSpam(timeout, key)
    timeout += 10000
  }
}



