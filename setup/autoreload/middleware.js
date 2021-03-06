/*!
 * Module dependencies.
 */

const autoreload = require('./middleware/autoreload');
const browser = require('./middleware/browser');
const connect = require('connect');
const cordova = require('./middleware/cordova/cordova');
const cordova_plugins = require('./middleware/cordova/cordova_plugins');
const devmode = require('./middleware/devmode');
const events = require('events');
const fs = require('fs');
const inject = require('./middleware/inject');
const mstatic = require('./middleware/static');
const nocache = require('./middleware/nocache');
const zip = require('./middleware/zip');
const path = require('path');
const plugins = require('./middleware/cordova/plugins');
const proxy = require('./middleware/proxy');
const register = require('./middleware/register');
const update = require('./middleware/update');
const bodyParser = require('body-parser');

/**
 * Request Listener / Connect Middleware.
 *
 * Options:
 *
 *   - `[options]` {Object}
 *     - `[autoreload]` {Boolean} toggle AutoReload watch (default: true).
 *
 * Events:
 *
 *   - `error` is emitted when an error occurs.
 *   - `log` is emitted with log info.
 *   - `close` is listened to and used to shutdown active middleware.
 *
 * Return:
 *
 *   - {Function} request listener that can be provided to `http.Server` or
 *     used as `connect` middleware.
 *
 * Example:
 *
 *     var phonegap = require('connect-phonegap')(),
 *         middleware = phonegap();
 *
 *     // subscribe to events
 *     middleware.on('log', function() {
 *         console.log.apply(this, arguments);
 *     });
 *
 *     // use as middleware
 *     app.use(middleware);
 *
 *     // or
 *
 *     // use as request listener
 *     http.createServer(middleware).listen(3000);
 */

module.exports = function(options) {

    let app = connect(),
        emitter = new events.EventEmitter();

    // optional parameters
    options = options || {};
    options.emitter = emitter;

    // global array to contain files to update for delta updates
    options.filesToUpdate = [];

    // proxy cross-origin requests
    app.use(proxy(options));

    // support POST JSON-encoded and URL-encoded queries
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));

    // no-cache header
    app.use(nocache(options));

    // sessions require the cookie parser
    /*
    var cookieSession = require('cookie-session');
    app.use(cookieSession({
        name: 'session',
        secret: 'phonegap'
    }));
    */

    // allow client to register devmode plugin is in use and get appID
    app.use(devmode(options));

    // watch file system for changes and notify client
    app.use(autoreload(options));

    // handle delta updates for content sync
    app.use(update(options));

    // handle /register requests
    app.use(register(options));

    // handle /zip requests
    app.use(zip(options));

    // inject JavaScript to refresh app or navigate home
    app.use(inject(options));

    // support desktop browser
    if (options.browser)
        app.use(browser(options));

    // serve static assets
    app.use(mstatic(options));

    // serve cordova js if 404'd out from previous static server
    app.use(cordova(options));

    // serve cordova_plugin js if 404'd out from previous static server
    app.use(cordova_plugins(options));

    // serve plugins if 404'd out from previous static server
    app.use(plugins(options));

    // create request listener and attach event emitter interface
    var requestListener = function(req, res, next) {
        app.handle(req, res, next);
    };

    for(var property in emitter) {
        requestListener[property] = emitter[property];
    }

    return requestListener;
};
