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
    var ServerHandler = function(route, options) {
      var _this = this;

      this._baseUrl = route.splice(0, 1)[0];
      this._resourcePath = route;
      this._fullUrl = this._buildUrl();
      this._options = options;

      // Public streams
      this.upStream = new Rx.Subject();
      this.upStream.subscribe(function(item) {
        if (!_this._connected) {
          _this._unpushedList[item.meta.rtId] = item;
        } else {
          _this._protocol.push(item, _this);
        }
      });

      this.downStream = new Rx.Subject();
      this.downStream.subscribe(null, function(error) {
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
        'harmonized_modified_' + this._options.modelName) || 0;

      this._protocol = null;
      var useProtocol;
      if (options.protocol === 'websocket') {
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
          _this._protocol.disconnect();
        }

        _this._protocol = newProtocol;
        _this._protocol.connect();
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
    ServerHandler.prototype.fetch = function fetch() {
      this._protocol.fetch(this);
    };

    /**
     * Sends a custom HTTP request to the server
     * @param  {Object} options The options for the request
     * @return {Promise}        The promise of the custom request
     */
    ServerHandler.prototype.sendHttpRequest = function(options) {
      return httpHandler.sendRequest(options, _this);
    }

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
      if (state) {
        this._protocol.connect(this);
      } else {
        this._protocol.disconnect(this);
      }
    };

    /**
     * Creates a server item in the form to send to the server
     * @param  {Object} item Item that has to be transformed to server server structure
     * @return {Object}      The item in the structure the server accepts
     */
    ServerHandler.prototype._createServerItem = function createServerItem(
      item) {
      // Clone data and arrange it for db
      var serverItem = _.clone(item.data);

      if (!_.isUndefined(item.meta) && !_.isUndefined(item.meta.serverId)) {
        serverItem[this._options.serverKey] = item.meta.serverId;
      }

      return serverItem;
    };

    ServerHandler.prototype._buildUrl = function() {
      var url = this._baseUrl + '/';

      for (var i = 0; i < this._resourcePath.length; i++) {
        url = url + this._resourcePath[i] + '/';
      }

      return url;
    }

    ServerHandler.prototype.setLastModified = function(lastModified) {
      this._lastModified = lastModified;
      webStorage.getWebStorage().setItem('harmonized_modified_' + this._options
        .modelName, lastModified);
    }

    return ServerHandler;
  });
