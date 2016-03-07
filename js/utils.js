// Utils - utility functions used across classes

function clamp(num, min, max) {
	return Math.min(Math.max(num, min), max);
};

function clone(obj) {
	return $.extend(true, {}, obj);
};

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
};

function isObject(obj) {
	return obj !== null && typeof(obj) === "object";
};

function randomFromString(seedString) {
	var hash = 0;
	for(var i = 0; i < seedString.length; i++) {
		var chr = seedString.charCodeAt(i);
		hash = ((hash << 5) - hash) + chr;
		hash |= 0; // Convert to 32bit integer
	}

	var x = Math.sin(hash) * 10000;
	return x - Math.floor(x);
};

function formatTime(date) {
	var min = date.getMinutes();
	var sec = date.getSeconds();

	return min + ":" + (sec < 10 ? "0" : "") + sec;
};

function easeInOutCubic(x, t, b, c, d) {
	if ((t/=d/2) < 1) return c/2*t*t*t + b;
	return c/2*((t-=2)*t*t + 2) + b;
};

function getUrlParameter(sParam) {
	var sPageURL = decodeURIComponent(window.location.search.substring(1)),
		sURLVariables = sPageURL.split('&'),
		sParameterName,
		i;

	for (i = 0; i < sURLVariables.length; i++) {
		sParameterName = sURLVariables[i].split('=');

		if (sParameterName[0] === sParam) {
			return sParameterName[1] === undefined ? true : sParameterName[1];
		}
	}
};
