// Joueur - The websocket client to a Cerveau chess game server. Handles i/o with Cerveau, and mostly merging delta states from it.

function Joueur(server, port, spectating, optionalArgs, errorCallback) {
	var self = this;
	this.gameStates = [];

	server = server || "localhost";
	port = port || 3088;
	try {
		this.ws = new WebSocket("ws://" + server + ":" + port);
	}
	catch(err) {
		errorCallback && errorCallback(err);
	}

	this.ws.onopen = function() {
		self.send("play", $.extend({
			gameName: "Chess",
			requestedSession: "*",
			spectating: spectating ? true : undefined,
			clientType: "In Browser",
			playerName: "Human",
			playerIndex: optionalArgs.index,
		}, optionalArgs));
	};

	this.ws.onerror = function(err) {
		errorCallback && errorCallback(err);
	};

	this.ws.onmessage = function(message) {
		if(getUrlParameter("printIO")) {
			console.log("FROM SERVER <-- ", message.data);
		}

		self.received(JSON.parse(message.data));
	};

	this.ws.onclose = function() {
		self.onClose && self.onClose();
	};
};

Joueur.prototype.received = function(data) {
	var captializedEvent = capitalizeFirstLetter(data.event);

	var funct = this["_autoHandle" + captializedEvent];
	if(funct) {
		funct.call(this, data.data);
	}

	if(this["on" + captializedEvent]) {
		this["on" + captializedEvent](data.data);
	}
};

Joueur.prototype._autoHandleOver = function(data) {
	this.ws.close();
};

Joueur.prototype._autoHandleDelta = function(data) {
	Joueur.prototype.addDelta(this.gameStates, this.gameStates[this.gameStates.length - 1], data);
};

Joueur.prototype.addDelta = function(states, prev, delta) {
	prev = prev || {};
	var newState = Joueur.prototype.mergeDelta(clone(prev), delta);
	newState._notMove = false;

	// see if a chess piece moved from prev to newState
	for(var id in newState.gameObjects) {
		if(newState.gameObjects.hasOwnProperty(id)) {
			if(!prev.gameObjects || !prev.gameObjects[id]) {
				continue;
			}

			if(newState.gameObjects[id].file !== prev.gameObjects[id].file || newState.gameObjects[id].rank !== prev.gameObjects[id].rank) {
				newState._notMove = true;
				break;
			}
		};
	}

	states.push(newState);
};

Joueur.prototype.mergeDelta = function(state, delta) {
	var deltaLength = delta["&LEN"];

	if(deltaLength !== undefined) { // then this part in the state is an array
		delete delta["&LEN"]; // we don't want to copy this key/value over to the state, it was just to signify it is an array
		while(state.length > deltaLength) { // pop elements off the array until the array is short enough. an increase in array size will be added below as arrays resize when keys larger are set
			state.pop();
		}
	}

	for(var key in delta) {
		if(delta.hasOwnProperty(key)) {
			var d = delta[key];
			if(d === "&RM") {
				delete state[key];
			}
			else if(isObject(d) && isObject(state[key])) {
				Joueur.prototype.mergeDelta(state[key], d); // static use in case this function is called statically
			}
			else {
				if(isObject(d)) {
					var newState = (d["&LEN"] === undefined ? {} : []);
					state[key] = Joueur.prototype.mergeDelta(newState, d);
				}
				else {
					state[key] = d;
				}
			}
		}
	}

	return state;
};

Joueur.prototype.send = function(eventName, data) {
	// NOTE: this does not serialize game objects, so don't be sending cycles like other joueurs
	var str = JSON.stringify({
		event: eventName,
		sentTime: (new Date).getTime(),
		data: data,
	});

	if(getUrlParameter("printIO")) {
		console.log("TO SERVER --> ", str);
	}

	this.ws.send(str);
};
