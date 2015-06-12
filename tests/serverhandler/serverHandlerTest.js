'use strict';

describe('ServerHandler', function() {
  var ServerHandler = Harmonized.ServerHandler;
  var sh;

  beforeEach(function() {
    spyOn(ServerHandler.prototype, '_setProtocol').and.callThrough();
    spyOn(ServerHandler.httpHandler, 'connect').and.stub();
    spyOn(ServerHandler.httpHandler, 'disconnect').and.stub();
    spyOn(ServerHandler.socketHandler, 'connect').and.stub();
    spyOn(ServerHandler.socketHandler, 'disconnect').and.stub();

    sh = new ServerHandler('http://api.hyphe.me/', 'rest/resource/', {});
  });

  describe('protocol', function() {

    xit('should be set to http on handler creation', function() {
      expect(ServerHandler.prototype._setProtocol).toHaveBeenCalled();
      expect(ServerHandler.httpHandler.connect).toHaveBeenCalled();
      expect(ServerHandler._protocol).toBe(ServerHandler.httpHandler);
    });

    xit('should be set to websocket on handler creation', function() {
      sh = new ServerHandler('http://api.hyphe.me/', 'rest/resource/', {
        protocol: 'websocket'
      });
      expect(ServerHandler.prototype._setProtocol).toHaveBeenCalled();
      expect(ServerHandler.socketHandler.connect).toHaveBeenCalled();
      expect(ServerHandler._protocol).toBe(ServerHandler.socketHandler);
    });

    xit('should be set to http from http', function() {
      sh._protocol = ServerHandler.httpHandler;
      expect(ServerHandler.httpHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.httpHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler._protocol).toBe(ServerHandler.httpHandler);

      sh._setProtocol('http');

      expect(ServerHandler.httpHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.httpHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler.websocketHandler.connect.calls.count()).toBe(0);
      expect(ServerHandler.websocketHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler._protocol).toBe(ServerHandler.httpHandler);
    });

    xit('should be set to websocket from http', function() {
      sh._protocol = ServerHandler.httpHandler;
      expect(ServerHandler.httpHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.httpHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler.websocketHandler.connect.calls.count()).toBe(0);
      expect(ServerHandler.websocketHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler._protocol).toBe(ServerHandler.httpHandler);

      sh._setProtocol('websocket');

      expect(ServerHandler.httpHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.httpHandler.disconnect.calls.count()).toBe(1);
      expect(ServerHandler.websocketHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.websocketHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler._protocol).toBe(ServerHandler.socketHandler);
    });

    xit('should be set to http from websocket', function() {
      sh._protocol = ServerHandler.socketHandler;
      expect(ServerHandler.httpHandler.connect.calls.count()).toBe(0);
      expect(ServerHandler.httpHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler.websocketHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.websocketHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler._protocol).toBe(ServerHandler.socketHandler);

      sh._setProtocol('http');

      expect(ServerHandler.httpHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.httpHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler.websocketHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.websocketHandler.disconnect.calls.count()).toBe(1);
      expect(ServerHandler._protocol).toBe(ServerHandler.httpHandler);
    });

  });

  describe('data', function() {

    xit('should be fetched by the protocolHandler', function() {

    });

    xit('should be pushed by pushAll function', function() {

    });

    xit('should be created by the createServerItem function', function() {

    });

  });

});
