'use strict';

Harmonized.ServerHandler = function(baseUrl, resourcePath) {
  this._baseUrl = baseUrl;
  this._resourcePath = resourcePath;

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

  // TODO add handling for different protocols (HTTP/socket)
  // Implement check if sockethandler is there and try to connect to the socket
  // (if config includes socket config). If connection was established, change
  // the protocol to 'websocket'.
  this._protocol = 'http';
};

Harmonized.ServerHandler.prototype._changeProtocol = function(protocol) {
  // TODO implement protocol
};

Harmonized.ServerHandler.prototype.fetch = function() {
  // TODO implement fetch
};

Harmonized.ServerHandler.prototype.pushAll = function() {
  // TODO implement pushAll

  // Has to push all items of the _unpushedList to the server resource
};

Harmonized.ServerHandler.prototype._createServerItem = function(item) {
  // TODO implement _createServerItem
};
