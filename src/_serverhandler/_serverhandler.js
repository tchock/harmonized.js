'use strict';

Harmonized.ServerHandler = function(baseUrl, resourcePath, options) {
  this._baseUrl = baseUrl;
  this._resourcePath = resourcePath;
  this._options = options;

  // Public streams
  this.upStream = new Rx.Subject();
  this.downStream = new Rx.Subject();

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

Harmonized.ServerHandler.prototype._createServerItem = function createServerItem(item) {
  // TODO implement _createServerItem
};
