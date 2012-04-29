/*!
 * Copyright(c) 2010 Ciaran Jessup <ciaranj@gmail.com>
 * MIT Licensed
 */
var OAuth = require("oauth").OAuth2,
    url = require("url"),
    connect = require("connect"),
    http = require("http"),
    Github = require("node-github");

module.exports = function(options, server) {
    options = options || {};
    // Construct the internal OAuth client
    var oAuth = new OAuth(options.appId, options.appSecret, "https://github.com/", "login/oauth/authorize", "login/oauth/access_token");
    var api_scope = options.scope || "";
    var name = options.name || "github";

    return {
        // Give the strategy a name
        name: name,

        // Build the authentication routes required
        setupRoutes: function(server) {
            server.use('/', connect.router(function routes(app) {
                app.get("/auth/github_callback", function(req, res) {
                    req.authenticate([name], {
                        scope: req.session[name + "_auth_scope"]
                    }, function(error, authenticated) {
                        res.writeHead(303, {
                            "Location": req.session.github_redirect_url
                        });
                        res.end("");
                    });
                });
            }));
        },

        // Declare the method that actually does the authentication
        authenticate: function(scope, request, response, callback) {
            var self = this;

            request.session[name + "_auth_scope"] = scope;
            //todo: makw the call timeout ....
            var parsedUrl = url.parse(request.url, true);
            if (parsedUrl.query && parsedUrl.query.code) {
                oAuth.getOAuthAccessToken(parsedUrl.query.code, {
                    redirect_uri: options.callback
                }, function(error, access_token, refresh_token) {
                    if (error)
                        return callback(error);

                    request.session.access_token = access_token;
                    if (refresh_token)
                        request.session.refresh_token = refresh_token;

                    var github = new Github({
                        version: "3.0.0"
                    });
                    github.authenticate({
                        type: "oauth",
                        token: access_token
                    });
                    github.user.get({}, function(err, data) {
                        if (err)
                            return self.fail(callback);
                        self.success(data, callback);
                    });
                });
            }
            else {
                request.session.github_redirect_url = request.url;
                var redirectUrl = oAuth.getAuthorizeUrl({
                    redirect_uri: options.callback,
                    scope: api_scope
                });
                self.redirect(response, redirectUrl, callback);
            }
        }
    };
};