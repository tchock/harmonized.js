'use strict';

console.log('webstorage geladen');

define('helper/webStorage', function() {
  console.log('storage initialisiert');

  var webStore = {};

  webStore.getWebStorage = function() {
    return webStore._webStorage;
  };

  /* istanbul ignore next */
  webStore._getLocalStorage = function() {
    return window.localStorage;
  };

  /* istanbul ignore next */
  webStore._getSessionStorage = function() {
    return window.sessionStorage;
  };

  webStore._webStorage = webStore._getSessionStorage();

  webStore.setWebStorage = function(storage, doClear) {
    if (doClear) {
      webStore._webStorage.clear();
    }

    switch (storage) {
      case 'session':
        webStore._webStorage = webStore._getSessionStorage();
        break;
      case 'local':
        webStore._webStorage = webStore._getLocalStorage();
        break;
      default:
        webStore._webStorage = webStore._getSessionStorage();
    }
  };

  return webStore;
});
