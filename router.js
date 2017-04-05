var fs = require("fs");
function route(handle, pathname, response, request) {
  console.log("About to route a request for " + pathname);
  if (typeof handle[pathname] === 'function') {
    handle[pathname](response, request);
  } else {
    //静态文件
    var filename = pathname.substring(1);
    var type;
    switch (filename.substring(filename.lastIndexOf('.') + 1)) {
      case 'html':
      case 'htm': type = 'text/html; charset=UTF-8'; break;
      case 'js': type = 'application/javascript; charset=UTF-8'; break;
      case 'css': type = 'text/css; charset=UTF-8'; break;
      case 'txt': type = 'text/plain; charset=UTF-8'; break;
      case 'manifest': type = 'text/cache-manifest; charset=UTF-8'; break;
      default: type = 'application/octet-stream'; break;
    }
    fs.readFile(`${__dirname}/view/${filename}`, function (err, content) {
      if (err) {
        response.writeHead(404, {
          'Content-Type': 'text/plain; charset=UTF-8'
        });
        response.write(err.message);
        response.end();
      } else {
        response.writeHead(200, { 'Content-Type': type });
        response.write(content);
        response.end();
      }
    });
  }
}

module.exports = {
  route: route
}