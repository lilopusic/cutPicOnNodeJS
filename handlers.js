var requestHandlers = require("./requestHandlers");

var handle = {}
handle["/"] = requestHandlers.start;
handle["/start"] = requestHandlers.start;
handle["/upload"] = requestHandlers.upload;
handle["/show"] = requestHandlers.show;
handle["/cutPicDemo"] = requestHandlers.cutPicDemo;
handle["/uploadCutPic"] = requestHandlers.uploadCutPic;

module.exports = handle;