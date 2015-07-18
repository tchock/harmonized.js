'use strict';

define(['Squire', 'sinon', 'lodash', 'rx', 'rx.testing', 'mockWebStorage'],
  function(Squire, sinon, _, Rx, RxTest, mockWebStorage) {
    describe('ServerHandler', function() {

      var injector;
      var sh;
      var scheduler;
      var pushList = [];

      beforeEach(function() {
        // Scheduler to mock the RxJS timing
        scheduler = new RxTest.TestScheduler();
      });

      beforeEach(function() {
        injector = new Squire();
        injector.mock('ServerHandler/httpHandler', {
          connect: jasmine.createSpy(),
          disconnect: jasmine.createSpy(),
          fetch: jasmine.createSpy(),
          push: jasmine.createSpy().and.callFake(
            function(item, handler) {
              pushList.push(item);
            }),

          sendRequest: jasmine.createSpy().and.returnValue('blub')
        });
        injector.mock('ServerHandler/socketHandler', {
          connect: jasmine.createSpy(),
          disconnect: jasmine.createSpy()
        });
        injector.mock('helper/webStorage', {
          getWebStorage: function() {
            return mockWebStorage.localStorage;
          }
        });
      });

      function testInContext(cb, options) {
        injector.require(['ServerHandler', 'mocks'], function(
          ServerHandler, mocks) {

          spyOn(ServerHandler.prototype, '_setProtocol').and.callThrough();

          ServerHandler.connectionStream = new Rx.Subject();
          sh = new ServerHandler(['http://api.hyphe.me/', 'rest',
            'resource'
          ], {
            serverKey: 'id',
            modelName: 'test'
          });

          pushList = [];

          cb({
            ServerHandler: ServerHandler,
            mocks: mocks
          });
        });
      }

      describe('connection', function() {

        it('should set connection state to true', function(done) {
          testInContext(function(deps) {
            spyOn(sh, 'pushAll').and.stub();
            expect(sh._connected).toBeFalsy();
            expect(sh.pushAll).not.toHaveBeenCalled();
            sh.setConnectionState(true);
            expect(sh._protocol.connect.calls.count()).toBe(2);

            // Test if already connected
            sh._connected = true;
            sh.setConnectionState(true);
            expect(sh._protocol.connect.calls.count()).toBe(2);

            done();
          });
        });

        it('should set connection state to false', function(done) {
          testInContext(function(deps) {
            sh._connected = true;
            spyOn(sh, 'pushAll').and.stub();
            expect(sh._connected).toBeTruthy();
            expect(sh.pushAll).not.toHaveBeenCalled();
            sh.setConnectionState(false);
            expect(sh._protocol.connect.calls.count()).toBe(1);
            expect(sh._protocol.disconnect.calls.count()).toBe(1);
            expect(sh.pushAll).not.toHaveBeenCalled();

            done();
          });
        });

      });

      describe('streams', function() {

        it(
          'should push items to a not connected stream and put them to the unpushedList',
          function(done) {
            testInContext(function(deps) {
              sh._connected = false;

              sh.upStream.subscribe(function(item) {
                pushList.push(item);
              });

              scheduler.scheduleWithAbsolute(1, function() {
                sh.upStream.onNext({
                  data: {
                    name: 'Frank Underwood'
                  },
                  meta: {
                    rtId: 152
                  }
                });
                sh.upStream.onNext({
                  data: {
                    name: 'Walter White'
                  },
                  meta: {
                    rtId: 415
                  }
                });
              });

              scheduler.scheduleWithAbsolute(10, function() {
                sh.upStream.onNext({
                  data: {
                    name: 'Don Draper'
                  },
                  meta: {
                    rtId: 387
                  }
                });
                sh.upStream.onNext({
                  data: {
                    name: 'Jack Sheppard'
                  },
                  meta: {
                    rtId: 18
                  }
                });
              });

              scheduler.start();

              expect(sh._unpushedList).toContainKeys([152, 415,
                387, 18
              ]);
              expect(deps.mocks.mocks[
                'ServerHandler/httpHandler'].push).not.toHaveBeenCalled();

              done();
            });
          });

        it(
          'should push items to a connected stream and call the push method of the implementation',
          function(done) {
            testInContext(function(deps) {
              sh._connected = true;
              sh._protocol = deps.mocks.mocks[
                'ServerHandler/httpHandler'];

              scheduler.scheduleWithAbsolute(1, function() {
                sh.upStream.onNext({
                  data: {
                    name: 'Frank Underwood'
                  },
                  meta: {
                    rtId: 152
                  }
                });
                sh.upStream.onNext({
                  data: {
                    name: 'Walter White'
                  },
                  meta: {
                    rtId: 415
                  }
                });
              });

              scheduler.scheduleWithAbsolute(10, function() {
                sh.upStream.onNext({
                  data: {
                    name: 'Don Draper'
                  },
                  meta: {
                    rtId: 387
                  }
                });
                sh.upStream.onNext({
                  data: {
                    name: 'Jack Sheppard'
                  },
                  meta: {
                    rtId: 18
                  }
                });
              });

              scheduler.start();

              expect(sh._unpushedList).not.toContainKeys([152,
                415,
                387, 18
              ]);

              expect(deps.mocks.mocks[
                  'ServerHandler/httpHandler'].push.calls.count())
                .toBe(
                  4);
              expect(pushList[0].meta.rtId).toBe(152);
              expect(pushList[1].meta.rtId).toBe(415);
              expect(pushList[2].meta.rtId).toBe(387);
              expect(pushList[3].meta.rtId).toBe(18);

              done();
            });
          });

        it(
          'should set the connection state through the global stream',
          function(done) {
            testInContext(function(deps) {
              var stateList = [];
              var connectionState = false;

              spyOn(sh, 'setConnectionState').and.callFake(
                function(
                  state) {
                  connectionState = state;
                });

              sh.connectionStream.subscribe(function(state) {
                stateList.push(state);
              });

              scheduler.scheduleWithAbsolute(5, function() {
                deps.ServerHandler.connectionStream.onNext(
                  true);
              });

              scheduler.scheduleWithAbsolute(10, function() {
                deps.ServerHandler.connectionStream.onNext(
                  false);
              });

              scheduler.scheduleWithAbsolute(15, function() {
                deps.ServerHandler.connectionStream.onNext(
                  true);
              });

              expect(connectionState).toBeFalsy();

              scheduler.start();

              expect(stateList).toEqual([true, false, true]);
              expect(connectionState).toBeTruthy();

              done();
            });
          });

        it(
          'should set the connection state through the connection stream of the handler instance',
          function(done) {
            testInContext(function(deps) {
              var stateList = [];
              var connectionState = false;

              spyOn(sh, 'setConnectionState').and.callFake(
                function(
                  state) {
                  connectionState = state;
                });

              sh.connectionStream.subscribe(function(state) {
                stateList.push(state);
              });

              scheduler.scheduleWithAbsolute(5, function() {
                sh.connectionStream.onNext(true);
              });

              scheduler.scheduleWithAbsolute(10, function() {
                sh.connectionStream.onNext(false);
              });

              scheduler.scheduleWithAbsolute(15, function() {
                sh.connectionStream.onNext(true);
              });

              expect(connectionState).toBeFalsy();

              scheduler.start();

              expect(stateList).toEqual([true, false, true]);
              expect(connectionState).toBeTruthy();

              done();
            });
          });

          it('should pass through errors to the error stream', function(done) {
            testInContext(function(deps) {

              var errorStreamItems = [];
              deps.ServerHandler.errorStream.subscribe(function(error) {
                errorStreamItems.push(error);
              });

              scheduler.scheduleWithAbsolute(5, function() {
                sh.downStream.onError({
                  message: 'this is an urgent error!'
                });
              });

              scheduler.start();

              expect(errorStreamItems.length).toBe(1);
              expect(errorStreamItems[0].message).toBe('this is an urgent error!');

              done();
            });
          });
      });

      describe('protocol', function() {

        it('should be set to http on handler creation', function(done) {
          testInContext(function(deps) {
            expect(deps.ServerHandler.prototype._setProtocol)
              .toHaveBeenCalled();
            expect(deps.mocks.mocks[
              'ServerHandler/httpHandler'].connect).toHaveBeenCalled();
            expect(sh._protocol).toBe(deps.mocks.mocks[
              'ServerHandler/httpHandler']);

            done();
          });
        });

        it('should be set to websocket on handler creation', function(
          done) {
          testInContext(function(deps) {
            sh = new deps.ServerHandler(
              ['http://api.hyphe.me', 'rest', 'resource'], {
                protocol: 'websocket'
              });
            expect(deps.ServerHandler.prototype._setProtocol)
              .toHaveBeenCalled();
            expect(deps.mocks.mocks[
              'ServerHandler/socketHandler'].connect).toHaveBeenCalled();
            expect(sh._protocol).toBe(deps.mocks.mocks[
              'ServerHandler/socketHandler']);

            done();
          });
        });

        it('should be set to http from http', function(done) {
          testInContext(function(deps) {
            sh._protocol = deps.mocks.mocks[
              'ServerHandler/httpHandler'];
            expect(deps.mocks.mocks[
                'ServerHandler/httpHandler'].connect.calls.count())
              .toBe(1);
            expect(deps.mocks.mocks[
                  'ServerHandler/httpHandler'].disconnect.calls
                .count())
              .toBe(0);
            expect(sh._protocol).toBe(deps.mocks.mocks[
              'ServerHandler/httpHandler']);

            sh._setProtocol('http');

            expect(deps.mocks.mocks[
                'ServerHandler/httpHandler'].connect.calls.count())
              .toBe(1);
            expect(deps.mocks.mocks[
                  'ServerHandler/httpHandler'].disconnect.calls
                .count())
              .toBe(0);
            expect(deps.mocks.mocks[
                  'ServerHandler/socketHandler'].connect.calls
                .count())
              .toBe(0);
            expect(deps.mocks.mocks[
                  'ServerHandler/socketHandler'].disconnect.calls
                .count())
              .toBe(0);
            expect(sh._protocol).toBe(deps.mocks.mocks[
              'ServerHandler/httpHandler']);

            done();
          });
        });

        it('should be set to websocket from http', function(done) {
          testInContext(function(deps) {
            sh._protocol = deps.mocks.mocks[
              'ServerHandler/httpHandler'];
            expect(deps.mocks.mocks[
                'ServerHandler/httpHandler'].connect.calls.count())
              .toBe(1);
            expect(deps.mocks.mocks[
                  'ServerHandler/httpHandler'].disconnect.calls
                .count())
              .toBe(0);
            expect(deps.mocks.mocks[
                  'ServerHandler/socketHandler'].connect.calls
                .count())
              .toBe(0);
            expect(deps.mocks.mocks[
                  'ServerHandler/socketHandler'].disconnect.calls
                .count())
              .toBe(0);
            expect(sh._protocol).toBe(deps.mocks.mocks[
              'ServerHandler/httpHandler']);

            sh._setProtocol('websocket');

            expect(deps.mocks.mocks[
                'ServerHandler/httpHandler'].connect.calls.count())
              .toBe(1);
            expect(deps.mocks.mocks[
                  'ServerHandler/httpHandler'].disconnect.calls
                .count())
              .toBe(1);
            expect(deps.mocks.mocks[
                  'ServerHandler/socketHandler'].connect.calls
                .count())
              .toBe(1);
            expect(deps.mocks.mocks[
                  'ServerHandler/socketHandler'].disconnect.calls
                .count())
              .toBe(0);
            expect(sh._protocol).toBe(deps.mocks.mocks[
              'ServerHandler/socketHandler']);

            done();
          });
        });

        it('should be set to http from websocket', function(done) {
          testInContext(function(deps) {
            sh._protocol = deps.mocks.mocks[
              'ServerHandler/socketHandler'];
            expect(deps.mocks.mocks[
                'ServerHandler/httpHandler'].connect.calls.count())
              .toBe(1);
            expect(deps.mocks.mocks[
                  'ServerHandler/httpHandler'].disconnect.calls
                .count())
              .toBe(0);
            expect(deps.mocks.mocks[
                  'ServerHandler/socketHandler'].connect.calls
                .count())
              .toBe(0);
            expect(deps.mocks.mocks[
                  'ServerHandler/socketHandler'].disconnect.calls
                .count())
              .toBe(0);
            expect(sh._protocol).toBe(deps.mocks.mocks[
              'ServerHandler/socketHandler']);

            sh._setProtocol('http');

            expect(deps.mocks.mocks[
                'ServerHandler/httpHandler'].connect.calls.count())
              .toBe(2);
            expect(deps.mocks.mocks[
                  'ServerHandler/httpHandler'].disconnect.calls
                .count())
              .toBe(0);
            expect(deps.mocks.mocks[
                  'ServerHandler/socketHandler'].connect.calls
                .count())
              .toBe(0);
            expect(deps.mocks.mocks[
                  'ServerHandler/socketHandler'].disconnect.calls
                .count())
              .toBe(1);
            expect(sh._protocol).toBe(deps.mocks.mocks[
              'ServerHandler/httpHandler']);

            done();
          });
        });

      });

      describe('data', function() {

        it('should be fetched by the protocolHandler', function(done) {
          testInContext(function(deps) {
            sh._protocol = deps.mocks.mocks[
              'ServerHandler/httpHandler'];
            expect(deps.mocks.mocks[
                'ServerHandler/httpHandler'].fetch.calls.count())
              .toBe(
                0);
            sh.fetch();
            expect(deps.mocks.mocks[
                'ServerHandler/httpHandler'].fetch.calls.count())
              .toBe(
                1);
            done();
          });
        });

        it('should be pushed by pushAll function', function(done) {
          testInContext(function(deps) {
            var pushList = [];
            sh._connected = true;
            sh._unpushedList = {
              123: {
                data: {
                  firstName: 'Hans',
                  lastName: 'Wurst'
                },
                meta: {
                  rtId: 123
                }
              },
              315: {
                data: {
                  firstName: 'Peter',
                  lastName: 'Silie'
                },
                meta: {
                  rtId: 315
                }
              },
              483: {
                data: {
                  firstName: 'Kurt',
                  lastName: 'Zehose'
                },
                meta: {
                  rtId: 483
                }
              }
            };

            sh.upStream.subscribe(function(item) {
              pushList.push(item);
            });

            scheduler.scheduleWithAbsolute(1, function() {
              sh.pushAll();
            });

            scheduler.start();

            expect(pushList).toBeArrayOfSize(3);
            expect(pushList[0].data.firstName).toBe('Hans');
            expect(pushList[1].data.firstName).toBe('Peter');
            expect(pushList[2].data.firstName).toBe('Kurt');

            expect(sh._unpushedList).toEqual({});

            done();
          });
        });

        it('should create create a server item with full metadata',
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
              expectedOutputItem.id = 321;
              var outputItem = sh._createServerItem(inputItem);

              expect(outputItem).toEqual(expectedOutputItem);
              expect(outputItem).not.toEqual(inputItem.data);
              expect(outputItem).not.toBe(inputItem.data);

              done();
            });
          });

        it(
          'should create create a server item with one missing metadata',
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

              var outputItem = sh._createServerItem(inputItem);
              expect(outputItem).toEqual(expectedOutputItem);
              expect(outputItem).not.toEqual(inputItem.data);
              expect(outputItem).not.toBe(inputItem.data);

              done();
            });
          });

        it(
          'should create create a server item with whole missing metadata',
          function(done) {
            testInContext(function(deps) {
              var inputItem = {
                data: {
                  firstName: 'John',
                  lastName: 'Doe'
                }
              };

              var expectedOutputItem = _.clone(inputItem.data);

              var outputItem = sh._createServerItem(inputItem);
              expect(outputItem).toEqual(expectedOutputItem);
              expect(outputItem).toEqual(inputItem.data);
              expect(outputItem).not.toBe(inputItem.data);

              done();
            });
          });
      });

      it('should send a http request', function(done) {
        testInContext(function(deps) {
          var returnedValue = sh.sendHttpRequest({
            method: 'GET'
          });

          // Should have called the mock sendRequest of the httpHandler
          expect(returnedValue).toBe('blub');

          done();
        });
      });

      it('should get the last modified value at the beginning', function(done) {
        testInContext(function(deps) {
          mockWebStorage.localStorageContent.harmonized_modified_testo = 123;
          sh = new deps.ServerHandler(['http://hyphe.me', 'testi'], {
            serverKey: 'id',
            modelName: 'testo'
          });

          expect(sh._lastModified).toBe(123);

          done();
        });
      });

      it('should set the last modified value', function(done) {
        testInContext(function(deps) {
          expect(sh._lastModified).toBe(0);

          sh.setLastModified(9001);

          expect(sh._lastModified).toBe(9001);
          expect(mockWebStorage.localStorageContent.harmonized_modified_test).toBe(9001);

          done();
        });
      });

    });
  });
