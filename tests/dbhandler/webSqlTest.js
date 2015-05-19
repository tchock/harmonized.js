describe("WebSql Service", function() {

  var mock;
  var WebSql;
  var rootScope, WebSqlService;
  var webStorage;

  function fillStorageWithTestData () {
    mockSQLVersion = '0.0';
    webStorage.add('localDb_meta_test_table', {dbVersion:'0.0'});
    mockSQLStorage = {
      test_db: {
        test_table: [{
          _id: 1,
          id: null,
          content: '{"firstname":"Igor","lastname":"Igorson","_id":1}'
        }, {
          _id: 2,
          id: null,
          content: '{"firstname":"Igor","lastname":"Igorson","_id":2}'
        },
        {
          _id: 3,
          id: null,
          content: '{"firstname":"Igor","lastname":"Igorov","_id":3}'
        }],
        test_table_index_lastname: [{
          id: 1,
          key: 'Igorson',
          value: 1
        }, {
          id: 2,
          key: 'Igorson',
          value: 2
        }, {
          id: 3,
          key: 'Igorov',
          value: 3
        }]
      }
    };

    mockSQLStorageDef = {
      test_db: {
        test_table: [{
          name: '_id',
          type: 'INT',
          size: 255,
          primary: true,
          key: true,
          autoIncrement: true,
          autoIncrementValue: 1
        }, {
          name: 'id',
          type: 'INT',
          size: 255,
          null: true,
          unique: true
        }, {
          name: 'content',
          type: 'TEXT',
          size: -1
        }],
        test_table_index_lastname: [{
          name: 'id',
          type: 'INT',
          size: 255,
          primary: true,
          key: true,
          autoIncrement: true,
          autoIncrementValue: 1
        }, {
          name: 'key',
          type: 'VARCHAR',
          size: 255,
        }, {
          name: 'value',
          type: 'INT',
          size: 255
        }]
      }
    };
  }

  beforeEach(module('angular-localdb', function(localDbProvider) {
    localDbProvider.setStoreDefinitions({
      'test_db': {
        'test_table': {
          _id: {
            isKey: true
          },
          id: {
            isServerKey: true
          },
          lastname: {
            searchable: true
          }
        }
      }
    });
  }));

  beforeEach(function() {
    // Inject services
    inject(function(_WebSqlService_, _localDb_, _$rootScope_, _$q_, _webStorage_) {
      rootScope = _$rootScope_;
      WebSqlService = _WebSqlService_;
      webStorage = _webStorage_;
      _webStorage_.remove('localDb_meta_test_table');
    });

    // Spy on getDbReference() and return mock database
    spyOn(WebSqlService, "getDbReference").and.returnValue(mockOpenDatabase);

    // Reset storage
    mockSQLVersion = null;
    mockSQLStorage = {};
    mockSQLStorageDef = {};
  });



  it('should connect to database', function() {
    // Expected table content
    var expectedTableDef = [{
      name: '_id',
      type: 'INT',
      size: 255,
      primary: true,
      key: true,
      autoIncrement: true,
      autoIncrementValue: 1
    }, {
      name: 'id',
      type: 'INT',
      size: 255,
      null: true,
      unique: true
    }, {
      name: 'content',
      type: 'TEXT',
      size: -1
    }];

    // Expected index table content
    var expectedIndexTableDef = [{
      name: 'id',
      type: 'INT',
      size: 255,
      primary: true,
      key: true,
      autoIncrement: true,
      autoIncrementValue: 1
    }, {
      name: 'key',
      type: 'VARCHAR',
      size: 255,
    }, {
      name: 'value',
      type: 'INT',
      size: 255
    }];

    var service = new WebSqlService('test_db', 'test_table', 0);
    var connected = false;
    // Connect
    service.connect().then(function(db) {
      connected = true;
    });
    // Apply tick for q!
    rootScope.$apply();
    // Check for connection
    expect(connected).toBe(true);
    // Test empty tables
    expect(mockSQLStorage.test_db.test_table).toEqual([]);
    expect(mockSQLStorage.test_db.test_table_index_lastname).toEqual([]);
    // Test Definitions
    expect(mockSQLStorageDef.test_db.test_table).toEqual(expectedTableDef);
    expect(mockSQLStorageDef.test_db.test_table_index_lastname).toEqual(expectedIndexTableDef);
  });



  it('should insert two new entries to the db separately', function(){
    var firstExpectedInput = {
      _id: 1,
      id: null,
      content: '{firstname:Igor,lastname:Igorson,_id:1}'
    };
    var secondExpectedInput = {
      _id: 2,
      id: null,
      content: '{firstname:Igor,lastname:Igorson,_id:2}'
    };

    var service = new WebSqlService('test_db', 'test_table', 0);
    var returnedData;
    service.put({
      firstname: 'Igor',
      lastname: 'Igorson'
    }).then(function(data){
      returnedData = data;
    });
    rootScope.$apply();
    expect(returnedData).toEqual([1]);
    expect(mockSQLStorage.test_db.test_table[0]).toEqual(firstExpectedInput);
    service.put({
      firstname: 'Igor',
      lastname: 'Igorson'
    }).then(function(data){
      returnedData = data;
    });
    rootScope.$apply();
    expect(returnedData).toEqual([2]);
    expect(mockSQLStorage.test_db.test_table[1]).toEqual(secondExpectedInput);
  });



  it('should insert two new entries to the db at once', function(){
    var expectedInput = [{
      _id: 1,
      id: null,
      content: '{firstname:Igor,lastname:Igorson,_id:1}'
    }, {
      _id: 2,
      id: null,
      content: '{firstname:Igor,lastname:Igorson,_id:2}'
    }];

    var service = new WebSqlService('test_db', 'test_table', 0);
    var returnedData;
    service.put([{
      firstname: 'Igor',
      lastname: 'Igorson'
    }, {
      firstname: 'Igor',
      lastname: 'Igorson'
    }]).then(function(data){
      returnedData = data;
    });
    rootScope.$apply();
    expect(returnedData).toEqual([1, 2]);
    expect(mockSQLStorage.test_db.test_table).toEqual(expectedInput);
  });



  it('should update an existing entry', function() {
    var expectedOutput = {
      _id: 2,
      id: null,
      content: '{firstname:Vladimir,lastname:Igorson,_id:2}'
    };
    fillStorageWithTestData();

    var service = new WebSqlService('test_db', 'test_table', 0);

    var returnedData;
    service.put({
      firstname: 'Vladimir',
      lastname: 'Igorson',
      _id: 2
    }).then(function(data){
      returnedData = data;
    });
    // test if existing storage is the same as it was
    expect(mockSQLStorage.test_db.test_table.length).toBe(3);
    // Apply the tick!
    rootScope.$apply();
    // Test returned ID and changed data
    expect(returnedData).toEqual([2]);
    expect(mockSQLStorage.test_db.test_table[1]).toEqual(expectedOutput);
  });



  it('should update two existing entries at once', function() {
    var expectedOutput = [{
      _id: 1,
      id: null,
      content: '{firstname:Olga,lastname:Igorson,_id:1}'
    }, {
      _id: 2,
      id: null,
      content: '{firstname:Dimitri,lastname:Igorson,_id:2}'
    }];

    // set the storage
    fillStorageWithTestData();

    var service = new WebSqlService('test_db', 'test_table', 0);
    var returnedData;
    service.put([{
      firstname: 'Olga',
      lastname: 'Igorson',
      _id: 1
    }, {
      firstname: 'Dimitri',
      lastname: 'Igorson',
      _id: 2
    }]).then(function(data){
      returnedData = data;
    });
    rootScope.$apply();
    expect(returnedData).toEqual([1, 2]);
    expect(mockSQLStorage.test_db.test_table[0]).toEqual(expectedOutput[0]);
    expect(mockSQLStorage.test_db.test_table[1]).toEqual(expectedOutput[1]);
  });



  it('should update an existing entry with an indexed property being an array', function() {
    var expectedOutput = {
      _id: 2,
      id: null,
      content: '{firstname:Vladimir,lastname:[Igorson,Vladimirson],_id:2}'
    };
    fillStorageWithTestData();

    var service = new WebSqlService('test_db', 'test_table', 0);

    var returnedData;
    service.put({
      firstname: 'Vladimir',
      lastname: ['Igorson', 'Vladimirson'],
      _id: 2
    }).then(function(data){
      returnedData = data;
    });
    // test if existing storage is the same as it was
    expect(mockSQLStorage.test_db.test_table.length).toBe(3);
    // Apply the tick!
    rootScope.$apply();
    // Test returned ID and changed data
    expect(returnedData).toEqual([2]);
    expect(mockSQLStorage.test_db.test_table[1]).toEqual(expectedOutput);
    expect(mockSQLStorage.test_db.test_table_index_lastname.length).toBe(4);
    expect(mockSQLStorage.test_db.test_table_index_lastname[2].key).toBe('Igorson');
    expect(mockSQLStorage.test_db.test_table_index_lastname[3].key).toBe('Vladimirson');
  });



  it('should get all entries from a table with 3 entries', function() {
    fillStorageWithTestData();

    var service = new WebSqlService('test_db', 'test_table', 0);
    var returnedData;
    service.getAllEntries().then(function(data){
      returnedData = data;
    });
    rootScope.$apply();
    expect(returnedData.length).toBe(3);
    expect(returnedData[0]._id).toBe(1);
    expect(returnedData[1]._id).toBe(2);
    expect(returnedData[2]._id).toBe(3);
  });



  it('should get all entries from an empty table', function() {
    // No content available
    mockSQLStorage = { test_db: { test_table: [] } };
    var service = new WebSqlService('test_db', 'test_table', 0);
    var returnedData;
    service.getAllEntries().then(function(data){
      returnedData = data;
    });
    rootScope.$apply();
    expect(returnedData).toEqual([]);
  });



  it('should get a single entry', function() {
    fillStorageWithTestData();
    var service = new WebSqlService('test_db', 'test_table', 0);
    var returnedData;
    service.getEntry(2).then(function(data){
      returnedData = data;
    });
    rootScope.$apply();
    expect(returnedData).toEqual(JSON.parse(mockSQLStorage.test_db.test_table[1].content));
  });



  it('should get an undefined single entry', function() {
    fillStorageWithTestData();
    var service = new WebSqlService('test_db', 'test_table', 0);
    var returnedData;
    service.getEntry(4).then(function(data){
      returnedData = data;
    });
    rootScope.$apply();
    expect(mockSQLStorage.test_db.test_table.length).toBe(3);
    expect(returnedData).toEqual(undefined);
  });



  it ('should get several defined entries', function () {
    fillStorageWithTestData();
    var service = new WebSqlService('test_db', 'test_table', 0);
    var returnedData;
    service.getEntriesByIdList([1,3]).then(function(data){
      returnedData = data;
    });
    rootScope.$apply();
    expect(mockSQLStorage.test_db.test_table.length).toBe(3);
    expect(returnedData[0]).toEqual(JSON.parse(mockSQLStorage.test_db.test_table[0].content));
    expect(returnedData[1]).toEqual(JSON.parse(mockSQLStorage.test_db.test_table[2].content));
  });



  it ('should get several entries with an undefined entry', function () {
    fillStorageWithTestData();
    var service = new WebSqlService('test_db', 'test_table', 0);
    var returnedData;
    service.getEntriesByIdList([2,4]).then(function(data){
      returnedData = data;
    });
    rootScope.$apply();
    expect(returnedData[0]).toEqual(JSON.parse(mockSQLStorage.test_db.test_table[1].content));
    expect(returnedData[1]).toEqual(undefined);
  });



  it('should find entries with lastname "Igorson"', function(){
    fillStorageWithTestData();
    var service = new WebSqlService('test_db', 'test_table', 0);
    var returnedData;
    service.searchEntries('lastname', 'Igorson').then(function(data){
      returnedData = data;
    });
    rootScope.$apply();
    expect(returnedData.length).toBe(2);
    expect(returnedData[0]._id).toBe(1);
    expect(returnedData[1]._id).toBe(2);
  });



  it('should find entries with lastname containing "Igor"', function(){
    fillStorageWithTestData();
    var service = new WebSqlService('test_db', 'test_table', 0);
    var returnedData;
    service.searchEntries('lastname', 'Igor', true).then(function(data){
      returnedData = data;
    });
    rootScope.$apply();
    expect(returnedData.length).toBe(3);
    expect(returnedData[0]._id).toBe(1);
    expect(returnedData[1]._id).toBe(2);
    expect(returnedData[2]._id).toBe(3);
  });



  it('should remove the second entry', function(){
    fillStorageWithTestData();
    var service = new WebSqlService('test_db', 'test_table', 0);
    service.remove(2);
    rootScope.$apply();
    expect(mockSQLStorage.test_db.test_table.length).toBe(2);
    expect(mockSQLStorage.test_db.test_table[0]._id).toBe(1);
    expect(mockSQLStorage.test_db.test_table[1]._id).toBe(3);
  });



  it('should add metadata and get it afterwards', function(){
    var service = new WebSqlService('test_db', 'test_table', 0);
    var returnedMetadata = service.setMetadata('hallo', 'welt');
    expect(returnedMetadata).toBeTruthy();

    var metadata = service.getMetadata();
    expect(metadata.hallo).toBe('welt');
  });



  it('should clear the storage', function(){
    fillStorageWithTestData();
    var service = new WebSqlService('test_db', 'test_table', 0);
    service.clearStorage();
    expect(mockSQLStorage.test_db.test_table.length).toBe(3);
    rootScope.$apply();
    expect(mockSQLStorage.test_db.test_table.length).toBe(0);
    expect(mockSQLStorage.test_db.test_table_index_lastname.length).toBe(0);
  });



  it('should delete the storage', function(){
    fillStorageWithTestData();
    var service = new WebSqlService('test_db', 'test_table', 0);
    spyOn(service, 'clearStorage').and.callThrough();
    expect(service.clearStorage.calls.count()).toBe(0);
    service.deleteDb();
    expect(mockSQLStorage.test_db.test_table.length).toBe(3);
    rootScope.$apply();
    expect(service.clearStorage.calls.count()).toBe(1);
    expect(mockSQLStorage.test_db.test_table.length).toBe(0);
    expect(mockSQLStorage.test_db.test_table_index_lastname.length).toBe(0);
  });


});
