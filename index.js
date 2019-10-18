var argv = require('minimist')(process.argv.slice(2), {
  string: ['command', 'token', 'api'],
  number: ['source', 'target'],
  default: {
  	api: 'https://api.storyblok.com/v1'
  }
})

var sync = require('./src/sync')
sync.handler({options: argv})