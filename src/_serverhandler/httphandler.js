'use strict';

Harmonized.ServerHandler.httpHandler = {
  connect: function(serverHandler) {
    serverHandler.setConnectionState(true);
  },

  disconnect: function(serverHandler) {
    serverHandler.setConnectionState(false);
  },

  fetch: function(serverHandler) {
    var httpOptions = {};
    if (Harmonized._config.sendModifiedSince && serverHandler._lastModified != null) {
      httpOptions.headers = {
        'If-Modified-Since': serverHandler._lastModified
      };
    }

    httpOptions.url = serverHandler._baseUrl + serverHandler._resourcePath;
    httpOptions.method = 'GET';

    Harmonized._httpFunction(httpOptions);
  },

  push: function(item, serverHandler) {
    // TODO implement http push
    // push a single item to the serverHandler
  }
};
