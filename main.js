require.config({
  // Karma serves files under /base, which is the basePath from your config file
  baseUrl: 'src/',

  deps: ['harmonized'],

  // automatically require this for production build
  insertRequire: ['harmonized'],

  paths: {
    'rx': '../bower_components/rxjs/dist/rx.lite',
    'rx.async': '../bower_components/rxjs/dist/rx.async',
  },

  shim: {
    'lodash': {
      exports: '_'
    }
  },
});
