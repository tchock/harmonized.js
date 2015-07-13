'use strict';

define('ServerHandler', ['ServerHandler/httpHandler',
    'ServerHandler/socketHandler', 'rx'
  ],
  function(httpHandler, socketHandler, Rx) {

    /**
     * ServerHandler constructor
     * @param  {string} baseUrl      The base url
     * @param  {string} resourcePath The resource path on the base url
     * @param  {Object} options      The options for the server handler
     */
    var ServerHandler = function(baseUrl, resourcePath, options) {
      var _this = this;

      this._baseUrl = baseUrl;
      this._resourcePath = resourcePath;
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

      // Instance connection stream that gets input from
      // the global connection stream.
      this.connectionStream = new Rx.Subject();
      this.connectionStream.subscribe(function(state) {
        _this.setConnectionState(state);
      });

      ServerHandler.connectionStream.subscribe(this.connectionStream);

      // List of items that couldn't be pushed to the server (e.g. because of
      // missing connection or offline mode).
      // Key of the items is always the runtime ID, so they can be replaced by
      // newer versions.
      this._unpushedList = {};

      // TODO implement last modified
      this._lastModified = 0;

      // Connection stuff
      this._connectionStream = new Rx.Subject();
      this._connected = false;
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
      } else if (protocol === 'websocket' && this._protocol !== socketHandler) {
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
        this._connected = true;
        this.pushAll();
      } else {
        this._connected = false;
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

    return ServerHandler;
  });
