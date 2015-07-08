'use strict';

define('MockDbHandler', ['DbHandler/BaseHandler'], function(DbHandler) {

  var MockDbHandler = function MockDbHandler() {
    DbHandler.apply(this, arguments);
  };

  MockDbHandler.mockPut = function(item) {
    return item;
  };

  MockDbHandler.mockRemove = function(item) {
    return item;
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
