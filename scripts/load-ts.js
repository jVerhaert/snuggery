const jsLoader = require.extensions['.js'];

require('esbuild-register/dist/node').register({
	format: 'cjs',
	target: ['node12'],
});

// remove esbuild-register's javascript loader
require.extensions['.js'] = jsLoader;
