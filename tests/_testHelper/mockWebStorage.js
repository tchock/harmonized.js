window.mockLocalStorageObj = {}
window.mockSessionStorageObj = {}

window.mockLocalStorage.getItem = function(key) {
  return mockLocalStorageObj[key];
}

window.mockLocalStorage.setItem = function(key, value) {
  mockLocalStorageObj[key] = value;
}

window.mockLocalStorage.clear = function() {
  mockLocalStorageObj = {};
}

window.mockSessionStorage.getItem = function(key) {
  return mockSessionStorageObj[key];
}

window.mockSessionStorage.setItem = function(key, value) {
  mockSessionStorageObj[key] = value;
}

window.mockSessionStorage.clear = function() {
  mockSessionStorageObj = {};
}
