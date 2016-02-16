'use strict';

define('ServerHandler', ['ServerHandler/httpHandler',
    'ServerHandler/socketHandler', 'helper/webStorage', 'rx'
  ],
  function(httpHandler, socketHandler, webStorage, Rx) {

    /**
     * ServerHandler constructor
     * @param  {Array} route      The route to the server resource, the
     *                            first array entry is the base URL
     * @param  {Object} options   The options for the server handler
     */
    var ServerHandler = function(route, keys, options) {
      var _this = this;

      this._baseUrl = route.splice(0, 1)[0];
      this._resourcePath = route;
      this._fullUrl = this._buildUrl();
      this._options = options || {};
      this._keys = keys;

      // Public streams
      this.upStream = new Rx.Subject();
      this.upStream.subscribe(function(item) {
        if (!_this._connected) {
          _this._unpushedList[item.meta.rtId] = item;
        } else {
          _this._protocol.push(item, _this);
        }
      }, function(err) {});

      this.downStream = new Rx.Subject();
      this.downStream.subscribe(
        /* istanbul ignore next */
        function() {},

        function(error) {
          ServerHandler.errorStream.onNext(error);
        });

      // Instance connection stream that gets input from
      // the global connection stream.
      this.connectionStream = new Rx.Subject();
      this.connectionStream.subscribe(function(state) {
        _this.setConnectionState(state);
      });

      this._connected = false;

      ServerHandler.connectionStream.subscribe(this.connectionStream);

      // List of items that couldn't be pushed to the server (e.g. because of
      // missing connection or offline mode).
      // Key of the items is always the runtime ID, so they can be replaced by
      // newer versions.
      this._unpushedList = {};

      this._lastModified = webStorage.getWebStorage().getItem(
        'harmonized-modified-' + this._resourcePath.join('_')) || 0;

      this._protocol = null;
      var useProtocol;
      if (this._options.protocol === 'websocket') {
        useProtocol = 'websocket';
      } else {
        useProtocol = 'http';
      }

      this._setProtocol(useProtocol);
    };

    ServerHandler.connectionStream = new Rx.Subject();
    ServerHandler.errorStream = new Rx.Subject();

    /**
     * Sets the protocol to HTTP or WebSocket
     * @param {httpHandler|socketHandler} protocol The protocol to set
     */
    ServerHandler.prototype._setProtocol = function setProtocol(protocol) {
      var _this = this;

      function setTheProtocol(newProtocol) {
        if (_this._protocol !== null) {
          _this._protocol.disconnect(_this);
        }

        _this._protocol = newProtocol;
        _this._protocol.connect(_this);
      }

      if (protocol === 'http' && this._protocol !== httpHandler) {
        setTheProtocol(httpHandler);
      } else if (protocol === 'websocket' && this._protocol !==
        socketHandler) {
        setTheProtocol(socketHandler);
      }
    };

    /**
     * Fetches the data from the server
     */
    ServerHandler.prototype.fetch = function fetch(cb) {
      this._protocol.fetch(this, cb);
    };

    /**
     * Sends a custom HTTP request to the server
     * @param  {Object} options The options for the request
     * @return {Promise}        The promise of the custom request
     */
    ServerHandler.prototype.sendHttpRequest = function(options) {
      return httpHandler.sendRequest(options, this);
    };

    /**
     * Pushes all unpushed data to the server
     */
    ServerHandler.prototype.pushAll = function pushAll() {
      for (var item in this._unpushedList) {
        this.upStream.onNext(this._unpushedList[item]);
        delete this._unpushedList[item];
      }
    };

    /**
     * Sets the connection online/offline
     * @param {boolean} state The connection state that should be set
     */
    ServerHandler.prototype.setConnectionState = function setConnectionState(
      state) {
      if (this._connected !== state) {
        if (state) {
          this._protocol.connect(this);
        } else {
          this._protocol.disconnect(this);
        }
      }

    };

    /**
     * Broadcasts an error globally to the error stream
     * @param  {Error} error The error to broadcast
     */
    ServerHandler.prototype._broadcastError = function broadcastError(error, item) {
      if (_.isPlainObject(item)) {
        error.target.transactionId = item.meta.transactionId;
      }

      ServerHandler.errorStream.onNext(error);
    };

    /**
     * Creates a server item in the form to send to the server
     * @param  {Object} item Item that has to be transformed to server structure
     * @return {Object}      The item in the structure the server accepts
     */
    ServerHandler.prototype._createServerItem = function createServerItem(item) {
      var meta = item.meta || {};
      var serverData = meta.serverData || {};

      var serverItem;

      if (this._options.omitItemDataOnSend) {
        serverItem = serverData;
      } else {
        serverItem = _.extend({}, item.data, serverData);
      }

      return serverItem;
    };

    ServerHandler.prototype._buildUrl = function() {
      var url = this._baseUrl + '/';

      for (var i = 0; i < this._resourcePath.length; i++) {
        url = url + this._resourcePath[i] + '/';
      }

      return url;
    };

    ServerHandler.prototype.setLastModified = function(lastModified) {
      this._lastModified = lastModified;
      var path = this._resourcePath.join('_');
      webStorage.getWebStorage().setItem('harmonized-modified-' + path, lastModified);
    };

    return ServerHandler;
  });
