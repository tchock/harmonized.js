'use strict';

define('ServerHandler/httpHandler', ['harmonized/config'], function(config) {
  return {
    connect: function(serverHandler) {
      serverHandler.setConnectionState(true);
    },

    disconnect: function(serverHandler) {
      serverHandler.setConnectionState(false);
    },

    fetch: function(serverHandler) {
      var httpOptions = {};
      if (Harmonized._config.sendModifiedSince &&
        serverHandler._lastModified != null) {
        httpOptions.headers = {
          'If-Modified-Since': serverHandler._lastModified
        };
      }

      httpOptions.url = serverHandler._baseUrl + serverHandler._resourcePath;
      httpOptions.method = 'GET';

      config.httpFunction(httpOptions);
    },

    push: function(item, serverHandler) {
      var httpOptions = {};

      if (_.isObject(serverHandler._options.params)) {
        httpOptions.params = serverHandler._options.params;
      }

      httpOptions.url = serverHandler._baseUrl + serverHandler._resourcePath;

      if (item.meta.action === 'delete') {
        httpOptions.method = 'DELETE';
        httpOptions.url = httpOptions.url + item.meta.serverId + '/';
      }

      if (item.meta.action === 'save') {
        httpOptions.data = item.data;
        if (_.isUndefined(item.meta.serverId)) {
          httpOptions.method = 'POST';
        } else {
          httpOptions.method = 'PUT';
          httpOptions.url = httpOptions.url + item.meta.serverId + '/';
        }
      }

      Harmonized._httpFunction(httpOptions).then(function(returnItem) {
        item.data = returnItem;
        serverHandler.downStream.onNext(item);
      }).catch(function(error) {
        serverHandler._unpushedList[item.meta.rtId] = item;
        serverHandler.downStream.onError(error);
      });
    }
  };
});
