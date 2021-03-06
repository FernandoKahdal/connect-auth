/*!
 * Copyright(c) 2010 stunti
 * MIT Licensed
 */
var OAuth= require("oauth").OAuth,
    url = require("url"),
    connect = require("connect"),
    http = require('http');

module.exports= function(options, server) {
  options= options || {}
  var that= {};
  var my= {};
  that.name     = options.name || "foursquare";
  
  // Construct the internal OAuth client
  my._oAuth= new OAuth("http://foursquare.com/oauth/request_token",
                         "http://foursquare.com/oauth/access_token", 
                         options.consumerKey,  options.consumerSecret, 
                         "1.0", null, "HMAC-SHA1");
                         
   // Build the authentication routes required 
   that.setupRoutes= function(server) {
     server.use('/', connect.router(function routes(app){
       app.get('/auth/foursquare_callback', function(req, res){
         req.authenticate([that.name], {scope: req.session[that.name + '_auth_scope']}, function(error, authenticated) {
           res.writeHead(303, { 'Location': req.session.foursquare_redirect_url });
           res.end('');
         });
       });
     }));
   }

  // Declare the method that actually does the authentication
  that.authenticate= function(scope, request, response, callback) {
    request.session[that.name + '_auth_scope']= scope;
    //todo: if multiple connect middlewares were doing this, it would be more efficient to do it in the stack??
    var parsedUrl= url.parse(request.url, true);
    //todo: makw the call timeout ....
    var self= this; 
    if( parsedUrl.query && parsedUrl.query.oauth_token && request.session.auth["foursquare_oauth_token_secret"] ) {
       my._oAuth.getOAuthAccessToken(parsedUrl.query.oauth_token, 
                                    request.session.auth["foursquare_oauth_token_secret"],
                                    function( error, oauth_token, oauth_token_secret, additionalParameters ) {
                                        if( error ) {
                                            require('sys').debug('error in foursquare');
                                            callback(null);
                                        } else { 
                                          request.session.auth["foursquare_oauth_token_secret"] = oauth_token_secret;
                                          request.session.auth["foursquare_oauth_token"]        = oauth_token;
                                          my._oAuth.getProtectedResource("http://api.foursquare.com/v1/user.json", "GET",
                                                                         oauth_token, oauth_token_secret, 
                                                                         function(err, data, response) {
                                                                           if(err ) {
                                                                             callback(null);
                                                                           }
                                                                           else {
                                                                             var user= JSON.parse(data).user;
                                                                             self.success(user, callback)
                                                                           }
                                          });
                                        }
                                    });
    } else {
       my._oAuth.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, oauth_authorize_url, additionalParameters ) {
           if (error) {
             callback(null); // Ignore the error upstream, treat as validation failure.
           } else {
              request.session['foursquare_redirect_url']            = request.url;
              request.session.auth["foursquare_oauth_token_secret"] = oauth_token_secret;
              request.session.auth["foursquare_oauth_token"]        = oauth_token;
              self.redirect(response, "http://foursquare.com/oauth/authorize?oauth_token=" + oauth_token, callback);
           }
       });
    }    
  };
  return that;
  
}