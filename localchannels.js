window.localChannels = (function () {
	"use strict";

	// TODO: maybe also dispatch propertieschange, bind and unbind events to self?
	//       maybe rename to localQueues? messageQueues?
	var MAX_CHANNEL_ID = 0xFFFFFFFF; // max unsigned 32bit integer, it's big and can be expressed by double
	var storage = localStorage;

	if (!Array.prototype.indexOf) {
		Array.prototype.indexOf = function (value) {
			for (var i = 0; i < this.length; ++ i) {
				if (this[i] === value) {
					return i;
				}
			}
			return -1;
		};
	}

	var has = (function (hasOwnProperty) {
		return function (obj, prop) {
			return hasOwnProperty.call(obj, prop);
		};
	})(Object.prototype.hasOwnProperty);

	var observe = window.addEventListener ?
		function (context, event, handler) {
			context.addEventListener(event, handler, false);
		} :
		function (context, event, handler) {
			context.attachEvent('on'+event,
				handler.__localChannels_wrapper || (handler.__localChannels_wrapper = function () {
					handler.call(this,window.event);
				}));
		};

	var unobserve = window.addEventListener ?
		function (context, event, handler) {
			context.removeEventListener(event, handler);
		} :
		function (context, event, handler) {
			context.detachEvent('on'+event, handler.__localChannels_wrapper);
		};

	var notifyEvent = 'onstorage' in window ? function (type, properties) {
			// done via event.key in storage event handler
		} :
		function (type, properties) {
			// IE8 has no event.{key|newValue} so this manually sends such messages to all channels
			var message = {source: selfId, type: type};
			if (properties) extend(message, properties);
			localChannels.__postMessage(message);
		};
	
	function EventTarget () {}

	EventTarget.prototype = {
		addEventListener: function (event, handler) {
			if (!this.__event_target_handlers) {
				this.__event_target_handlers = {};
			}
			if (has(this.__event_target_handlers,event)) {
				this.__event_target_handlers[event].push(handler);
			}
			else {
				this.__event_target_handlers[event] = [handler];
			}
		},
		removeEventListener: function (event, handler) {
			if (!__event_target_handlers) return;
			if (has(this.__event_target_handlers,event)) {
				var handlers = this.__event_target_handlers[event];
				var i = handlers.indexOf(handler);
				if (i >= 0) {
					hadnlers.splice(i,1);
				}
			}
		},
		dispatchEvent: function (event) {
			if (!this.__event_target_handlers) return;
			if (has(this.__event_target_handlers,event.type)) {
				var handlers = this.__event_target_handlers[event.type];
				for (var i = 0; i < handlers.length; ++ i) {
					try {
						handlers[i].call(this,event);
					}
					catch (e) {
						if (window.console) {
							console.error(e);
						}
					}
				}
			}
		}
	}
	
	function LocalChannels () {}

	LocalChannels.prototype = extend(new EventTarget(), {
		MAX_CHANNEL_ID: MAX_CHANNEL_ID,
		selfId: function () {
			return selfId;
		},
		self: function () {
			return channels[selfId]||null;
		},
		getChannelById: function (id) {
			if (selfId === null) throw new TypeError("local channel is not connected");
			return channels[id]||null;
		},
		getChannelByName: function (name) {
			if (selfId === null) throw new TypeError("local channel is not connected");
			var bindings = this.__getBindings();

			if (!has(bindings, name)) {
				return null;
			}

			var id = bindings[name];
			return channels[id]||null;
		},
		getChannels: function () {
			if (selfId === null) throw new TypeError("local channel is not connected");
			var channelList = [];
			for (var channelId in channels) {
				channelList.push(channels[channelId]);
			}
			return channelList;
		},
		getBindings: function () {
			if (selfId === null) throw new TypeError("local channel is not connected");
			var bindings = {};
			var idBindings = this.__getBindings();
			for (var name in idBindings) {
				var id = idBindings[name];
				if (has(channels,id)) {
					bindings[name] = channels[id];
				}
			}
			return bindings;
		},
		__getBindings: function () {
			var bindings = storage.getItem("localChannels.bindings");
			try {
				bindings = bindings ? JSON.parse(bindings) : {};
			}
			catch (e) {
				bindings = {};
				if (window.console) console.error(e);
			}
			return bindings;
		},
		// broadcast to all channels
		postMessage: 'onstorage' in window ? function (data, filter) {
			this.__postMessage({source: selfId, data: data}, filter);
		} : function (data, filter) {
			this.__postMessage({source: selfId, data: data, type: 'message'}, filter);
		},
		__postMessage: function (message, filter) {
			if (selfId === null) throw new TypeError("local channel is not connected");
			if (filter) {
				for (var channelId in channels) {
					if (channelId != selfId) {
						var channel = channels[channelId];
						var properties = channel.getProperties();
						var matches = true;
						for (var key in filter) {
							if (properties[key] !== filter[key]) {
								matches = false;
								break;
							}
						}
						if (matches) {
							channel.__postMessage(message);
						}
					}
				}
			}
			else {
				for (var channelId in channels) {
					if (channelId != selfId) {
						channels[channelId].__postMessage(message);
					}
				}
			}
		},
		connected: function () {
			return selfId !== null;
		},
		connect: function (options) {
			if (selfId !== null) throw new TypeError("local channel is already connected");
			if (!options) options = {};

			var channelIds = storage.getItem("localChannels.channels");
			try {
				channelIds = channelIds ? JSON.parse(channelIds) : [];
			}
			catch (e) {
				channelIds = [];
				if (window.console) console.error(e);
			}
			channels = {};
			for (var i = 0; i < channelIds.length; ++ i) {
				var channelId = channelIds[i];
				channels[channelId] = new Channel(channelId);
			}
			channelIds.sort();
			var maxId = channelIds.length > 0 ? channelIds[channelIds.length - 1] : -1;
			var id;
			if (maxId < MAX_CHANNEL_ID) {
				id = maxId + 1;
			}
			else {
				id = 0; // wrap around
				while (id <= MAX_CHANNEL_ID && has(channels, id)) { ++ id; }
				if (id === MAX_CHANNEL_ID) {
					// the browser should run out of memory before this happens anyway
					// also it should take for ever to reach this point
					throw new TypeError("too many open channels");
				}
			}
			selfId = id;
			var self = channels[id] = new SelfChannel(id);
			channelIds.push(id);

			var bindings;
			if (options.name != undefined) {
				bindings = storage.getItem("localChannels.bindings");
				try {
					bindings = bindings ? JSON.parse(bindings) : {};
				}
				catch (e) {
					bindings = {};
					if (window.console) console.error(e);
				}
				if (!options.rebind && has(bindings, options.name)) {
					throw new TypeError("local channel name already bound: "+options.name);
				}
				bindings[options.name] = selfId;
			}

			storage.setItem("localChannels.channels", JSON.stringify(channelIds));
			notifyEvent('channelschange');
			
			if (options.name != undefined) {
				storage.setItem('localChannels.bindings', JSON.stringify(bindings));
				notifyEvent('bind', {name: options.name});
			}

			if (options.properties) {
				this.setProperties(options.properties);
			}

			if ('onstorage' in window) {
				observe(window, "storage", handleStorage);
			}
			else if ('onstorage' in document) {
				observe(document, "storage", handleStorageIE8);
			}

			observe(window, "unload", handleUnload);

			return self;
		},
		disconnect: function () {
			if (selfId === null) throw new TypeError("local channel is not connected");

			// unbind all bound names (if any)
			var bindings = this.__getBindings();
			var newBindings = {};
			var unbound = [];
			for (var name in bindings) {
				var id = bindings[name];
				if (id === selfId) {
					unbound.push(name);
				}
				else {
					newBindings[name] = id;
				}
			}

			if (unbound.length > 0) {
				storage.setItem("localChannels.bindings", JSON.stringify(bindings));
				for (var i = 0; i < unbound.length; ++ i) {
					notifyEvent("unbind", {name: unbound[i]});
				}
			}

			// remove from listed channels
			var channelIds = storage.getItem("localChannels.channels");
			if (channelIds) {
				channelIds = JSON.parse(channelIds);
				var i = channelIds.indexOf(selfId);
				if (i >= 0) {
					channelIds.splice(i,1);
					storage.setItem("localChannels.channels", JSON.stringify(channelIds));
					notifyEvent('channelschange');
				}
			}

			// remove channel data
			storage.removeItem("localChannels.channel."+selfId+".queue");
			storage.removeItem("localChannels.channel."+selfId+".properties");

			if ('onstorage' in window) {
				unobserve(window, "storage", handleStorage);
			}
			else if ('onstorage' in document) {
				unobserve(document, "storage", handleStorageIE8);
			}

			unobserve(window, "unload", handleUnload);

			selfId   = null;
			channels = null;
		}
	});
	
	function Channel (id) {
		this.__id = id;
	}

	Channel.prototype = extend(new EventTarget(), {
		id: function () {
			return this.__id;
		},
		getNames: function () {
			var bindings = localChannels.__getBindings();
			var names = [];
			for (var name in bindings) {
				if (bindings[name] === this.__id) {
					names.push(name);
				}
			}
			return names;
		},
		getProperties: function () {
			var props = storage.getItem('localChannels.channel.'+this.__id+'.properties');
			return props ? JSON.parse(props) : {};
		},
		getProperty: function (name) {
			return this.getProperty()[name];
		},
		postMessage: 'onstorage' in window ? function (data) {
			this.__postMessage({source: selfId, data: data});
		} : function (data) {
			this.__postMessage({source: selfId, data: data, type: 'message'});
		},
		__postMessage: function (message) {
			var key = 'localChannels.channel.'+this.__id+'.queue';
			var queue = storage.getItem(key);
			queue = queue ? JSON.parse(queue) : [];
			queue.push(message);
			storage.setItem(key, JSON.stringify(queue));
		},
		bind: function (name, rebind) {
			var bindings = localChannels.__getBindings();

			if (!rebind && has(bindings, name)) {
				throw new TypeError("local channel name already bound: "+name);
			}
			bindings[name] = this.__id;
			storage.setItem('localChannels.bindings', JSON.stringify(bindings));
			notifyEvent('bind', {name: name});
		},
		unbind: function (name) {
			var bindings = localChannels.__getBindings();
			if (!has(bindings, name) || bindings[name] !== this.__id) {
				throw new TypeError("name not bound to local channel");
			}
			delete bindings[name];
			storage.setItem('localChannels.bindings', JSON.stringify(bindings));
			notifyEvent('unbind', {name: name});
		}
	});

	function SelfChannel (id) {
		this.__id = id;
	}

	SelfChannel.prototype = extend(new Channel(null), {
		setProperties: function (properties) {
			var key = 'localChannels.channel.'+this.__id+'.properties';
			storage.setItem(key, JSON.stringify(properties));
			notifyEvent('propertieschange');
		},
		setProperty: function (name, value) {
			var key = 'localChannels.channel.'+this.__id+'.properties';
			var props = storage.getItem(key);
			props = props ? JSON.parse(props) : {};
			props[name] = value;
			storage.setItem(key, JSON.stringify(props));
			notifyEvent('propertieschange');
		},
		removeProperty: function (name, value) {
			var key = 'localChannels.channel.'+this.__id+'.properties';
			var props = storage.getItem(key);
			props = props ? JSON.parse(props) : {};
			delete props[name];
			storage.setItem(key, JSON.stringify(props));
			notifyEvent('propertieschange');
		},
		postMessage: function (data) {
			var self = this;
			setTimeout(function () {
				var event = new MessageEvent(self, data);
				self.dispatchEvent(event);
				localChannels.dispatchEvent(event);
			}, 0);
		}
	});

	function extend (obj, other) {
		for (var key in other) {
			obj[key] = other[key];
		}
		return obj;
	}

	function updateChannels (channelIds) {
		var newChannels = {};
		var events = [];

		for (var i = 0; i < channelIds.length; ++ i) {
			var channelId = channelIds[i];
			if (has(channels, channelId)) {
				newChannels[channelId] = channels[channelId];
			}
			else {
				var channel = newChannels[channelId] = new Channel(channelId);
				events.push(new ConnectEvent(channel));
			}
		}

		for (var channelId in channels) {
			if (!has(newChannels, channelId)) {
				var channel = channels[channelId];
				events.push(new DisconnectEvent(channel));
			}
		}

		channels = newChannels;

		// dispatch events after channel map was updated
		for (var i = 0; i < events.length; ++ i) {
			var event = events[i];
			event.source.dispatchEvent(event);
			localChannels.dispatchEvent(event);
		}
	}

	function updateProperties (channelId, properties) {
		var channel = channels[channelId];
		var event = new PropertiesChangeEvent(channel,properties);
		channel.dispatchEvent(event);
		localChannels.dispatchEvent(event);
	}

	function processQueue (queue) {
		// removeItem does not work here for IE
		storage.setItem("localChannels.channel."+selfId+".queue","[]");

		for (var i = 0; i < queue.length; ++ i) {
			try {
				var message = queue[i];
				processMessage(message);
			}
			catch (e) {
				if (window.console) console.error(e);
			}
		}
	}

	function handleStorage (event) {
		// Firefox Bug: always false!
		// and in IE8 event.storageArea is undefined
//		if (event.storageArea !== storage) {
//			return;
//		}
		if (event.key === "localChannels.channels") {
			updateChannels(JSON.parse(event.newValue));
		}
		else if (event.key === "localChannels.bindings") {
			var oldBindings = event.oldValue;
			var newBindings = event.newValue;

			try {
				oldBindings = oldBindings ? JSON.parse(oldBindings) : {};
			}
			catch (e) {
				oldBindings = {};
				if (window.console) console.error(e);
			}

			newBindings = newBindings ? JSON.parse(newBindings) : {};
			for (var name in oldBindings) {
				var id = oldBindings[name];
				if (!has(newBindings, name) || newBindings[name] !== id) {
					var channel = channels[id];
					var newEvent = new UnbindEvent(channel, name);
					channel.dispatchEvent(newEvent);
					localChannels.dispatchEvent(newEvent);
				}
			}

			for (var name in newBindings) {
				var id = newBindings[name];
				if (!has(oldBindings, name) || oldBindings[name] !== id) {
					var channel = channels[id];
					var newEvent = new BindEvent(channel, name);
					channel.dispatchEvent(newEvent);
					localChannels.dispatchEvent(newEvent);
				}
			}
		}
		else {
			var key = event.key.split(".");
			if (key.length === 4 && key[0] === "localChannels" && key[1] === "channel") {
				var channelId = Number(key[2]);
				var field = key[3];

				switch (field) {
				case 'properties':
					if (event.newValue) {
						updateProperties(channelId, JSON.parse(event.newValue));
					}
					break;

				case 'queue':
					if (event.newValue && selfId === channelId) {
						processQueue(JSON.parse(event.newValue));
					}
					break;
				}
			}
		}
	}

	function handleStorageIE8 (event) {
		// IE8 has not event.{key|newValue|oldValue|storageArea} properties,
		// so I have to explicitely send all events to all channels.
		var key = "localChannels.channel."+selfId+".queue";
		var queue = storage.getItem(key);
		queue = queue ? JSON.parse(queue) : [];
		storage.setItem(key,"[]");

		for (var i = 0; i < queue.length; ++ i) {
			try {
				var message = queue[i];
				switch (message.type) {
				case "message":
					processMessage(message);
					break;

				case "propertieschange":
					var properties = storage.getItem("localChannels.channel."+message.source+".properties");
					updateProperties(message.source, properties ? JSON.parse(properties) : {});
					break;

				case "channelschange":
					var channelIds = storage.getItem("localChannels.channels");
					updateChannels(channelIds ? JSON.parse(channelIds) : []);
					break;

				case "bind":
					var channel = channels[message.source];
					var newEvent = new BindEvent(channel, message.name);
					channel.dispatchEvent(newEvent);
					localChannels.dispatchEvent(newEvent);
					break;

				case "unbind":
					var channel = channels[message.source];
					var newEvent = new UnbindEvent(channel, message.name);
					channel.dispatchEvent(newEvent);
					localChannels.dispatchEvent(newEvent);
					break;
				}
			}
			catch (e) {
				if (window.console) console.error(e);
			}
		}
	}

	function handleUnload (event) {
		localChannels.disconnect();
	}

	function processMessage (message) {
		var channel = channels[message.source];
		var event = new MessageEvent(channel, message.data);
		channels[selfId].dispatchEvent(event);
		localChannels.dispatchEvent(event);
	}

	function Event () {}

	Event.prototype = {
		initEvent: function (type, source) {
			this.type      = type;
			this.source    = source;
			this.timeStamp = +new Date();
		}
	};

	function ConnectEvent (source) {
		this.initEvent('connect', source);
	}

	function DisconnectEvent (source) {
		this.initEvent('disconnect', source);
	}

	function PropertiesChangeEvent (source, properties) {
		this.initEvent('propertieschange', source);
		this.properties = properties;
	}

	function BindEvent (source, name) {
		this.initEvent('bind', source);
		this.name = name;
	}

	function UnbindEvent (source, name) {
		this.initEvent('unbind', source);
		this.name = name;
	}

	function MessageEvent (source, data) {
		this.initEvent('message', source);
		this.data = data;
	}

	ConnectEvent.prototype          = new Event();
	DisconnectEvent.prototype       = new Event();
	PropertiesChangeEvent.prototype = new Event();
	BindEvent.prototype             = new Event();
	UnbindEvent.prototype           = new Event();
	MessageEvent.prototype          = new Event();

	var selfId   = null;
	var channels = null;
	var localChannels = new LocalChannels();

	return localChannels;
})();
