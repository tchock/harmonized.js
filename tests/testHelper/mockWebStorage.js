'use strict';

define('mockWebStorage', function() {

  var mockWebStorage = {
    localStorage: {},
    sessionStorage: {},
    localStorageContent: {},
    sessionStorageContent: {}
  };

  mockWebStorage.localStorage.getItem = function(key) {
    return mockWebStorage.localStorageContent[key];
  };

  mockWebStorage.localStorage.setItem = function(key, value) {
    mockWebStorage.localStorageContent[key] = value;
  };

  mockWebStorage.localStorage.clear = function() {
    mockWebStorage.localStorageContent = {};
  };

  mockWebStorage.sessionStorage.getItem = function(key) {
    return mockWebStorage.sessionStorageContent[key];
  };

  mockWebStorage.sessionStorage.setItem = function(key, value) {
    mockWebStorage.sessionStorageContent[key] = value;
  };

  mockWebStorage.sessionStorage.clear = function() {
    mockWebStorage.sessionStorageContent = {};
  };

  return mockWebStorage;

});
