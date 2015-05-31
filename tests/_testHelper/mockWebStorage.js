window.mockLocalStorageObj = {}
window.mockSessionStorageObj = {}

window.mockLocalStorage = {};

window.mockLocalStorage.getItem = function(key) {
  return window.mockLocalStorageObj[key];
};

window.mockLocalStorage.setItem = function(key, value) {
  window.mockLocalStorageObj[key] = value;
};

window.mockLocalStorage.clear = function() {
  window.mockLocalStorageObj = {};
};

window.mockSessionStorage = {};

window.mockSessionStorage.getItem = function(key) {
  return window.mockSessionStorageObj[key];
};

window.mockSessionStorage.setItem = function(key, value) {
  window.mockSessionStorageObj[key] = value;
};

window.mockSessionStorage.clear = function() {
  window.mockSessionStorageObj = {};
};
