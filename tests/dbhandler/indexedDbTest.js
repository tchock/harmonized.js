'use strict';

define(['rx', 'rx.testing', 'DbHandler/IndexedDbHandler', 'harmonizedData',
    'indexedDBmock'
  ],
  function(Rx, RxTest, IndexedDbHandler, harmonizedData, indexedDBmock) {

    describe('IndexedDB Service', function() {

      var dbHandler;
      var connectionStreamOutputs;
      var connectionStreamErrors;
      var scheduler;

      var keys = {
        storeKey: '_id',
        serverKey: 'id'
      };

      function fillStorageWithTestData() {
        return dbHandler.put([{
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
        spyOn(IndexedDbHandler, 'getDbReference').and.returnValue(
          indexedDBmock.mock);
      });

      afterEach(function() {
        IndexedDbHandler._db = null;
        IndexedDbHandler._isConnecting = false;
        delete indexedDBmock.mockDbs.harmonizedDb;
      });

      beforeEach(function() {
        spyOn(harmonizedData, 'getDbSchema').and.returnValue({
          testStore: {
            storeId: '_id',
            serverId: 'id'
          }
        });
      });

      // Reactive X testing build up
      beforeEach(function() {

        // Scheduler to mock the RxJS timing
        scheduler = new RxTest.TestScheduler();

        // Mock the subject to let it use the scheduler
        /*var OriginalSubject = Rx.Subject;
        spyOn(Rx, 'Subject').and.callFake(function() {
          return new OriginalSubject(scheduler.createObserver(), scheduler.createHotObservable());
        });*/

        IndexedDbHandler._connectionStream = new Rx.Subject();

        // Subscribe connection stream to get the streams output
        connectionStreamOutputs = [];
        connectionStreamErrors = [];
        IndexedDbHandler._connectionStream.subscribe(
          function(item) {
            connectionStreamOutputs.push(item);
          },

          function(error) {
            connectionStreamErrors.push(error);
          });

        // Rebuild dbHandler to include mock subject
        dbHandler = new IndexedDbHandler('testStore', keys);
      });

      it(
        'should connect to database, disconnect afterwards and connect again with increased version number',
        function() {
          // _db should not be set!
          expect(IndexedDbHandler._db).toBe(null);

          scheduler.scheduleWithAbsolute(0, function() {
            // Check if only the initial false is in the connection stream output
            expect(connectionStreamOutputs).toEqual([false]);
          });

          scheduler.scheduleWithAbsolute(1, function() {
            // Check if storage is not jet build
            expect(indexedDBmock.mockDbs.harmonizedDb.objectStoreNames)
              .toEqual([]);
            expect(connectionStreamOutputs).toEqual([false]);

            // Check after the connection has happened (2 fake ticks)
            // Also check if _isConnecting is set correctly
            expect(IndexedDbHandler._isConnecting).toBeTruthy();
            jasmine.clock().tick(2);
            expect(IndexedDbHandler._isConnecting).toBeFalsy();

            // Now the database connection is established (2nd entry === true)
            expect(connectionStreamOutputs).toEqual([false, true]);

            // _db is set and version should be 1 (in indexeddb and its handler)
            expect(IndexedDbHandler._db).not.toBe(null);
            expect(IndexedDbHandler._db.version).toBe(1);
            expect(indexedDBmock.mockDbs.harmonizedDb.version).toBe(
              1);

            // TODO check if storage is build by now

            // Test if connect() will not connect on already established connection
            expect(IndexedDbHandler.connect()).toBeUndefined();
            expect(IndexedDbHandler._isConnecting).toBeFalsy();
          });

          scheduler.scheduleWithAbsolute(10, function() {
            // Check if the closing of connection works
            IndexedDbHandler.closeConnection();
            expect(IndexedDbHandler._db).toBe(null);
            expect(connectionStreamOutputs).toEqual([false, true,
              false
            ]);
          });

          scheduler.scheduleWithAbsolute(20, function() {
            // Version update
            harmonizedData.dbVersion = 2;

            // Connect again!
            IndexedDbHandler.connect();
            expect(connectionStreamOutputs).toEqual([false, true,
              false
            ]);
            expect(IndexedDbHandler._isConnecting).toBeTruthy();
            jasmine.clock().tick(2);
            expect(IndexedDbHandler._isConnecting).toBeFalsy();

            // Should now be connected
            // and version should be 2 (in indexeddb and its handler)
            expect(connectionStreamOutputs).toEqual([false, true,
              false, true
            ]);
            expect(IndexedDbHandler._db.version).toBe(2);
            expect(indexedDBmock.mockDbs.harmonizedDb.version).toBe(
              2);
          });

          // Start the scheduler to run the current setup
          scheduler.start();
        });

      it(
        'should fail at a second connection with lower db version number',
        function() {
          // _db should not be set!
          IndexedDbHandler._isConnecting = false;
          dbHandler = new IndexedDbHandler('testStore', keys);
          expect(IndexedDbHandler._db).toBe(null);
          harmonizedData.dbVersion = 2;

          scheduler.scheduleWithAbsolute(1, function() {
            expect(IndexedDbHandler._isConnecting).toBeTruthy();
            jasmine.clock().tick(2);
            expect(IndexedDbHandler._db.version).toBe(2);
            IndexedDbHandler.closeConnection();
          });

          scheduler.scheduleWithAbsolute(10, function() {
            harmonizedData.dbVersion = 1;
            dbHandler = new IndexedDbHandler('testStore', keys);
            jasmine.clock().tick(2);

            expect(connectionStreamErrors.length).toBe(1);
            expect(connectionStreamErrors[0].message).toEqual(
              'VersionError');
          });

          // Start the scheduler to run the current setup
          scheduler.start();
        });

      it('should add 3 entries to a storage', function() {
        var putStream;
        var putItems = [];

        jasmine.clock().tick(2);
        expect(IndexedDbHandler._db).not.toBe(null);

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
        var storeData = indexedDBmock.mockDbs.harmonizedDb.objectStores[
          0].__data;
        expect(storeData[1]).toEqual({
          firstname: 'Igor',
          lastname: 'Igorson',
          _id: 1,
          _deleted: false
        });
        expect(storeData[2]).toEqual({
          firstname: 'Igor',
          lastname: 'Igorson',
          _id: 2,
          _deleted: false
        });
        expect(storeData[3]).toEqual({
          firstname: 'Igor',
          lastname: 'Igorov',
          _id: 3,
          _deleted: false
        });
      });

      it('should add a single entry to the database', function() {
        var putStream;
        var putItems = [];

        jasmine.clock().tick(2);
        expect(IndexedDbHandler._db).not.toBe(null);

        // Add some data
        scheduler.scheduleWithAbsolute(0, function() {
          putStream = dbHandler.put({
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
        var storeData = indexedDBmock.mockDbs.harmonizedDb.objectStores[
          0].__data;
        expect(storeData[1]).toEqual({
          firstname: 'Stanislav',
          lastname: 'Schewadnaze',
          _id: 1,
          _deleted: false
        });
      });

      it('should fail at inserting data because of the same serverId',
        function() {
          var putStream;
          var putItems = [];

          jasmine.clock().tick(2);
          expect(IndexedDbHandler._db).not.toBe(null);

          // Add some data
          scheduler.scheduleWithAbsolute(0, function() {
            expect(function() {
              putStream = dbHandler.put([{
                data: {
                  firstname: 'Igor',
                  lastname: 'Igorson'
                },
                meta: {
                  serverId: 123,
                  deleted: false
                }
              }, {
                data: {
                  firstname: 'Eduard',
                  lastname: 'Schewadnaze'
                },
                meta: {
                  serverId: 123,
                  deleted: false
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
              serverId: 123,
              deleted: false
            },
            data: {
              firstname: 'Igor',
              lastname: 'Igorson'
            }
          }]);

          // Check the saved data
          var storeData = indexedDBmock.mockDbs.harmonizedDb.objectStores[
            0].__data;
          expect(storeData[1]).toEqual({
            firstname: 'Igor',
            lastname: 'Igorson',
            _id: 1,
            id: 123,
            _deleted: false
          });
        });

      it('should fail at inserting data because missing db connection',
        function() {
          var putStream;
          var putItems = [];
          var putErrors = [];

          // Add some data
          scheduler.scheduleWithAbsolute(0, function() {
            expect(IndexedDbHandler._db).toBe(null);

            putStream = dbHandler.put([{
              data: {
                firstname: 'Igor',
                lastname: 'Igorson'
              },
              meta: {
                serverId: 123,
                deleted: false
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

          expect(putItems.length).toBe(0);
          expect(putErrors.length).toBe(1);
          expect(putErrors[0].message).toEqual(
            'no database connection established');
        });

      it('should get all entries from a store with 3 items', function() {
        var getItems = [];

        jasmine.clock().tick(2);
        expect(IndexedDbHandler._db).not.toBe(null);

        // Add data to the mocked indexeddb
        indexedDBmock.mockDbs.harmonizedDb.objectStores[0].__data = {
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

        indexedDBmock.mockDbs.harmonizedDb.objectStores[0].__keys = [
          1, 2, 3
        ];

        scheduler.scheduleWithAbsolute(0, function() {
          dbHandler.getAllEntries();
          dbHandler.downstream.subscribe(function(item) {
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
        expect(IndexedDbHandler._db).not.toBe(null);

        scheduler.scheduleWithAbsolute(0, function() {
          getStream = dbHandler.getAllEntries();
          dbHandler.downstream.subscribe(function(item) {
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
        expect(IndexedDbHandler._db).not.toBe(null);

        // Add data to the mocked indexeddb
        indexedDBmock.mockDbs.harmonizedDb.objectStores[0].__data = {
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

        indexedDBmock.mockDbs.harmonizedDb.objectStores[0].__keys = [
          1, 2, 3
        ];

        scheduler.scheduleWithAbsolute(0, function() {
          removeStream = dbHandler.remove({
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
        var storeData = indexedDBmock.mockDbs.harmonizedDb.objectStores[
          0].__data;
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

      it('should fail at removing data because missing db connetion',
        function(done) {
          var removeStream;
          var removeItems = [];
          var removeErrors = [];

          // Add some data
          scheduler.scheduleWithAbsolute(0, function() {
            expect(IndexedDbHandler._db).toBe(null);

            removeStream = dbHandler.remove([{
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

          expect(removeItems.length).toBe(0);
          expect(removeErrors.length).toBe(1);
          expect(removeErrors[0].message).toEqual(
            'no database connection established');
          done();
        });

      it('should delete the database', function() {
        jasmine.clock().tick(2);
        expect(IndexedDbHandler._db).not.toBe(null);

        scheduler.scheduleWithAbsolute(0, function() {
          IndexedDbHandler.deleteDb();
          expect(indexedDBmock.mockDbs.harmonizedDb).toBeUndefined();
        });

        scheduler.scheduleWithAbsolute(1, function() {
          jasmine.clock().tick(2);
          expect(connectionStreamOutputs).toEqual([false, true,false]);
          expect(indexedDBmock.mockDbs.harmonizedDb).toBeUndefined();
        });

        scheduler.start();
      });

    });
  });
