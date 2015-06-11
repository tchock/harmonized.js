'use strict';

describe('IndexedDB Service', function() {

  var indexedDbHandler;
  var connectionStreamOutputs;
  var connectionStreamErrors;
  var scheduler;

  var keys = {
    storeKey: '_id',
    serverKey: 'id'
  };

  function fillStorageWithTestData() {
    return indexedDbHandler.put([{
      data: {
        firstname: 'Igor',
        lastname: 'Igorson'
      }
    }, {
      data: {
        firstname: 'Igor',
        lastname: 'Igorson'
      }
    }, {
      data: {
        firstname: 'Igor',
        lastname: 'Igorov'
      },
      meta: {
        test: true
      }
    }]);
  }

  beforeEach(function() {
    jasmine.clock().install();
  });

  afterEach(function() {
    jasmine.clock().uninstall();
  });

  beforeEach(function() {
    spyOn(Harmonized.IndexedDbHandler, 'getDbReference').and.returnValue(window.indexedDBmock);
  });

  afterEach(function() {
    Harmonized.IndexedDbHandler._db = null;
    Harmonized.IndexedDbHandler._isConnecting = false;
    delete indexedDBmockDbs.harmonizedDb;
  });

  beforeEach(function() {
    spyOn(Harmonized, 'getDbSchema').and.returnValue({
      testStore: {
        storeId: '_id',
        serverId: 'id'
      }
    });
  });

  // Reactive X testing build up
  beforeEach(function() {
    // Add custom RxJS matchers
    jasmine.addMatchers(streamMatchers);

    // Scheduler to mock the RxJS timing
    scheduler = new Rx.TestScheduler();

    // Mock the subject to let it use the scheduler
    var OriginalSubject = Rx.Subject;
    spyOn(Rx, 'Subject').and.callFake(function() {
      return new OriginalSubject(scheduler.createObserver(), scheduler.createHotObservable());
    });

    Harmonized.IndexedDbHandler._connectionStream = new Rx.Subject();

    // Subscribe connection stream to get the streams output
    connectionStreamOutputs = [];
    connectionStreamErrors = [];
    Harmonized.IndexedDbHandler._connectionStream.subscribe(
      function(item) {
        connectionStreamOutputs.push(item);
      },

      function(error) {
        connectionStreamErrors.push(error);
      });

    // Rebuild dbHandler to include mock subject
    indexedDbHandler = new Harmonized.IndexedDbHandler('testStore', keys);
  });

  it('should connect to database, disconnect afterwards and connect again with increased version number', function() {
    // _db should not be set!
    expect(Harmonized.IndexedDbHandler._db).toBe(null);

    scheduler.scheduleWithAbsolute(0, function() {
      // Check if only the initial false is in the connection stream output
      expect(connectionStreamOutputs).toEqual([false]);
    });

    scheduler.scheduleWithAbsolute(1, function() {
      // Check if storage is not jet build
      expect(indexedDBmockDbs.harmonizedDb.objectStoreNames).toEqual([]);
      expect(connectionStreamOutputs).toEqual([false]);

      // Check after the connection has happened (2 fake ticks)
      // Also check if _isConnecting is set correctly
      expect(Harmonized.IndexedDbHandler._isConnecting).toBeTruthy();
      jasmine.clock().tick(2);
      expect(Harmonized.IndexedDbHandler._isConnecting).toBeFalsy();

      // Now the database connection is established (2nd entry === true)
      expect(connectionStreamOutputs).toEqual([false, true]);

      // _db is set and version should be 1 (in indexeddb and its handler)
      expect(Harmonized.IndexedDbHandler._db).not.toBe(null);
      expect(Harmonized.IndexedDbHandler._db.version).toBe(1);
      expect(indexedDBmockDbs.harmonizedDb.version).toBe(1);

      // TODO check if storage is build by now

      // Test if connect() will not connect on already established connection
      expect(Harmonized.IndexedDbHandler.connect()).toBeUndefined();
      expect(Harmonized.IndexedDbHandler._isConnecting).toBeFalsy();
    });

    scheduler.scheduleWithAbsolute(10, function() {
      // Check if the closing of connection works
      Harmonized.IndexedDbHandler.closeConnection();
      expect(Harmonized.IndexedDbHandler._db).toBe(null);
      expect(connectionStreamOutputs).toEqual([false, true, false]);
    });

    scheduler.scheduleWithAbsolute(20, function() {
      // Version update
      Harmonized.dbVersion = 2;

      // Connect again!
      Harmonized.IndexedDbHandler.connect();
      expect(connectionStreamOutputs).toEqual([false, true, false]);
      expect(Harmonized.IndexedDbHandler._isConnecting).toBeTruthy();
      jasmine.clock().tick(2);
      expect(Harmonized.IndexedDbHandler._isConnecting).toBeFalsy();

      // Should now be connected
      // and version should be 2 (in indexeddb and its handler)
      expect(connectionStreamOutputs).toEqual([false, true, false, true]);
      expect(Harmonized.IndexedDbHandler._db.version).toBe(2);
      expect(indexedDBmockDbs.harmonizedDb.version).toBe(2);
    });

    // Start the scheduler to run the current setup
    scheduler.start();
  });

  it('should fail at a second connection with lower db version number', function() {
    // _db should not be set!
    Harmonized.IndexedDbHandler._isConnecting = false;
    indexedDbHandler = new Harmonized.IndexedDbHandler('testStore', keys);
    expect(Harmonized.IndexedDbHandler._db).toBe(null);
    Harmonized.dbVersion = 2;

    scheduler.scheduleWithAbsolute(1, function() {
      expect(Harmonized.IndexedDbHandler._isConnecting).toBeTruthy();
      jasmine.clock().tick(2);
      expect(Harmonized.IndexedDbHandler._db.version).toBe(2);
      Harmonized.IndexedDbHandler.closeConnection();
    });

    scheduler.scheduleWithAbsolute(10, function() {
      Harmonized.dbVersion = 1;
      indexedDbHandler = new Harmonized.IndexedDbHandler('testStore', keys);
      jasmine.clock().tick(2);

      expect(connectionStreamErrors.length).toBe(1);
      expect(connectionStreamErrors[0].message).toEqual('VersionError');
    });

    // Start the scheduler to run the current setup
    scheduler.start();
  });

  it('should add 3 entries to a storage', function() {
    var putStream;
    var putItems = [];

    jasmine.clock().tick(2);
    expect(Harmonized.IndexedDbHandler._db).not.toBe(null);

    // Add some data
    scheduler.scheduleWithAbsolute(0, function() {
      putStream = fillStorageWithTestData();
      putStream.subscribe(function(item) {
        putItems.push(item);
      });

      jasmine.clock().tick(3);
    });

    scheduler.start();

    // Check the returned stream data
    expect(putItems.length).toBe(3);
    expect(putItems).toEqual([{
      meta: {
        storeId: 1
      },
      data: {
        firstname: 'Igor',
        lastname: 'Igorson'
      }
    }, {
      meta: {
        storeId: 2
      },
      data: {
        firstname: 'Igor',
        lastname: 'Igorson'
      }
    }, {
      meta: {
        storeId: 3,
        test: true
      },
      data: {
        firstname: 'Igor',
        lastname: 'Igorov'
      }
    }]);

    // Check the saved data
    var storeData = indexedDBmockDbs.harmonizedDb.objectStores[0].__data;
    expect(storeData[1]).toEqual({
      firstname: 'Igor',
      lastname: 'Igorson',
      _id: 1
    });
    expect(storeData[2]).toEqual({
      firstname: 'Igor',
      lastname: 'Igorson',
      _id: 2
    });
    expect(storeData[3]).toEqual({
      firstname: 'Igor',
      lastname: 'Igorov',
      _id: 3
    });
  });

  it('should add a single entry to the database', function() {
    var putStream;
    var putItems = [];

    jasmine.clock().tick(2);
    expect(Harmonized.IndexedDbHandler._db).not.toBe(null);

    // Add some data
    scheduler.scheduleWithAbsolute(0, function() {
      putStream = indexedDbHandler.put({
        data: {
          firstname: 'Stanislav',
          lastname: 'Schewadnaze'
        }
      });
      putStream.subscribe(function(item) {
        putItems.push(item);
      });

      jasmine.clock().tick(3);
    });

    scheduler.start();

    // Check the returned stream data
    expect(putItems.length).toBe(1);
    expect(putItems).toEqual([{
      meta: {
        storeId: 1
      },
      data: {
        firstname: 'Stanislav',
        lastname: 'Schewadnaze'
      }
    }]);

    // Check the saved data
    var storeData = indexedDBmockDbs.harmonizedDb.objectStores[0].__data;
    expect(storeData[1]).toEqual({
      firstname: 'Stanislav',
      lastname: 'Schewadnaze',
      _id: 1
    });
  });

  it('should fail at inserting data because of the same serverId', function() {
    var putStream;
    var putItems = [];

    jasmine.clock().tick(2);
    expect(Harmonized.IndexedDbHandler._db).not.toBe(null);

    // Add some data
    scheduler.scheduleWithAbsolute(0, function() {
      expect(function() {
        putStream = indexedDbHandler.put([{
          data: {
            firstname: 'Igor',
            lastname: 'Igorson'
          },
          meta: {
            serverId: 123
          }
        }, {
          data: {
            firstname: 'Eduard',
            lastname: 'Schewadnaze'
          },
          meta: {
            serverId: 123
          }
        }, {
          data: {
            firstname: 'Igor',
            lastname: 'Igorov'
          }
        }]);

        putStream.subscribe(function(item) {
          putItems.push(item);
        });

        jasmine.clock().tick(3);
      }).toThrow(new Error('ConstraintError'));
    });

    scheduler.start();

    // Check the returned stream data
    expect(putItems.length).toBe(1);
    expect(putItems).toEqual([{
      meta: {
        storeId: 1,
        serverId: 123
      },
      data: {
        firstname: 'Igor',
        lastname: 'Igorson'
      }
    }]);

    // Check the saved data
    var storeData = indexedDBmockDbs.harmonizedDb.objectStores[0].__data;
    expect(storeData[1]).toEqual({
      firstname: 'Igor',
      lastname: 'Igorson',
      _id: 1,
      id: 123
    });
  });

  it('should fail at inserting data because missing db connetion', function() {
    var putStream;
    var putItems = [];
    var putErrors = [];

    // Add some data
    scheduler.scheduleWithAbsolute(0, function() {
      expect(Harmonized.IndexedDbHandler._db).toBe(null);

      putStream = indexedDbHandler.put([{
        data: {
          firstname: 'Igor',
          lastname: 'Igorson'
        },
        meta: {
          serverId: 123
        }
      }]);

      putStream.subscribe(
        function(item) {
          putItems.push(item);
        },

        function(error) {
          putErrors.push(error);
        });

      jasmine.clock().tick(3);
    });

    scheduler.start();

    expect(putItems).toBeEmptyArray();
    expect(putErrors).toBeArrayOfSize(1);
    expect(putErrors[0].message).toEqual('no database connection established');
  });

  it('should get all entries from a store with 3 items', function() {
    var getItems = [];

    jasmine.clock().tick(2);
    expect(Harmonized.IndexedDbHandler._db).not.toBe(null);

    // Add data to the mocked indexeddb
    indexedDBmockDbs.harmonizedDb.objectStores[0].__data = {
      1: {
        firstname: 'Igor',
        lastname: 'Igorson',
        _id: 1
      },
      2: {
        firstname: 'Igor',
        lastname: 'Mortison',
        _id: 2
      },
      3: {
        firstname: 'Igor',
        lastname: 'Igorov',
        _id: 3
      }
    }

    indexedDBmockDbs.harmonizedDb.objectStores[0].__keys = [1, 2, 3];

    scheduler.scheduleWithAbsolute(0, function() {
      indexedDbHandler.getAllEntries();
      indexedDbHandler.downstream.subscribe(function(item) {
        getItems.push(item);
      });

      jasmine.clock().tick(20);
    });

    scheduler.start();

    expect(getItems).toEqual([{
      meta: {
        storeId: 1,
        serverId: undefined
      },
      data: {
        firstname: 'Igor',
        lastname: 'Igorson'
      }
    }, {
      meta: {
        storeId: 2,
        serverId: undefined
      },
      data: {
        firstname: 'Igor',
        lastname: 'Mortison'
      }
    }, {
      meta: {
        storeId: 3,
        serverId: undefined
      },
      data: {
        firstname: 'Igor',
        lastname: 'Igorov'
      }
    }]);
  });

  it('should get all entries from an empty table', function() {
    var getStream;
    var getItems = [];

    jasmine.clock().tick(2);
    expect(Harmonized.IndexedDbHandler._db).not.toBe(null);

    scheduler.scheduleWithAbsolute(0, function() {
      getStream = indexedDbHandler.getAllEntries();
      indexedDbHandler.downstream.subscribe(function(item) {
        getItems.push(item);
      });

      jasmine.clock().tick(3);
    });

    scheduler.start();

    expect(getItems).toEqual([]);
  });

  it('should remove the second entry', function() {
    var removeStream;
    var removeItems = [];

    jasmine.clock().tick(2);
    expect(Harmonized.IndexedDbHandler._db).not.toBe(null);

    // Add data to the mocked indexeddb
    indexedDBmockDbs.harmonizedDb.objectStores[0].__data = {
      1: {
        firstname: 'Igor',
        lastname: 'Igorson',
        _id: 1
      },
      2: {
        firstname: 'Igor',
        lastname: 'Mortison',
        _id: 2
      },
      3: {
        firstname: 'Igor',
        lastname: 'Igorov',
        _id: 3
      }
    };

    indexedDBmockDbs.harmonizedDb.objectStores[0].__keys = [1, 2, 3];

    scheduler.scheduleWithAbsolute(0, function() {
      removeStream = indexedDbHandler.remove({
        meta: {
          storeId: 2
        },
        data: {
          firstname: 'Igor',
          lastname: 'Mortison'
        }
      });

      removeStream.subscribe(function(item) {
        removeItems.push(item);
      });

      jasmine.clock().tick(2);
    });

    scheduler.start();

    // Check the downstream
    expect(removeItems.length).toBe(1);
    expect(removeItems[0]).toEqual({
      meta: {
        deleted: true,
        storeId: 2
      },
      data: {
        firstname: 'Igor',
        lastname: 'Mortison'
      }
    });

    // Check the saved data
    var storeData = indexedDBmockDbs.harmonizedDb.objectStores[0].__data;
    expect(storeData[1]).toEqual({
      firstname: 'Igor',
      lastname: 'Igorson',
      _id: 1
    });
    expect(storeData[2]).toBeUndefined();
    expect(storeData[3]).toEqual({
      firstname: 'Igor',
      lastname: 'Igorov',
      _id: 3
    });
  });

  it('should fail at removing data because missing db connetion', function() {
    var removeStream;
    var removeItems = [];
    var removeErrors = [];

    // Add some data
    scheduler.scheduleWithAbsolute(0, function() {
      expect(Harmonized.IndexedDbHandler._db).toBe(null);

      removeStream = indexedDbHandler.remove([{
        data: {
          firstname: 'Igor',
          lastname: 'Igorson'
        },
        meta: {
          _id: 1,
          serverId: 123
        }
      }]);

      removeStream.subscribe(
        function(item) {
          removeItems.push(item);
        },

        function(error) {
          removeErrors.push(error);
        });

      jasmine.clock().tick(3);
    });

    scheduler.start();

    expect(removeItems).toBeEmptyArray();
    expect(removeErrors).toBeArrayOfSize(1);
    expect(removeErrors[0].message).toEqual('no database connection established');
  });

  it('should delete the database', function() {
    jasmine.clock().tick(2);
    expect(Harmonized.IndexedDbHandler._db).not.toBe(null);

    scheduler.scheduleWithAbsolute(0, function() {
      Harmonized.IndexedDbHandler.deleteDb();
      expect(indexedDBmockDbs.harmonizedDb).toBeUndefined();
    });

    scheduler.scheduleWithAbsolute(1, function() {
      jasmine.clock().tick(2);
      expect(connectionStreamOutputs).toEqual([false, true, false]);
      expect(indexedDBmockDbs.harmonizedDb).toBeUndefined();
    });

    scheduler.start();
  });

});
