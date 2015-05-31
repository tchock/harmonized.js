describe('Harmonized.webStorage', function() {

  beforeEach(function() {
    spyOn(Harmonized, '_getLocalStorage').and.returnValue(mockLocalStorage);
    spyOn(Harmonized, '_getSessionStorage').and.returnValue(mockSessionStorage);
    // Reset storage
    window.mockLocalStorageObj = {};
    window.mockSessionStorageObj = {};
  });

  it('should start with sessionStorage as default', function(){
    expect(Harmonized._webStorage).toEqual(sessionStorage);
  });

  it('should get the web storage', function() {
    Harmonized._webStorage = 'abc';
    expect(Harmonized.getWebStorage()).toBe('abc');
  });

  it('should switch to localStorage', function() {
    Harmonized.setWebStorage('local');
    expect(Harmonized._webStorage).toEqual(Harmonized._getLocalStorage());
  });

  it('should switch to sessionStorage', function() {
    Harmonized._webStorage = Harmonized._getLocalStorage();
    Harmonized.setWebStorage('session');
    expect(Harmonized._webStorage).toEqual(Harmonized._getSessionStorage());
  });

  it('should switch storage type with clearing the store', function() {
    window.mockSessionStorageObj = {
      'test': 123
    };

    Harmonized.setWebStorage('local', true);
    expect(_.isUndefined(window.mockSessionStorageObj.test)).toBeTruthy();
  });

});
