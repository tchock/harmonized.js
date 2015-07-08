'use strict';

define(['rx', 'rx.testing', 'ServerHandler/httpHandler', 'harmonizedData'],
  function(Rx, RxTest, httpHandler, harmonizedData) {
    describe('HTTP handler', function() {

      var scheduler;

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
            setConnectionState: function(state) {
              sh._connected = state;
            }
          };

          scheduler.scheduleWithAbsolute(5, function() {
            httpHandler.connect(sh);
          });

          expect(sh._connected).toBeFalsy();

          scheduler.start();

          expect(sh._connected).toBeTruthy();
        });

      });

      describe('disconnect function', function() {

        it('should remove the stream connection correctly', function() {
          var sh = {
            downStream: new Rx.Subject(),
            _connected: true,
            setConnectionState: function(state) {
              sh._connected = state;
            }
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
        var receivedOptions;

        beforeEach(function() {
          receivedOptions = null;

          spyOn(harmonizedData, '_httpFunction').and.callFake(
            function(options) {
              receivedOptions = options;
            });

          sh = {
            downStream: new Rx.Subject(),
            _baseUrl: 'http://www.hyphe.me/',
            _resourcePath: 'test/resource/',
            _options: {}
          };
        });

        it('should fetch all data', function() {
          httpHandler.fetch(sh);
          expect(receivedOptions).toEqual({
            method: 'GET',
            url: 'http://www.hyphe.me/test/resource/'
          });
        });

        it('should fetch data with "modified-since header"', function() {
          harmonizedData._config.sendModifiedSince = true;
          sh._lastModified = 1234;

          httpHandler.fetch(sh);

          expect(receivedOptions).toEqual({
            method: 'GET',
            url: 'http://www.hyphe.me/test/resource/',
            headers: {
              'If-Modified-Since': 1234
            }
          });
        });

        it(
          'should fetch all data with missing last-modified info but activated sendLastModified in config',
          function() {
            harmonizedData._config.sendModifiedSince = true;
            sh._lastModified = undefined;

            httpHandler.fetch(sh);

            expect(receivedOptions).toEqual({
              method: 'GET',
              url: 'http://www.hyphe.me/test/resource/'
            });
          });

      });

      describe('push function', function() {

        var sh;
        var receivedOptions;
        var postItem;
        var putItem;
        var deleteItem;

        beforeEach(function() {
          receivedOptions = null;
          spyOn(harmonizedData, '_httpFunction').and.callFake(
            function(options) {
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
                case 'POST':
                  returnedData = _.clone(options.data);
                  break;
                case 'PUT':
                  returnedData = _.clone(options.data);
                  break;
                case 'DELETE':
                  returnedData = '';
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
            });

          sh = {
            downStream: new Rx.Subject(),
            _baseUrl: 'http://www.hyphe.me/',
            _resourcePath: 'test/resource/',
            _options: {},
            _unpushedList: {}
          };
        });

        beforeEach(function() {
          postItem = {
            meta: {
              action: 'save',
              rtId: 12,
              storeId: 11
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
              storeId: 11
            },
            data: {
              name: 'HAL-9000'
            }
          };

          deleteItem = {
            meta: {
              action: 'delete',
              rtId: 12,
              serverId: 4103,
              storeId: 11
            },
            data: {
              name: 'HAL-9000'
            }
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
              name: 'HAL-9000'
            }
          });

          expect(returnedItem).toEqual({
            meta: postItem.meta,
            data: postItem.data
          });
        });

        it('should POST an item with parameters', function() {
          sh._options.params = {
            openPodBayDoor: false,
            iCantDoThatDave: true
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
              name: 'HAL-9000'
            },
            params: {
              openPodBayDoor: false,
              iCantDoThatDave: true
            }
          });

          expect(returnedItem).toEqual({
            meta: postItem.meta,
            data: postItem.data
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
              name: 'HAL-9000'
            }
          });

          expect(returnedItem).toEqual({
            meta: putItem.meta,
            data: putItem.data
          });
        });

        it('should PUT an item with parameter', function() {
          sh._options.params = {
            openPodBayDoor: false,
            iCantDoThatDave: true
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
              name: 'HAL-9000'
            },
            params: {
              openPodBayDoor: false,
              iCantDoThatDave: true
            }
          });

          expect(returnedItem).toEqual({
            meta: putItem.meta,
            data: putItem.data
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
            url: 'http://www.hyphe.me/test/resource/4103/'
          });

          expect(returnedItem).toEqual({
            meta: deleteItem.meta,
            data: deleteItem.data
          });
        });

        it('should DELETE an item with parameter', function() {
          sh._options.params = {
            openPodBayDoor: false,
            iCantDoThatDave: true
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
              iCantDoThatDave: true
            }
          });

          expect(returnedItem).toEqual({
            meta: deleteItem.meta,
            data: deleteItem.data
          });
        });

        it('should fail and add item to the unpushedList', function() {
          sh._options.params = {
            shouldFail: true
          };

          var returnedItem = null;
          var returnedError = null;

          sh.downStream.subscribe(
            function(item) {
              returnedItem = item;
            },

            function(error) {
              returnedError = error;
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
        });

      });

    });
  });
