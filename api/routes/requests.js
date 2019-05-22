const express = require('express');
const router = express.Router();
const models = require('../models/index').models;
const webpush = require('web-push');

// sends a join request to the owner of the group
router.post('/join_request', (req, res) => {
    var traveler = {
      fb_id: req.body.fb_id,
      name: req.body.name,
      from: req.body.from,
      to: req.body.to,
      time: req.body.time,
    };
  
    // find the group the user wants to join
    models.Group.findById(req.body.groupId).exec((err, group) => {
      var request = models.Request({
        group: group,
        traveler: traveler,
      });
  
      // create a request object
      request.save((err) => {
        if (err)
          res.send(500, "Error creating request");
        else {  
          // add those requests to the users concerned
          models.User.findOneAndUpdate({fb_id: req.body.fb_id}, {$push: {sent_requests: request}})
          .exec((err, user) => {
            if (err) {
              res.send(500, "Error adding sent request to user");
            }
  
            models.User.findOneAndUpdate({fb_id: group.owner.fb_id}, {$push: {received_requests: request}})
            .exec((err, owner) => {
              if (err)
                res.send(500, "Error adding received request to user");
              else {
  
                // send notication to this user (the owner of the group)
                const message = {
                  type: 'join_request',
                  title: 'Join Request',
                  body: user.name + " has sent a join request",
                }
                webpush.sendNotification(JSON.parse(owner.push_subscription), JSON.stringify(message))
                .catch(err => console.log(err))
                .then(() => res.send(200, "OK"));
              }
            });
          });
        }
      });
    });
});
  
  // approves a request to join the group
  //TODO: update notification and send it to all members
router.post('/approve_request', (req, res) => {
    // find the request object
    models.Request.findById(req.body.requestId, (err, request) => {
      if (err)
        res.send(500, err);
      else {
        // find the group and add the travler
        models.Group.findByIdAndUpdate(request.group, {$push: {members: request.traveler}})
        .exec((err, group) => {
          if (err)
            res.send(500, err);
          else {
            // remove received request from owner of the group
            models.User.findOneAndUpdate({fb_id: group.owner.fb_id}, 
              {$pull: {received_requests: req.body.requestId}})  //remove requests matching req id
              .exec((err) => {
                if (err)
                  res.send(500, "error removing request from user");
                else {
                  // remove request from sent_request of traveler
                  models.User.findOneAndUpdate({fb_id: request.traveler.fb_id}, 
                    {$pull: {sent_requests: req.body.requestId}, $push: {joined_groups: group}})  //remove requests matching req id
                    .exec((err, traveler) => {
                      if (err)
                        res.send(500, "error removing request from user");
                      else {
                        
                        // message to all the members of the group
                        const message = JSON.stringify({
                          type: 'approve_request',
                          title: 'Group Update',
                          body: request.traveler.name + " has joined the group",
                        });
                        
                        // sending notification to all members of the group
                        group.members.map((member) => {
                          models.User.findOne({fb_id: member.fb_id})
                          .exec((err, user) => {
                            webpush.sendNotification(JSON.parse(user.push_subscription), message)
                            .catch(err => console.log(err));
                          });
                        });
  
                        // message to the traveler
                        const message2 = JSON.stringify({
                          type: 'approve_request',
                          title: 'Request Update',
                          body: group.owner.name + " has accepted your request",
                        });
  
                        webpush.sendNotification(JSON.parse(traveler.push_subscription), message2)
                        .catch(err => console.log(err))
                        .then(() => res.send(200, "OK"));
                      }
                    });
                }
              });
          }
        });
      }
    });
});
  
// rejects a request to join the group
//TODO: update notification and send it to all members
router.post('/reject_request', (req, res) => {
    // find the request object
    models.Request.findById(req.body.requestId, (err, request) => {
        if (err)
        res.send(500, err);
        else {
        // find the group and add the travler
        models.Group.findById(request.group)
        .exec((err, group) => {
            if (err)
            res.send(500, err);
            else {
            // remove received request from owner of the group
            models.User.findOneAndUpdate({fb_id: group.owner.fb_id}, 
                {$pull: {received_requests: req.body.requestId}})  //remove requests matching req id
                .exec((err) => {
                if (err)
                    res.send(500, "error removing request from user");
                else {
                    // remove request from sent_request of traveler
                    models.User.findOneAndUpdate({fb_id: request.traveler.fb_id}, 
                    {$pull: {sent_requests: req.body.requestId}, $push: {joined_groups: group}})  //remove requests matching req id
                    .exec((err) => {
                        if (err)
                        res.send(500, "error removing request from user");
                        else {
                        // message to the traveler
                        const message = JSON.stringify({
                            type: 'approve_request',
                            title: 'Request Update',
                            body: group.owner.name + " has rehected your request",
                        });

                        webpush.sendNotification(JSON.parse(traveler.push_subscription), message)
                        .catch(err => console.log(err))
                        .then(() => res.send(200, "OK"));
                        res.send(200, "OK");
                        }
                    });
                }
                });
            }
        });
        }
    });
});

module.exports = router;