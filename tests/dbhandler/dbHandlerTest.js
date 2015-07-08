'use strict';

define(['Squire', 'sinon', 'lodash', 'rx', 'rx.testing', 'mockWebStorage'],
  function(Squire, sinon, _, Rx, RxTest, mockWebStorage) {

    describe('DbHandler', function() {

      var dbHandler;
      var explicitDbHandler;

      var injector;

      var keys = {
        storeKey: '_id',
        serverKey: 'id'
      };

      // Mock time
      beforeEach(function() {});

      afterEach(function() {
        jasmine.clock().uninstall();
      });

      beforeEach(function() {
        explicitDbHandler = {
          _connectionStream: new Rx.Subject(),
          connect: function() {
            explicitDbHandler._isConnecting = true;
            setTimeout(function() {
              explicitDbHandler._db = {};
              explicitDbHandler._isConnecting = false;
            }, 10);
          },

          _isConnecting: false
        };

        spyOn(explicitDbHandler, 'connect').and.callThrough();

        // webStorage mock
        injector = new Squire();
        injector.mock('helper/webStorage', {
          getWebStorage: function() {
            return mockWebStorage.localStorage;
          }
        });
      });

      afterEach(function() {
        injector = null;
        mockWebStorage.localStorageContent = {};
      });

      function testInContext(cb, options) {
        injector.require([
          'DbHandler/BaseHandler',
          'MockDbHandler',
          'mocks'
        ], function(DbHandler, MockDbHandler, mocks) {
          jasmine.clock().install();
          dbHandler = new MockDbHandler(explicitDbHandler,
            'testStore', keys);
          cb({
            DbHandler: DbHandler,
            MockDbHandler: MockDbHandler
          });
        });
      }

      it('should not call the connect function twice', function(done) {
        testInContext(function(deps) {
          expect(explicitDbHandler._isConnecting).toBeTruthy();
          var secondDbHandler = new deps.MockDbHandler(
            explicitDbHandler, 'secondStore', keys);
          expect(explicitDbHandler.connect.calls.count()).toEqual(
            1);
          jasmine.clock().tick(9);
          expect(explicitDbHandler._isConnecting).toBeTruthy();
          jasmine.clock().tick(1);
          expect(explicitDbHandler._isConnecting).toBeFalsy();

          // Check after established Connection
          var thirdDbHandler = new deps.MockDbHandler(
            explicitDbHandler, 'thirdStore', keys);
          jasmine.clock().tick(10);
          expect(explicitDbHandler.connect.calls.count()).toEqual(
            1);

          done();
        });
      });

      describe('streams', function() {

        // Aliases
        var scheduler;
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
        }, {
          data: {
            name: 'Mike Hansen'
          },
          meta: {
            action: 'delete'
          }
        }, {
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
          scheduler.scheduleWithAbsolute(1, function() {
            explicitDbHandler._connectionStream.onNext(true);
            dbHandler.upstream.onNext(streamInputs[0]);
          });

          scheduler.scheduleWithAbsolute(10, function() {
            dbHandler.upstream.onNext(streamInputs[1]);
          });

          scheduler.scheduleWithAbsolute(45, function() {
            dbHandler.upstream.onNext(streamInputs[2]);
          });

          scheduler.scheduleWithAbsolute(60, function() {
            dbHandler.upstream.onNext(streamInputs[3]);
          });
        }

        function scheduleIgnorableData() {
          scheduler.scheduleWithAbsolute(15, function() {
            dbHandler.upstream.onNext(ignorableInputs[0]);
          });

          scheduler.scheduleWithAbsolute(55, function() {
            dbHandler.upstream.onNext(ignorableInputs[1]);
          });
        }

        // Reactive X testing build up
        beforeEach(function() {
          // Scheduler to mock the RxJS timing
          scheduler = new RxTest.TestScheduler();

          // Mock the subject to let it use the scheduler
          // TODO is that code needed??? Find it out!!!!
          // var OriginalSubject = Rx.Subject;
          // spyOn(Rx, 'Subject').and.callFake(function() {
          //  return new OriginalSubject(scheduler.createObserver(), scheduler.createHotObservable());
          // });

          // Rebuild explicitDbHandler to include mock subject
          explicitDbHandler = {
            _connectionStream: new Rx.Subject(),
            connect: function() {}
          };

        });

        beforeEach(function() {
          // Reset stream output arrays
          upstreamOutputs = [];
          downstreamOutputs = [];

          deleteUpstreamOutputs = [];
          deleteDownstreamOutputs = [];

          saveUpstreamOutputs = [];
          saveDownstreamOutputs = [];

        });

        function rebuildDbHandler(deps) {
          // Rebuild dbHandler to include mock subject
          dbHandler = new deps.MockDbHandler(explicitDbHandler,
            'testStore', keys);

          // spy on these methods
          spyOn(deps.MockDbHandler, 'mockPut').and.callThrough();
          spyOn(deps.MockDbHandler, 'mockRemove').and.callThrough();

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
        }


        it('should filter data to be saved', function(done) {
          testInContext(function(deps) {
            rebuildDbHandler(deps);

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
            expect(saveUpstreamOutputs).toEqual(
              expectedStreamOutputs);

            // check Downstream length
            expect(downstreamOutputs.length).toBe(2);
            expect(downstreamOutputs).toEqual(
              expectedStreamOutputs);

            // Test if map functions were called
            expect(deps.MockDbHandler.mockPut).toHaveBeenCalled();
            expect(deps.MockDbHandler.mockRemove).not.toHaveBeenCalled();

            done();
          });
        });

        it('should filter data to be deleted', function(done) {
          testInContext(function(deps) {
            rebuildDbHandler(deps);
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
            expect(deleteUpstreamOutputs).toEqual(
              expectedStreamOutputs);

            // check Downstream length
            expect(downstreamOutputs.length).toBe(2);
            expect(downstreamOutputs).toEqual(
              expectedStreamOutputs);

            // Test if map functions were called
            expect(deps.MockDbHandler.mockRemove).toHaveBeenCalled();
            expect(deps.MockDbHandler.mockPut).not.toHaveBeenCalled();

            done();
          });
        });

        it('should ignore data to not be saved or deleted', function(done) {
          testInContext(function(deps) {
            rebuildDbHandler(deps);
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

            done();
          });
        });

        it('should pause/resume internal upstream', function(done) {
          testInContext(function(deps) {
            rebuildDbHandler(deps);
            // Fill upstream with data
            scheduleData();

            // Pause the internal upstream at 8ms
            scheduler.scheduleWithAbsolute(8, function() {
              explicitDbHandler._connectionStream.onNext(
                false);
            });

            // In the meantime the second stream item is put on the upstream
            // is buffered in the internal upstream because it is paused

            // Resume the internal upstream at 15ms
            scheduler.scheduleWithAbsolute(15, function() {
              explicitDbHandler._connectionStream.onNext(
                true);
            });

            // In the meantime the second (10ms) and third (45ms) item are put on the
            // upstream and are delegated to the downstream, because the internal
            // upstream is not paused

            // Pause the internal upstream at 50ms
            scheduler.scheduleWithAbsolute(50, function() {
              explicitDbHandler._connectionStream.onNext(
                false);
            });

            // Start the scheduler to run the current setup
            scheduler.start();

            // Until now, only 3 items should be handled by the database
            expect(upstreamOutputs.length).toBe(3);

            // Stop the scheduler to add new scheduling steps
            scheduler.stop();

            // Resume the internal upstream at 65ms, all items should by now be on the
            // public upstream
            scheduler.scheduleWithAbsolute(65, function() {
              explicitDbHandler._connectionStream.onNext(
                true);
            });

            // Start the scheduler again to flush the remaining stream items to the
            // public downstream
            scheduler.start();

            // Now all items should be handled by the database and put on the public
            // downstream! These items should match the input
            expect(upstreamOutputs.length).toBe(4);
            expect(downstreamOutputs).toEqual(streamInputs);
            done();
          });
        });
      });

      describe('db metadata', function() {
        it('should get empty DB metadata', function(done) {
          testInContext(function(deps) {
            expect(dbHandler.getMetadata()).toEqual({});
            done();
          });
        });

        it('should get DB metadata with data', function(done) {
          testInContext(function(deps) {
            var expectedObject = {
              hey: 'you'
            };


            mockWebStorage.localStorageContent = {
              harmonizedMeta_testStore: expectedObject
            };

            dbHandler = new deps.DbHandler(explicitDbHandler,
              'testStore', keys);
            expect(dbHandler.getMetadata()).toEqual(
              expectedObject);
            done();
          });
        });

        it('should write into empty DB metadata', function(done) {
          testInContext(function(deps) {
            var expectedObject = {
              name: 'John Doe'
            };

            expect(dbHandler._metadata).toEqual({});

            dbHandler.setMetadata('name', 'John Doe');
            expect(dbHandler._metadata).toEqual(
              expectedObject);
            expect(mockWebStorage.localStorageContent).toEqual({
              harmonizedMeta_testStore: expectedObject
            });
            done();
          });
        });

        it('should add to already existing DB metadata', function(
          done) {
          testInContext(function(deps) {
            mockWebStorage.localStorageContent = {
              harmonizedMeta_testStore: {
                name: 'John Doe'
              }
            };

            var expectedObject = {
              name: 'John Doe',
              otherName: 'Max Mustermann'
            };

            dbHandler = new deps.DbHandler(explicitDbHandler,
              'testStore', keys);
            dbHandler.setMetadata('otherName',
              'Max Mustermann');
            expect(dbHandler._metadata).toEqual(
              expectedObject);
            expect(mockWebStorage.localStorageContent).toEqual({
              harmonizedMeta_testStore: expectedObject
            });
            done();
          });
        });

      });

      describe('createDbItem', function() {
        it('should create create a db item with full metadata',
          function(done) {
            testInContext(function(deps) {
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
              var outputItem = dbHandler._createDbItem(
                inputItem);

              expect(outputItem).toEqual(expectedOutputItem);
              expect(outputItem).not.toEqual(inputItem.data);
              expect(outputItem).not.toBe(inputItem.data);
              done();
            });
          });

        it('should create create a db item with one missing metadata',
          function(done) {
            testInContext(function(deps) {
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
              done();
            });
          });

        it(
          'should create create a db item with whole missing metadata',
          function(done) {
            testInContext(function(deps) {
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
              done();
            });
          });
      });

    });

  });
