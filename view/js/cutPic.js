/**
 * Created by hnayan on 2017-3-20.
 */
'use strict'

$(document).ready(function () {

    //一些全局变量
    //是否按下鼠标
    var isDown = false;
    //是否移动鼠标
    var isMove = false;
    //是否正在绘画
    var isDraw = false;
    //是否正在绘制矩形
    var isDrawRect = false;
    //是否正在绘制（椭）圆形
    var isDrawCircle = false;
    //记录是否已经运行截图插件
    var alreadyRun = false;
    //截图区域四个顶点坐标
    var x0, y0, x1, y1;
    //添加矩形用的四个顶点坐标
    var x00, y00, x11, y11;
    //temp用来交换数据
    var temp, tx0, tx1, ty0, ty1;
    //step范围:0~3,分别代表0,90,180,270度
    var step = 0;
    //背景dom
    var bck;
    //遮罩层dom
    var mask;
    //绘制截图框用的承载Context的容器dom
    var c;
    //绘制截图框的Context
    var ctx;
    //绘制截图层的承载Context的容器dom
    var c2;
    //绘制截图层的Context
    var ctxPic;
    //绘制绘画层的承载Context的容器dom
    var paintC;
    //绘制绘画层的Context
    var paintCtx;
    //截图的宽和高，一旦截图完成（松开鼠标），两个值就固定了
    //这两个值是用来操作原图的
    var cutPicWidth, cutPicHeight;
    //目标区域的html,用来还原截图前状态
    var srcHtml;
    //原图
    var image = new Image();
    //截图区域大小
    var wholeWidth, wholeHeight;
    //自定义对象，用来保存画布的信息
    var cutPicCanvas = {
        width: 0,
        height: 0,
        left: 0,
        top: 0,
        zoom: 1,
        isVertical: false,
        isHorizontal: false,
        haveWaterMark: false,
        waterMark: null,
        waterMarkSize: 0,
        waterMarkFontStyle: null,
        waterMarkColor: null,
        isMosaic: false,
        mosaicType: null,
        isReverse: false,
        borderColor: null,
        borderWidth: 1
    };
    //保存绘画图层信息
    var paintCanvasInfo = {
        paintColor: "red",
        paintWidth: 2,
        width: 0,
        height: 0,
        left: 0,
        top: 0,
        zoom: 1,
        isVertical: false,
        isHorizontal: false
    };
    //目前的dom对象
    var currentDom;
    //用户配置项对象
    var options;
    //工具栏的偏移距离
    var toolbarOffset = 200;
    //记录重载的方式,默认simple
    var reloadWay = "simple";
    var uploadFuc = null;

    //入口
    jQuery.fn.cutPic = function (userOptions) {
        //用户自定义配置赋值
        options = userOptions;
        //上传回调函数独立出来
        uploadFuc = userOptions.uploadFunc || function () {
            alert("you have not define a func");
        };
        //获得当前Dom
        currentDom = this.get(0);

        paintCanvasInfo.paintColor = options.paintColor || "red";
        paintCanvasInfo.paintWidth = options.paintWidth || 2;
        reloadWay = options.reloadWay || "simple";
        //绑定点击事件,这里只有一个作用,就是点击之后进入截图
        currentDom.onclick = function () {
            //只有第一次会调用，防止多次调用
            if (!alreadyRun) {
                alreadyRun = !alreadyRun;
                //将目标转换成Canvas
                html2canvas(currentDom, {
                    allowTaint: true,
                    taintTest: false,
                    background: "#ffffff",
                    onrendered: function (canvas) {
                        wholeWidth = $(currentDom).width();
                        wholeHeight = $(currentDom).height();
                        srcHtml = $(currentDom).html();
                        $(currentDom).empty();
                        createContainer(canvas);
                        loadCtx();
                    }
                });
            }
        }
    };

    //造一个id为background的div元素用来装入图片
    //最后构造出的结构应为：
    /*
     backGround(class) --> div {
        mask(class) --> div {
            pic(id),       --> canvas
            paintCanvas(id)--> canvas
        }
        myCanvas(id) -->canvas
     }
     这部分装进原来的目标区域,在此之前原来的目标区域已被清空并被备份到srcHtml中
     */
    var createContainer = function (canvas) {
        //设置原图
        image.src = canvas.toDataURL();
        var width = wholeWidth;
        var height = wholeHeight;
        //背景
        var $backGround = $("<div class='backGround'></div>");
        $backGround.css("background-image", "url(" + image.src + ")");
        $backGround.css("position", "relative");
        $backGround.height(height).width(width);
        //绘画层
        var $paintCanvas = $("<canvas id='paintCanvas'>your browser doesn't support canvas!</canvas>");
        $paintCanvas.css("position", "absolute").css("top", 0).css("left", 0).css("z-index", 0);
        $paintCanvas.attr("height", height).attr("width", width);
        //截图层
        var $pic = $("<canvas id='pic'>your browser doesn't support canvas!</canvas>");
        $pic.css("position", "absolute").css("top", 0).css("left", 0).css("z-index", 10);
        $pic.attr("height", height).attr("width", width);
        //遮罩层
        var $mask = $("<div class='mask'></div>");
        $mask.css("position", "relative").css("display", "none")
            .css("top", 0).css("left", 0).css("background-color", "rgba(0,0,0,0.8)");
        $mask.height(height).width(width);
        $mask.append($pic).append($paintCanvas);
        //截图框层
        var $myCanvas = $("<canvas id='myCanvas'>your browser doesn't support canvas!</canvas>");
        $myCanvas.css("position", "relative").css("cursor", "crosshair")
            .css("top", 0).css("left", 0);
        $myCanvas.attr("height", height).attr("width", width);

        $backGround.append($mask).append($myCanvas);
        //最后加入到源
        $(currentDom).append($backGround);
    };

    //核心函数,用于绑定各种事件,初始化各种值
    var loadCtx = function () {

        //1.初始化各种对象
        initialDomAndContext();
        //2.绑定事件
        bindMouseEvent();
        bindWheelEvent();
    };

    //画出截图
    function playCutPic(x0, y0, x1, y1) {
        c.style.display = "none";
        mask.style.display = "block";
        cutPicWidth = x1 - x0;
        cutPicHeight = y1 - y0;
        var left = (c2.width - cutPicWidth) / 2;
        var top = (c2.height - cutPicHeight) / 2;
        //保存截图信息&&赋初始值
        cutPicCanvas.width = x1 - x0;
        cutPicCanvas.height = y1 - y0;
        cutPicCanvas.left = left;
        cutPicCanvas.top = top;
        cutPicCanvas.isHorizontal = false;
        cutPicCanvas.isVertical = false;
        cutPicCanvas.haveWaterMark = options.haveWaterMark || false;
        cutPicCanvas.waterMark = options.waterMark || null;
        cutPicCanvas.waterMarkSize = options.waterMarkSize || 0;
        cutPicCanvas.waterMarkFontStyle = options.waterMarkFontStyle || "Arial";
        cutPicCanvas.mosaicType = options.mosaicType || null;
        cutPicCanvas.waterMarkColor = options.waterMarkColor || "black";
        cutPicCanvas.borderColor = options.borderColor || "red";
        cutPicCanvas.borderWidth = options.borderWidth || 1;
        cutPicCanvas.zoom = 1;
        step = 0;
        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
            left, top, cutPicWidth, cutPicHeight);
        addWaterMark();
        createToolbar();
    }

    //制作带响应功能工具栏
    function createToolbar() {

        //画出工具栏
        paintToolbar();

        bindEventOnToolbar();


    }

    //绑定事件到工具栏
    function bindEventOnToolbar() {
        //核心代码,响应各种功能
        c2.onclick = function (event) {

            var position = getEventPosition(event);
            var x = position.x, y = position.y;
            //处理取消截图事件
            if (x > 0 && x < 30 && y < (c2.height / 2 + 30 - toolbarOffset) && y > (c2.height / 2 - toolbarOffset)) {
                cancelCutPic();
            }
            //向右旋转
            if (x > 0 && x < 30 && y < (c2.height / 2 + 60 - toolbarOffset) && y > (c2.height / 2 + 30 - toolbarOffset)) {
                rotatePicRight();
            }
            //向左旋转
            if (x > 0 && x < 30 && y < (c2.height / 2 + 90 - toolbarOffset) && y > (c2.height / 2 + 60 - toolbarOffset)) {
                rotatePicLeft();
            }
            //垂直翻转
            if (x > 0 && x < 30 && y < (c2.height / 2 + 120 - toolbarOffset) && y > (c2.height / 2 + 90 - toolbarOffset)) {
                upDownPic();
            }
            //水平翻转
            if (x > 0 && x < 30 && y < (c2.height / 2 + 150 - toolbarOffset) && y > (c2.height / 2 + 120 - toolbarOffset)) {
                leftRightPic();
            }
            //马赛克
            if (x > 0 && x < 30 && y < (c2.height / 2 + 180 - toolbarOffset) && y > (c2.height / 2 + 150 - toolbarOffset)) {
                resolveMosaic();
            }
            //回到原网页
            if (x > 0 && x < 30 && y < (c2.height / 2 + 210 - toolbarOffset) && y > (c2.height / 2 + 180 - toolbarOffset)) {
                backToSource();
            }
            //下载图片
            if (x > 0 && x < 30 && y < (c2.height / 2 + 240 - toolbarOffset) && y > (c2.height / 2 + 210 - toolbarOffset)) {
                downloadPic();
            }
            //涂鸦
            if (x > 0 && x < 30 && y < (c2.height / 2 + 270 - toolbarOffset) && y > (c2.height / 2 + 240 - toolbarOffset)) {
                paintInPaintCanvas();
                isDraw = true;
            }
            //反色
            if (x > 0 && x < 30 && y < (c2.height / 2 + 300 - toolbarOffset) && y > (c2.height / 2 + 270 - toolbarOffset)) {
                reservePic();
            }
            //加边框
            if (x > 0 && x < 30 && y < (c2.height / 2 + 330 - toolbarOffset) && y > (c2.height / 2 + 300 - toolbarOffset)) {
                addBorder();
            }
            //上传
            if (x > 0 && x < 30 && y < (c2.height / 2 + 360 - toolbarOffset) && y > (c2.height / 2 + 330 - toolbarOffset)) {
                var imageData = ctxPic.getImageData(cutPicCanvas.left, cutPicCanvas.top, cutPicCanvas.width, cutPicCanvas.height);
                var downloadCanvas = document.createElement("canvas");
                downloadCanvas.width = cutPicCanvas.width;
                downloadCanvas.height = cutPicCanvas.height;
                var downloadCanvasCtx = downloadCanvas.getContext("2d");
                downloadCanvasCtx.putImageData(imageData, 0, 0);
                uploadFuc(downloadCanvas.toDataURL());
            }
            //添加矩形
            if (x > 0 && x < 30 && y < (c2.height / 2 + 390 - toolbarOffset) && y > (c2.height / 2 + 360 - toolbarOffset)) {
                paintInPaintCanvas();
                isDrawRect = true;
            }
            //添加圆形
            if (x > 0 && x < 30 && y < (c2.height / 2 + 420 - toolbarOffset) && y > (c2.height / 2 + 390 - toolbarOffset)) {
                paintInPaintCanvas();
                isDrawCircle = true;
            }
            //阻止冒泡,避免了被currentDom捕捉到
            event.stopPropagation();

        };
    }

    //取消截图回到截图界面
    function cancelCutPic() {
        ctx.clearRect(0, 0, c.width, c.height);
        ctxPic.clearRect(cutPicCanvas.left - 1, cutPicCanvas.top - 1,
            cutPicCanvas.width + 2, cutPicCanvas.height + 2);
        mask.style.display = "none";
        c.style.display = "block";
        //变量重新初始化
        cutPicCanvas = {};
        cutPicHeight = 0;
        cutPicWidth = 0;
        step = 0;
        //清除绘画的内容
        paintCtx.clearRect(0, 0, paintC.width, paintC.height);
    }

    //顺时针旋转
    function rotatePicRight() {
        step++;
        step > 3 && (step = 0);
        //转化成弧度
        var degree = step * 90 * Math.PI / 180;
        //得到图片的中心坐标
        var xCenter = cutPicCanvas.left + cutPicCanvas.width / 2;
        var yCenter = cutPicCanvas.top + cutPicCanvas.height / 2;
        //清除上次旋转的图片
        ctxPic.clearRect(cutPicCanvas.left - 1, cutPicCanvas.top - 1, cutPicCanvas.width + 2, cutPicCanvas.height + 2);
        switch (step) {
            case 0:
                temp = cutPicCanvas.height;
                cutPicCanvas.height = cutPicCanvas.width;
                cutPicCanvas.width = temp;
                var left = (c2.width - cutPicCanvas.width) / 2;
                var top = (c2.height - cutPicCanvas.height) / 2;
                cutPicCanvas.left = left;
                cutPicCanvas.top = top;
                ctxPic.save();
                ctxPic.translate(xCenter, yCenter);
                ctxPic.rotate(degree);
                if (cutPicCanvas.isVertical) {
                    ctxPic.scale(1, -1);
                }
                if (cutPicCanvas.isHorizontal) {
                    ctxPic.scale(-1, 1);
                }
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
                ctxPic.restore();
                break;
            case 1:
                temp = cutPicCanvas.height;
                cutPicCanvas.height = cutPicCanvas.width;
                cutPicCanvas.width = temp;
                var left = (c2.width - cutPicCanvas.width) / 2;
                var top = (c2.height - cutPicCanvas.height) / 2;
                cutPicCanvas.left = left;
                cutPicCanvas.top = top;
                ctxPic.save();
                ctxPic.translate(xCenter, yCenter);
                ctxPic.rotate(degree);
                if (cutPicCanvas.isVertical) {
                    ctxPic.scale(1, -1);
                }
                if (cutPicCanvas.isHorizontal) {
                    ctxPic.scale(-1, 1);
                }
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
                ctxPic.restore();
                break;
            case 2:
                temp = cutPicCanvas.height;
                cutPicCanvas.height = cutPicCanvas.width;
                cutPicCanvas.width = temp;
                var left = (c2.width - cutPicCanvas.width) / 2;
                var top = (c2.height - cutPicCanvas.height) / 2;
                cutPicCanvas.left = left;
                cutPicCanvas.top = top;
                ctxPic.save();
                ctxPic.translate(xCenter, yCenter);
                ctxPic.rotate(degree);
                if (cutPicCanvas.isVertical) {
                    ctxPic.scale(1, -1);
                }
                if (cutPicCanvas.isHorizontal) {
                    ctxPic.scale(-1, 1);
                }
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
                ctxPic.restore();
                break;
            case 3:
                temp = cutPicCanvas.height;
                cutPicCanvas.height = cutPicCanvas.width;
                cutPicCanvas.width = temp;
                var left = (c2.width - cutPicCanvas.width) / 2;
                var top = (c2.height - cutPicCanvas.height) / 2;
                cutPicCanvas.left = left;
                cutPicCanvas.top = top;
                ctxPic.save();
                ctxPic.translate(xCenter, yCenter);
                ctxPic.rotate(degree);
                if (cutPicCanvas.isVertical) {
                    ctxPic.scale(1, -1);
                }
                if (cutPicCanvas.isHorizontal) {
                    ctxPic.scale(-1, 1);
                }
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
                ctxPic.restore();
                break;

        }
        if (cutPicCanvas.isMosaic) {
            mosaic();
        }
        if (cutPicCanvas.isReverse) {
            reverse();
        }
        addWaterMark();
        paintCtx.clearRect(0, 0, paintC.width, paintC.height);
    }

    //逆时针旋转
    function rotatePicLeft() {
        //得到图片的中心坐标
        var xCenter = cutPicCanvas.left + cutPicCanvas.width / 2;
        var yCenter = cutPicCanvas.top + cutPicCanvas.height / 2;
        step--;
        step < 0 && (step = 3);
        //转化成弧度
        var degree = step * 90 * Math.PI / 180;
        //清除上次旋转的图片
        ctxPic.clearRect(cutPicCanvas.left - 1, cutPicCanvas.top - 1, cutPicCanvas.width + 2, cutPicCanvas.height + 2);
        switch (step) {
            case 0:
                temp = cutPicCanvas.height;
                cutPicCanvas.height = cutPicCanvas.width;
                cutPicCanvas.width = temp;
                var left = (c2.width - cutPicCanvas.width) / 2;
                var top = (c2.height - cutPicCanvas.height) / 2;
                cutPicCanvas.left = left;
                cutPicCanvas.top = top;
                ctxPic.save();
                ctxPic.translate(xCenter, yCenter);
                ctxPic.rotate(degree);
                if (cutPicCanvas.isVertical) {
                    ctxPic.scale(1, -1);
                }
                if (cutPicCanvas.isHorizontal) {
                    ctxPic.scale(-1, 1);
                }
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
                ctxPic.restore();
                break;
            case 1:
                //更新cutPicCanvas状态
                temp = cutPicCanvas.height;
                cutPicCanvas.height = cutPicCanvas.width;
                cutPicCanvas.width = temp;
                var left = (c2.width - cutPicCanvas.width) / 2;
                var top = (c2.height - cutPicCanvas.height) / 2;
                cutPicCanvas.left = left;
                cutPicCanvas.top = top;
                ctxPic.save();
                ctxPic.translate(xCenter, yCenter);
                ctxPic.rotate(degree);
                if (cutPicCanvas.isVertical) {
                    ctxPic.scale(1, -1);
                }
                if (cutPicCanvas.isHorizontal) {
                    ctxPic.scale(-1, 1);
                }
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
                ctxPic.restore();
                break;
            case 2:
                temp = cutPicCanvas.height;
                cutPicCanvas.height = cutPicCanvas.width;
                cutPicCanvas.width = temp;
                var left = (c2.width - cutPicCanvas.width) / 2;
                var top = (c2.height - cutPicCanvas.height) / 2;
                cutPicCanvas.left = left;
                cutPicCanvas.top = top;

                ctxPic.save();
                ctxPic.translate(xCenter, yCenter);
                ctxPic.rotate(degree);
                if (cutPicCanvas.isVertical) {
                    ctxPic.scale(1, -1);
                }
                if (cutPicCanvas.isHorizontal) {
                    ctxPic.scale(-1, 1);
                }
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
                ctxPic.restore();
                break;
            case 3:
                temp = cutPicCanvas.height;
                cutPicCanvas.height = cutPicCanvas.width;
                cutPicCanvas.width = temp;
                var left = (c2.width - cutPicCanvas.width) / 2;
                var top = (c2.height - cutPicCanvas.height) / 2;
                cutPicCanvas.left = left;
                cutPicCanvas.top = top;

                ctxPic.save();
                ctxPic.translate(xCenter, yCenter);
                ctxPic.rotate(degree);
                if (cutPicCanvas.isVertical) {
                    ctxPic.scale(1, -1);
                }
                if (cutPicCanvas.isHorizontal) {
                    ctxPic.scale(-1, 1);
                }

                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
                ctxPic.restore();
                break;
        }
        if (cutPicCanvas.isMosaic) {
            mosaic();
        }
        if (cutPicCanvas.isReverse) {
            reverse();
        }
        addWaterMark();
        paintCtx.clearRect(0, 0, paintC.width, paintC.height);
    }

    //上下翻转图片
    function upDownPic() {
        //得到图片的中心坐标
        var xCenter = cutPicCanvas.left + cutPicCanvas.width / 2;
        var yCenter = cutPicCanvas.top + cutPicCanvas.height / 2;
        ctxPic.clearRect(cutPicCanvas.left - 1, cutPicCanvas.top - 1, cutPicCanvas.width + 2, cutPicCanvas.height + 2);
        if (!cutPicCanvas.isVertical) {
            ctxPic.save();
            ctxPic.translate(xCenter, yCenter);
            ctxPic.scale(1, -1);
            if (cutPicCanvas.isHorizontal) {
                ctxPic.scale(-1, 1);
            }
            ctxPic.rotate(step * 90 * Math.PI / 180);
            if (step == 0 || step == 2) {
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
            }
            if (step == 1 || step == 3) {
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
            }
            ctxPic.restore();
            cutPicCanvas.isVertical = true;
        } else {
            ctxPic.save();
            ctxPic.translate(xCenter, yCenter);
            if (cutPicCanvas.isHorizontal) {
                ctxPic.scale(-1, 1);
            }
            ctxPic.rotate(step * 90 * Math.PI / 180);
            if (step == 0 || step == 2) {
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
            }
            if (step == 1 || step == 3) {
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
            }
            ctxPic.restore();
            cutPicCanvas.isVertical = false;
        }
        if (cutPicCanvas.isMosaic) {
            mosaic();
        }
        if (cutPicCanvas.isReverse) {
            reverse();
        }
        addWaterMark();
        paintCtx.clearRect(0, 0, paintC.width, paintC.height);
    }

    //左右翻转图片
    function leftRightPic() {
        //得到图片的中心坐标
        var xCenter = cutPicCanvas.left + cutPicCanvas.width / 2;
        var yCenter = cutPicCanvas.top + cutPicCanvas.height / 2;
        ctxPic.clearRect(cutPicCanvas.left - 1, cutPicCanvas.top - 1, cutPicCanvas.width + 2, cutPicCanvas.height + 2);
        if (!cutPicCanvas.isHorizontal) {
            ctxPic.save();
            ctxPic.translate(xCenter, yCenter);
            ctxPic.scale(-1, 1);
            if (cutPicCanvas.isVertical) {
                ctxPic.scale(1, -1);
            }
            ctxPic.rotate(step * 90 * Math.PI / 180);
            if (step == 0 || step == 2) {
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
            }
            if (step == 1 || step == 3) {
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
            }
            ctxPic.restore();
            cutPicCanvas.isHorizontal = true;
        } else {
            ctxPic.save();
            ctxPic.translate(xCenter, yCenter);
            if (cutPicCanvas.isVertical) {
                ctxPic.scale(1, -1);
            }
            ctxPic.rotate(step * 90 * Math.PI / 180);
            if (step == 0 || step == 2) {
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
            }
            if (step == 1 || step == 3) {
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
            }
            ctxPic.restore();
            cutPicCanvas.isHorizontal = false;
        }
        if (cutPicCanvas.isMosaic) {
            mosaic();
        }
        if (cutPicCanvas.isReverse) {
            reverse();
        }
        addWaterMark();
        paintCtx.clearRect(0, 0, paintC.width, paintC.height);
    }

    //处理马赛克
    function resolveMosaic() {
        //得到图片的中心坐标
        var xCenter = cutPicCanvas.left + cutPicCanvas.width / 2;
        var yCenter = cutPicCanvas.top + cutPicCanvas.height / 2;
        if (!cutPicCanvas.isMosaic) {
            //没有马赛克就将其马赛克
            mosaic();
            cutPicCanvas.isMosaic = true;
        } else {
            //已经马赛克过了就恢复原状
            ctxPic.clearRect(cutPicCanvas.left - 1, cutPicCanvas.top - 1, cutPicCanvas.width + 2, cutPicCanvas.height + 2);
            ctxPic.save();
            ctxPic.translate(xCenter, yCenter);
            ctxPic.rotate(step * 90 * Math.PI / 180);
            if (cutPicCanvas.isVertical) {
                ctxPic.scale(1, -1);
            }
            if (cutPicCanvas.isHorizontal) {
                ctxPic.scale(-1, 1);
            }
            ctxPic.scale(cutPicCanvas.zoom, cutPicCanvas.zoom);
            if (step == 0 || step == 2) {
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -(cutPicCanvas.width / cutPicCanvas.zoom) / 2, -(cutPicCanvas.height / cutPicCanvas.zoom) / 2,
                    cutPicCanvas.width / cutPicCanvas.zoom, cutPicCanvas.height / cutPicCanvas.zoom);
            }
            if (step == 1 || step == 3) {
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -(cutPicCanvas.height / cutPicCanvas.zoom) / 2, -(cutPicCanvas.width / cutPicCanvas.zoom) / 2,
                    cutPicCanvas.height / cutPicCanvas.zoom, cutPicCanvas.width / cutPicCanvas.zoom);
            }
            ctxPic.restore();
            if (cutPicCanvas.isReverse) {
                reverse();
            }
            cutPicCanvas.isMosaic = false;
        }
        addWaterMark();
        paintCtx.clearRect(0, 0, paintC.width, paintC.height);
    }

    //取消截图并回到原网页
    function backToSource() {
        //返回并重新绑定事件
        switch (reloadWay) {
            case "simple":
                $(currentDom).html(srcHtml);
                alreadyRun = false;
                break;
            case "normal":
                window.location.reload();
        }

    }

    //下载截好的图片
    function downloadPic() {
        var imageData = ctxPic.getImageData(cutPicCanvas.left, cutPicCanvas.top, cutPicCanvas.width, cutPicCanvas.height);
        var downloadCanvas = document.createElement("canvas");
        downloadCanvas.width = cutPicCanvas.width;
        downloadCanvas.height = cutPicCanvas.height;
        var downloadCanvasCtx = downloadCanvas.getContext("2d");
        downloadCanvasCtx.putImageData(imageData, 0, 0);
        downloadURI(downloadCanvas.toDataURL(), "cutPic.png");
        $(downloadCanvas).remove();
    }

    //开始绘画
    function paintInPaintCanvas() {
        //交换两者的z-index
        $("#pic").css("z-index", 0);
        $("#paintCanvas").css("z-index", 10);
    }

    //添加边框
    function addBorder() {
        ctxPic.strokeStyle = cutPicCanvas.borderColor;
        ctxPic.lineWidth = cutPicCanvas.borderWidth;
        ctxPic.strokeRect(cutPicCanvas.left + 1, cutPicCanvas.top + 1, cutPicCanvas.width - 2, cutPicCanvas.height - 2);
    }

    function addWaterMark() {
        if (cutPicCanvas.haveWaterMark) {
            ctxPic.font = cutPicCanvas.waterMarkSize + "px " + cutPicCanvas.waterMarkFontStyle;
            ctxPic.strokeStyle = cutPicCanvas.waterMarkColor;
            ctxPic.strokeText(cutPicCanvas.waterMark, cutPicCanvas.left, cutPicCanvas.top + cutPicCanvas.waterMarkSize);
        }
    }

    //处理反色
    function reservePic() {
        //得到图片的中心坐标
        var xCenter = cutPicCanvas.left + cutPicCanvas.width / 2;
        var yCenter = cutPicCanvas.top + cutPicCanvas.height / 2;
        if (!cutPicCanvas.isReverse) {
            //没有反色就将其反色
            reverse();
            cutPicCanvas.isReverse = true;
        } else {
            //已经反色过了就恢复原状
            ctxPic.clearRect(cutPicCanvas.left - 1, cutPicCanvas.top - 1, cutPicCanvas.width + 2, cutPicCanvas.height + 2);
            ctxPic.save();
            ctxPic.translate(xCenter, yCenter);
            ctxPic.rotate(step * 90 * Math.PI / 180);
            if (cutPicCanvas.isVertical) {
                ctxPic.scale(1, -1);
            }
            if (cutPicCanvas.isHorizontal) {
                ctxPic.scale(-1, 1);
            }
            ctxPic.scale(cutPicCanvas.zoom, cutPicCanvas.zoom);
            if (step == 0 || step == 2) {
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -(cutPicCanvas.width / cutPicCanvas.zoom) / 2, -(cutPicCanvas.height / cutPicCanvas.zoom) / 2,
                    cutPicCanvas.width / cutPicCanvas.zoom, cutPicCanvas.height / cutPicCanvas.zoom);
            }
            if (step == 1 || step == 3) {
                ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                    -(cutPicCanvas.height / cutPicCanvas.zoom) / 2, -(cutPicCanvas.width / cutPicCanvas.zoom) / 2,
                    cutPicCanvas.height / cutPicCanvas.zoom, cutPicCanvas.width / cutPicCanvas.zoom);
            }
            ctxPic.restore();
            if (cutPicCanvas.isMosaic) {
                mosaic();
            }
            cutPicCanvas.isReverse = false;
        }
        addWaterMark();
        paintCtx.clearRect(0, 0, paintC.width, paintC.height);
    }

    //画线（通过两个坐标）
    function drawLine(x1, y1, x2, y2) {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = 'white';
        ctx.stroke();
    }

    function drawLineOnPaintC(x1, y1, x2, y2) {
        paintCtx.beginPath();
        paintCtx.moveTo(x1, y1);
        paintCtx.lineTo(x2, y2);
        paintCtx.stroke();
    }

    //得到相对位置的坐标
    function getEventPosition(event) {
        //获取相对位置
        var e = event || window.event;
        var x = e.offsetX || e.layerX;
        var y = e.offsetY || e.layerY;
        return {
            x: x,
            y: y
        }
    }

    //以下两个算法都是像素的变换，和原图无关
    //马赛克算法
    function mosaic() {
        var imageData = ctxPic.getImageData(cutPicCanvas.left, cutPicCanvas.top, cutPicCanvas.width, cutPicCanvas.height);
        var pixels = imageData.data;
        var numTileRows = 50;
        var numTileCols = 50;
        var tileWidth = cutPicCanvas.width / numTileCols;
        var tileHeight = cutPicCanvas.height / numTileRows;
        for (var r = 0; r < numTileRows; r++) {
            for (var c = 0; c < numTileCols; c++) {
                var tx = (c * tileWidth) + (tileWidth / 2);
                var ty = (r * tileHeight) + (tileHeight / 2);
                var pos = (Math.floor(ty) * (imageData.width * 4)) + (Math.floor(tx) * 4);
                var red = pixels[pos];
                var green = pixels[pos + 1];
                var blue = pixels[pos + 2];
                ctxPic.fillStyle = 'rgb(' + red + ',' + green + ',' + blue + ')';
                if (cutPicCanvas.mosaicType == "circle") {
                    //圆形马赛克
                    ctxPic.beginPath();
                    ctxPic.arc(tx + cutPicCanvas.left, ty + cutPicCanvas.top, tileWidth / 2.5, 0, Math.PI * 2, false);
                    ctxPic.closePath();
                    ctxPic.fill();
                } else {
                    //方形马赛克
                    ctxPic.fillRect(tx - (tileWidth / 2) + cutPicCanvas.left, ty - (tileHeight / 2) + cutPicCanvas.top, tileWidth, tileHeight);
                }
            }

        }
    }

    //反色算法
    function reverse() {
        var imageData = ctxPic.getImageData(cutPicCanvas.left, cutPicCanvas.top, cutPicCanvas.width, cutPicCanvas.height);
        var pixels = imageData.data;
        for (var i = 0, n = pixels.length; i < n; i += 4) {
            pixels[i] = 255 - pixels[i];
            pixels[i + 1] = 255 - pixels[i + 1];
            pixels[i + 2] = 255 - pixels[i + 2];
        }
        ctxPic.putImageData(imageData, cutPicCanvas.left, cutPicCanvas.top);
    }

    //下载到本地
    function downloadURI(uri, name) {
        var link = document.createElement("a");
        link.download = name;
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        $(link).remove();
    }

    //绘图放置在图片上
    function paintOnImage() {
        var paintImage = new Image();
        paintImage.src = document.getElementById("paintCanvas").toDataURL();
        paintImage.onload = function () {
            ctxPic.save();
            ctxPic.globalCompositeOperation = "source-atop";
            ctxPic.drawImage(paintImage, 0, 0);
            ctxPic.restore();
        }
    }

    //画出工具栏
    function paintToolbar() {
        //左侧工具栏用到的图片
        var closeImageObj = new Image();
        var rotateRightImage = new Image();
        var rotateLeftImage = new Image();
        var upDownImage = new Image();
        var leftRightImage = new Image();
        var backImage = new Image();
        var mosaicImage = new Image();
        var downloadImage = new Image();
        var paintImage = new Image();
        var reverseImage = new Image();
        var addBorderImage = new Image();
        var uploadImage = new Image();
        var addRectImage = new Image();
        var addCircleImage = new Image();
        //取消按钮
        closeImageObj.src = "../img/close.png";
        closeImageObj.onload = function () {
            //ctxPic.fillRect(0, c2.height/2 - 120, 30, 30);
            ctxPic.drawImage(closeImageObj, 0, c2.height / 2 - toolbarOffset, 30, 30);
        };

        //顺时针旋转
        rotateRightImage.src = "../img/rotateRight.png";
        rotateRightImage.onload = function () {
            ctxPic.drawImage(rotateRightImage, 0, c2.height / 2 + 30 - toolbarOffset, 30, 30);
        };

        //逆时针旋转
        rotateLeftImage.src = "../img/rotateLeft.png";
        rotateLeftImage.onload = function () {
            //ctxPic.fillRect(0, c2.height/2 + 60 - 120, 30, 30);
            ctxPic.drawImage(rotateLeftImage, 0, c2.height / 2 + 60 - toolbarOffset, 30, 30);
        };

        //垂直翻转
        upDownImage.src = "../img/upDown.png";
        upDownImage.onload = function () {
            //ctxPic.fillRect(0, c2.height/2 + 90 - 120, 30, 30);
            ctxPic.drawImage(upDownImage, 0, c2.height / 2 + 90 - toolbarOffset, 30, 30);
        };

        //水平翻转
        leftRightImage.src = "../img/leftRight.png";
        leftRightImage.onload = function () {
            //ctxPic.fillRect(0, c2.height/2 + 120 - 120, 30, 30);
            ctxPic.drawImage(leftRightImage, 0, c2.height / 2 + 120 - toolbarOffset, 30, 30);
        };

        //一键马赛克
        mosaicImage.src = "../img/mosaic.png";
        mosaicImage.onload = function () {
            ctxPic.drawImage(mosaicImage, 0, c2.height / 2 + 150 - toolbarOffset, 30, 30);
        };

        //回到原来的网页
        backImage.src = "../img/back.png";
        backImage.onload = function () {
            //ctxPic.fillRect(0, c2.height/2 + 150 - 120, 30, 30);
            ctxPic.drawImage(backImage, 0, c2.height / 2 + 180 - toolbarOffset, 30, 30);
        };

        //保存图片
        downloadImage.src = "../img/download.png";
        downloadImage.onload = function () {
            ctxPic.drawImage(downloadImage, 0, c2.height / 2 + 210 - toolbarOffset, 30, 30);
        };

        //涂个鸦？
        paintImage.src = "../img/paint.png";
        paintImage.onload = function () {
            ctxPic.drawImage(paintImage, 0, c2.height / 2 + 240 - toolbarOffset, 30, 30);
        };

        //反个色？
        reverseImage.src = "../img/reverse.png";
        reverseImage.onload = function () {
            ctxPic.drawImage(reverseImage, 0, c2.height / 2 + 270 - toolbarOffset, 30, 30)
        };

        //加个边框？
        addBorderImage.src = "../img/boder.png";
        addBorderImage.onload = function () {
            ctxPic.drawImage(addBorderImage, 0, c2.height / 2 + 300 - toolbarOffset, 30, 30)
        };

        //上传图片
        uploadImage.src = "../img/upload.png";
        uploadImage.onload = function () {
            ctxPic.drawImage(uploadImage, 0, c2.height / 2 + 330 - toolbarOffset, 30, 30)
        };

        //添加矩形
        addRectImage.src = "../img/addRect.png";
        addRectImage.onload = function () {
            ctxPic.drawImage(addRectImage, 0, c2.height / 2 + 360 - toolbarOffset, 30, 30)
        };

        //添加圆形
        addCircleImage.src = "../img/addCircle.png";
        addCircleImage.onload = function () {
            ctxPic.drawImage(addCircleImage, 0, c2.height / 2 + 390 - toolbarOffset, 30, 30)
        }
    }

    //初始化dom,context
    function initialDomAndContext() {
        //一般的Dom元素
        bck = document.getElementsByClassName("backGround")[0];
        mask = document.getElementsByClassName("mask")[0];

        //Canvas元素--用来绘制截图时的矩形框以及绑定鼠标事件
        c = document.getElementById('myCanvas');
        ctx = c.getContext('2d');

        //Canvas元素--用来绘制截下来的图片
        c2 = document.getElementById('pic');
        ctxPic = c2.getContext('2d');

        //用来涂鸦，画矩形的图层
        paintC = document.getElementById("paintCanvas");
        paintCtx = paintC.getContext('2d');
    }

    //绑定鼠标事件
    function bindMouseEvent() {

        //以下三个事件均是用来绘制截图框的
        c.onmousedown = function (event) {
            event = event ? event : window.event;
            isDown = true;
            var position = getEventPosition(event);
            x0 = position.x;
            y0 = position.y;
        };
        c.onmousemove = function (event) {
            event = event ? event : window.event;
            if (isDown) {
                var position = getEventPosition(event);
                ctx.clearRect(0, 0, c.width, c.height);
                isMove = true;
                x1 = position.x;
                y1 = position.y;
                drawLine(x0, y0, x1, y0);  //上
                drawLine(x0, y0, x0, y1);  //左
                drawLine(x1, y1, x1, y0);  //右
                drawLine(x1, y1, x0, y1);  //下
            }
        };
        c.onmouseup = function () {
            if (isDown && isMove) {
                ctx.clearRect(0, 0, c.width, c.height);
                //鼠标释放的时候，画出来的形状是个矩形，保持x0,y0是左上角的坐标，x1,y1是右下角的坐标
                if (x0 > x1) {
                    temp = x0;
                    x0 = x1;
                    x1 = temp;
                }
                if (y0 > y1) {
                    temp = y0;
                    y0 = y1;
                    y1 = temp;
                }
                playCutPic(x0, y0, x1, y1);
            }
            isDown = false;
            isMove = false;
        };

        //以下三个事件函数用来绘画,但是并不响应，只有调用特定函数后开始响应
        //开始绘画
        paintC.onmousedown = function (event) {
            var position = getEventPosition(event);
            var x = position.x, y = position.y;
            if (x > cutPicCanvas.left && x < cutPicCanvas.left + cutPicCanvas.width
                && y > cutPicCanvas.top && y < cutPicCanvas.top + cutPicCanvas.height) {
                paintCtx.lineWidth = paintCanvasInfo.paintWidth;
                paintCtx.strokeStyle = paintCanvasInfo.paintColor;
                isDown = true;
                x00 = x;
                y00 = y;
                if (isDraw) {
                    paintCtx.beginPath();
                    paintCtx.moveTo(x, y);
                }
            }
        };

        //鼠标移动,绘画
        paintC.onmousemove = function (event) {
            var position = getEventPosition(event);
            var x = position.x, y = position.y;
            if (x > cutPicCanvas.left && x < cutPicCanvas.left + cutPicCanvas.width
                && y > cutPicCanvas.top && y < cutPicCanvas.top + cutPicCanvas.height) {
                if (isDraw && isDown) {
                    paintCtx.lineTo(x, y);
                    paintCtx.stroke();
                }
                if (isDrawRect && isDown) {
                    x11 = x;
                    y11 = y;
                    paintCtx.clearRect(0, 0, paintC.width, paintC.height);
                    drawLineOnPaintC(x00, y00, x11, y00);  //上
                    drawLineOnPaintC(x00, y00, x00, y11);  //左
                    drawLineOnPaintC(x11, y11, x11, y00);  //右
                    drawLineOnPaintC(x11, y11, x00, y11);  //下
                }
                if (isDrawCircle && isDown) {
                    x11 = x;
                    y11 = y;
                    //保证tx0&ty0在左上角,tx1&ty1在右下角
                    tx0 = x00 < x11 ? x00 : x11;
                    tx1 = x00 < x11 ? x11 : x00;
                    ty0 = y00 < y11 ? y00 : y11;
                    ty1 = y00 < y11 ? y11 : y00;
                    paintCtx.clearRect(0, 0, paintC.width, paintC.height);
                    //如果浏览器兼容，直接调用api
                    if (paintCtx.ellipse) {
                        paintCtx.beginPath();
                        paintCtx.ellipse((tx0 + tx1) / 2, (ty1 + ty0) / 2, (tx1 - tx0) / 2, (ty1 - ty0) / 2, 0, 0, 2 * Math.PI);
                        paintCtx.stroke();
                    } else {
                        //使用复杂的算法画椭圆
                        drawEllipse(paintCtx, tx0, ty0, tx1 - tx0, ty1 - ty0);
                    }
                }
            }
        };

        //结束绘画
        paintC.onmouseup = function (event) {
            var position = getEventPosition(event);
            var x = position.x, y = position.y;
            if (x > cutPicCanvas.left && x < cutPicCanvas + cutPicCanvas.width
                && y > cutPicCanvas.top && y < cutPicCanvas.top + cutPicCanvas.height) {
                if (isDraw && isDown) {
                    paintCtx.closePath();
                }
                if (isDrawRect && isDown) {

                }
                if (isDrawCircle && isDown) {

                }
            }
            isDraw = false;
            isDown = false;
            isDrawRect = false;
            isDrawCircle = false;
            $("#pic").css("z-index", 10);
            $("#paintCanvas").css("z-index", 0);
            //将paintCanvas图层的内容复制到ctxPic上面去,曲线救国，先丢到一张图里去
            paintOnImage();
        };
    }

    //绑定滚动事件
    function bindWheelEvent() {
        //绑定鼠标滚动事件
        c2.addEventListener("wheel", function (event) {
            var xCenter = cutPicCanvas.left + cutPicCanvas.width / 2;
            var yCenter = cutPicCanvas.top + cutPicCanvas.height / 2;
            var position = getEventPosition(event);
            //在截取区域中才响应
            if (position.x > cutPicCanvas.left && position.x < cutPicCanvas.left + cutPicCanvas.width &&
                position.y > cutPicCanvas.top && position.y < cutPicCanvas.top + cutPicCanvas.height) {
                event.preventDefault();
                //wheelDelta向下滚动为-120，向上滚动为120,firefox可能为3,-3
                //上滚放大，下滚缩小，默认倍率0.9/1;
                if (event.wheelDelta == 120 || event.wheelDelta == 3) {
                    var tempLeft = (c2.width - cutPicCanvas.width * (1 / 0.9)) / 2;
                    var tempTop = (c2.width - cutPicCanvas.height * (1 / 0.9)) / 2;
                    if (tempLeft < 30 || tempTop < 30) {
                        return;
                    }
                    ctxPic.clearRect(cutPicCanvas.left - 1, cutPicCanvas.top - 1, cutPicCanvas.width + 2, cutPicCanvas.height + 2);
                    ctxPic.save();
                    ctxPic.translate(xCenter, yCenter);
                    ctxPic.rotate(step * 90 * Math.PI / 180);
                    if (cutPicCanvas.isVertical) {
                        ctxPic.scale(1, -1);
                    }
                    if (cutPicCanvas.isHorizontal) {
                        ctxPic.scale(-1, 1);
                    }
                    cutPicCanvas.zoom = cutPicCanvas.zoom * (1 / 0.9);
                    cutPicCanvas.width = cutPicCanvas.width * (1 / 0.9);
                    cutPicCanvas.height = cutPicCanvas.height * (1 / 0.9);
                    var left = (c2.width - cutPicCanvas.width) / 2;
                    var top = (c2.height - cutPicCanvas.height) / 2;
                    cutPicCanvas.left = left;
                    cutPicCanvas.top = top;
                    ctxPic.scale(cutPicCanvas.zoom, cutPicCanvas.zoom);
                    if (step == 0 || step == 2) {
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                            -(cutPicCanvas.width / cutPicCanvas.zoom) / 2, -(cutPicCanvas.height / cutPicCanvas.zoom) / 2,
                            cutPicCanvas.width / cutPicCanvas.zoom, cutPicCanvas.height / cutPicCanvas.zoom);
                    }
                    if (step == 1 || step == 3) {
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                            -(cutPicCanvas.height / cutPicCanvas.zoom) / 2, -(cutPicCanvas.width / cutPicCanvas.zoom) / 2,
                            cutPicCanvas.height / cutPicCanvas.zoom, cutPicCanvas.width / cutPicCanvas.zoom);
                    }
                    ctxPic.restore();
                }
                if (event.wheelDelta == -120 || event.wheelDelta == -3) {
                    ctxPic.clearRect(cutPicCanvas.left - 1, cutPicCanvas.top - 1, cutPicCanvas.width + 2, cutPicCanvas.height + 2);
                    ctxPic.save();
                    ctxPic.translate(xCenter, yCenter);
                    ctxPic.rotate(step * 90 * Math.PI / 180);
                    if (cutPicCanvas.isVertical) {
                        ctxPic.scale(1, -1);
                    }
                    if (cutPicCanvas.isHorizontal) {
                        ctxPic.scale(-1, 1);
                    }
                    cutPicCanvas.zoom = cutPicCanvas.zoom * 0.9;
                    cutPicCanvas.width = cutPicCanvas.width * 0.9;
                    cutPicCanvas.height = cutPicCanvas.height * 0.9;
                    var left = (c2.width - cutPicCanvas.width) / 2;
                    var top = (c2.height - cutPicCanvas.height) / 2;
                    cutPicCanvas.left = left;
                    cutPicCanvas.top = top;
                    ctxPic.scale(cutPicCanvas.zoom, cutPicCanvas.zoom);

                    if (step == 0 || step == 2) {
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                            -(cutPicCanvas.width / cutPicCanvas.zoom) / 2, -(cutPicCanvas.height / cutPicCanvas.zoom) / 2,
                            cutPicCanvas.width / cutPicCanvas.zoom, cutPicCanvas.height / cutPicCanvas.zoom);
                    }
                    if (step == 1 || step == 3) {
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight,
                            -(cutPicCanvas.height / cutPicCanvas.zoom) / 2, -(cutPicCanvas.width / cutPicCanvas.zoom) / 2,
                            cutPicCanvas.height / cutPicCanvas.zoom, cutPicCanvas.width / cutPicCanvas.zoom);
                    }
                    ctxPic.restore();
                }
                if (cutPicCanvas.isMosaic) {
                    mosaic();
                }
                if (cutPicCanvas.isReverse) {
                    reverse();
                }
                addWaterMark();
                paintCtx.clearRect(0, 0, paintC.width, paintC.height);
            }
        });
    }

    //使用贝塞尔曲线画椭圆,
    //src:http://stackoverflow.com/questions/2172798/how-to-draw-an-oval-in-html5-canvas
    function drawEllipse(ctx, x, y, w, h) {
        var kappa = .5522848,
            ox = (w / 2) * kappa, // control point offset horizontal
            oy = (h / 2) * kappa, // control point offset vertical
            xe = x + w,           // x-end
            ye = y + h,           // y-end
            xm = x + w / 2,       // x-middle
            ym = y + h / 2;       // y-middle

        ctx.beginPath();
        ctx.moveTo(x, ym);
        ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
        ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
        ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
        ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
        //ctx.closePath(); // not used correctly, see comments (use to close off open path)
        ctx.stroke();
    }
});
