'use strict';

define(['Squire', 'rx', 'rx.testing'], function(Squire, Rx, RxTest) {
  describe('ViewCollection', function() {

    var injector;
    var testViewCollection;
    var testModel;
    var scheduler;
    var upStreamItems;
    var downStreamItems;

    var ViewItemMock = function ViewItemMock(parent, data, meta, subData, addToCollection) {
      this.getCollection = function() {
        return parent;
      };

      for (var key in data) {
        this[key] = data[key];
      }

      this._meta = meta;
      this._subData = subData;

      if (addToCollection) {
        parent.push(this);
        parent._items[meta.rtId] = this;
      }

    };

    var ModelMock = function ModelMock(modelName, options) {
      this.downStream = new Rx.Subject();
      this.upStream = new Rx.Subject();
      this._existingItemDownStream = new Rx.Subject();
      this._dbDownStream = new Rx.Subject();

      this._rtIdHash = {};
      this._serverIdHash = {};
      this._storeIdHash = {};

      this._nextRuntimeId = 1;
      this.getNextRuntimeId = function() {
        return this._nextRuntimeId++;
      };

      this.getUrl = function() {
        return 'http://www.test.de/' + modelName;
      };

      this.getItem = function(rtId) {
        return this._rtIdHash[rtId];
      };

      this.getItems = function(itemCb) {
        var hash = this._rtIdHash;
        for (var item in hash) {
          itemCb(hash[item]);
        }
      };

      this.getFromServer = jasmine.createSpy();
    };

    beforeEach(function() {
      // Scheduler to mock the RxJS timing
      scheduler = new RxTest.TestScheduler();
    });

    beforeEach(function() {
      injector = new Squire();
      injector.mock('Model', ModelMock);
      injector.mock('ViewItem', ViewItemMock);
    });

    beforeEach(function() {
      downStreamItems = [];
      upStreamItems = [];
    });

    function testInContext(cb, options) {
      injector.require(['ViewCollection', 'mocks'], function(
        ViewCollection, mocks) {

        testModel = new ModelMock('test');
        testViewCollection = new ViewCollection(testModel);

        cb({
          ViewCollection: ViewCollection,
          mocks: mocks.mocks
        });
      });
    }

    it('should add all existing model items at the start', function(
      done) {
      testInContext(function(deps) {
        // Create the items in the rtIdHash
        testModel._rtIdHash = {
          123: {
            data: {
              name: 'Darth Vader'
            },
            meta: {
              rtId: 123
            }
          },
          124: {
            data: {
              name: 'Luke Skywalker'
            },
            meta: {
              rtId: 124
            }
          },
          125: {
            data: {
              name: 'Han Solo'
            },
            meta: {
              rtId: 125
            }
          }
        };

        // Create a new view collection with the above data
        testViewCollection = new deps.ViewCollection(testModel);

        expect(testViewCollection.length).toBe(3);
        expect(testViewCollection[0].name).toBe('Darth Vader');
        expect(testViewCollection._items[123].name).toBe(
          'Darth Vader');
        expect(testViewCollection[0]._meta.rtId).toBe(123);
        expect(testViewCollection._items[124].name).toBe(
          'Luke Skywalker');
        expect(testViewCollection[1].name).toBe(
          'Luke Skywalker');
        expect(testViewCollection[1]._meta.rtId).toBe(124);
        expect(testViewCollection._items[125].name).toBe(
          'Han Solo');
        expect(testViewCollection[2].name).toBe('Han Solo');
        expect(testViewCollection[2]._meta.rtId).toBe(125);

        done();
      });
    });

    it(
      'should add an existing item from the model to the view collection',
      function(done) {
        testInContext(function(deps) {
          // Create an item after the the collection was initialized
          testModel._rtIdHash = {
            123: {
              data: {
                name: 'Darth Vader'
              },
              meta: {
                rtId: 123
              }
            }
          };

          var newItem = testViewCollection.addItem(123);

          expect(newItem.name).toBe('Darth Vader');
          expect(newItem._meta.rtId).toBe(123);

          expect(testViewCollection.length).toBe(1);
          expect(testViewCollection[0].name).toBe('Darth Vader');
          expect(testViewCollection._items[123].name).toBe(
            'Darth Vader');
          expect(testViewCollection[0]._meta.rtId).toBe(123);

          done();
        });
      });

    it('should create a new view item', function(done) {
      testInContext(function() {
        var newItem = testViewCollection.new();

        expect(newItem instanceof ViewItemMock).toBeTruthy();
        expect(newItem._meta).toEqual({});

        expect(newItem.getCollection()).toBe(testViewCollection);
        expect(testViewCollection.length).toBe(0);

        done();
      });
    });

    it('should create a new view item from downstream', function(done) {
      testInContext(function(deps) {
        testModel._rtIdHash = {
          125: {
            subData: 'hello'
          }
        };

        var newViewItem = new ViewItemMock(testViewCollection, {}, {
          rtId: 123
        }, null);
        testViewCollection._items[123] = newViewItem;
        testViewCollection.push(newViewItem);

        // Add second entry to the server downstream
        scheduler.scheduleWithAbsolute(10, function() {
          testModel.downStream.onNext({
            data: {
              name: 'Han Solo'
            },
            meta: {
              rtId: 125
            }
          });
        });

        scheduler.start();

        expect(testViewCollection.length).toBe(2);
        expect(testViewCollection[1].name).toBe('Han Solo');
        expect(testViewCollection._items[125].name).toBe(
          'Han Solo');
        expect(testViewCollection[1]._meta.rtId).toBe(125);

        expect(testViewCollection[1]._subData).toBe('hello');

        done();
      });
    });

    it('should create a view collection without map functions',
      function(done) {
        testInContext(function() {
          testModel._rtIdHash = {
            123: {
              subData: 'hello'
            },
            125: {
              subData: 'there'
            }
          };

          testViewCollection.downStream.subscribe(function(item) {
            downStreamItems.push(item);
          });

          testModel.upStream.subscribe(function(item) {
            upStreamItems.push(item);
          });

          // Add first entry to the server downstream
          scheduler.scheduleWithAbsolute(1, function() {
            testViewCollection.upStream.onNext({
              data: {
                name: 'Darth Vader'
              },
              meta: {
                rtId: 123
              }
            });
          });

          // Add second entry to the server downstream
          scheduler.scheduleWithAbsolute(10, function() {
            testModel.downStream.onNext({
              data: {
                name: 'Han Solo'
              },
              meta: {
                rtId: 125
              }
            });
          });

          scheduler.start();

          expect(upStreamItems).toEqual([{
            data: {
              name: 'Darth Vader'
            },
            meta: {
              rtId: 123
            }
          }]);

          expect(downStreamItems).toEqual([{
            data: {
              name: 'Han Solo'
            },
            meta: {
              rtId: 125
            }
          }]);

          done();
        });
      });

    it('should create a view collection with map functions', function(
      done) {
      testInContext(function(deps) {
        testViewCollection = new deps.ViewCollection(testModel,
          function(item) {
            var newItem = {};
            newItem.country = item.country;
            newItem.gdp = item.gdp;
            newItem.dept = item.exactDept / item.gdp * 100;
            return newItem;
          },

          function(item) {
            var newItem = {};
            newItem.country = item.country;
            newItem.gdp = item.gdp;
            newItem.exactDept = item.gdp / 100 * item.dept;
            return newItem;
          });

        testModel._rtIdHash = {
          123: {
            subData: 'hello'
          },
          125: {
            subData: 'there'
          }
        };

        testViewCollection.downStream.subscribe(function(item) {
          downStreamItems.push(item);
        });

        testModel.upStream.subscribe(function(item) {
          upStreamItems.push(item);
        });

        // Add first entry to the server downstream
        scheduler.scheduleWithAbsolute(1, function() {
          testViewCollection.upStream.onNext({
            data: {
              country: 'Germany',
              gdp: 3730000000,
              dept: 78.4
            },
            meta: {
              rtId: 123
            }
          });
        });

        // Add second entry to the server downstream
        scheduler.scheduleWithAbsolute(10, function() {
          testModel.downStream.onNext({
            data: {
              country: 'Germany',
              gdp: 3730000000,
              exactDept: 2924320000
            },
            meta: {
              rtId: 125
            }
          });
        });

        scheduler.start();

        expect(upStreamItems).toEqual([{
          data: {
            country: 'Germany',
            gdp: 3730000000,
            exactDept: 2924320000
          },
          meta: {
            rtId: 123
          }
        }]);

        expect(downStreamItems).toEqual([{
          data: {
            country: 'Germany',
            gdp: 3730000000,
            dept: 78.4
          },
          meta: {
            rtId: 125
          }
        }]);

        done();
      });
    });

    it('should should fetch data from the server', function(done) {
      testInContext(function() {
        testViewCollection.fetch();

        expect(testViewCollection._model.getFromServer.calls.count()).toBe(1);        
        done();
      });
    });
  });
});
