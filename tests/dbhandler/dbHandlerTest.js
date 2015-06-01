describe('DbHandler', function() {

  var dbHandler;
  var explicitDbHandler;

  beforeEach(function() {
    // Set key mocks
    spyOn(Harmonized, 'getStoreKey').and.returnValue('_id');
    spyOn(Harmonized, 'getServerKey').and.returnValue('id');

    explicitDbHandler = {
      _connectionStream: new Rx.Subject(),
      connect: function() {}
    }

    dbHandler = new Harmonized.MockDbHandler(explicitDbHandler, 'testStore');

    // webStorage mock
    spyOn(Harmonized, 'getWebStorage').and.returnValue(mockLocalStorage);
  });

  afterEach(function() {
    window.mockLocalStorageObj = {};
  });

  describe('streams', function() {

    // Aliases
    var TestScheduler = Rx.TestScheduler;
    var onNext = Rx.ReactiveTest.onNext;
    var onError = Rx.ReactiveTest.onError;
    var subscribe = Rx.ReactiveTest.subscribe;
    var scheduler;
    var virtualTick;
    var upstreamOutputs;
    var downstreamOutputs;
    var saveUpstreamOutputs;
    var saveDownstreamOutputs;
    var deleteUpstreamOutputs;
    var deleteDownstreamOutputs;

    var streamInputs = [{
      data: {
        name: 'Hans Wurst'
      },
      meta: {
        action: 'save'
      }
    },
    {
      data: {
        name: 'Mike Hansen'
      },
      meta: {
        action: 'delete'
      }
    },
    {
      data: {
        name: 'Wigald Boning'
      },
      meta: {
        action: 'save'
      }
    }, {
      data: {
        name: 'Biff Tannen'
      },
      meta: {
        action: 'delete'
      }
    }];

    var ignorableInputs = [{
      data: {
        name: 'Marty McFly'
      },
      meta: {
        action: 'befriend'
      }
    }, {
      data: {
        name: 'Till Schweiger'
      },
      meta: {
        action: 'deletee'
      }
    }];

    function scheduleData() {
      scheduler.scheduleWithAbsolute(1, function () {
        explicitDbHandler._connectionStream.onNext(true);
        dbHandler.upstream.onNext(streamInputs[0]);
      });

      scheduler.scheduleWithAbsolute(10, function () {
        dbHandler.upstream.onNext(streamInputs[1]);
      });

      scheduler.scheduleWithAbsolute(45, function () {
        dbHandler.upstream.onNext(streamInputs[2]);
      });

      scheduler.scheduleWithAbsolute(60, function () {
        dbHandler.upstream.onNext(streamInputs[3]);
      });
    }

    function scheduleIgnorableData() {
      scheduler.scheduleWithAbsolute(15, function () {
        dbHandler.upstream.onNext(ignorableInputs[0]);
      });

      scheduler.scheduleWithAbsolute(55, function () {
        dbHandler.upstream.onNext(ignorableInputs[1]);
      });
    }

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

      // Rebuild explicitDbHandler to include mock subject
      explicitDbHandler = {
        _connectionStream: new Rx.Subject(),
        connect: function() {}
      };

      // Rebuild dbHandler to include mock subject
      dbHandler = new Harmonized.MockDbHandler(explicitDbHandler, 'testStore');

      // Subscribe streams to push to respective output arrays
      dbHandler._upstream.subscribe(function(item) {
        upstreamOutputs.push(item);
      });
      dbHandler.downstream.subscribe(function(item) {
        downstreamOutputs.push(item);
      });

      dbHandler._saveUpstream.subscribe(function(item) {
        saveUpstreamOutputs.push(item);
      });

      dbHandler._deleteUpstream.subscribe(function(item) {
        deleteUpstreamOutputs.push(item);
      });

    });

    beforeEach(function() {
      // Reset stream output arrays
      upstreamOutputs = [];
      downstreamOutputs = [];

      deleteUpstreamOutputs = [];
      deleteDownstreamOutputs = [];

      saveUpstreamOutputs = [];
      saveDownstreamOutputs = [];

      // spy on these methods
      spyOn(Harmonized.MockDbHandler, 'mockPut').and.callThrough();
      spyOn(Harmonized.MockDbHandler, 'mockRemove').and.callThrough();
    });

    it('should filter data to be saved', function() {
      var expectedStreamOutputs = [
        streamInputs[0],
        streamInputs[2]
      ];

      // unsubscribe _deleteDownstream=>downstream;
      dbHandler._deleteSubscribe.dispose();

      // Fill upstream with data
      scheduleData();
      scheduler.start();

      // Test if the data was filtered as expected
      expect(upstreamOutputs.length).toBe(4);
      expect(saveUpstreamOutputs).toEqual(expectedStreamOutputs);

      // check Downstream length
      expect(downstreamOutputs.length).toBe(2);
      expect(downstreamOutputs).toEqual(expectedStreamOutputs);

      // Test if map functions were called
      expect(Harmonized.MockDbHandler.mockPut).toHaveBeenCalled();
      expect(Harmonized.MockDbHandler.mockRemove).not.toHaveBeenCalled();
    });

    it('should filter data to be deleted', function() {
      var expectedStreamOutputs = [
        streamInputs[1],
        streamInputs[3]
      ];

      // unsubscribe _saveDownstream=>downstream;
      dbHandler._saveSubscribe.dispose();

      // Fill upstream with data
      scheduleData();
      scheduler.start();

      // Test if the data was filtered as expected
      expect(upstreamOutputs.length).toBe(4);
      expect(deleteUpstreamOutputs).toEqual(expectedStreamOutputs);

      // check Downstream length
      expect(downstreamOutputs.length).toBe(2);
      expect(downstreamOutputs).toEqual(expectedStreamOutputs);

      // Test if map functions were called
      expect(Harmonized.MockDbHandler.mockRemove).toHaveBeenCalled();
      expect(Harmonized.MockDbHandler.mockPut).not.toHaveBeenCalled();
    });

    it('should ignore data to not be saved or deleted', function() {
      // Fill upstream with data
      scheduleData();
      scheduleIgnorableData();
      scheduler.start();

      // Check stream lengths
      expect(upstreamOutputs.length).toBe(6);
      expect(deleteUpstreamOutputs.length).toBe(2);
      expect(saveUpstreamOutputs.length).toBe(2);
      expect(downstreamOutputs.length).toBe(4);
      expect(downstreamOutputs).toEqual(streamInputs);
    });

    it('should pause/resume internal upstream depending on db connection', function() {
      // Fill upstream with data
      scheduleData();

      // Pause the internal upstream at 8ms
      scheduler.scheduleWithAbsolute(8, function () {
        explicitDbHandler._connectionStream.onNext(false);
      });

      // In the meantime the second stream item is put on the upstream
      // is buffered in the internal upstream because it is paused

      // Resume the internal upstream at 15ms
      scheduler.scheduleWithAbsolute(15, function () {
        explicitDbHandler._connectionStream.onNext(true);
      });

      // In the meantime the second (10ms) and third (45ms) item are put on the
      // upstream and are delegated to the downstream, because the internal
      // upstream is not paused

      // Pause the internal upstream at 50ms
      scheduler.scheduleWithAbsolute(50, function () {
        explicitDbHandler._connectionStream.onNext(false);
      });

      // Start the scheduler to run the current setup
      scheduler.start();

      // Until now, only 3 items should be handled by the database
      expect(upstreamOutputs.length).toBe(3);

      // Stop the scheduler to add new scheduling steps
      scheduler.stop();

      // Resume the internal upstream at 65ms, all items should by now be on the
      // public upstream
      scheduler.scheduleWithAbsolute(65, function () {
        explicitDbHandler._connectionStream.onNext(true);
      });

      // Start the scheduler again to flush the remaining stream items to the
      // public downstream
      scheduler.start();

      // Now all items should be handled by the database and put on the public
      // downstream! These items should match the input
      expect(upstreamOutputs.length).toBe(4);
      expect(downstreamOutputs).toEqual(streamInputs);
    });

  });

  describe('db metadata', function() {
    it('should get empty DB metadata', function() {
      expect(dbHandler.getMetadata()).toEqual({});
    });

    it('should get DB metadata with data', function() {
      var expectedObject = {
        hey: 'you'
      };

      window.mockLocalStorageObj = {
        'harmonized_meta_testStore': expectedObject
      };

      dbHandler = new Harmonized.DbHandler(explicitDbHandler, 'testStore');
      expect(dbHandler.getMetadata()).toEqual(expectedObject);
    });

    it('should write into empty DB metadata', function() {
      var expectedObject = {
        name: 'John Doe'
      };

      expect(dbHandler._metadata).toEqual({});

      dbHandler.setMetadata('name', 'John Doe');
      expect(dbHandler._metadata).toEqual(expectedObject);
      expect(window.mockLocalStorageObj).toEqual({
        'harmonized_meta_testStore': expectedObject
      });
    });

    it('should add to already existing DB metadata', function() {
      window.mockLocalStorageObj = {
        'harmonized_meta_testStore': {
          'name': 'John Doe'
        }
      };

      var expectedObject = {
        name: 'John Doe',
        otherName: 'Max Mustermann'
      };

      dbHandler = new Harmonized.DbHandler(explicitDbHandler, 'testStore');
      dbHandler.setMetadata('otherName', 'Max Mustermann');
      expect(dbHandler._metadata).toEqual(expectedObject);
      expect(window.mockLocalStorageObj).toEqual({
        'harmonized_meta_testStore': expectedObject
      });
    });

  });

  describe('createDbItem', function() {
    it('should create create a db item with full metadata', function() {
      var inputItem = {
        data: {
          firstName: 'John',
          lastName: 'Doe'
        },
        meta: {
          storeId: 123,
          serverId: 321
        }
      };

      var expectedOutputItem = _.clone(inputItem.data);
      expectedOutputItem._id = 123;
      expectedOutputItem.id = 321;
      var outputItem = dbHandler._createDbItem(inputItem);

      expect(outputItem).toEqual(expectedOutputItem);
      expect(outputItem).not.toEqual(inputItem.data);
      expect(outputItem).not.toBe(inputItem.data);
    });

    it('should create create a db item with one missing metadata', function() {
      var inputItem = {
        data: {
          firstName: 'John',
          lastName: 'Doe'
        },
        meta: {
          serverId: 321
        }
      };

      var expectedOutputItem = _.clone(inputItem.data);
      expectedOutputItem.id = 321;

      var outputItem = dbHandler._createDbItem(inputItem);
      expect(outputItem).toEqual(expectedOutputItem);
      expect(outputItem).not.toEqual(inputItem.data);
      expect(outputItem).not.toBe(inputItem.data);
    });

    it('should create create a db item with whole missing metadata', function() {
      var inputItem = {
        data: {
          firstName: 'John',
          lastName: 'Doe'
        }
      };

      var expectedOutputItem = _.clone(inputItem.data);

      var outputItem = dbHandler._createDbItem(inputItem);
      expect(outputItem).toEqual(expectedOutputItem);
      expect(outputItem).toEqual(inputItem.data);
      expect(outputItem).not.toBe(inputItem.data);
    });
  });

});
