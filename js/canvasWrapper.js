// CanvasWrapper: wraps a jquerified <canvas> element to be easier to work with

function CanvasWrapper($canvas, width, height) {
	this.$element = $canvas;
	this.context = $canvas[0].getContext("2d");
	$canvas.bind('contextmenu', function(e){
		return false;
	});

	this._fontFamily = "sans-serif";

	this.width = width || 100;
	this.height = height || 100;
	this._attrWidth = 720;
	this._attrHeight = 720;

	this._d = this._attrHeight / this.height; // assumes height/width are the same scalar diff

	this.$element.attr("width", this._attrWidth);
	this.$element.attr("height", this._attrHeight);
};

CanvasWrapper.prototype.drawRectangle = function(color, x, y, width, height) {
	width = width || 1;
	height = height || 1;

	this.context.fillStyle = color.toString();
	this.context.fillRect(x * this._d, y * this._d, width * this._d, height * this._d);
};

CanvasWrapper.prototype.drawText = function(text, color, height, x, y) {
	this.context.font = "" + Math.floor(height * this._d) + "px " + this._fontFamily;
	this.context.fillStyle = color.toString();
	x = x || 0;
	y = y || 0;
	this.context.textBaseline = "top";
	this.context.fillText(text, x * this._d, y * this._d);
};

CanvasWrapper.prototype.fillRoundedRectangle = function(color, x, y, width, height, radius) {
	this._roundedRectangle(x, y, width, height, radius);
	this.context.fillStyle = color.toString();
	this.context.fill();
};

CanvasWrapper.prototype.strokeRoundedRectangle = function(stroke, color, x, y, width, height, radius) {
	this._roundedRectangle(x, y, width, height, radius);
	this.context.lineWidth = stroke * this._d;
	this.context.strokeStyle = color.toString();
	this.context.stroke();
};

CanvasWrapper.prototype._roundedRectangle = function(x, y, width, height, radius) {
	var ctx = this.context;

	x = this._d * x;
	y = this._d * y;
	width = this._d * width;
	height = this._d * height;
	radius = this._d * radius;

	ctx.beginPath();
	ctx.moveTo(x, y + radius);
	ctx.lineTo(x, y + height - radius);
	ctx.quadraticCurveTo(x, y + height, x + radius, y + height);
	ctx.lineTo(x + width - radius, y + height);
	ctx.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
	ctx.lineTo(x + width, y + radius);
	ctx.quadraticCurveTo(x + width, y, x + width - radius, y);
	ctx.lineTo(x + radius, y);
	ctx.quadraticCurveTo(x, y, x, y + radius);
};

CanvasWrapper.prototype.clear = function() {
	this.context.clearRect(0, 0, this._attrWidth, this._attrHeight);
};


