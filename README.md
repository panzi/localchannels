Local Channels
==============

This library provides a way for browser windows opened from the same origin to communicate.
One could do basically the same thing using WebSockets, but this doesn't need any server
interaction after the web page is loaded. This means less opened connection/less server
load, but it also means that only windows of the same browser on the same machine can
communicate.

This supports Internet Exporer 8+ and every modern browser that *correctly* implements
HTML5 local storage (e.g. Firefox, Chrome and Safari).

TODO:

 * write readme
 * maybe change name? localQueues? messageQueues?
 * maybe also dispatch propertieschange, bind and unbind events to self?

Basic Usage
-----------

```javascript
localChannels.connect();
localChannels.onmessage = function (event) {
	alert("Got a message: "+event.data);
};
localChannels.postMessage("broadcast message");
localChannels.self().bind("some.name");
localChannels.getChannelByName("some.other.name").postMessage("message to named channel");
localChannels.postMessage("broadcast to some channels", "some.*");
```

Message `data` can be anything that survives a `JSON.stringify`/`JSON.parse` roundtrip.

Reference
---------

This JavaScript library uses the HTML5 local storage for communication between windows from
the same origin. This is possible because whenever any window sets any local storage key the
`storage` event is dispatched to any other window of the same origin.

### Channels

#### LocalChannels

There is one global instance of the `LocalChannles` interface `window.localChannles`.

	dictionary ConnectParameters {
		attribute String? name;
		attribute boolean rebind = false;
		attribute object? properties;
	};
	
	callback FilterFunction = boolean(Channel channel);
	
	interface LocalChannels : EventTarget {
		const unsigned int MAX_CHANNEL_ID = 0xFFFFFFFF;
		attribute EventHandler? onconnect;
		attribute EventHandler? ondisconnect;
		attribute EventHandler? onmessage;
		attribute EventHandler? onpropertieschange;
		attribute EventHandler? onbind;
		attribute EventHandler? onunbind;
	
		unsigned int? selfId();
		Channel?      self();
		Channel?      getChannelById(unsigned int id) raises(TypeError);
		Channel?      getChannelByName(String name) raises(TypeError);
		Channel[]     getChannels(optional (String or FilterFunction or object) filter)
		                  raises(TypeError);
		object        getBindings() raises(TypeError);
		void          postMessage(any data, optional (String or FilterFunction or object) filter)
		                  raises(TypeError);
		boolean       connected();
		Channel       connect(optional ConnectParameters options) raises(TypeError);
		void          disconnect() raises(TypeError);
	};
	
#### Channel

	[Constructor(unsigned int id)]
	interface Channel : EventTarget {
		attribute EventHandler? onconnect;
		attribute EventHandler? ondisconnect;
		attribute EventHandler? onpropertieschange;
		attribute EventHandler? onbind;
		attribute EventHandler? onunbind;
	
		unsigned int id();
		String[]     getNames();
		object       getProperties();
		any?         getProperty(String name);
		void         postMessage(any data);
		void         bind(String name, optional boolean rebind = false)
		                 raises(TypeError);
		void         unbind(String name) raises(TypeError);
	};
	
#### SelfChannel

	[Constructor(unsigned int id)]
	interface SelfChannel : Channel {
		attribute EventHandler? onmessage;
		
		void setProperties(object properties);
		void setProperty(String name, any value);
		void removeProperty(String name);
	};

### Events

	callback EventHandler = void(Event event);
	
	interface EventTarget {
		void addEventListener(String type, EventHandler listener);
		void removeEventListener(String type, EventHandler listener);
		void dispatchEvent(Event event);
	};
	
	interface Event {
		void initEvent(String type, Channel source);
		
		attribute String  type;
		attribute Channel source;
		attribute Number  timeStamp;
	};


#### ConnectionEvent

	[Constructor(String type, Channel source)]
	interface ConnectionEvent : Event {};

##### connect


##### disconnect


#### PropertiesChangeEvent

	[Constructor(Channel source, object properties)]
	interface PropertiesChangeEvent : Event {
		attribute object properties;
	};

##### propertieschange

#### BindingEvent

	[Constructor(String type, Channel source, String name)]
	interface BindingEvent : Event {
		attribute String name;
	};

##### bind


##### unbind


#### MessageEvent

	[Constructor(Channel source, any data)]
	interface MessageEvent : Event {
		attribute any data;
	};

##### message


### Used Keys

These local storage keys are used:

 * localChannels.channels: Array of channel IDs
 * localChannels.bindings: Object mapping bound names to channel IDs
 * localChannels.channel.{ID}.queue: Array of message Objects
 * localChannels.channel.{ID}.properties: Object mapping property names to values
