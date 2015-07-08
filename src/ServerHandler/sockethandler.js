'use strict';

define('ServerHandler/socketHandler', ['harmonizedData'], function(harmonizedData) {
  return {

    /**
     * Connects to the socket and set connection state to true
     * @param  {ServerHandler} serverHandler ServerHandler to set connection on
     */
    connect: function(serverHandler) {
      // TODO implement http connect
      // Wire with streams
    },

    /**
     * Disconnects from the socket set connection state to false
     * @param  {ServerHandler} serverHandler ServerHandler to set connection on
     */
    disconnect: function(serverHandler) {
      // TODO implement http disconnect
      // Remove connection with streams
    },

    /**
     * Fetches data from the server via socket
     * @param  {ServerHandler} serverHandler ServerHandler to set last modified
     */
    fetch: function(serverHandler) {
      // TODO implement socket fetch
      // fetch everything
    },

    /**
     * Push item to the socket server
     * @param  {Object} item          item to push
     * @param  {ServerHandler} serverHandler ServerHandler for individual options
     */
    push: function(item, serverHandler) {
      // TODO implement socket push
      // push a single item to the serverHandler
    }
  };
});
