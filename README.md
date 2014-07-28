Local Channels
==============

This library provides a way for browser windows opened from the same origin to communicate.
One could do basically the same thing using WebSockets, but this doesn't need any server
interaction after the web page is loaded. This means less opened connection/less server
load, but it also means that only windows of the same browser on the same machine can
communicate.

This supports Internet Exporer 8+ and every modern browser that *correctly* implements
HTML5 local storage (e.g. Firefox, Chrome and Safari).

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

TODO
----

 * write readme
 * maybe change the name? localQueues? messageQueues?
 * maybe also dispatch propertieschange, bind and unbind events to self?

Many functions of this library are synchronous (e.g. `LocalChannels::getChannelByName` and
`Channel::bind` etc.) because the underlying local storage works synchronously as well.
Currently there aren't any alternatives for the local storage that dispatch events when
something cahnges, but maybe there will be one in the future and maybe (likely) that will
work asynchronously. So maybe it would be a good idea to change all functions so that they
already act asynchronously and require callback arguments?

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

##### postMessage

	void postMessage(any data, optional (String or FilterFunction or object) filter)
		     raises(TypeError);

`localChannels.postMessage` can be used to dispatch a message to all other windows.
Message `data` can be anything that survives a `JSON.stringify`/`JSON.parse` roundtrip. If
the `filter` parameter is provided it will only dispatch the message to channels for which
it matches.

If `filter` is a string it will be interpreted as a channel name pattern. Such a pattern
can contain `*` as a placeholder for an arbitrary number of any characters. So to send
a message to all a channel that has the name `foo.bar` bound and also to a channel with
the name `foo.baz` you can use the pattern `foo.*`.

If `filter` is a function if will be simply called on each channel. For those channels
where the function returns a true value the message will be dispatched.


If `filter` is any other kind of object it is interpreted as a pattern on the properties
of the channels. So using the filter `{type: "SomeType"}` the message will be dispatched
to all channels that have a `type` property with the value `"SomeType"`. Note that values
are compared using `===`, so `0` and `"0"` are not equal.

#### Channel

A channel has an automatically assigned unique id.

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
	};
	
##### postMessage

Use this to dispatch a message to a certain channel. Message `data` can be anything that
survives a `JSON.stringify`/`JSON.parse` roundtrip. You can also send a message to
`localChannels.self()`. In that case the data parameter will not go through
`JSON.stringify`/`JSON.parse` and has to remain valid until the message is dispatched,
which still happens asynchrounously.

**TDOD:** Maybe make a copy of the data parameter/pass it through `JSON.stringify`/`JSON.parse`
anyway, so that the original value can be changed without unexpected side effects?

#### SelfChannel

You can also bind an arbitrary number of unique names to the self channel through which
it can be addressed by other windows. You can also attach arbitrary properties to the
self channel which other channels can query. Updating name bindings and properites will
dispatch bind, unbind and propertieschange events to the other windows.

	[Constructor(unsigned int id)]
	interface SelfChannel : Channel {
		attribute EventHandler? onmessage;
		
		void setProperties(object properties);
		void setProperty(String name, any value);
		void removeProperty(String name);
		void bind(String name, optional boolean rebind = false)
		         raises(TypeError);
		void unbind(String name) raises(TypeError);
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

The `connect` event is dispatched to the `Channel` objects representing the channel that
got connected and to the global `localChannels` objects in all windows except the one that
is the source of this event.

##### disconnect

The `disconnect` event is dispatched to the `Channel` objects representing the channel that
got disconnected and to the global `localChannels` objects in all windows except the one that
is the source of this event.

#### PropertiesChangeEvent

	[Constructor(Channel source, object properties)]
	interface PropertiesChangeEvent : Event {
		attribute object properties;
	};

##### propertieschange

The `propertieschange` event is dispatched to the `Channel` objects representing the channel that
changed its properties and to the global `localChannels` objects in all windows except the one that
is the source of this event.

#### BindingEvent

	[Constructor(String type, Channel source, String name)]
	interface BindingEvent : Event {
		attribute String name;
	};

##### bind

The `bind` event is dispatched to the `Channel` objects representing the channel that got bound
to a name and to the global `localChannels` objects in all windows except the one that is the
source of this event.

##### unbind

The `unbind` event is dispatched to the `Channel` objects representing the channel that got unbound
from a name and to the global `localChannels` objects in all windows except the one that is the
source of this event.

#### MessageEvent

	[Constructor(Channel source, any data)]
	interface MessageEvent : Event {
		attribute any data;
	};

##### message

The `message` event is dispatched to the `Channel` objects representing the channel that sent the
message and to the global `localChannels` objects in all windows except the one that is the
source of this event.

### Used Keys

These local storage keys are used:

 * localChannels.channels: Array of channel IDs
 * localChannels.bindings: Object mapping bound names to channel IDs
 * localChannels.channel.{ID}.queue: Array of message Objects
 * localChannels.channel.{ID}.properties: Object mapping property names to values

License
-------

The MIT License (MIT)

Copyright (c) 2014 Mathias Panzenböck

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
