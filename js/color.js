// Color & HSLColor - classes to represent colors

function HSLColor(h, s, l) {
	this.h = clamp(Math.round(h), 0, 360);
	this.s = clamp(Math.round(s * 100), 0, 100);
	this.l = clamp(Math.round(l * 100), 0, 100);
};

HSLColor.prototype.toString = function() {
	return "hsl(" + this.h + ", " + this.s + "%, " + this.l + "%)";
};

function Color(r, g, b, a) {
	a = a === undefined ? 1 : a;
	this.r = clamp(Math.round(r * 255), 0, 255);
	this.g = clamp(Math.round(g * 255), 0, 255);
	this.b = clamp(Math.round(b * 255), 0, 255);
	this.a = clamp(a, 0, 1);
};

Color.prototype.toString = function() {
	return "rgba(" + this.r + ", " + this.g + ", " + this.b + ", "+ this.a +")";
};
