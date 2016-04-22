// Tournament - A WS connection to a Chesser-Master tournament server

function Tournament(chesser, args, logCallback, errorCallback) {
	this.chesser = chesser;
	var self = this;
	this.log = logCallback;

	this.log("Connecting to Chesser-Master at " + args.server + ":" + args.port);

	try {
		this.ws = new WebSocket("ws://" + args.server + ":" + args.port);
	}
	catch(err) {
		if(errorCallback) {
			errorCallback(err);
		}
		else {
			console.error(err);
		}
	}

	this.ws.onopen = function() {
		self.connected = true;
		self.log("Connected to Chesser-Master, waiting for the Arena to give us a game.");
		self.send("register", {
			type: "Chesser",
			name: args.name,
			password: args.password,
		});
	};

	this.ws.onerror = function(err) {
		errorCallback(self.connected ? "Unexpected error" : "Could not connect.");
		console.error(err);
	};

	this.ws.onmessage = function(message) {
		if(getUrlParameter("printIO")) {
			console.log("FROM TOURNAMENT <-- ", message.data);
		}

		self.received(JSON.parse(message.data));
	};

	this.ws.onclose = function() {
		self.log("Connection closed");
	};
};

Tournament.prototype.send = function(eventName, data) {
	var str = JSON.stringify({
		event: eventName,
		data: data,
	});

	if(getUrlParameter("printIO")) {
		console.log("TO TOURNAMENT --> ", str);
	}

	this.ws.send(str);
};

Tournament.prototype.received = function(data) {
	console.log("received", data);

	var event = data.event;
	var callbackName = "on" + event.charAt(0).toUpperCase() + event.slice(1);
	if(!this[callbackName]) {
		console.error("unexpected tournament callback", callbackName);
	}
	else {
		this[callbackName].call(this, data.data);
	}
};

Tournament.prototype.onMessage = function(data) {
	console.log("message", data);
};

Tournament.prototype.onPlay = function(data) {
	this.log("Recieved play data from Chesser-Master, connecting...");
	this.chesser.connectTo(data.server, data.port, undefined, data);
};
