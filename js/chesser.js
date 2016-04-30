// Chesser - the "main" class which deals with all the input/output of the other classes, and human input

function Chesser() {
	this.$this = $("#chesser");
	this.renderingTurn = 0;
	this.renderingTurnDT = 0;
	this.playbackSpeed = 1; // num > 1.0 increase speed, numbers < 1.0 decrease speed
	var canvases = $(".canvases", this.$this).children();
	this.canvases = {};

	var self = this;
	this.$connected = $("#chesser .connected");
	this.$connect = $("#chesser .connect");
	var serverInput = $("#server").val(window.location.hostname);
	$("#tournament-server").val(window.location.hostname);
	this.$connect.submit(function(e) {
		e.preventDefault();
		var server = serverInput.val();
		var port = parseInt($("#port", this).val()) || undefined;
		var spectating = self.$connect.$spectate.is(":checked");
		self.connectTo(server, port, spectating, {
			playerName: self.$connect.$playerName.val(),
			requestedSession: $("#session", this).val(),
		});
	});

	this.$connect.$playerName = $("#player-name", this.$connect);
	this.$connect.$spectate = $("#spectate", this.$connect)
		.on("change", function() {
			if(this.checked) {
				self.$connect.$playerName.attr("disabled", true);
			}
			else {
				self.$connect.$playerName.removeAttr("disabled");
			}
		});

	this.$tournamentLogs = $("#tournament-logs");
	this.$tournamentSetup = $("#chesser .tournament .setup").submit(function(e) {
		e.preventDefault();

		// get all the inputs into an array.
		var $inputs = $(":input", self.$tournamentSetup);
		var values = {};
		var invalids = false;
		$inputs.each(function() {
			if(this.name) {
				var $this = $(this);
				var val = $this.val();
				$this.toggleClass("invalid", !val);
				if(val) {
					values[this.name] = val;
				}
				else {
					invalids = true;
				}
			}
		});

		if(invalids) {
			return;
		}

		self.$tournamentSetup.hide();
		self.tournament = new Tournament(self, values,
			function tournamentLog(str) {
				self.logTournament(str);
			},
			function tournamentError(err) {
				self.logTournament("Error: " + err, "error");
			}
		);

		self.$connect.hide();
		self.updateConnection("Awaiting connection info from Tournament");
	});

	this.tabs = {};
	$(".tabs-content", this.$this).children().each(function() {
		var $content = $(this);
		var key = $content.attr("class");
		var $tab = $(".tab-for-" + key, self.$this);
		self.tabs[key] = {
			"$content": $content,
			"$tab": $tab,
		};

		$tab.on("click", function(e) {
			e.preventDefault();
			self.setCurrentTab(key);
		});
	});

	$(".game", this.tabs.status.$content).hide();

	this.tabs.status.$currentTurn = $(".currentTurn", this.tabs.status.$content);
	this.tabs.status.confirmMove = {
		"$element": $(".confirm-move", this.tabs.status.$content),
		"$button": $(".confirm-move button", this.tabs.status.$content),
		"$message": $(".confirm-move .message", this.tabs.status.$content),
		"$promotionField": $(".confirm-move .promotion-field", this.tabs.status.$content),
		"$promotionType": $(".confirm-move #promotion-type", this.tabs.status.$content),
		"$time": $(".time", this.tabs.status.$content),
	};

	this.tabs.status.$turnSlider = $("#turn-slider", this.tabs.status.$content)
	$(document).on('input', "#turn-slider", function() {
		if(self._sliderNoChange) { // slider is updating because of the interval callback, so just ignore this event, or they arn't dragging (just mousing over)
			return;
		}

		self.pause();
		self.renderingTurn = parseInt(self.tabs.status.$turnSlider.val());
		self.renderingTurnDT = 0;
		self._update();
	});

	this.tabs.status.$playPauseButton = $("#play-pause", this.tabs.status.$content).on("click", function() {
		if(self._updateInterval) {
			self.pause();
		}
		else {
			self.play();
		}
	});

	this.tabs.status.$nextTurnButton = $("#next-turn", this.tabs.status.$content).on("click", function() {
		self.pause();
		for(var i = self.renderingTurn + 1; i < self._gameStates.length - 1; i++) {
			if(self._gameStates[i]._notMove) {
				continue;
			}

			self.renderingTurn = i;
			break;
		}
		self._update();
	});

	this.tabs.status.$prevTurnButton = $("#prev-turn", this.tabs.status.$content).on("click", function() {
		self.pause();
		for(var i = self.renderingTurn - 1; i >= 0; i--) {
			if(self._gameStates[i]._notMove) {
				continue;
			}

			self.renderingTurn = i;
			break;
		}
		self._update();
	});

	this.tabs.status.$playbackSpeed = $("#playback-speed", this.tabs.status.$content).on("change", function() {
		self.playbackSpeed = parseFloat($(this).val());
	});
	this.tabs.status.$playbackSpeed.val(this.playbackSpeed);

	this.tabs.status.$moves = $(".moves ol", this.tabs.status.$content);

	// init File tab
	this.tabs.file.$messages = $(".messages", this.tabs.file.$content);
	this.tabs.file.$loading = $("#file-loading");
	this.tabs.file.$progress = $("progress", this.tabs.file.$loading);
	if(!window.File || !window.FileReader || !window.FileList || !window.Blob) {
		this.tabs.file.$messages.append($("<li>").addClass("error").html("Error: The FileRead API is not supported by this browser, and you will not be able to load local gamelogs."));
	}
	else {
		this.tabs.file.$gamelogfile = $("#gamelog-file", this.tabs.file.$content).on("change", function() {
			var reader = new FileReader();
			reader.onloadend = function() {
				self.tabs.file.$loading.show();
				self.addFileMessage("File loaded successfully.");
				try {
					var parsed = JSON.parse(reader.result);
				}
				catch(e) {
					self.addFileMessage("Error: Could not parse the gamelog file as valid JSON - '" + e.message + "'.", "error");
				}

				self.addFileMessage("File parsed as valid JSON.");
				self._gamelogLoaded(parsed);
			};

			reader.onerror = function() {
				self.addFileMessage("Error: Could not read local gamelog file.", "error");
			};

			self.addFileMessage("Reading local gamelog file.");
			reader.readAsText(this.files[0]);
		});
	}

	this.tabs.inspect.$tree = $("#inspect-tree");
	this.tabs.inspect.$needGamelog = $(".need-game-loaded", this.tabs.inspect.$content);

	this.tabs.status.confirmMove.$button.on("click", function(e) {
		e.preventDefault();
		self._joueur.send("run", {
			caller: {id: self._activePiece.id},
			functionName: "move",
			args: {
				file: self._activeMove.to[0],
				rank: parseInt(self._activeMove.to[1]),
				promotionType: self.tabs.status.confirmMove.$promotionType.val() || "Queen",
			},
		});
	})

	this._playerColorsTop = [
		new Color(0.4, 0.4, 0.4),
		new Color(0, 0, 0)
	];

	this._playerColorsBottom = [
		new Color(1, 1, 1),
		new Color(0.2, 0.2, 0.2)
	];

	this._pieceTextTop = {
		King: String.fromCharCode(9812),
		Queen: String.fromCharCode(9813),
		Rook: String.fromCharCode(9814),
		Bishop: String.fromCharCode(9815),
		Knight: String.fromCharCode(9816),
		Pawn: String.fromCharCode(9817),
	};

	this._pieceTextBottom = {
		King: String.fromCharCode(9818),
		Queen: String.fromCharCode(9819),
		Rook: String.fromCharCode(9820),
		Bishop: String.fromCharCode(9821),
		Knight: String.fromCharCode(9822),
		Pawn: String.fromCharCode(9823),
	};

	for(var i = 0; i < canvases.length; i++) {
		var child = $(canvases[i]);
		this.canvases[child.attr("class")] = new CanvasWrapper(child, 8, 8);
	}

	this.initPlaying();

	this._drawBackground();

	var log;

	var file = getUrlParameter("file");
	if(file) {
		log = window.location.protocol + "//" + window.location.hostname + ":3080/gamelog/" + file;
	}

	log = log || getUrlParameter("log") || getUrlParameter("gamelog") || getUrlParameter("logUrl"); // logUrl to be compatible with Wyatt's visualizer url parm

	if(log) {
		this.tabs.file.$loading.show();
		this.addFileMessage("Fetching remote gamelog at '" + log + "'.");
		this.linkToGamelog(log);
		this.tabs.file.$gamelogfile.hide();
		$.ajax({
			dataType: "json",
			url: log,
			success: function(data) {
				self.addFileMessage("Remote gamelog fetched.");
				if(data.error) {
					self.addFileMessage("Fetched gamelog was an error: '" + data.error + "'.", "error");
				}
				else {
					self._gamelogLoaded(data);
				}
			},
			error: function(data) {
				self.addFileMessage("Error fetching remote gamelog.", "error");
			},
		});
	}

	this.setCurrentTab(log ? "file" : "help");
};

Chesser.prototype.linkToGamelog = function(link) {
	$("#gamelog-download").show().attr("href", link);
};

Chesser.prototype._colorize = function(rand) {
	var h = Math.round(rand*360);
	this._uiHighlightColor = new HSLColor(h, 0.5, 0.5);
	this._uiActiveHightlightColor = new HSLColor((h + 225)%360, 0.5, 0.5);
	this._drawBackground((h + 135)%360);
};

Chesser.prototype._drawBackground = function(h) {
	var lightOutter = h ? new HSLColor(h, 0.5, 0.575) : new Color(0.7, 0.7, 0.7);
	var darkOutter = h ? new HSLColor(h, 0.5, 0.425) : new Color(0.3, 0.3, 0.3);
	var lightInner = h ? new HSLColor(h, 0.5, 0.667) : new Color(0.8, 0.8, 0.8);
	var darkInner = h ? new HSLColor(h, 0.5, 0.333) : new Color(0.2, 0.2, 0.2);
	var borderWidth = 0.05;
	var borderRadius = 0.075;

	var canvas = this.canvases.background;
	for(var file = 0; file < 8; file++) {
		for(var rank = 0; rank < 8; rank++) {
			var dark = (file+rank)%2;
			canvas.drawRectangle(dark ? darkOutter : lightOutter, file, rank);
			canvas.fillRoundedRectangle(dark ? darkInner : lightInner, file + borderWidth, rank + borderWidth, 1 - borderWidth*2, 1 - borderWidth*2, borderRadius);
		}
	}
};

Chesser.prototype.connectTo = function(server, port, spectating, optionalArgs) {
	var self = this;
	this.setCurrentTab("connection");
	this.$connect.hide();

	if(!this.tournament) {
		this.logTournament("Cannot connect to Tournament during live playback");
	}

	this.$tournamentSetup.hide();
	this.playing = !spectating;
	this.tabs.file.$content.children().each(function() {
		var $child = $(this);
		$child.toggle($child.hasClass("no-load"));
	});
	this._joueur = new Joueur(server, port, spectating, optionalArgs, function(err) {
		self.updateConnection("Error connecting to " + server + ":" + port, "error");
	});

	this._gameStates = this._joueur.gameStates; // we have no gamelog rank to read gamestates from, instead the joueur client will handle fetching new gamestates as they stream in

	this.updateConnection("Attempting to connect to " + server + ":" + port);

	this._joueur.onDelta = function() {
		if(!self.isPlaying()) {
			self.play();
		}
	};

	var _startData = {};
	this._joueur.onLobbied = function(data) {
		_startData.session = data.gameSession;
		self.updateConnection("In lobby for game '" + data.gameName + "' in session '" + data.gameSession + "'.");
	};

	this._joueur.onStart = function(data) {
		self._colorize(randomFromString(_startData.session));
		self.updateConnection("Game Started!");
		$(".game", self.tabs.status.$content).show();
		$("#turn-controls", self.tabs.status.$content).hide();
		$(".no-game", self.tabs.status.$content).hide();
		self.tabs.inspect.$needGamelog.hide();
		self.playerID = data.playerID;
		self.startTime = self.playerID ? self._gameStates[0].gameObjects[self.playerID].timeRemaining: -1;
		self.setCurrentTab("status");
	};

	this._joueur.onOver = function(data) {
		self.updateConnection("Game is over. Disconnected from server.");
		if(data.gamelogURL) {
			self.linkToGamelog(data.gamelogURL);
		}
		self.over = true;
		self.setCurrentTab("connection");
	};

	this._joueur.onClose = function() {
		if(!self.over) {
			self.updateConnection("Connection closed unexpectedly...", "error");
			self.setCurrentTab("connection");
		}

		if(self.tournament) {
			self.tournament.close();
		}
	};

	if(this.playing) {
		this._joueur.onOrder = function(data) {
			self._currentOrder = data;
			self._validMoves = null;
			self._joueur.send("run", {
				caller: {id: self.playerID},
				functionName: "getMoves",
				args: {},
			});
		}

		this._joueur.onRan = function(data) {
			if(!self._validMoves) {
				delete data["&LEN"];
				self._validMoves = data;

				self._runTurn();
			}
			else { // we should have just ran a 'move', so finish our turn
				self._joueur.send("finished", {
					orderIndex: self._currentOrder.index,
					returned: true,
				});

				delete this._currentOrder;
				self.playerDone();
			}
		}
	}
};

Chesser.prototype.playerDone = function() {
	this._unselectActive();
	this._uiUnlocked = false;
	this.pausePlayerTime();
	this.tabs.status.confirmMove.$element.removeClass("run-turn");
};

Chesser.prototype.updateConnection = function(str, classes) {
	return this._addToLogList(this.$connected, str, classes);
};

Chesser.prototype.logTournament = function(str, classes) {
	return this._addToLogList(this.$tournamentLogs, str, classes);
};

Chesser.prototype.addFileMessage = function(str, classes) {
	return this._addToLogList(this.tabs.file.$messages, str, classes);
};

Chesser.prototype._addToLogList = function($list, str, classes) {
	var $li =$("<li>").html(str);
	$list.append($li);

	if(classes) {
		$li.addClass(classes);
	}
};

Chesser.prototype._emptyBoard = function() {
	this._board = this.board || [];
	for(var file = 0; file < 8; file++) {
		this._board[file] = this._board[file] || [];
		for(var rank = 0; rank < 8; rank++) {
			this._board[file][rank] = null;
		}
	}

	return this._board;
};

Chesser.prototype._cleanPos = function(obj) {
	var file;
	var rank;
	switch(typeof(obj)) {
		case "string":
			file = obj;
			rank = parseInt(obj[1]);
			break;
		case "object":
			file = obj.file;
			rank = obj.rank;
			break;
	}

	return {
		file: file.charCodeAt(0) - "a".charCodeAt(0),
		rank: 8 - rank,
	};
};

Chesser.prototype._updateBoard = function() {
	var current = this._gameStates[this.renderingTurn];
	var next = this._gameStates[this.renderingTurn + 1];
	var gameObjs = current.gameObjects;
	var nextGameObjs = next && next.gameObjects;
	this.canvases.pieces.clear();

	this._emptyBoard();

	var d = easeInOutCubic(0, this.renderingTurnDT, 0, 1, 1);

	for(var id in gameObjs) {
		if(gameObjs.hasOwnProperty(id)) {
			var gameObj = gameObjs[id];
			if(gameObj.gameObjectName === "Piece" && !gameObj.captured) {
				var pos = this._cleanPos(gameObj);
				this._board[pos.file][pos.rank] = gameObj; // for playing as a client (they should not be moving before making moves, chess is not asyncronous)

				var fadeOut = false;
				if(this.renderingTurnDT > 0 && nextGameObjs) {
					var nextGameObj = nextGameObjs[id];
					var toPos = this._cleanPos(nextGameObj);

					if(nextGameObj.captured) {
						fadeOut = true;
						toPos = pos; // instead of flying off to -1, -1
					}

					pos = {
						file: pos.file + (toPos.file - pos.file) * d,
						rank: pos.rank + (toPos.rank - pos.rank) * d,
					};
				}
				this.drawPiece(gameObj, pos.file, pos.rank, fadeOut ? 1 - this.renderingTurnDT : 1);
			}
		}
	}
};

Chesser.prototype._updateStatus = function() {
	var current = this._gameStates[this.renderingTurn];

	this.tabs.status.$currentTurn.html(current.currentTurn);

	for(var i = 0; i < current.players.length; i++) {
		var player = current.gameObjects[current.players[i].id];
		var $status = $(".player-" + i, this.tabs.status.$content);
		$(".name", $status).html(player.name);
		$status
			.addClass("client-" + player.clientType.toLowerCase())
			.removeClass("current-player");

		if(current.currentPlayer.id === player.id) {
			$status.addClass("current-player");
		}

		var reason = "";
		if(player.won) {
			reason = "Won! - &quot;" + player.reasonWon + "&quot;";
		}
		else if(player.lost) {
			reason = "Lost - &quot;" + player.reasonLost + "&quot;";
		}
		else if(player.inCheck) {
			reason = " - In Check!";
		}

		$(".reason", $status).html(reason);
	}

	this.tabs.status.$playPauseButton.html(this._updateInterval ? "&#10074;&#10074;" : "&#9658;"); // pause characters (two vertical bars) or play character (left arrow)

	this._updateMovesTable();
};

Chesser.prototype.drawPiece = function(piece, file, rank, alpha) {
	var canvas = this.canvases.pieces;

	var bottom = this._playerColorsBottom[piece.owner.id];
	bottom.a = alpha;
	var top = this._playerColorsTop[piece.owner.id];
	top.a = alpha;

	canvas.drawText(this._pieceTextBottom[piece.type], bottom, 1, file, rank);
	canvas.drawText(this._pieceTextTop[piece.type], top, 1, file, rank);

	bottom.a  = 1;
	top.a = 1;
};

Chesser.prototype.setCurrentTab = function(currentKey) {
	for(var key in this.tabs) {
		if(this.tabs.hasOwnProperty(key)) {
			var tab = this.tabs[key];
			tab.$tab.removeClass("current");
			tab.$content.removeClass("current");
			if(key === currentKey) {
				tab.$tab.addClass("current");
				tab.$content.addClass("current");
			}
		}
	}
};

var _buttons = ["left", "middle", "right"];
Chesser.prototype.initPlaying = function() {
	var self = this;
	var canvas = this.canvases.pieces.$element;
	var canvasWrapper = this.canvases.pieces;
	canvas.on("mouseup", function(e) {
		var rect = canvas[0].getBoundingClientRect();
		self._onClick(canvasWrapper.width*(e.clientX - rect.left)/canvas.width(), canvasWrapper.height*(e.clientY - rect.top)/canvas.height(), _buttons[e.button]);
	})
};

Chesser.prototype._onClick = function(x, y, button) {
	var file = Math.floor(x);
	var rank = Math.floor(y);
	var piece = this._board && this._board[file][rank];

	if(this._uiUnlocked && button === "left") {
		if(this.playing) {
			if(this._activePiece) {
				// see if they clicked a valid move tile
				for(var i = 0; i < this._activeValidMoves.length; i++) {
					var move = this._activeValidMoves[i];
					var pos = this._cleanPos(move.to);
					if(pos.file === file && pos.rank === rank) {
						return this._confirmMove(move);
					}
				}

				// otherwise unselect the active piece
				this._unselectActive();
			}
			else if(piece) {
				if(piece.owner.id === this.playerID) {
					this._activePiece = piece;
					this._makeActive(piece);
				}
			}
		}
	}

	if(button === "left" && this.playing) {
		return; // because while playing left should ONLY be used for move selection.
	}

	if(this._canInspectCanvas && piece) {
		this.pause();
		this.setCurrentTab("inspect");
		this._inspectGameObject(piece);
	}
};

Chesser.prototype._unselectActive = function() {
	this.canvases.ui.clear();
	this._activePiece = null;
	this._activeMove = null;
	this._activeValidMoves = null;
	this.tabs.status.confirmMove.$message.html("Select a piece to move.");
	this.tabs.status.confirmMove.$promotionField.removeClass("needed");
	this.tabs.status.confirmMove.$button.prop("disabled", true);
};

Chesser.prototype._runTurn = function() {
	this.tabs.status.confirmMove.$element.addClass("run-turn");
	this.tabs.status.confirmMove.$message.text("Select a piece to move.");
	this.setCurrentTab("status");
	this.tickPlayerTime();
	this._uiUnlocked = true;
};

Chesser.prototype.tickPlayerTime = function() {
	var self = this;
	var current = this._gameStates[this._gameStates.length - 1];
	var time = current.gameObjects[this.playerID].timeRemaining;
	var oneSecInNs = 1e9;
	var oneMsInNs = 1e6;

	this._playerTimeInterval = setInterval(function() {
		self.tabs.status.confirmMove.$time.html(formatTime(new Date(time/oneMsInNs)) + " / " + formatTime(new Date(self.startTime/oneMsInNs)));
		time -= oneSecInNs;
	}, 1000); // tick every second (1000ms)
};

Chesser.prototype.pausePlayerTime = function() {
	clearTimeout(this._playerTimeInterval);
	delete this._playerTimeInterval;
};

Chesser.prototype._makeActive = function(piece) {
	var moves = [];
	for(var id in this._validMoves) {
		if(this._validMoves.hasOwnProperty(id)) {
			var move = this._validMoves[id];
			if(move.from === (piece.file + piece.rank)) {
				moves.push(move);
			}
		}
	}
	this._activePiece = piece;
	this._activeValidMoves = moves;

	this._updateUI();
};

Chesser.prototype._updateUI = function() {
	var canvas = this.canvases.ui;
	canvas.clear();

	if(this._activePiece) {
		var pos = this._cleanPos(this._activePiece);
		canvas.strokeRoundedRectangle(0.1, this._uiActiveHightlightColor, pos.file, pos.rank, 1, 1, 0.2);
	}

	if(this._inspectingPiece) {
		var pos = this._cleanPos(this._inspectingPiece);
		canvas.fillRoundedRectangle(this._uiActiveHightlightColor, pos.file, pos.rank, 1, 1, 0.2);
	}

	if(this._activeValidMoves) {
	// remove duplicate position moves (pawns have 4 moves to end tiles because each move is unqiue due to 4 different promotion types)
		var moves = {};
		for(var i = 0; i < this._activeValidMoves.length; i++) {
			var validMove = this._activeValidMoves[i];
			moves[validMove.to] = moves[validMove.to] || validMove;
		}

		for(var key in moves) {
			if(moves.hasOwnProperty(key)) {
				var move = moves[key];
				var pos = this._cleanPos(move.to);
				var color = this._uiHighlightColor;
				if(this._activeMove && move.to === this._activeMove.to) {
					color = this._uiActiveHightlightColor;
				}

				canvas.fillRoundedRectangle(color, pos.file, pos.rank, 1, 1, 0.2);
			}
		}
	}
};

Chesser.prototype._confirmMove = function(move) {
	var piece = this._activePiece;
	this._activeMove = move;
	this.setCurrentTab("status");
	this.tabs.status.confirmMove.$message.html("Move " + piece.type + " #" + piece.id + " from " + move.from + " to " + move.to + "?");

	if(move.flags && move.flags.indexOf("p") >= 0) { // then this move has a promotions
		this.tabs.status.confirmMove.$promotionField.addClass("needed");
	}

	this.tabs.status.confirmMove.$button.prop("disabled", false);

	this._updateUI();
};

Chesser.prototype._updateMovesTable = function() {
	var recordedWhite = false;
	var current = this._gameStates[this.renderingTurn];

	this.tabs.status.$moves.html("");
	for(var i = 0; i < current.moves.length; i++) {
		var san = current.gameObjects[current.moves[i].id].san;

		var span;
		if(recordedWhite) {
			var li = $("li:last-child", this.tabs.status.$moves);
			span = $("<span>").addClass("black-player").appendTo(li);
		}
		else {
			li = $("<li>");
			li.appendTo(this.tabs.status.$moves);

			span = $("<span>").addClass("white-player").appendTo(li);
		}

		span.html(san);
		recordedWhite = !recordedWhite;
	}
};

Chesser.prototype._gamelogLoaded = function(parsed) {
	this.$connect.hide();
	this.updateConnection("Cannot connect to live games while playing back gamelogs.");
	this.$tournamentSetup.hide();
	this.logTournament("Cannot connect to tournaments while playing back gamelogs.");
	this.addFileMessage("Parsing gamelog.");
	this.tabs.inspect.$needGamelog.hide();
	this.tabs.file.$progress.attr("max", parsed.deltas.length);

	this._rawGamelog = parsed;
	this._gameStates = [];

	this.tabs.file.$gamelogfile.attr("disabled", true);
	this.$connect.hide();
	$(".game", this.tabs.status.$content).show();
	$(".no-game", this.tabs.status.$content).hide();

	this._asynchParse(0);
};

Chesser.prototype._asynchParse = function(i) {
	var state = this._rawGamelog.deltas[i].game;
	var prev = this._gameStates[i - 1] || {};
	Joueur.prototype.addDelta(this._gameStates, prev, state);
	this.tabs.file.$progress.attr("value", i + 1);

	i++;
	if(i < this._rawGamelog.deltas.length) {
		var self = this;
		setTimeout(function() {
			self._asynchParse(i);
		}, 0);
	}
	else {
		this.tabs.status.$turnSlider.attr("max", this._gameStates.length - 1);

		this._colorize(randomFromString(this._rawGamelog.randomSeed));

		this.setCurrentTab("status");

		this.addFileMessage("Gamelog parsed. Playing back.");
		this.tabs.file.$loading.hide();
		this.play();
	}
};

Chesser.prototype.isPlaying = function() {
	return this._updateInterval !== undefined;
};

Chesser.prototype.play = function() {
	var self = this;
	this._canInspectCanvas = true;
	this._highlightPiece(undefined);
	var dt = 1/60 // update 60 times every 1 second
	this._updateInterval = window.setInterval(function() {
		var d = dt * self.playbackSpeed;

		var oldTurn = self.renderingTurn;
		if(self.getCurrentState()._notMove) {
			d = 1; // advance 1 turn, no need to animate a non-move
		}

		self.renderingTurnDT += d;

		while(self.renderingTurnDT >= 1) {
			self.renderingTurn += 1;
			self.renderingTurnDT -= 1;

			self._sliderNoChange = true;
			self.tabs.status.$turnSlider.val(self.renderingTurn);
			self._sliderNoChange = false;
		}

		if(self.renderingTurn >= self._gameStates.length) {
			self.renderingTurn = self._gameStates.length - 1;
			self.renderingTurnDT = 0;
			self.pause();
		}

		self._update(oldTurn);
	}, dt * 1000); // interval from sec to ms
};

Chesser.prototype.getCurrentState = function() {
	return this._gameStates[this.renderingTurn];
};

Chesser.prototype.pause = function() {
	if(this._updateInterval !== undefined) {
		window.clearTimeout(this._updateInterval);
		delete this._updateInterval;

		this._update();
	}
};

Chesser.prototype._update = function(oldTurn) {
	this._updateBoard();
	this._updateStatus();
	if(oldTurn !== this.renderingTurn) {
		this._updateInspect();
	}
};

Chesser.prototype._updateInspect = function() {
	var current = this.getCurrentState();

	var $list = this.tabs.inspect.$tree.html("");

	this._updateInspectAt(current, current, "", $list);
};

Chesser.prototype._updateInspectAt = function(current, state, location, $list) {
	var self = this;
	var keys = [];
	for(var key in state) {
		if(state.hasOwnProperty(key) && key.charAt(0) !== "_") {
			keys.push(key);
		}
	}

	if(state !== current.gameObjects && (!Array.isArray || !Array.isArray(state))) {
		keys.sort();
	}
	else {
		keys.sort(function(idA, idB) {
			return parseInt(idA) - parseInt(idB);
		});
	}

	for(var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var stateObj = state[key];

		var objStr = stateObj;
		var objType = typeof(stateObj);
		switch(objType) {
			case "string":
				objStr = "&quot;" + objStr + "&quot;";
				break;
			case "object":
				if(stateObj === null) {
					objStr = "null";
					objType = "null";
					break;
				}

				if(stateObj.id) { // then it's a game object reference
					objType = "game-object";
					var gameObj = current.gameObjects[stateObj.id];
					if(gameObj.gameObjectName === "Player") {
						objStr = "Player &quot;" + gameObj.name + "&quot;";
					}
					else if(gameObj.gameObjectName === "Piece") {
						objStr = "Piece " + current.gameObjects[gameObj.owner.id].color + " " + gameObj.type;
					}
					else {
						objStr = gameObj.gameObjectName;
					}

					if(!stateObj.gameObjectName) {
						objType += "-reference";
					}

					objStr += " #" + gameObj.id;
				}
				else {
					objStr = "Dictionary[" + (Object.keys ? Object.keys(stateObj).length : "?") + "]";
					objType = "dictionary";
				}
				break;
			case "boolean":
				objStr = objStr ? "true" : "false";
				break;
		}

		if(Array.isArray && Array.isArray(stateObj)) {
			objType = "array";
			objStr = "List[" + stateObj.length + "]";
		}

		var $subList = $("<ul>");
		var $header = $("<header>")
			.append($("<span>")
				.addClass("inspect-label")
				.html(key)
			)
			.append($("<span>")
				.addClass("inspect-value")
				.html(objStr)
			);

		var loc = location + (location ? "_" : "") + key;
		var $li = $("<li>")
			.attr("id", "inspect-tree-" + loc)
			.addClass("inspect-type-" + objType)
			.append($header)
			.append($subList)
			.appendTo($list);

		if(isObject(stateObj)) {
			(function(current, stateObj, loc, $li, $subList, objType) {
				$header.on("click", function(e) {
					e.stopPropagation();

					if(objType === "game-object-reference") { // then it is a game object reference with only an id
						self._inspectGameObject(stateObj);
					}
					else {
						$li.toggleClass("inspecting");
						$li.trigger("chesser-inspect");
						self._highlightPiece($li.hasClass("inspecting") && stateObj.id);
					}
				});

				$li.on("chesser-inspect", function() {
					if($li.hasClass("inspecting") && $subList.html() === "") { // then we need to lazy load the sub list
						self._updateInspectAt(current, stateObj, loc, $subList);
						if($subList.html() === "") { // it's still empty
							$subList.html('<li><em class="inspecting-empty">empty</em></li>');
						}
					}
				});
			})(current, stateObj, loc, $li, $subList, objType);
		}
	}
};

var _highlightTimeout = undefined;
Chesser.prototype._inspectGameObject = function(obj) {
	var self = this;

	this.pause();

	this._highlightPiece(obj.id);

	if(_highlightTimeout) {
		clearTimeout(_highlightTimeout);
		_highlightTimeout = undefined;
	}

	$("#chesser #inspect-tree li.highlight").removeClass("highlight"); // remove anything else highlighted

	$("#inspect-tree-gameObjects")
		.addClass("inspecting")
		.trigger("chesser-inspect");

	$li = $("#inspect-tree-gameObjects_" + obj.id)
		.addClass("inspecting highlight")
		.trigger("chesser-inspect");

	$li[0].scrollIntoView();

	_highlightTimeout = setTimeout(function() {
		$li.removeClass("highlight");
		self._highlightPiece(undefined);
	}, 3000);
};

Chesser.prototype._highlightPiece = function(id) {
	this._inspectingPiece = undefined;
	var currentState = this.getCurrentState();
	var gameObject = currentState && currentState.gameObjects[id]; // in case it is a shallow reference
	if(gameObject && gameObject.gameObjectName === "Piece") {
		this._inspectingPiece = gameObject;
	}
	this._updateUI();
};
