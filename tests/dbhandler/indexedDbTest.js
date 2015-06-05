describe("IndexedDB Service", function() {

  var indexedDbHandler;
  var connectionStreamOutputs;

  function fillStorageWithTestData () {
    return service.put([{firstname:'Igor',lastname:'Igorson'},
      {firstname:'Igor',lastname:'Igorson'},
      {firstname:'Igor',lastname:'Igorov'}]
    );
  }

  beforeEach(function() {
    jasmine.clock().install();
  });

  beforeEach(function() {
    spyOn(Harmonized.IndexedDbHandler, 'getDbReference').and.returnValue(window.indexedDBmock);
    console.log('mock DBs on buildup:');
    for (var mockDb in window.indexedDBmockDbs) {
      delete window.indexedDBmockDbs[mockDb];
    }
  });

  // Reactive X testing build up
  beforeEach(function() {
    // Add custom RxJS matchers
    jasmine.addMatchers(streamMatchers);

    // Scheduler to mock the RxJS timing
    scheduler = new Rx.TestScheduler();

    // Mock the subject to let it use the scheduler
    var originalSubject = Rx.Subject;
    spyOn(Rx, 'Subject').and.callFake(function() {
      return new originalSubject(scheduler.createObserver(), scheduler.createHotObservable());
    });

    Harmonized.IndexedDbHandler._connectionStream = new Rx.Subject();

    // Subscribe connection stream to get the streams output
    connectionStreamOutputs = [];
    Harmonized.IndexedDbHandler._connectionStream.subscribe(function(item) {
      connectionStreamOutputs.push(item);
    });

    // Rebuild dbHandler to include mock subject
    indexedDbHandler = new Harmonized.IndexedDbHandler('testStore');

  });

  it('should connect to database, disconnect afterwards and connect again with increased version number', function() {
    expect(Harmonized.IndexedDbHandler._db).toBe(null);

    scheduler.scheduleWithAbsolute(0, function () {
      expect(connectionStreamOutputs).toEqual([false]);
    });

    scheduler.scheduleWithAbsolute(1, function () {
      expect(indexedDBmockDbs.harmonized_db.objectStoreNames).toEqual([]);
      expect(connectionStreamOutputs).toEqual([false]);
      jasmine.clock().tick(2);
      expect(connectionStreamOutputs).toEqual([false, true]);
      expect(Harmonized.IndexedDbHandler._db).not.toBe(null);
      expect(Harmonized.IndexedDbHandler._db.version).toBe(1);
      expect(indexedDBmockDbs.harmonized_db.version).toBe(1);
    });

    scheduler.scheduleWithAbsolute(10, function () {
      Harmonized.IndexedDbHandler.closeConnection();
      expect(Harmonized.IndexedDbHandler._db).toBe(null);
      expect(connectionStreamOutputs).toEqual([false, true, false]);
    });

    scheduler.scheduleWithAbsolute(20, function () {
      // Version update
      Harmonized.dbVersion = 2;
      Harmonized.IndexedDbHandler.connect();
      expect(connectionStreamOutputs).toEqual([false, true, false]);
      jasmine.clock().tick(2);
      expect(connectionStreamOutputs).toEqual([false, true, false, true]);
      expect(Harmonized.IndexedDbHandler._db.version).toBe(2);
      expect(indexedDBmockDbs.harmonized_db.version).toBe(2);
    });

    // Start the scheduler to run the current setup
    scheduler.start();
  });



  xit('should get all entries from a table with 3 entries', function(done) {
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



  xit('should get all entries from an empty table', function(done) {
    // No content available
    mockIndexedDBItems = [];
    service.getAllEntries().then(function(data){
      expect(data).toEqual([]);
      done();
    });
  });



  xit('should get a single entry', function(done) {
    fillStorageWithTestData().then(function(){
      service.getEntry(2).then(function(data){
        expect(data).toEqual({firstname:'Igor',lastname:'Igorson', _id: 2});
        done();
      });
    });
  });



  xit('should get an undefined single entry', function(done) {
    fillStorageWithTestData().then(function(){
      service.getEntry(4).then(function(data){
        expect(data).toEqual(undefined);
        done();
      });
    });
    rootScope.$apply();
  });



  xit ('should get several defined entries', function (done) {
    fillStorageWithTestData().then(function(){
      service.getEntriesByIdList([1,3]).then(function(data){
        expect(data[0]).toEqual({firstname:'Igor',lastname:'Igorson', _id: 1});
        expect(data[1]).toEqual({firstname:'Igor',lastname:'Igorov', _id: 3});
        done();
      });
    });
  });



  xit ('should get several entries with an undefined entry', function (done) {
    fillStorageWithTestData().then(function(){
      service.getEntriesByIdList([2,4]).then(function(data){
        expect(data[0]).toEqual({firstname:'Igor',lastname:'Igorson', _id: 2});
        expect(data[1]).toEqual(undefined);
        done();
      });
    });
  });



  xit('should find entries with lastname "Igorson"', function(done){
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



  xit('should find entries with lastname containing "Igor"', function(done){
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



  xit('should insert two new entries to the db separately', function(done){
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



  xit('should insert two new entries to the db at once', function(done){
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



  xit('should update an existing entry', function(done) {
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



  xit('should update two existing entries at once', function(done) {
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



  xit('should remove the second entry', function(done){
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



  xit('should add metadata and get it afterwards', function(){
    var returnedMetadata = service.setMetadata('hallo', 'welt');
    expect(returnedMetadata).toBeTruthy();

    var metadata = service.getMetadata();
    expect(metadata.hallo).toBe('welt');
  });



  xit('should clear the storage', function(done){
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
