'use strict';

define('ServerHandler/httpHandler', ['harmonizedData'], function(harmonizedData) {
  return {

    /**
     * Sets connection state to true
     * @param  {ServerHandler} serverHandler ServerHandler to set connection on
     */
    connect: function(serverHandler) {
      serverHandler._connected = true;
      serverHandler._pushAll();
    },

    /**
     * Sets connection state to false
     * @param  {ServerHandler} serverHandler ServerHandler to set connection on
     */
    disconnect: function(serverHandler) {
      serverHandler._connected = false;
    },

    /**
     * Fetches data from the server via HTTP
     * @param  {ServerHandler} serverHandler ServerHandler to set last modified
     */
    fetch: function(serverHandler) {
      var httpOptions = {};
      if (harmonizedData._config.sendModifiedSince &&
        serverHandler._lastModified > 0) {
        httpOptions.headers = {
          'If-Modified-Since': serverHandler._lastModified
        };
      }

      httpOptions.url = serverHandler._fullUrl;
      httpOptions.method = 'GET';

      harmonizedData._httpFunction(httpOptions).then(function(response) {
        // Return last modified response
        serverHandler._lastModified = response.header.lastModified;

        // The returned content
        var returnedItems = response.data;
        var responseLenght = returnedItems.length;

        // Go through all returned items
        for (var i = 0; i < responseLenght; i++) {
          var item = harmonizedData._createStreamItem(returnedItems[i], {
            serverKey: serverHandler._options.serverKey
          });

          // Send item to the downstream
          serverHandler.downStream.onNext(item);
        }
      }).catch(function(error) {
        // Catch errors
        serverHandler.downStream.onError(error);
      });
    },

    /**
     * Sends a request to the server
     * @param  {ServerHandler} serverHandler  The server handler to get URL
     * @param  {Request} httpOptions          The options for the request
     * @return {Promise}                      The promise of the HTTP request
     */
    sendRequest: function(httpOptions, serverHandler) {
      httpOptions.url = serverHandler._fullUrl;
      httpOptions.method = httpOptions.method || 'GET';

      return harmonizedData._httpFunction(httpOptions);
    },

    /**
     * Push item to the HTTP server
     * @param  {object} item                  item to push
     * @param  {ServerHandler} serverHandler  ServerHandler for individual options
     */
    push: function(item, serverHandler) {
      var httpOptions = {};

      if (_.isObject(serverHandler._options.params)) {
        httpOptions.params = serverHandler._options.params;
      }

      httpOptions.url = serverHandler._fullUrl;

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

      harmonizedData._httpFunction(httpOptions).then(function(returnItem) {
        item.data = returnItem;
        if (item.meta.action === 'delete') {
          item.meta.action = 'deletePermanently';
        }

        serverHandler.downStream.onNext(item);
      }).catch(function(error) {
        serverHandler._unpushedList[item.meta.rtId] = item;
        serverHandler.downStream.onError(error);
      });
    }
  };
});
