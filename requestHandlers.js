var querystring = require("querystring"),
  fs = require("fs"),
  formidable = require("formidable"),
  uuidV4 = require("uuid/v4"),
  Sequelize = require("sequelize");

//建立与数据库链接
var sequelize = new Sequelize('mysql://root:yanghan123@127.0.0.1:3306/cutPic');
var CutPic = sequelize.define('upload_pic', {
  'uuid': Sequelize.STRING,
  'path': Sequelize.STRING,
  'type': Sequelize.STRING
}, {
  timestamps: false
});

function start(response) {
  var body = '<html>' +
    '<head>' +
    '<meta http-equiv="Content-Type" content="text/html; ' +
    'charset=UTF-8" />' +
    '</head>' +
    '<body>' +
    '<form action="/upload" enctype="multipart/form-data" ' +
    'method="post">' +
    '<input type="file" name="upload" multiple="multiple">' +
    '<input type="submit" value="Upload file" />' +
    '</form>' +
    '</body>' +
    '</html>';

  response.writeHead(200, {
    "Content-Type": "text/html"
  });
  response.write(body);
  response.end();
}

function upload(response, request) {
  var form = new formidable.IncomingForm();
  form.uploadDir = ".";
  console.log("about to parse");
  form.parse(request, function (error, fields, files) {
    console.log("parsing done");
    fs.renameSync(files.upload.path, "tmp/test.png");
    response.writeHead(200, {
      "Content-Type": "text/html"
    });
    response.write("received image:<br/>");
    response.write("<img src='/show' />");
    response.end();
  });
}

function show(response) {
  fs.readFile("tmp/test.png", "binary", function (error, file) {
    if (error) {
      response.writeHead(500, {
        "Content-Type": "text/plain"
      });
      response.write(error + "\n");
      response.end();
    } else {
      response.writeHead(200, {
        "Content-Type": "image/png"
      });
      response.write(file, "binary");
      response.end();
    }
  });
}

function cutPicDemo(response) {
  fs.createReadStream(`${__dirname}/view/html/demo.html`).pipe(response);
}

function uploadCutPic(response, request) {
  request.setEncoding('utf-8');
  var postData = '';
  // 注册监听, 接收数据块
  request.addListener("data", function (postDataChunk) {
    postData += postDataChunk;
  });
  // 数据接收完毕, 执行回调函数
  request.addListener("end", function () {
    var params = querystring.parse(postData); //解析 HEADER 中的数据
    var picType = params.picType;
    var picInfo = params.info.replace(/^data:image\/png;base64,/, "").replace(/^data:image\/jpeg;base64,/, "");
    var uuid = uuidV4();
    try {
      var stat = fs.statSync("tmp");
    } catch (err) {
      if (stat && stat.isFile) {
        console.log("目录存在");
      } else {
        fs.mkdirSync("tmp");
      }
    }

    //写入数据库
    (async() => {
      try {
        let aCutPic = await CutPic.create({
          uuid: uuid,
          path: 'tmp',
          type: picType
        });
      } catch (err) {
        console.log(`can't connect db.`);
      }

    })();


    fs.writeFileSync(`tmp/${uuid}.${picType}`, picInfo, 'base64', function (err) {
      console.log(err);
    });
    response.end(uuid);
  });
}

function findPicByUUID(response, request) {
  fs.createReadStream(`${__dirname}/view/html/findByUUID.html`).pipe(response);
}

function getImg(response, request) {
  var postData = '';
  // 注册监听, 接收数据块
  request.addListener("data", function (postDataChunk) {
    postData += postDataChunk;
  });
  // 数据接收完毕, 执行回调函数
  request.addListener("end", function () {
    let params = querystring.parse(postData); //解析 HEADER 中的数据
    let uuid = params.UUID;
    (async() => {
      try {
        let cutpic = await CutPic.findOne({
          where: {
            uuid: uuid
          }
        });
        if (cutpic !== null) {
          let path = cutpic.get('path');
          let name = cutpic.get('uuid');
          let type = cutpic.get('type');
          // read binary data
          let bitmap = fs.readFileSync(`${path}/${name}.${type}`);
          // convert binary data to base64 encoded string
          response.end(`data:image/${type};base64,` + new Buffer(bitmap).toString('base64'));
        } else {
          let bitmap = fs.readFileSync(`view/img/notfound.png`);
          response.end(`data:image/png;base64,` + new Buffer(bitmap).toString('base64'));
        }
      } catch (err) {
        console.log(`can't connect db.`);
      }

    })();


  });

}


module.exports = {
  start,
  upload,
  show,
  cutPicDemo,
  uploadCutPic,
  findPicByUUID,
  getImg
}