describe('Harmonized.webStorage', function() {

  beforeEach(function() {
    spyOn(window, 'localStorage').and.returnValue(mockLocalStorage);
    spyOn(window, 'sessionStorage').and.returnValue(mockSessionStorage);

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
    expect(Harmonized._webStorage).toEqual(localStorage);
  });

  it('should switch to sessionStorage', function() {
    Harmonized._webStorage = window.localStorage;
    Harmonized.setWebStorage('session');
    expect(Harmonized._webStorage).toEqual(sessionStorage);
  });

  it('should switch storage type with clearing the store', function() {
    window.mockLocalStorageObj = {
      'test': 123
    };

    Harmonized.setWebStorage('local', true);
    expect(_.isUndefined(window.mockLocalStorageObj.test)).toBeTruthy();
  });

});
