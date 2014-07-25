window.localChannels = (function () {
	"use strict";

	// TODO: maybe also list self in channels?
	//       maybe allow to create multiple channels and not create one automatically? but then what would be the source channel?
	//       maybe also dispatch properties change events to self?
	var MAX_CHANNEL_ID = 4294967296; /* max unsinged 32bit integer */
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

	var notifyEvent = 'onstorage' in window ? function (type) { /* done via event.key in storage event handler */ } :
		function (type) {
			/* IE8 has no event.{key|newValue} so this manually sends such messages to all channels */
			localChannels.__postMessage({source: selfId, type: type});
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
		getProperties: function () {
			if (selfId === null) throw new TypeError("local channel is not connected");
			var key = 'localChannels.channel.'+selfId+'.properties';
			var props = storage.getItem(key);
			return props ? JSON.parse(props) : {};
		},
		getProperty: function (name) {
			return this.getProperties()[name];
		},
		setProperties: function (properties) {
			if (selfId === null) throw new TypeError("local channel is not connected");
			var key = 'localChannels.channel.'+selfId+'.properties';
			storage.setItem(key, JSON.stringify(properties));
			notifyEvent('propertieschange');
		},
		setProperty: function (name, value) {
			if (selfId === null) throw new TypeError("local channel is not connected");
			var key = 'localChannels.channel.'+selfId+'.properties';
			var props = storage.getItem(key);
			props = props ? JSON.parse(props) : {};
			props[name] = value;
			storage.setItem(key, JSON.stringify(props));
			notifyEvent('propertieschange');
		},
		removeProperty: function (name, value) {
			if (selfId === null) throw new TypeError("local channel is not connected");
			var key = 'localChannels.channel.'+selfId+'.properties';
			var props = storage.getItem(key);
			props = props ? JSON.parse(props) : {};
			delete props[name];
			storage.setItem(key, JSON.stringify(props));
			notifyEvent('propertieschange');
		},
		getChannel: function (id) {
			if (selfId === null) throw new TypeError("local channel is not connected");
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
		// broadcast to all channels
		postMessage: 'onstorage' in window ? function (data, filter) {
			this.__postMessage({source: selfId, data: data}, filter);
		} : function (data) {
			this.__postMessage({source: selfId, data: data, type: 'message'}, filter);
		},
		__postMessage: function (message, filter) {
			if (selfId === null) throw new TypeError("local channel is not connected");
			if (filter) {
				for (var channelId in channels) {
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
			else {
				for (var channelId in channels) {
					channels[channelId].__postMessage(message);
				}
			}
		},
		connected: function () {
			return selfId !== null;
		},
		connect: function (properties) {
			if (selfId !== null) throw new TypeError("local channel is already connected");

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
			channelIds.push(id);
			storage.setItem("localChannels.channels", JSON.stringify(channelIds));
			notifyEvent('channelschange');
			if (properties) {
				this.setProperties(properties);
			}

			if ('onstorage' in window) {
				observe(window, "storage", handleStorage);
			}
			else if ('onstorage' in document) {
				observe(document, "storage", handleStorageIE8);
			}

			observe(window, "unload", handleUnload);

			return id;
		},
		disconnect: function () {
			if (selfId === null) throw new TypeError("local channel is not connected");

			var channelIds = storage.getItem("localChannels.channels");
			if (channelIds) {
				channelIds = JSON.parse(channelIds);
				var i = channelIds.indexOf(selfId);
				if (i >= 0) {
					channelIds.splice(i,1);
					storage.setItem("localChannels.channels", JSON.stringify(channelIds));
					storage.removeItem("localChannels.channel."+selfId+".queue");
					storage.removeItem("localChannels.channel."+selfId+".properties");
					notifyEvent('channelschange');
				}
			}
			selfId = null;

			if ('onstorage' in window) {
				unobserve(window, "storage", handleStorage);
			}
			else if ('onstorage' in document) {
				unobserve(document, "storage", handleStorageIE8);
			}

			unobserve(window, "unload", handleUnload);
		}
	});
	
	function Channel (id) {
		this.__id = id;
	}

	Channel.prototype = extend(new EventTarget(), {
		id: function () {
			return this.__id;
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
		for (var i = 0; i < channelIds.length; ++ i) {
			var channelId = channelIds[i];
			if (channelId !== selfId) {
				if (has(channels, channelId)) {
					newChannels[channelId] = channels[channelId];
				}
				else {
					var channel = newChannels[channelId] = new Channel(channelId);
					localChannels.dispatchEvent(new ConnectEvent(channel));
				}
			}
		}
		for (var channelId in channels) {
			if (!has(newChannels, channelId)) {
				var channel = channels[channelId];
				localChannels.dispatchEvent(new DisconnectEvent(channel));
			}
		}
		channels = newChannels;
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
		// TODO: IE8 has no event.{key|oldValue|newValue|storageArea}
//		if (event.storageArea !== storage) {
//			return;
//		}
		var m;
		if (event.key === "localChannels.channels") {
			updateChannels(JSON.parse(event.newValue));
		}
		else if ((m = /^localChannels\.channel\.(\d+)\.([_a-zA-Z0-9]+)$/.exec(event.key))) {
			var channelId = Number(m[1]);
			var field = m[2];

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
		var event = new MessageEvent(channel,message.data);
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

	function MessageEvent (source, data) {
		this.initEvent('message', source);
		this.data = data;
	}

	ConnectEvent.prototype          = new Event();
	DisconnectEvent.prototype       = new Event();
	PropertiesChangeEvent.prototype = new Event();
	MessageEvent.prototype          = new Event();

	var selfId = null;
	var channels;
	var localChannels = new LocalChannels();

	return localChannels;
})();
