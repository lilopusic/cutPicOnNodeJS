/**
 * Created by hnayan on 2017-3-20.
 */
//闭包添加插件不污染环境
(function ($) {

        //严格模式
        'use strict'
        //添加依赖
        requireJS(['CanvasInput.js', 'html2canvas.js']);
        //插件定义
        $.fn.cutPic = function (userOptions) {

            //保护默认参数
            userOptions = $.extend({
                //水印信息
                haveWaterMark: false,
                waterMark: '',
                waterMarkSize: 12,
                waterMarkColor: 'green',
                waterMarkFontStyle: 'Arial',
                //画笔信息
                paintColor: 'red',
                paintWidth: 2,
                //输入框信息
                inputFontSize: 18,
                inputFontColor: 'red',
                inputFontFamily: 'Arial',
                //重载信息
                reloadWay: 'normal',
                //边框信息
                borderColor: 'red',
                borderWidth: 2,
                //下载信息
                downloadType: 'png',
                downloadName: 'cutPic',
                //上传信息
                uploadFunc: 'nodeJs'
            }, userOptions);

            //一些全局变量
            //是否按下鼠标
            let isDown = false;
            //是否移动鼠标
            let isMove = false;
            //是否正在绘画
            let isDraw = false;
            //是否正在绘制矩形
            let isDrawRect = false;
            //是否正在绘制（椭）圆形
            let isDrawCircle = false;
            //记录是否已经运行截图插件
            let alreadyRun = false;
            //是否正在输入文字
            let isInput = false;
            //截图区域四个顶点坐标
            let x0, y0, x1, y1;
            //添加矩形用的四个顶点坐标
            let x00, y00, x11, y11;
            //temp用来交换数据
            let temp, tx0, tx1, ty0, ty1;
            //step范围:0~3,分别代表0,90,180,270度
            let step = 0;
            //背景dom
            let bck;
            //遮罩层dom
            let mask;
            //绘制截图框用的承载Context的容器dom
            let c;
            //绘制截图框的Context
            let ctx;
            //绘制截图层的承载Context的容器dom
            let c2;
            //绘制截图层的Context
            let ctxPic;
            //绘制绘画层的承载Context的容器dom
            let paintC;
            //绘制绘画层的Context
            let paintCtx;
            //截图的宽和高，一旦截图完成（松开鼠标），两个值就固定了
            //这两个值是用来操作原图的
            let cutPicWidth, cutPicHeight;
            //目标区域的html,用来还原截图前状态
            let srcHtml;
            //原图
            let image = new Image();
            //截图区域大小
            let wholeWidth, wholeHeight;
            //自定义对象，用来保存画布的信息
            let cutPicCanvas = {
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
            let paintCanvasInfo = {
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
            let currentDom;
            //工具栏的偏移距离
            let toolbarOffset = 150;
            //记录重载的方式,默认simple
            let reloadWay = "simple";
            let uploadFunc = null;
            //下载的默认格式为png
            let downloadType;
            //下载的默认名字为cutPic
            let downloadName;
            //输入框，恒定一个
            let inputBox;
            //别名
            let _self = this;
            //上传回调函数独立出来
            uploadFunc = userOptions.uploadFunc || function () {
                alert("you have not define a func");
            };

            //如果传入字符串调用内置方法
            if (typeof uploadFunc !== 'function') {
                switch (uploadFunc) {
                    case 'nodeJS':
                        uploadFunc = uploadNodeJS;
                        break;

                    default:
                        uploadFunc = () => {
                            layer.open({
                                content: '没有找到对应上传方法'
                            });
                        }
                        break;
                }
            }
            //下载格式独立出来
            downloadType = userOptions.downloadType;

            //下载名字也独立出来
            downloadName = userOptions.downloadName;
            //获得当前Dom
            currentDom = this.get(0);

            paintCanvasInfo.paintColor = userOptions.paintColor;
            paintCanvasInfo.paintWidth = userOptions.paintWidth;
            reloadWay = userOptions.reloadWay;
            //绑定点击事件,这里只有一个作用,就是点击之后进入截图
            currentDom.onclick = (event) => {
                //只有第一次会调用，防止多次调用
                if (!alreadyRun) {
                    alreadyRun = !alreadyRun;
                    //将目标转换成Canvas
                    html2canvas(currentDom, {
                        allowTaint: true,
                        taintTest: false,
                        background: "#ffffff",
                        onrendered: (canvas) => {
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
            let createContainer = (canvas) => {
                //设置原图
                image.src = canvas.toDataURL();
                let width = wholeWidth;
                let height = wholeHeight;
                let backGroundClass = 'backGround';
                let paintCanvasId = 'paintCanvas';
                let picId = 'pic';
                let maskClass = 'mask';
                let myCanvasId = 'myCanvas';
                //背景
                let $backGround = $(`<div class=${backGroundClass}></div>`);
                $backGround.css("background-image", `url(${image.src})`);
                $backGround.css("position", "relative");
                $backGround.height(height).width(width);
                //绘画层
                let $paintCanvas = $(`<canvas id=${paintCanvasId}>your browser doesn't support canvas!</canvas>`);
                $paintCanvas.css("position", "absolute").css("top", 0).css("left", 0).css("z-index", 0);
                $paintCanvas.attr("height", height).attr("width", width);
                //截图层
                let $pic = $(`<canvas id=${picId}>your browser doesn't support canvas!</canvas>`);
                $pic.css("position", "absolute").css("top", 0).css("left", 0).css("z-index", 10);
                $pic.attr("height", height).attr("width", width);
                //遮罩层
                let $mask = $(`<div class=${maskClass}></div>`);
                $mask.css("position", "relative").css("display", "none")
                    .css("top", 0).css("left", 0).css("background-color", "rgba(0,0,0,0.8)");
                $mask.height(height).width(width);
                $mask.append($pic).append($paintCanvas);
                //截图框层
                let $myCanvas = $(`<canvas id=${myCanvasId}>your browser doesn't support canvas!</canvas>`);
                $myCanvas.css("position", "relative").css("cursor", "crosshair")
                    .css("top", 0).css("left", 0);
                $myCanvas.attr("height", height).attr("width", width);

                $backGround.append($mask).append($myCanvas);
                //最后加入到源
                $(currentDom).append($backGround);
            };

            //核心函数,用于绑定各种事件,初始化各种值
            let loadCtx = () => {

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
                let left = (c2.width - cutPicWidth) / 2;
                let top = (c2.height - cutPicHeight) / 2;
                //保存截图信息&&赋初始值
                cutPicCanvas.width = x1 - x0;
                cutPicCanvas.height = y1 - y0;
                cutPicCanvas.left = left;
                cutPicCanvas.top = top;
                cutPicCanvas.isHorizontal = false;
                cutPicCanvas.isVertical = false;
                cutPicCanvas.haveWaterMark = userOptions.haveWaterMark || false;
                cutPicCanvas.waterMark = userOptions.waterMark || null;
                cutPicCanvas.waterMarkSize = userOptions.waterMarkSize || 0;
                cutPicCanvas.waterMarkFontStyle = userOptions.waterMarkFontStyle || "Arial";
                cutPicCanvas.mosaicType = userOptions.mosaicType || null;
                cutPicCanvas.waterMarkColor = userOptions.waterMarkColor || "black";
                cutPicCanvas.borderColor = userOptions.borderColor || "red";
                cutPicCanvas.borderWidth = userOptions.borderWidth || 1;
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
                c2.onclick = (event) => {

                    let position = getEventPosition(event);
                    let x = position.x,
                        y = position.y;

                    //左侧功能
                    //处理取消截图事件
                    if (x > c2.width - 30 && x < c2.width && y < (c2.height / 2 + 60 - toolbarOffset) && y > (c2.height / 2 + 30 - toolbarOffset)) {
                        cancelCutPic();
                    }
                    //回到原网页
                    if (x > c2.width - 30 && x < c2.width && y < (c2.height / 2 + 90 - toolbarOffset) && y > (c2.height / 2 + 60 - toolbarOffset)) {
                        backToSource();
                    }
                    //下载图片
                    if (x > c2.width - 30 && x < c2.width && y < (c2.height / 2 + 120 - toolbarOffset) && y > (c2.height / 2 + 90 - toolbarOffset)) {
                        downloadPic();
                    }
                    //上传
                    if (x > c2.width - 30 && x < c2.width && y < (c2.height / 2 + 150 - toolbarOffset) && y > (c2.height / 2 + 120 - toolbarOffset)) {
                        //传入两个函数
                        //第一个函数会调用第二个
                        chooseType(uploadFunc, getCutPicBase64);
                    }

                    //左边功能
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

                    //涂鸦
                    if (x > 0 && x < 30 && y < (c2.height / 2 + 210 - toolbarOffset) && y > (c2.height / 2 + 180 - toolbarOffset)) {
                        paintInPaintCanvas();
                        isDraw = true;
                    }
                    //反色
                    if (x > 0 && x < 30 && y < (c2.height / 2 + 240 - toolbarOffset) && y > (c2.height / 2 + 210 - toolbarOffset)) {
                        reservePic();
                    }
                    //加边框
                    if (x > 0 && x < 30 && y < (c2.height / 2 + 270 - toolbarOffset) && y > (c2.height / 2 + 240 - toolbarOffset)) {
                        addBorder();
                    }

                    //添加矩形
                    if (x > 0 && x < 30 && y < (c2.height / 2 + 300 - toolbarOffset) && y > (c2.height / 2 + 270 - toolbarOffset)) {
                        paintInPaintCanvas();
                        isDrawRect = true;
                    }
                    //添加圆形
                    if (x > 0 && x < 30 && y < (c2.height / 2 + 330 - toolbarOffset) && y > (c2.height / 2 + 300 - toolbarOffset)) {
                        paintInPaintCanvas();
                        isDrawCircle = true;
                    }
                    //添加文本框
                    if (x > 0 && x < 30 && y < (c2.height / 2 + 360 - toolbarOffset) && y > (c2.height / 2 + 330 - toolbarOffset)) {
                        paintInPaintCanvas();
                        isInput = true;
                    }
                    //阻止冒泡,避免了被currentDom捕捉到
                    event.stopPropagation();

                };
            }


            //获取base64格式图片
            //暴露给外部
            let getCutPicBase64 = (type) => {
                let imageData = ctxPic.getImageData(cutPicCanvas.left, cutPicCanvas.top, cutPicCanvas.width, cutPicCanvas.height);
                let downloadCanvas = document.createElement("canvas");
                downloadCanvas.width = cutPicCanvas.width;
                downloadCanvas.height = cutPicCanvas.height;
                let downloadCanvasCtx = downloadCanvas.getContext("2d");
                downloadCanvasCtx.putImageData(imageData, 0, 0);
                return downloadCanvas.toDataURL(`image\/${type}`, 1.0);
                $(downloadCanvas).remove();
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
                let degree = step * 90 * Math.PI / 180;
                //得到图片的中心坐标
                let xCenter = cutPicCanvas.left + cutPicCanvas.width / 2;
                let yCenter = cutPicCanvas.top + cutPicCanvas.height / 2;
                let left, top;
                //清除上次旋转的图片
                ctxPic.clearRect(cutPicCanvas.left - 1, cutPicCanvas.top - 1, cutPicCanvas.width + 2, cutPicCanvas.height + 2);
                switch (step) {
                    case 0:
                        temp = cutPicCanvas.height;
                        cutPicCanvas.height = cutPicCanvas.width;
                        cutPicCanvas.width = temp;
                        left = (c2.width - cutPicCanvas.width) / 2;
                        top = (c2.height - cutPicCanvas.height) / 2;
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
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
                        ctxPic.restore();
                        break;
                    case 1:
                        temp = cutPicCanvas.height;
                        cutPicCanvas.height = cutPicCanvas.width;
                        cutPicCanvas.width = temp;
                        left = (c2.width - cutPicCanvas.width) / 2;
                        top = (c2.height - cutPicCanvas.height) / 2;
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
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
                        ctxPic.restore();
                        break;
                    case 2:
                        temp = cutPicCanvas.height;
                        cutPicCanvas.height = cutPicCanvas.width;
                        cutPicCanvas.width = temp;
                        left = (c2.width - cutPicCanvas.width) / 2;
                        top = (c2.height - cutPicCanvas.height) / 2;
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
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
                        ctxPic.restore();
                        break;
                    case 3:
                        temp = cutPicCanvas.height;
                        cutPicCanvas.height = cutPicCanvas.width;
                        cutPicCanvas.width = temp;
                        left = (c2.width - cutPicCanvas.width) / 2;
                        top = (c2.height - cutPicCanvas.height) / 2;
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
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
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
                let xCenter = cutPicCanvas.left + cutPicCanvas.width / 2;
                let yCenter = cutPicCanvas.top + cutPicCanvas.height / 2;
                step--;
                step < 0 && (step = 3);
                //转化成弧度
                let degree = step * 90 * Math.PI / 180;
                let left, top;
                //清除上次旋转的图片
                ctxPic.clearRect(cutPicCanvas.left - 1, cutPicCanvas.top - 1, cutPicCanvas.width + 2, cutPicCanvas.height + 2);
                switch (step) {
                    case 0:
                        temp = cutPicCanvas.height;
                        cutPicCanvas.height = cutPicCanvas.width;
                        cutPicCanvas.width = temp;
                        left = (c2.width - cutPicCanvas.width) / 2;
                        top = (c2.height - cutPicCanvas.height) / 2;
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
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
                        ctxPic.restore();
                        break;
                    case 1:
                        //更新cutPicCanvas状态
                        temp = cutPicCanvas.height;
                        cutPicCanvas.height = cutPicCanvas.width;
                        cutPicCanvas.width = temp;
                        left = (c2.width - cutPicCanvas.width) / 2;
                        top = (c2.height - cutPicCanvas.height) / 2;
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
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
                        ctxPic.restore();
                        break;
                    case 2:
                        temp = cutPicCanvas.height;
                        cutPicCanvas.height = cutPicCanvas.width;
                        cutPicCanvas.width = temp;
                        left = (c2.width - cutPicCanvas.width) / 2;
                        top = (c2.height - cutPicCanvas.height) / 2;
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
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
                        ctxPic.restore();
                        break;
                    case 3:
                        temp = cutPicCanvas.height;
                        cutPicCanvas.height = cutPicCanvas.width;
                        cutPicCanvas.width = temp;
                        left = (c2.width - cutPicCanvas.width) / 2;
                        top = (c2.height - cutPicCanvas.height) / 2;
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

                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
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
                let xCenter = cutPicCanvas.left + cutPicCanvas.width / 2;
                let yCenter = cutPicCanvas.top + cutPicCanvas.height / 2;
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
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
                    }
                    if (step == 1 || step == 3) {
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
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
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
                    }
                    if (step == 1 || step == 3) {
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
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
                let xCenter = cutPicCanvas.left + cutPicCanvas.width / 2;
                let yCenter = cutPicCanvas.top + cutPicCanvas.height / 2;
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
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
                    }
                    if (step == 1 || step == 3) {
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
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
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.width / 2, -cutPicCanvas.height / 2, cutPicCanvas.width, cutPicCanvas.height);
                    }
                    if (step == 1 || step == 3) {
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -cutPicCanvas.height / 2, -cutPicCanvas.width / 2, cutPicCanvas.height, cutPicCanvas.width);
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
                let xCenter = cutPicCanvas.left + cutPicCanvas.width / 2;
                let yCenter = cutPicCanvas.top + cutPicCanvas.height / 2;
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
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -(cutPicCanvas.width / cutPicCanvas.zoom) / 2, -(cutPicCanvas.height / cutPicCanvas.zoom) / 2,
                            cutPicCanvas.width / cutPicCanvas.zoom, cutPicCanvas.height / cutPicCanvas.zoom);
                    }
                    if (step == 1 || step == 3) {
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -(cutPicCanvas.height / cutPicCanvas.zoom) / 2, -(cutPicCanvas.width / cutPicCanvas.zoom) / 2,
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
                //变量重新初始化
                cutPicCanvas = {};
                cutPicHeight = 0;
                cutPicWidth = 0;
                step = 0;
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
                let name;
                let chooseType;
                layer.prompt({
                    title: '输入名字并选择一种格式',
                    btn: ['png', 'jpeg', 'cancle'],
                    yes: function (index, layero) {
                        name = $(layero).find('input').val() || downloadName;
                        chooseType = 'png';
                        layer.close(index);
                        //获取用户输入值再上传/下载
                        downloadURI(getCutPicBase64(chooseType), `${name}.${chooseType}`);
                    },
                    btn2: function (index, layero) {
                        name = $(layero).find('input').val() || downloadName;
                        chooseType = 'jpeg';
                        layer.close(index);
                        downloadURI(getCutPicBase64(chooseType), `${name}.${chooseType}`);
                    },
                    btn3: function (index, layero) {
                        layer.close(index);
                    },
                    cancel: function () {

                    }
                });


            }

            //开始绘画
            function paintInPaintCanvas() {
                //交换两者的z-index
                $("#pic").css("z-index", 0);
                $("#paintCanvas").css("z-index", 10);
                paintCtx.clearRect(0, 0, paintC.width, paintC.height);

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
                let xCenter = cutPicCanvas.left + cutPicCanvas.width / 2;
                let yCenter = cutPicCanvas.top + cutPicCanvas.height / 2;
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
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -(cutPicCanvas.width / cutPicCanvas.zoom) / 2, -(cutPicCanvas.height / cutPicCanvas.zoom) / 2,
                            cutPicCanvas.width / cutPicCanvas.zoom, cutPicCanvas.height / cutPicCanvas.zoom);
                    }
                    if (step == 1 || step == 3) {
                        ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -(cutPicCanvas.height / cutPicCanvas.zoom) / 2, -(cutPicCanvas.width / cutPicCanvas.zoom) / 2,
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
                let e = event || window.event;
                let x = e.offsetX || e.layerX;
                let y = e.offsetY || e.layerY;
                return {
                    x,
                    y
                }
            }

            //以下两个算法都是像素的变换，和原图无关
            //马赛克算法
            function mosaic() {
                let imageData = ctxPic.getImageData(cutPicCanvas.left, cutPicCanvas.top, cutPicCanvas.width, cutPicCanvas.height);
                let pixels = imageData.data;
                let numTileRows = 50;
                let numTileCols = 50;
                let tileWidth = cutPicCanvas.width / numTileCols;
                let tileHeight = cutPicCanvas.height / numTileRows;
                for (let r = 0; r < numTileRows; r++) {
                    for (let c = 0; c < numTileCols; c++) {
                        let tx = (c * tileWidth) + (tileWidth / 2);
                        let ty = (r * tileHeight) + (tileHeight / 2);
                        let pos = (Math.floor(ty) * (imageData.width * 4)) + (Math.floor(tx) * 4);
                        let red = pixels[pos];
                        let green = pixels[pos + 1];
                        let blue = pixels[pos + 2];
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
                let imageData = ctxPic.getImageData(cutPicCanvas.left, cutPicCanvas.top, cutPicCanvas.width, cutPicCanvas.height);
                let pixels = imageData.data;
                for (let i = 0, n = pixels.length; i < n; i += 4) {
                    pixels[i] = 255 - pixels[i];
                    pixels[i + 1] = 255 - pixels[i + 1];
                    pixels[i + 2] = 255 - pixels[i + 2];
                }
                ctxPic.putImageData(imageData, cutPicCanvas.left, cutPicCanvas.top);
            }

            //下载到本地
            function downloadURI(uri, name) {
                let link = document.createElement("a");
                link.download = name;
                link.href = uri;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                $(link).remove();
            }

            //绘图放置在图片上
            function paintOnImage() {
                let paintImage = new Image();
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
                let closeImageObj = new Image();
                let rotateRightImage = new Image();
                let rotateLeftImage = new Image();
                let upDownImage = new Image();
                let leftRightImage = new Image();
                let backImage = new Image();
                let mosaicImage = new Image();
                let downloadImage = new Image();
                let paintImage = new Image();
                let reverseImage = new Image();
                let addBorderImage = new Image();
                let uploadImage = new Image();
                let addRectImage = new Image();
                let addCircleImage = new Image();
                let inputImage = new Image();
                //右边
                //取消按钮
                closeImageObj.src = "../img/close.png";
                closeImageObj.onload = () => {
                    //ctxPic.fillRect(0, c2.height/2 - 120, 30, 30);
                    ctxPic.drawImage(closeImageObj, c2.width - 30, c2.height / 2 - toolbarOffset + 30, 30, 30);
                };

                //回到原来的网页
                backImage.src = "../img/back.png";
                backImage.onload = () => {
                    //ctxPic.fillRect(0, c2.height/2 + 150 - 120, 30, 30);
                    ctxPic.drawImage(backImage, c2.width - 30, c2.height / 2 + 30 - toolbarOffset + 30, 30, 30);
                };

                //保存图片
                downloadImage.src = "../img/download.png";
                downloadImage.onload = () => {
                    ctxPic.drawImage(downloadImage, c2.width - 30, c2.height / 2 + 60 - toolbarOffset + 30, 30, 30);
                };

                //上传图片
                uploadImage.src = "../img/upload.png";
                uploadImage.onload = () => {
                    ctxPic.drawImage(uploadImage, c2.width - 30, c2.height / 2 + 90 - toolbarOffset + 30, 30, 30)
                };

                //左边
                //顺时针旋转
                rotateRightImage.src = "../img/rotateRight.png";
                rotateRightImage.onload = () => {
                    ctxPic.drawImage(rotateRightImage, 0, c2.height / 2 + 30 - toolbarOffset, 30, 30);
                };

                //逆时针旋转
                rotateLeftImage.src = "../img/rotateLeft.png";
                rotateLeftImage.onload = () => {
                    //ctxPic.fillRect(0, c2.height/2 + 60 - 120, 30, 30);
                    ctxPic.drawImage(rotateLeftImage, 0, c2.height / 2 + 60 - toolbarOffset, 30, 30);
                };

                //垂直翻转
                upDownImage.src = "../img/upDown.png";
                upDownImage.onload = () => {
                    //ctxPic.fillRect(0, c2.height/2 + 90 - 120, 30, 30);
                    ctxPic.drawImage(upDownImage, 0, c2.height / 2 + 90 - toolbarOffset, 30, 30);
                };

                //水平翻转
                leftRightImage.src = "../img/leftRight.png";
                leftRightImage.onload = () => {
                    //ctxPic.fillRect(0, c2.height/2 + 120 - 120, 30, 30);
                    ctxPic.drawImage(leftRightImage, 0, c2.height / 2 + 120 - toolbarOffset, 30, 30);
                };

                //一键马赛克
                mosaicImage.src = "../img/mosaic.png";
                mosaicImage.onload = () => {
                    ctxPic.drawImage(mosaicImage, 0, c2.height / 2 + 150 - toolbarOffset, 30, 30);
                };

                //涂个鸦？
                paintImage.src = "../img/paint.png";
                paintImage.onload = () => {
                    ctxPic.drawImage(paintImage, 0, c2.height / 2 + 180 - toolbarOffset, 30, 30);
                };

                //反个色？
                reverseImage.src = "../img/reverse.png";
                reverseImage.onload = () => {
                    ctxPic.drawImage(reverseImage, 0, c2.height / 2 + 210 - toolbarOffset, 30, 30)
                };

                //加个边框？
                addBorderImage.src = "../img/boder.png";
                addBorderImage.onload = () => {
                    ctxPic.drawImage(addBorderImage, 0, c2.height / 2 + 240 - toolbarOffset, 30, 30)
                };

                //添加矩形
                addRectImage.src = "../img/addRect.png";
                addRectImage.onload = () => {
                    ctxPic.drawImage(addRectImage, 0, c2.height / 2 + 270 - toolbarOffset, 30, 30)
                };

                //添加圆形
                addCircleImage.src = "../img/addCircle.png";
                addCircleImage.onload = () => {
                    ctxPic.drawImage(addCircleImage, 0, c2.height / 2 + 300 - toolbarOffset, 30, 30)
                }

                //添加文本框
                inputImage.src = "../img/input.png";
                inputImage.onload = () => {
                    ctxPic.drawImage(inputImage, 0, c2.height / 2 + 330 - toolbarOffset, 30, 30)
                }
            }

            //初始化dom,context
            function initialDomAndContext() {
                //一般的Dom元素
                bck = document.getElementsByClassName("backGround")[0];
                mask = document.getElementsByClassName("mask")[0];

                //Canvas元素--用来绘制截图时的矩形框以及绑定鼠标事件
                c = document.getElementById('myCanvas');
                if (typeof c.getContext === 'function') {

                    ctx = c.getContext('2d');

                }

                //Canvas元素--用来绘制截下来的图片
                c2 = document.getElementById('pic');
                if (typeof c2.getContext === 'function') {

                    ctxPic = c2.getContext('2d');

                }

                //用来涂鸦，画矩形的图层
                paintC = document.getElementById("paintCanvas");
                if (typeof paintC.getContext === 'function') {

                    paintCtx = paintC.getContext('2d');

                }
            }

            //绑定鼠标移动事件
            //包括截图框和绘画
            function bindMouseEvent() {

                //以下三个事件均是用来绘制截图框的
                c.onmousedown = (event) => {
                    event = event ? event : window.event;
                    isDown = true;
                    let position = getEventPosition(event);
                    x0 = position.x;
                    y0 = position.y;
                };
                c.onmousemove = (event) => {
                    event = event ? event : window.event;
                    if (isDown) {
                        let position = getEventPosition(event);
                        ctx.clearRect(0, 0, c.width, c.height);
                        isMove = true;
                        x1 = position.x;
                        y1 = position.y;
                        drawLine(x0, y0, x1, y0); //上
                        drawLine(x0, y0, x0, y1); //左
                        drawLine(x1, y1, x1, y0); //右
                        drawLine(x1, y1, x0, y1); //下
                    }
                };
                c.onmouseup = () => {
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
                paintC.onmousedown = (event) => {
                    let position = getEventPosition(event);
                    let x = position.x,
                        y = position.y;
                    if (x > cutPicCanvas.left && x < cutPicCanvas.left + cutPicCanvas.width &&
                        y > cutPicCanvas.top && y < cutPicCanvas.top + cutPicCanvas.height) {
                        paintCtx.lineWidth = paintCanvasInfo.paintWidth;
                        paintCtx.strokeStyle = paintCanvasInfo.paintColor;
                        isDown = true;
                        x00 = x;
                        y00 = y;
                        //涂鸦
                        if (isDraw) {
                            paintCtx.beginPath();
                            paintCtx.moveTo(x, y);
                        }
                    }
                };

                //鼠标移动,绘画
                paintC.onmousemove = (event) => {
                    let position = getEventPosition(event);
                    let x = position.x,
                        y = position.y;
                    if (x > cutPicCanvas.left && x < cutPicCanvas.left + cutPicCanvas.width &&
                        y > cutPicCanvas.top && y < cutPicCanvas.top + cutPicCanvas.height) {
                        //涂鸦
                        if (isDraw && isDown) {
                            paintCtx.lineTo(x, y);
                            paintCtx.stroke();
                        }
                        //画矩形
                        if (isDrawRect && isDown) {
                            x11 = x;
                            y11 = y;
                            paintCtx.clearRect(0, 0, paintC.width, paintC.height);
                            drawLineOnPaintC(x00, y00, x11, y00); //上
                            drawLineOnPaintC(x00, y00, x00, y11); //左
                            drawLineOnPaintC(x11, y11, x11, y00); //右
                            drawLineOnPaintC(x11, y11, x00, y11); //下
                        }
                        //画(椭)圆形
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
                paintC.onmouseup = (event) => {
                    let position = getEventPosition(event);
                    let x = position.x,
                        y = position.y;
                    if (x > cutPicCanvas.left && x < cutPicCanvas.left + cutPicCanvas.width &&
                        y > cutPicCanvas.top && y < cutPicCanvas.top + cutPicCanvas.height) {
                        //涂鸦结束
                        if (isDraw && isDown) {
                            paintCtx.closePath();
                            isDraw = false;
                            $("#pic").css("z-index", 10);
                            $("#paintCanvas").css("z-index", 0);
                            paintOnImage();

                        }
                        //画矩形结束
                        if (isDrawRect && isDown) {
                            isDrawRect = false;
                            $("#pic").css("z-index", 10);
                            $("#paintCanvas").css("z-index", 0);
                            paintOnImage();

                        }
                        //画(椭)圆形结束
                        if (isDrawCircle && isDown) {
                            isDrawCircle = false;
                            $("#pic").css("z-index", 10);
                            $("#paintCanvas").css("z-index", 0);
                            paintOnImage();

                        }
                        //输入文字
                        if (isInput) {
                            inputBox = new CanvasInput({
                                canvas: paintC,
                                fontSize: userOptions.inputFontSize,
                                fontFamily: userOptions.inputFontFamily,
                                fontColor: userOptions.inputFontColor,
                                placeHolder: 'Type...',
                                borderWidth: 0,
                                boxShadow: 'none',
                                x: x,
                                y: y,
                                onsubmit: () => {
                                    submitText();
                                }
                            });
                            inputBox.focus();
                            isInput = false;
                        }
                    }
                    isDown = false;
                    //将paintCanvas图层的内容复制到ctxPic上面去,曲线救国，先丢到一张图里去
                    paintCtx.clearRect(0, 0, paintC.width, paintC.height);
                };
            }

            //绑定滚动事件
            function bindWheelEvent() {
                //绑定鼠标滚动事件
                c2.addEventListener("wheel",
                    (event) => {
                        let xCenter = cutPicCanvas.left + cutPicCanvas.width / 2;
                        let yCenter = cutPicCanvas.top + cutPicCanvas.height / 2;
                        let position = getEventPosition(event);
                        //在截取区域中才响应
                        if (position.x > cutPicCanvas.left && position.x < cutPicCanvas.left + cutPicCanvas.width &&
                            position.y > cutPicCanvas.top && position.y < cutPicCanvas.top + cutPicCanvas.height) {
                            event.preventDefault();
                            //wheelDelta向下滚动为-120，向上滚动为120,firefox可能为3,-3
                            //上滚放大，下滚缩小，默认倍率0.9/1;
                            if (event.wheelDelta == 120 || event.wheelDelta == 3) {
                                let tempLeft = (c2.width - cutPicCanvas.width * (1 / 0.9)) / 2;
                                let tempTop = (c2.width - cutPicCanvas.height * (1 / 0.9)) / 2;
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
                                let left = (c2.width - cutPicCanvas.width) / 2;
                                let top = (c2.height - cutPicCanvas.height) / 2;
                                cutPicCanvas.left = left;
                                cutPicCanvas.top = top;
                                ctxPic.scale(cutPicCanvas.zoom, cutPicCanvas.zoom);
                                if (step == 0 || step == 2) {
                                    ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -(cutPicCanvas.width / cutPicCanvas.zoom) / 2, -(cutPicCanvas.height / cutPicCanvas.zoom) / 2,
                                        cutPicCanvas.width / cutPicCanvas.zoom, cutPicCanvas.height / cutPicCanvas.zoom);
                                }
                                if (step == 1 || step == 3) {
                                    ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -(cutPicCanvas.height / cutPicCanvas.zoom) / 2, -(cutPicCanvas.width / cutPicCanvas.zoom) / 2,
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
                                let left = (c2.width - cutPicCanvas.width) / 2;
                                let top = (c2.height - cutPicCanvas.height) / 2;
                                cutPicCanvas.left = left;
                                cutPicCanvas.top = top;
                                ctxPic.scale(cutPicCanvas.zoom, cutPicCanvas.zoom);

                                if (step == 0 || step == 2) {
                                    ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -(cutPicCanvas.width / cutPicCanvas.zoom) / 2, -(cutPicCanvas.height / cutPicCanvas.zoom) / 2,
                                        cutPicCanvas.width / cutPicCanvas.zoom, cutPicCanvas.height / cutPicCanvas.zoom);
                                }
                                if (step == 1 || step == 3) {
                                    ctxPic.drawImage(image, x0, y0, cutPicWidth, cutPicHeight, -(cutPicCanvas.height / cutPicCanvas.zoom) / 2, -(cutPicCanvas.width / cutPicCanvas.zoom) / 2,
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
                let kappa = .5522848,
                    ox = (w / 2) * kappa, // control point offset horizontal
                    oy = (h / 2) * kappa, // control point offset vertical
                    xe = x + w, // x-end
                    ye = y + h, // y-end
                    xm = x + w / 2, // x-middle
                    ym = y + h / 2; // y-middle

                ctx.beginPath();
                ctx.moveTo(x, ym);
                ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
                ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
                ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
                ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
                //ctx.closePath(); // not used correctly, see comments (use to close off open path)
                ctx.stroke();
            }

            //弹出选择格式框并返回选择结果和暴露方法给外部
            function chooseType(callback, getCutPicBase64) {
                let name;
                let chooseType;
                layer.open({
                    title: "选择格式",
                    btn: ['png', 'jpeg', 'cancle'],
                    yes: function (index, layero) {
                        chooseType = 'png';
                        layer.close(index);
                        //用户自定义函数的话，只需要定义这一个callbcak，
                        //插件会返回chooseType和一个函数用来获取base64的info
                        //eg. uploadNodeJS
                        callback(chooseType, getCutPicBase64);
                    },
                    btn2: function (index, layero) {
                        chooseType = 'jpeg';
                        layer.close(index);
                        callback(chooseType, getCutPicBase64);
                    },
                    btn3: function (index, layero) {
                        layer.close(index);
                    },
                    cancel: function () {

                    }
                });
            }

            //上传函数(nodejs版本)
            function uploadNodeJS(chooseType, getCutPicBase64) {
                $.post("uploadCutPic", {
                    "info": getCutPicBase64(chooseType),
                    "picType": chooseType
                }, function (data) {
                    layer.open({
                        btn: '去下载!',
                        title: 'Your UUID',
                        content: data,
                        yes: (index, layero) => {
                            let _href = 'findPicByUUID';
                            $('body').append('<a href="" id="goto" target="_blank"></a>');
                            $('#goto').attr('href', _href);
                            $('#goto').get(0).click();
                            $('#goto').remove();
                        }
                    });
                });
            }

            //提交文字触发事件
            function submitText() {
                paintCtx.clearRect(0, 0, paintC.width, paintC.height);
                $("#pic").css("z-index", 10);
                $("#paintCanvas").css("z-index", 0);
                ctxPic.font = inputBox.fontSize() + "px " + inputBox.fontFamily();
                ctxPic.strokeStyle = inputBox.fontColor();
                ctxPic.strokeText(inputBox.value(), inputBox.x(), inputBox.y() + inputBox.fontSize());
                inputBox.destroy();
            }


            //后期优化
            function drawCanvas(cutPicCanvas) {
                //使用属性画出图
            }


            //暴露一批方法供外部调用
            _self.cutPicWidth = () => {
                return cutPicCanvas.width;
            }

            _self.cutPicHeight = () => {
                return cutPicCanvas.height;
            }

            _self.cutPicZoom = () => {
                return cutPicCanvas.zoom;
            }

            _self.cutPicStep = () => {
                return step;
            }

            _self.cutPicWaterMark = () => {
                return cutPicCanvas.waterMark;
            }

            _self.cutPicIsMosaic = () => {
                return cutPicCanvas.isMosaic;
            }

            _self.cutPicIsReverse = () => {
                return cutPicCanvas.isReverse;
            }

            _self.cutPicIsVertical = () => {
                return cutPicCanvas.isVertical;
            }

            _self.cutPicIsHorizontal = () => {
                return cutPicCanvas.isHorizontal;
            }
            //链式调用
            return _self;
        };

        function requireJS(nameArray) {
            let filePath = $("script").last().attr("src");
            let p = filePath.substring(0, filePath.length - 9) + 'third/';
            for (let index in nameArray) {
                let js = document.createElement('script');
                js.src = `${p}${nameArray[index]}`;
                document.head.appendChild(js);
            }
        }

})(jQuery);