describe('DbHandler', function() {

  var dbHandler;
  var explicitDbHandler = {
    _connectionStream: new Rx.Subject(),
    connect: function() {}
  };

  beforeEach(function() {
    // Set key mocks
    spyOn(Harmonized, 'getStoreKey').and.returnValue('_id');
    spyOn(Harmonized, 'getServerKey').and.returnValue('id');

    dbHandler = new Harmonized.DbHandler(explicitDbHandler, 'testStore');

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
    var virtualTick;

    // Reactive X testing build up
    beforeEach(function() {
        // Add custom RxJS matchers
        jasmine.addMatchers(streamMatchers);
        virtualTick = 0;

        spyOn(dbHandler.upstream, 'onNext').and.callFake(function(item) {
          onNext(virtualTick, item);
          virtualTick += 10;
        });
    });

    beforeEach(function(){
      // Add missing put and remove methods to test
      dbHandler.put = function(item) {
        return item;
      };

      dbHandler.remove = function(item) {
        return item;
      };

      // spy on these methods
      spyOn(dbHandler, 'put').and.callThrough();
      spyOn(dbHandler, 'remove').and.callThrough();
    });

    xit('should filter data to be saved for saveUpstream', function() {
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
      }];

      dbHandler.upstream.onNext(streamInputs[0]);
      dbHandler.upstream.onNext(streamInputs[1]);
      dbHandler.upstream.onNext(streamInputs[2]);

      expect(dbHandler._saveUpstream.messages).toHaveEqualElements(
        onNext(0, streamInputs[0]),
        onNext(20, streamInputs[2])
      );
    });

    xit('should filter data to be deleted for deleteUpstream', function() {

    });

    xit('should ignore data to not be saved or deleted', function() {

    });

    xit('should call the save downstream map fn and delegate to downstream',
      function() {
        expect(dbHandler.put).toHaveBeenCalled();
        expect(dbHandler.remove).not.toHaveBeenCalled();
      });

    xit('should call the delete downstream map fn and delegate to downstream',
      function() {
        expect(dbHandler.remove).toHaveBeenCalled();
        expect(dbHandler.put).not.toHaveBeenCalled();
      });

    xit('should pause/resume internal upstream depending on db connection', function() {

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
