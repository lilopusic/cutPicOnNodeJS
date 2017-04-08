var requestHandlers = require("./requestHandlers");

var handle = {}
handle["/"] = requestHandlers.cutPicDemo;
handle["/start"] = requestHandlers.start;
handle["/upload"] = requestHandlers.upload;
handle["/show"] = requestHandlers.show;
handle["/cutPicDemo"] = requestHandlers.cutPicDemo;
handle["/uploadCutPic"] = requestHandlers.uploadCutPic;
handle["/findPicByUUID"] = requestHandlers.findPicByUUID;

module.exports = handle;