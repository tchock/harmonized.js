'use strict';

Harmonized.ServerHandler = function(baseUrl, resourcePath, options) {
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
      _this.protocol.push(item, _this);
    }
  });

  this.downStream = new Rx.Subject();

  // Instance connection stream that gets input from
  // the global connection stream.
  this.connectionStream = new Rx.Subject();
  this.connectionStream.subscribe(function(state) {
    _this.setConnectionState(state);
  });

  Harmonized.ServerHandler.connectionStream.subscribe(this.connectionStream);

  // List of items that couldn't be pushed to the server (e.g. because of
  // missing connection or offline mode).
  // Key of the items is always the runtime ID, so they can be replaced by newer
  // versions.
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

Harmonized.ServerHandler.connectionStream = new Rx.Subject();

Harmonized.ServerHandler.prototype._setProtocol = function setProtocol(protocol) {
  // TODO implement protocol
  // * Check if the new protocol is available
  // * Call the disconnect method of old protocol
  // * Call the connect method of new protocol
};

Harmonized.ServerHandler.prototype.fetch = function fetch() {
  // TODO implement fetch
  // If 'http' protocol is active, call the httpHandler.fetch() function.
  // If 'websocket' protocol is active, call the socketHandler.fetch() function.
};

Harmonized.ServerHandler.prototype.pushAll = function pushAll() {
  // TODO implement pushAll
  // Has to push all items of the _unpushedList to the server resource
};

Harmonized.ServerHandler.prototype.setConnectionState = function setConnectionState(state) {
  // TODO implement setConnectionState
  // Set online/offline state and call pushAll if state === true
};

Harmonized.ServerHandler.prototype._createServerItem = function createServerItem(item) {
  // TODO implement _createServerItem
};
