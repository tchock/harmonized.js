'use strict';

define('helper/webStorage', function() {
  var webStore = {};

  /**
   * Gets the current active web storage (local or session)
   * @return {Storage} The storage that is active (localStorage or sessionStorage)
   */
  webStore.getWebStorage = function() {
    return webStore._webStorage;
  };

  /* istanbul ignore next */

  /**
   * Gets the localStorage
   *
   * This function exists to make it possible to spy on the local storage
   *
   * @return {Storage} The localStorage
   */
  webStore._getLocalStorage = function() {
    return window.localStorage;
  };

  /* istanbul ignore next */

  /**
   * Gets the sessionStorage
   *
   * This function exists to make it possible to spy on the session storage
   *
   * @return {Storage} The sessionStorage
   */
  webStore._getSessionStorage = function() {
    return window.sessionStorage;
  };

  webStore._webStorage = webStore._getSessionStorage();

  /**
   * Sets the web storage to local or session storage
   * @param  {string} storage     The name of the storage to switch to:
   *                            	Either 'session' for session storage or
   *                            	'local' for local storage
   * @param  {boolean} [doClear]  If true the storage that was set before the
   *                              switch will be cleared
   */
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
