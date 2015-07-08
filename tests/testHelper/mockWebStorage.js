'use strict';

define('mockWebStorage', function() {

  var mockLocalStorageObj = {}
  var mockSessionStorageObj = {}

  var mockLocalStorage = {};

  mockLocalStorage.getItem = function(key) {
    return mockLocalStorageObj[key];
  };

  mockLocalStorage.setItem = function(key, value) {
    mockLocalStorageObj[key] = value;
  };

  mockLocalStorage.clear = function() {
    mockLocalStorageObj = {};
  };

  var mockSessionStorage = {};

  mockSessionStorage.getItem = function(key) {
    return mockSessionStorageObj[key];
  };

  mockSessionStorage.setItem = function(key, value) {
    mockSessionStorageObj[key] = value;
  };

  mockSessionStorage.clear = function() {
    mockSessionStorageObj = {};
  };

  console.log('whooookjbn kjbhjlb j');
  return {
    localStorage: mockLocalStorage,
    sessionStorage: mockSessionStorage,
    localStorageContent: mockLocalStorageObj,
    sessionStorageContent: mockSessionStorageObj
  }

});
