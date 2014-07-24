window.localChannels = (function () {
	"use strict";

	// TODO: maybe also list self in channels?
	//       maybe allow to create multiple channels and not create one automatically? but then what would be the source channel?
	//       maybe also dispatch properties change events to self (this window)?
	var MAX_CHANNEL_ID = 4294967296; /* max unsinged 32bit integer */
	var storage = localStorage;      /* or use session storage? */

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

	var selfId;
	var channels;
	var localChannels;
	
	function LocalChannels () {}

	LocalChannels.prototype = {
		MAX_CHANNEL_ID: MAX_CHANNEL_ID,
		selfId: function () {
			return selfId;
		},
		getProperties: function () {
			var key = 'localChannels.channel.'+selfId+'.properties';
			var props = storage.getItem(key);
			return props ? JSON.parse(props) : {};
		},
		getProperty: function (name) {
			return this.getProperties()[name];
		},
		setProperties: function (properties) {
			var key = 'localChannels.channel.'+selfId+'.properties';
			storage.setItem(key, JSON.stringify(properties));
		},
		setProperty: function (name, value) {
			var key = 'localChannels.channel.'+selfId+'.properties';
			var props = storage.getItem(key);
			props = props ? JSON.parse(props) : {};
			props[name] = value;
			storage.setItem(key, JSON.stringify(props));
		},
		removeProperty: function (name, value) {
			var key = 'localChannels.channel.'+selfId+'.properties';
			var props = storage.getItem(key);
			props = props ? JSON.parse(props) : {};
			delete props[name];
			storage.setItem(key, JSON.stringify(props));
		},
		getChannel: function (id) {
			return channels[id]||null;
		},
		getChannels: function () {
			var channelList = [];
			for (var channelId in channels) {
				channelList.push(channels[channelId]);
			}
			return channelList;
		},
		// broadcast to all channels
		postMessage: function (message) {
			for (var channelId in channels) {
				var channel = channels[channelId];
				channel.postMessage(message);
			}
		}
	};
	
	function Channel (id) {
		this.__id = id;
		this.__handlers = {};
	}

	Channel.prototype = {
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
		postMessage: function (data) {
			var key = 'localChannels.channel.'+this.__id+'.queue';
			var queue = storage.getItem(key);
			queue = queue ? JSON.parse(queue) : [];
			queue.push({source: selfId, data: data});
			storage.setItem(key, JSON.stringify(queue));
		},
		addEventListener: function (event, handler) {
			if (has(this.__handlers,event)) {
				this.__handlers[event].push(handler);
			}
			else {
				this.__handlers[event] = [handler];
			}
		},
		removeEventListener: function (event, handler) {
			if (has(this.__handlers,event)) {
				var handlers = this.__handlers[event];
				var i = handlers.indexOf(handler);
				if (i >= 0) {
					hadnlers.splice(i,1);
				}
			}
		},
		dispatchEvent: function (event) {
			var type = event.type||event.eventType;
			if (has(this.__handlers,event)) {
				var handlers = this.__handlers[event];
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
	};

	init();

	observe('onstorage' in window ? window : document, "storage", function (event) {
		// Firefox Bug: always false!
		// and in IE8 event.storageArea is undefined
		// TODO: IE8 has no event.{key|oldValue|newValue|storageArea}
//		if (event.storageArea !== storage) {
//			return;
//		}
		var m;
		if (event.key === "localChannels.channels") {
			var channelIds = JSON.parse(event.newValue);
			var newChannels = {};
			for (var i = 0; i < channelIds.length; ++ i) {
				var channelId = channelIds[i];
				if (channelId !== selfId) {
					if (has(channels, channelId)) {
						newChannels[channelId] = channels[channelId];
					}
					else {
						var channel = newChannels[channelId] = new Channel(channelId);
						var newEvent = createEvent('localchannels:connect',{source:channel});
						dispatchEvent(window, newEvent);
					}
				}
			}
			for (var channelId in channels) {
				if (!has(newChannels, channelId)) {
					var channel = channels[channelId];
					var newEvent = createEvent('localchannels:disconnect',{source:channel});
					dispatchEvent(window, newEvent);
				}
			}
			channels = newChannels;
		}
		else if ((m = /^localChannels\.channel\.(\d+)\.([_a-z0-9]+)$/i.exec(event.key))) {
			var channelId = Number(m[1]);
			var field = m[2];

			switch (field) {
			case 'properties':
				if (event.newValue) {
					var channel = channels[channelId];
					var properties = JSON.parse(event.newValue);
					var newEvent = createEvent('localchannels:propertieschange',{source:channel,properties:properties});
					channel.dispatchEvent(newEvent);
					if (!chanceled(newEvent)) {
						dispatchEvent(window, newEvent);
					}
				}
				break;

			case 'queue':
				if (event.newValue && selfId === channelId) {
					var queue = JSON.parse(event.newValue);
					// removeItem does not work here for IE
					event.storageArea.setItem(event.key,"[]");
						
					for (var i = 0; i < queue.length; ++ i) {
						var message = queue[i];
						var source = channels[message.source];
						var newEvent = createEvent('localchannels:message',{source:source,data:message.data});
						dispatchEvent(window, newEvent);
					}
				}
				break;
			}
		}
	});

	observe(window, "unload", function (event) {
		var channelIds = storage.getItem("localChannels.channels");
		if (channelIds) {
			channelIds = JSON.parse(channelIds);
			var i = channelIds.indexOf(selfId);
			if (i >= 0) {
				channelIds.splice(i,1);
				storage.setItem("localChannels.channels", JSON.stringify(channelIds));
				storage.removeItem("localChannels.channel."+selfId+".queue");
				storage.removeItem("localChannels.channel."+selfId+".properties");
			}
		}
	});

	function chanceled (event) {
		return 'cancelBubble' in event ? event.cancelBubble : event.returnValue === false;
	}

	function init () {
		localChannels = new LocalChannels();
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
	}

	function createEvent (type, properties) {
		var event;

		if (document.createEvent) {
			event = document.createEvent("Event");
			event.initEvent(type, true, true);
		}
		else if (document.createEventObject) {
			event = document.createEventObject();
			event.eventType = type;
		}
		else {
			event = new CustomEvent(type, {bubbles: true, cancelable: true});
		}

		for (var key in properties) {
			event[key] = properties[key];
		}

		return event;
	}

	function dispatchEvent (context, event) {
		if (context.dispatchEvent) {
			context.dispatchEvent(event);
		}
		else {
			context.fireEvent("on"+event.eventType, event);
		}
	}

	return localChannels;
})();
