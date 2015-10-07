'use strict';

define(['rx', 'rx.testing', 'ServerHandler/httpHandler', 'harmonizedData'],
  function(Rx, RxTest, httpHandler, harmonizedData) {
    describe('HTTP handler', function() {

      var scheduler;
      var receivedOptions;

      var fakeHttpFn = function(options) {
        receivedOptions = options;
        var returnedPromise = {

          then: function(fn) {
            returnedPromise.thenFn = fn;
            return returnedPromise;
          },

          catch: function(fn) {
            returnedPromise.catchFn = fn;
            return returnedPromise;
          }
        };
        var returnedData = {};

        switch (options.method) {
          case 'GET':
            returnedData = {
              header: {
                lastModified: 1234
              },
              data: [
                123, 124, 125
              ]
            };
            break;
          case 'POST':
            returnedData = {
              data: _.cloneDeep(options.data)
            };
            break;
          case 'PUT':
            returnedData = {
              data: _.cloneDeep(options.data)
            };
            break;
          case 'DELETE':
            returnedData = {
              data: null
            };
            break;
        }

        setTimeout(function() {
          if (_.isObject(options.params) && options.params
            .shouldFail === true) {
            returnedPromise.catchFn({
              status: 500
            });
          } else {
            returnedPromise.thenFn(returnedData);
          }
        }, 10);

        return returnedPromise;
      };

      beforeEach(function() {
        // Scheduler to mock the RxJS timing
        scheduler = new RxTest.TestScheduler();
      });

      beforeEach(function() {
        jasmine.clock().install();
      });

      afterEach(function() {
        jasmine.clock().uninstall();
      });

      describe('connect function', function() {

        it('should set the connection state to true', function() {
          var sh = {
            downStream: new Rx.Subject(),
            _downStreamSubscribe: null,
            _connected: false,
            _createServerItem: jasmine.createSpy().and.callFake(function(item) {
              return item.data;
            }),
            setConnectionState: function(state) {
              sh._connected = state;
            },
            pushAll: jasmine.createSpy()
          };

          scheduler.scheduleWithAbsolute(5, function() {
            httpHandler.connect(sh);
          });

          expect(sh._connected).toBeFalsy();
          expect(sh.pushAll.calls.count()).toBe(0);

          scheduler.start();

          expect(sh._connected).toBeTruthy();
          expect(sh.pushAll.calls.count()).toBe(1);
        });

      });

      describe('disconnect function', function() {

        it('should remove the stream connection correctly', function() {
          var sh = {
            downStream: new Rx.Subject(),
            _connected: true,
            setConnectionState: function(state) {
              sh._connected = state;
            },
            _createServerItem: jasmine.createSpy().and.callFake(function(item) {
              return item.data;
            })
          };

          scheduler.scheduleWithAbsolute(5, function() {
            httpHandler.disconnect(sh);
          });

          expect(sh._connected).toBeTruthy();

          scheduler.start();

          expect(sh._connected).toBeFalsy();
        });

      });

      describe('fetch function', function() {
        var sh;

        beforeEach(function() {
          receivedOptions = null;

          spyOn(harmonizedData, '_httpFunction').and.callFake(fakeHttpFn);

          sh = {
            downStream: new Rx.Subject(),
            _fullUrl: 'http://www.hyphe.me/test/resource/',
            _options: {},
            _keys: {},
            _createServerItem: jasmine.createSpy().and.callFake(function(item) {
              return item.data;
            })
          };
        });

        it('should fetch all data', function() {
          var fetchedItems = [];
          sh.downStream.subscribe(function(item) {
            fetchedItems.push(item);
          });

          var calledCb = false;
          httpHandler.fetch(sh, function() {
            calledCb = true;
          });
          expect(receivedOptions).toEqual({
            method: 'GET',
            url: 'http://www.hyphe.me/test/resource/'
          });
          expect(harmonizedData._httpFunction.calls.count()).toBe(1);

          jasmine.clock().tick(11);

          scheduler.start();

          expect(fetchedItems.length).toBe(3);
          expect(fetchedItems[0].data).toBe(123);
          expect(fetchedItems[1].data).toBe(124);
          expect(fetchedItems[2].data).toBe(125);
          expect(calledCb).toBeTruthy();
        });

        it('should fetch data with "modified-since header"', function() {
          sh._options.sendModifiedSince = true;
          sh._lastModified = 1234;

          httpHandler.fetch(sh);

          expect(receivedOptions).toEqual({
            method: 'GET',
            url: 'http://www.hyphe.me/test/resource/',
            headers: {
              'If-Modified-Since': 1234,
            },
          });

          jasmine.clock().tick(11);
        });

        it(
          'should fetch all data with missing last-modified info but activated sendLastModified in config',
          function() {
            harmonizedData._config.sendModifiedSince = true;
            sh._lastModified = undefined;

            httpHandler.fetch(sh);

            expect(receivedOptions).toEqual({
              method: 'GET',
              url: 'http://www.hyphe.me/test/resource/',
            });
          });

        it('should fail at fetching data', function() {
          var fetchedItems = [];
          var fetchedErrors = [];

          sh._broadcastError = jasmine.createSpy().and.callFake(function(err) {
            fetchedErrors.push(err);
          });

          sh.downStream.subscribe(function(item) {
            fetchedItems.push(item);
          });

          sh._options.params = {
            shouldFail: true,
          };

          httpHandler.fetch(sh);

          jasmine.clock().tick(11);
          scheduler.start();

          expect(fetchedItems.length).toBe(0);
          expect(fetchedErrors.length).toBe(1);
          expect(fetchedErrors[0].status).toBe(500);
        });

      });

      describe('push function', function() {

        var sh;
        var postItem;
        var putItem;
        var deleteItem;

        beforeEach(function() {
          receivedOptions = null;
          spyOn(harmonizedData, '_httpFunction').and.callFake(fakeHttpFn);

          sh = {
            downStream: new Rx.Subject(),
            _fullUrl: 'http://www.hyphe.me/test/resource/',
            _options: {},
            _keys: {},
            _unpushedList: {},
            _createServerItem: jasmine.createSpy().and.callFake(function(item) {
              return item.data;
            }),
          };
        });

        beforeEach(function() {
          postItem = {
            meta: {
              action: 'save',
              rtId: 12,
              storeId: 11,
            },
            data: {
              name: 'HAL-9000'
            }
          };

          putItem = {
            meta: {
              action: 'save',
              rtId: 12,
              serverId: 4103,
              storeId: 11,
            },
            data: {
              name: 'HAL-9000',
            }
          };

          deleteItem = {
            meta: {
              action: 'delete',
              rtId: 12,
              serverId: 4103,
              storeId: 11,
            },
            data: {
              name: 'HAL-9000',
            },
          };
        });

        it('should POST an item', function() {
          var returnedItem = null;

          sh.downStream.subscribe(function(item) {
            returnedItem = item;
          });

          scheduler.scheduleWithAbsolute(5, function() {
            httpHandler.push(postItem, sh);
            expect(returnedItem).toBeNull();
            jasmine.clock().tick(10);
          });

          scheduler.start();

          expect(receivedOptions).toEqual({
            method: 'POST',
            url: 'http://www.hyphe.me/test/resource/',
            data: {
              name: 'HAL-9000',
            }
          });

          expect(returnedItem).toEqual({
            meta: postItem.meta,
            data: postItem.data,
          });
        });

        it('should POST an item with parameters', function() {
          sh._options.params = {
            openPodBayDoor: false,
            iCantDoThatDave: true,
          };

          var returnedItem = null;

          sh.downStream.subscribe(function(item) {
            returnedItem = item;
          });

          scheduler.scheduleWithAbsolute(5, function() {
            httpHandler.push(postItem, sh);
            expect(returnedItem).toBeNull();
            jasmine.clock().tick(10);
          });

          scheduler.start();

          expect(receivedOptions).toEqual({
            method: 'POST',
            url: 'http://www.hyphe.me/test/resource/',
            data: {
              name: 'HAL-9000',
            },
            params: {
              openPodBayDoor: false,
              iCantDoThatDave: true,
            }
          });

          expect(returnedItem).toEqual({
            meta: postItem.meta,
            data: postItem.data,
          });
        });

        it('should PUT an item', function() {
          var returnedItem = null;

          sh.downStream.subscribe(function(item) {
            returnedItem = item;
          });

          scheduler.scheduleWithAbsolute(5, function() {
            httpHandler.push(putItem, sh);
            expect(returnedItem).toBeNull();
            jasmine.clock().tick(10);
          });

          scheduler.start();

          expect(receivedOptions).toEqual({
            method: 'PUT',
            url: 'http://www.hyphe.me/test/resource/4103/',
            data: {
              name: 'HAL-9000',
            },
          });

          expect(returnedItem).toEqual({
            meta: putItem.meta,
            data: putItem.data,
          });
        });

        it('should PUT an item with parameter', function() {
          sh._options.params = {
            openPodBayDoor: false,
            iCantDoThatDave: true,
          };

          var returnedItem = null;

          sh.downStream.subscribe(function(item) {
            returnedItem = item;
          });

          scheduler.scheduleWithAbsolute(5, function() {
            httpHandler.push(putItem, sh);
            expect(returnedItem).toBeNull();
            jasmine.clock().tick(10);
          });

          scheduler.start();

          expect(receivedOptions).toEqual({
            method: 'PUT',
            url: 'http://www.hyphe.me/test/resource/4103/',
            data: {
              name: 'HAL-9000',
            },
            params: {
              openPodBayDoor: false,
              iCantDoThatDave: true,
            }
          });

          expect(returnedItem).toEqual({
            meta: putItem.meta,
            data: putItem.data,
          });
        });

        it('should DELETE an item', function() {
          var returnedItem = null;

          sh.downStream.subscribe(function(item) {
            returnedItem = item;
          });

          scheduler.scheduleWithAbsolute(5, function() {
            httpHandler.push(deleteItem, sh);
            expect(returnedItem).toBeNull();
            jasmine.clock().tick(10);
          });

          scheduler.start();

          expect(receivedOptions).toEqual({
            method: 'DELETE',
            url: 'http://www.hyphe.me/test/resource/4103/',
          });

          expect(returnedItem).toEqual({
            meta: deleteItem.meta,
            data: deleteItem.data,
          });
        });

        it('should DELETE an item with parameter', function() {
          sh._options.params = {
            openPodBayDoor: false,
            iCantDoThatDave: true,
          };

          var returnedItem = null;

          sh.downStream.subscribe(function(item) {
            returnedItem = item;
          });

          scheduler.scheduleWithAbsolute(5, function() {
            httpHandler.push(deleteItem, sh);
            expect(returnedItem).toBeNull();
            jasmine.clock().tick(10);
          });

          scheduler.start();

          expect(receivedOptions).toEqual({
            method: 'DELETE',
            url: 'http://www.hyphe.me/test/resource/4103/',
            params: {
              openPodBayDoor: false,
              iCantDoThatDave: true,
            },
          });

          expect(returnedItem).toEqual({
            meta: {
              action: 'deletePermanently',
              rtId: 12,
              serverId: 4103,
              storeId: 11,
              deleted: true,
            },
            data: deleteItem.data,
          });
        });

        it('should fail and add item to the unpushedList', function() {
          sh._options.params = {
            shouldFail: true,
          };

          var returnedItem = null;
          var returnedError = null;

          sh._broadcastError = jasmine.createSpy().and.callFake(function(err) {
            returnedError = err;
          });

          sh.downStream.subscribe(
            function(item) {
              returnedItem = item;
            });

          scheduler.scheduleWithAbsolute(5, function() {
            httpHandler.push(postItem, sh);
            expect(returnedItem).toBeNull();
            jasmine.clock().tick(10);
          });

          scheduler.start();

          expect(returnedItem).toBe(null);
          expect(returnedError.status).toBe(500);
          expect(sh._unpushedList[12]).toEqual(postItem);

          expect(sh._broadcastError.calls.count()).toBe(1);
        });

        it('should send a collection function to the server', function() {
          var returnedItem = null;

          sh.downStream.subscribe(function(item) {
            returnedItem = item;
          });

          scheduler.scheduleWithAbsolute(5, function() {
            httpHandler.push({
              meta: {
                action: 'function',
              },
              data: {
                fnName: 'testfn',
                fnArgs: {
                  value: true,
                },
              },
            }, sh);
            expect(returnedItem).toBeNull();
            jasmine.clock().tick(10);
          });

          scheduler.start();

          expect(receivedOptions).toEqual({
            method: 'POST',
            url: 'http://www.hyphe.me/test/resource/testfn/',
            data: {
              value: true,
            },
          });

          expect(returnedItem).toEqual({
            meta: {
              action: 'function',
            },
            data: {
              fnName: 'testfn',
              fnArgs: {
                value: true,
              },
              fnReturn: {
                value: true,
              },
            },
          });
        });

        it('should send a item function to the server', function() {
          var returnedItem = null;

          sh.downStream.subscribe(function(item) {
            returnedItem = item;
          });

          scheduler.scheduleWithAbsolute(5, function() {
            httpHandler.push({
              meta: {
                serverId: 123,
                rtId: 2,
                action: 'function',
              },
              data: {
                fnName: 'carbonize',
                fnArgs: {
                  place: 'Bespin',
                },
              },
            }, sh);
            expect(returnedItem).toBeNull();
            jasmine.clock().tick(10);
          });

          scheduler.start();

          expect(receivedOptions).toEqual({
            method: 'POST',
            url: 'http://www.hyphe.me/test/resource/123/carbonize/',
            data: {
              place: 'Bespin',
            },
          });

          expect(returnedItem).toEqual({
            meta: {
              serverId: 123,
              rtId: 2,
              action: 'function',
            },
            data: {
              fnName: 'carbonize',
              fnArgs: {
                place: 'Bespin',
              },
              fnReturn: {
                place: 'Bespin',
              },
            },
          });
        });

      });

      it('should send a custom request', function() {
        spyOn(harmonizedData, '_httpFunction').and.callFake(fakeHttpFn);
        var sh = {
          downStream: new Rx.Subject(),
          _downStreamSubscribe: null,
          _connected: false,
          _fullUrl: 'http://hyphe.me/blub',
        };

        var insertedOptions = {
          blub: 'blib',
        };

        httpHandler.sendRequest(insertedOptions, sh);

        expect(receivedOptions).toEqual({
          method: 'GET',
          url: 'http://hyphe.me/blub',
          blub: 'blib',
        });

        httpHandler.sendRequest({
          method: 'POST',
          hello: 'dave',
        }, sh);

        expect(receivedOptions).toEqual({
          method: 'POST',
          url: 'http://hyphe.me/blub',
          hello: 'dave',
        });
      });

    });
  });
