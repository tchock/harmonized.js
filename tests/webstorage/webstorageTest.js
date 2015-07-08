'use strict';

define(['helper/webStorage', 'harmonizedData', 'mockWebStorage', 'lodash'],
  function(webStore, harmonizedData, mockWebStorage, _) {

  describe('Harmonized.webStorage', function() {

    beforeEach(function() {
      spyOn(webStore, '_getLocalStorage').and.returnValue(mockWebStorage.localStorage);
      spyOn(webStore, '_getSessionStorage').and.returnValue(mockWebStorage.sessionStorage);

      // Reset storage
      mockWebStorage.localStorageContent = {};
      mockWebStorage.sessionStorageContent = {};
    });

    afterEach(function() {
      mockWebStorage.localStorageContent = {};
      mockWebStorage.sessionStorageContent = {};
    });

    it('should start with sessionStorage as default', function() {
      expect(webStore._webStorage).toEqual(sessionStorage);
    });

    it('should get the web storage', function() {
      webStore._webStorage = 'abc';
      expect(webStore.getWebStorage()).toBe('abc');
    });

    it('should switch to localStorage', function() {
      webStore.setWebStorage('local');
      expect(webStore._webStorage).toEqual(webStore._getLocalStorage());
    });

    it('should switch to sessionStorage', function() {
      webStore._webStorage = webStore._getLocalStorage();
      webStore.setWebStorage('session');
      expect(webStore._webStorage).toEqual(webStore._getSessionStorage());
    });

    it('should switch to sessionStorage with default parameter', function() {
      webStore._webStorage = webStore._getLocalStorage();
      webStore.setWebStorage();
      expect(webStore._webStorage).toEqual(webStore._getSessionStorage());
    });

    it('should switch storage type with clearing the store', function() {
      mockWebStorage.sessionStorageContent = {
        test: 123
      };
      webStore._webStorage = webStore._getSessionStorage();

      webStore.setWebStorage('local', true);
      expect(_.isUndefined(mockWebStorage.sessionStorage.test)).toBeTruthy();
    });

  });
});
