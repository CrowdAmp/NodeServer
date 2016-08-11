var express = require('express');
var request = require('request');
var app = express();


console.log('Hello!')


var data = {
  "object":"page",
  "entry":[
    {
      "id":"506618029393355",
      "time":1460245674269,
      "messaging":[
        {
          "sender":{
            "id":"1010801502368854"
          },
          "recipient":{
            "id":"506618029393355"
          },
          "timestamp":1460245672080,
          "message":{
            "mid":"mid.1460245671959:dad2ec9421b03d6f78",
            "seq":216,
            "text":"hello"
          }
        }
      ]
    }
  ]
}
tokens = ["EAANDZBlrUMZAUBAK0kDXHcHxiFZAYzO6jUSVZCfZC8L4D4rAixSC4TkoTfwHDD3GKZC0zxavKDS1gu24GKJSDtduWDhOWUrJX6830QLYCa8mFv3TV6FN9Pa4UJ6TkIAWHbr6QN0XnoHNu4xkUHUrt9LZCF5YsZAwJNK2d13Nf3fX5BQbUHH8i4173ZAgOv66dkvUZCt2hmMX1Ve1mhNEZAAD87CpAOOr1x5HpAZD"]
/*"EAANDZBlrUMZAUBAFOqXZC6DjNNTPLW5BKMtmtOy7BdjoPsJbV8l1c1RFcysuqAYk9gl4KnMgthEcZAcqX0CuLAomczDITzciceW7gcrASNsJQw5bHZAmR24BtSorwP6NzUUgHlaQnZBdrfp4Fs8qEvZBmfGsCJ2LqesNRXMQ8HzhMN37DRVxSKVtzN36d8bEOc6JKAOngvBlu4G1xVPtakc1EBEC1AhZA6gZD",
  
  "EAANDZBlrUMZAUBAJGTWmZCrzDQ0UHORnqPasZAVzZCwaZCc7JDEISddf4iNQgcJRunjZCKF18MBuvrCzI4XBIx0j8bHVZBc17SHa77cKbL2eXIIkVvvUWKhJNeZCd2XJmMO7huzhvZBuaa9Iag1rooV5tsjj01wkSJ9AIldC1iouFTyHKeMfMpAb5jQSI2hAMEI6PlW6BiIyZCbYDOwZBira8AOPGLlgZCSCyZAQ4ZD",
  *"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"]*/


accessToken = "EAANDZBlrUMZAUBAHZBkcPDhAOfMno6Baj0saNlX8tSmiMd8o35edWCZA67HrZCFWo8kyLwZBdsNPMXCJnWQ1w9mIuq918jryzPZBZCYMwd7f60oTsbpdbjExL9WxIC6HM3x43vZBDdSNVqsYqyDqFoXytJ9z5I3qE9jVjlodRDg2UxH19hojbKZB63UAb7ZAYDLPQIl9IdNZCTW0EBYJPBOygckMKZBQ8NGeZBhl3cd8E6uPgDMoZBNrZBqR6sqb"
inviteURL = "https://m.facebook.com/v2.7/dialog/apprequests?access_token=" + accessToken + "&app_id=919167474872725&display=touch&frictionless=1&get_frictionless_recipients=1&message=Check%20out%20Trump%20Bot%21&redirect_uri=fbconnect%3A%2F%2Fsuccess&sdk=ios-4.14.0&title=Invite%20Your%20Friends&to="

request({
	    url:  "https://graph.facebook.com/v2.7/me/invitable_friends?limit=1000&fields=first_name,last_name,middle_name,picture.width(350).height(350),id,name&access_token=" + accessToken + "&format=json&include_headers=false",
		method: 'GET'
    }, function(error, response, body) {
	    if (error) {
		console.log('Error sending message: ', error);
	    } else if (response.body.error) {
		console.log('Error: ', response.body.error);
	    } else {
        console.log(response.body)
        var idString = ""
	    	for (entry in JSON.parse(response.body)['data']) {

          if (entry != 0 && entry % 49 == 0) {
            idString += JSON.parse(response.body)['data'][entry]["id"]
            console.log(inviteURL + idString + '\n')
            idString = ""

          } else {
            idString += JSON.parse(response.body)['data'][entry]["id"] + ','
          }
        }
        console.log(inviteURL + idString + '\n')
	    }
	});
