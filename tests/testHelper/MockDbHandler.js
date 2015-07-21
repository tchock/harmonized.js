'use strict';

define('MockDbHandler', ['DbHandler/BaseHandler', 'rx'], function(DbHandler, Rx) {

  var MockDbHandler = function MockDbHandler() {
    DbHandler.apply(this, arguments);
  };

  MockDbHandler.mockPut = function(item) {
    return new Rx.Observable.of(item);
  };

  MockDbHandler.mockRemove = function(item) {
    return new Rx.Observable.of(item);
  };

  MockDbHandler.prototype = Object.create(DbHandler.prototype);

  MockDbHandler.prototype.put = function(item) {
    return MockDbHandler.mockPut(item);
  };

  MockDbHandler.prototype.remove = function(item) {
    return MockDbHandler.mockRemove(item);
  };

  return MockDbHandler;
});
