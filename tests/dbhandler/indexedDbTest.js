describe("IndexedDB Service", function() {

  var rootScope, IndexedDbService;
  var q;
  var timeout, browser;
  var deferred1, deferred2;
  var service;
  var interval;

  function fillStorageWithTestData () {
    return service.put([{firstname:'Igor',lastname:'Igorson'},
      {firstname:'Igor',lastname:'Igorson'},
      {firstname:'Igor',lastname:'Igorov'}]
    );
  }

  beforeEach(module('angular-localdb', function(localDbProvider) {
    localDbProvider.setStoreDefinitions({
      'test_db': {
        'test_table': {
          _id: {
            isKey: true
          },
          id: {
            isServerKey: true
          },
          lastname: {
            searchable: true
          }
        }
      }
    });
  }));

  beforeEach(function(done) {
    // Inject services
    inject(function(_IndexedDbService_, _localDb_, _$rootScope_, _$q_, _$timeout_, _$browser_) {
      rootScope = _$rootScope_;
      IndexedDbService = _IndexedDbService_;
      timeout = _$timeout_;
      browser = _$browser_;
      q = _$q_;
    });

    // Spy on getDbReference() and return mock database
    //spyOn(IndexedDbService, "getDbReference").and.returnValue(mockIndexedDB);

    spyOn(window, 'setTimeout').and.callFake(function(fn, delay){
      timeout(function() {
        fn();
      }, delay);
    });

    // Reset storage
    indexedDB.deleteDatabase('test_db').onsuccess = function(){
      done();
    };
    //resetIndexedDBMock();

  });

  beforeEach(function() {
    inverval = window.setInterval(function(){
      if (!rootScope.$$phase) {
        rootScope.$apply();
      }
    }, 10);
    service = new IndexedDbService('test_db', 'test_table', 1);
  });

  afterEach(function() {
    window.clearInterval(interval);
  });



  it('should connect to database, disconnect afterwards and connect again with increased version number', function(done) {
    var connected = false;
    // Connect
    expect(IndexedDbService._db).toBe(null);
    service.connect().then(function(db) {
      connected = true;
      expect(connected).toBe(true);
      expect(mockIndexedDBItems).toEqual([]);
      expect(IndexedDbService._db).not.toBe(null);

      service.closeConnection();
      expect(IndexedDbService._db).toBe(null);

      // Version update
      service._version = 2;
      service.connect().then(function(db){
        expect(IndexedDbService._db.version).toBe(2);
        done();
      });
    });
  });



  it('should get all entries from a table with 3 entries', function(done) {
    fillStorageWithTestData().then(function(){
      service.getAllEntries().then(function(data){
        expect(data.length).toBe(3);
        if (data.length === 3) {
          expect(data[0]._id).toBe(1);
          expect(data[1]._id).toBe(2);
          expect(data[2]._id).toBe(3);
        }
        done();
      });
    });

  });



  it('should get all entries from an empty table', function(done) {
    // No content available
    mockIndexedDBItems = [];
    service.getAllEntries().then(function(data){
      expect(data).toEqual([]);
      done();
    });
  });



  it('should get a single entry', function(done) {
    fillStorageWithTestData().then(function(){
      service.getEntry(2).then(function(data){
        expect(data).toEqual({firstname:'Igor',lastname:'Igorson', _id: 2});
        done();
      });
    });
  });



  it('should get an undefined single entry', function(done) {
    fillStorageWithTestData().then(function(){
      service.getEntry(4).then(function(data){
        expect(data).toEqual(undefined);
        done();
      });
    });
    rootScope.$apply();
  });



  it ('should get several defined entries', function (done) {
    fillStorageWithTestData().then(function(){
      service.getEntriesByIdList([1,3]).then(function(data){
        expect(data[0]).toEqual({firstname:'Igor',lastname:'Igorson', _id: 1});
        expect(data[1]).toEqual({firstname:'Igor',lastname:'Igorov', _id: 3});
        done();
      });
    });
  });



  it ('should get several entries with an undefined entry', function (done) {
    fillStorageWithTestData().then(function(){
      service.getEntriesByIdList([2,4]).then(function(data){
        expect(data[0]).toEqual({firstname:'Igor',lastname:'Igorson', _id: 2});
        expect(data[1]).toEqual(undefined);
        done();
      });
    });
  });



  it('should find entries with lastname "Igorson"', function(done){
    fillStorageWithTestData().then(function(){
      service.searchEntries('lastname', 'Igorson', false).then(function(data){
        expect(data.length).toBe(2);
        if (data.length === 2) {
          expect(data[0]._id).toBe(1);
          expect(data[1]._id).toBe(2);
        }
        done();
      });
    });
  });



  it('should find entries with lastname containing "Igor"', function(done){
    fillStorageWithTestData().then(function(){
      service.searchEntries('lastname', 'Igoro', true).then(function(data){
        expect(data.length).toBe(1);
        if (data.length === 1) {
          expect(data[0]._id).toBe(3);
        }
        done();
      });
    });
  });



  it('should insert two new entries to the db separately', function(done){
    var firstExpectedInput = {firstname:'Igor',lastname:'Igorson',_id:1};
    var secondExpectedInput = {firstname:'Igor',lastname:'Igorson',_id:2};

    service.put({
      firstname: 'Igor',
      lastname: 'Igorson'
    }).then(function(data){
      expect(data).toEqual([1]);
      service.getEntry(1).then(function(data){
        expect(data).toEqual(firstExpectedInput);

        service.put({
          firstname: 'Igor',
          lastname: 'Igorson'
        }).then(function(data){
          expect(data).toEqual([2]);
          service.getEntry(2).then(function(data){
            expect(data).toEqual(secondExpectedInput);
            done();
          });
        });

      });
    });
  });



  it('should insert two new entries to the db at once', function(done){
    var expectedInput = [
      {firstname:'Igor',lastname:'Igorson',_id:1},
      {firstname:'Igor',lastname:'Igorson',_id:2}];

    service.put([{
      firstname: 'Igor',
      lastname: 'Igorson'
    }, {
      firstname: 'Igor',
      lastname: 'Igorson'
    }]).then(function(data){
      expect(data).toEqual([1, 2]);
      service.getAllEntries().then(function(data){
        expect(data).toEqual(expectedInput);
        done();
      });

    });
  });



  it('should update an existing entry', function(done) {
    var expectedOutput = {firstname:'Vladimir',lastname:'Igorson',_id:2};
    fillStorageWithTestData().then(function(){
      service.put({
        firstname: 'Vladimir',
        lastname: 'Igorson',
        _id: 2
      }).then(function(data){
        expect(data).toEqual([2]);
        service.getEntry(2).then(function(data){
          expect(data).toEqual(expectedOutput);
          done();
        });
      });
    });
  });



  it('should update two existing entries at once', function(done) {
    var expectedOutput = [
      {firstname:'Olga',lastname:'Igorson', _id: 1},
      {firstname:'Dimitri',lastname:'Igorson',_id:2}
    ];

    // set the storage
    fillStorageWithTestData().then(function(){
      service.put([{
        firstname: 'Olga',
        lastname: 'Igorson',
        _id: 1
      }, {
        firstname: 'Dimitri',
        lastname: 'Igorson',
        _id: 2
      }]).then(function(data){
        expect(data).toEqual([1, 2]);
        service.getAllEntries().then(function(data){
          expect(data[0]).toEqual(expectedOutput[0]);
          expect(data[1]).toEqual(expectedOutput[1]);
          done();
        });
      });
    });
  });



  it('should remove the second entry', function(done){
    fillStorageWithTestData().then(function(){
      service.remove(2).then(function(){
        service.getAllEntries().then(function(data){
          expect(data.length).toBe(2);
          expect(data[0]._id).toBe(1);
          expect(data[1]._id).toBe(3);
          done();
        });
      });
    });
  });



  it('should add metadata and get it afterwards', function(){
    var returnedMetadata = service.setMetadata('hallo', 'welt');
    expect(returnedMetadata).toBeTruthy();

    var metadata = service.getMetadata();
    expect(metadata.hallo).toBe('welt');
  });



  it('should clear the storage', function(done){
    fillStorageWithTestData().then(function(){
      service.clearStorage().then(function(){
        service.getAllEntries().then(function(data){
          expect(data.length).toBe(0);
          done();
        });
      });
    });
  });

});
