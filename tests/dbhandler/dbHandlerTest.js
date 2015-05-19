describe("Local DB Service", function() {

  var localDb, IndexedDbService, WebSqlService, NoDbService;
  var storeTest1, storeTest2, storeOtherTest;

  function getObjectSize (object) {
    var size = 0;
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        size++;
      }
    }
    return size;
  }

  beforeEach(module('angular-localdb', function(localDbProvider) {
    localDbProvider.setStoreDefinitions({
      'testDb': {
        'test': {},
        'newtest': {
          nachname: { searchable: true },
          _id: { isKey: true },
          id: { isServerKey: true }
        },
        'othertest': {
          _id: { isKey: true },
          id: { isServerKey: true },
          coolness: { searchable: true },
          gangname: { searchable: true }
        }
      }
    });
  }));

  beforeEach(function() {
    inject(function(_localDb_, _IndexedDbService_, _WebSqlService_, _NoDbService_) {
        localDb = _localDb_;
        IndexedDbService = _IndexedDbService_;
        WebSqlService = _WebSqlService_;
        NoDbService = _NoDbService_;
        localDb.setDbHandler('indexedDb');
        storeTest1 = new localDb('testDb', 'test');
        storeTest2 = new localDb('testDb', 'test');
        storeOtherTest = new localDb('testDb', 'othertest');
    });
  });



  it('should create a DbHandler and clear it afterwards', function(){
    // Get handler list size
    var handlerList = localDb.getHandlerList('testDb');
    var handlerListSize = getObjectSize(handlerList);

    expect(handlerListSize).toEqual(2);
    expect(storeTest1).toEqual(storeTest2);
    expect(storeTest1).not.toEqual(storeOtherTest);

    // Spy on the clear function of the first handler
    spyOn(handlerList.test, 'deleteDb').and.callThrough();
    var newTestHandler = handlerList.test;

    localDb.clear();
    expect(newTestHandler.deleteDb.calls.count()).toBe(1);
    handlerList = localDb.getHandlerList('testDb');
    handlerListSize = getObjectSize(handlerList);
    expect(handlerListSize).toBe(0);

  });



  it ('should find the right store definitions', function() {
    expect(localDb.getSearchProperties('testDb', 'test').length).toEqual(0);
    expect(localDb.getSearchProperties('testDb', 'newtest').length).toEqual(1);
    expect(localDb.getSearchProperties('testDb', 'othertest').length).toEqual(2);

    // TODO Check if content of search properties array is correct

  });



  it  ('should get server and store key names', function(){
    expect(localDb.getStoreKey('testDb', 'test')).toEqual('_id');
    expect(localDb.getServerKey('testDb', 'test')).toEqual('id');
    expect(localDb.getStoreKey('testDb', 'newtest')).toEqual('_id');
    expect(localDb.getServerKey('testDb', 'newtest')).toEqual('id');
    expect(localDb.getStoreKey('testDb', 'othertest')).toEqual('_id');
    expect(localDb.getServerKey('testDb', 'othertest')).toEqual('id');
  });



  it ('should get db version', function(){
    expect(localDb.getDbVersion()).toEqual(1);
  });



  it ('should change the db handler to WebSQL', function(){
    localDb.setDbHandler('webSql');

    var handlerList = localDb.getHandlerList('testDb');
    var handlerListSize = getObjectSize(handlerList);
    expect(handlerListSize).toEqual(0);
    var newStore = new localDb('testDb', 'test');
    expect(newStore._handlerType).toBe('WebSQL');
  });



  it ('should change the db handler to NoDB', function(){
    localDb.setDbHandler('noDb');

    var handlerList = localDb.getHandlerList('testDb');
    var handlerListSize = getObjectSize(handlerList);
    expect(handlerListSize).toEqual(0);
    var newStore = new localDb('testDb', 'test');
    expect(newStore._handlerType).toBe('NoDB');
  });


});
