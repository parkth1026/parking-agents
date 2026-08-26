// Vendored entry point for toml-node 4.3.0.
// The runner only uses parse(); keep the upstream module boundary intact so
// the generated interface remains dependency-free.
var parser = require('./lib/parser.cjs');
var compiler = require('./lib/compiler.cjs');

module.exports = {
  parse: function(input, options) {
    var str = input.toString();
    var nodes = parser.parse(str, options);
    return compiler.compile(nodes, str, options);
  }
};
