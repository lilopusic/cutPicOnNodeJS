var server = require("./server");
var router = require("./router");
var handlers = require("./handlers");

server.start(router.route, handlers);