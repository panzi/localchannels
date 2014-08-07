Local Channels
==============

This library provides a way for browser windows opened from the same origin to communicate.
One could do basically the same thing using WebSockets, but this doesn't need any server
interaction after the web page is loaded. This means less opened connection/less server
load, but it also means that only windows of the same browser on the same machine can
communicate.

This supports Internet Exporer 8+ and every modern browser that *correctly* implements
HTML5 local storage including the storage event (e.g. Firefox, Chrome and Safari).

 * [Basic Usage](#basic-usage)
 * [TODO](#todo)
 * [Reference](#reference)
 * [License](#license)

Basic Usage
-----------

```javascript
localChannels.connect();
localChannels.onmessage = function (event) {
	alert("Got a message: "+event.data);
	event.source.postMessage("message back to source of processed message");
};
localChannels.postMessage("broadcast message");
localChannels.self().bind("some.name");
localChannels.getChannelByName("some.other.name").postMessage("message to named channel");
localChannels.postMessage("broadcast to some channels", "some.*");
localChannels.addEventListener("connect", function (event) {
	alert("channel connected: "+event.source.id());
});
```

Message `data` can be anything that survives a `JSON.stringify`/`JSON.parse` roundtrip.

TODO
----

 * write tests
 * maybe change the name? localQueues? messageQueues?
 * maybe also dispatch propertieschange, bind and unbind events to self?

Many functions of this library are synchronous (e.g.
[LocalChannels::getChannelByName](#localchannelsgetchannelbyname) and
[SelfChannel::bind](#selfchannelbind) etc.) because the underlying local storage works
synchronously as well. Currently there aren't any alternatives for the local storage that
dispatch events when something changes, but maybe there will be one in the future and maybe
(likely) that will work asynchronously. So maybe it would be a good idea to change all
functions so that they already act asynchronously and require callback arguments?

Reference
---------

This JavaScript library uses the HTML5 local storage for communication between windows from
the same origin. This is possible because whenever any window sets any local storage key the
`storage` event is dispatched to any other window of the same origin.

 * [Channels](#channels)
  * [LocalChannels](#localchannels)
  * [Channel](#channel)
  * [SelfChannel](#selfchannel)
 * [Events](#events)
  * [ConnectEvent](#connectevent)
    * [connect](#connect)
    * [disconnect](#disconnect)
  * [PropertiesChangeEvent](#propertieschangeevent)
    * [propertieschange](#propertieschange)
  * [BindingEvent](#bindingevent)
    * [bind](#bind)
    * [unbind](#unbind)
  * [MessageEvent](#messageevent)
    * [message](#message)
 * [Local Storage Keys](#local-storage-keys)

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
		SelfChannel?  self();
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

##### LocalChannels::selfId

	unsigned int? selfId();

Returns the id of the `SelfChannel` instance associated with this window. Returns `null`
if not connected.

##### LocalChannels::self

	SelfChannel? self();

Returns the `SelfChannel` instance associated with this window. Returns `null` if not connected.


##### LocalChannels::getChannelById

	Channel? getChannelById(unsigned int id) raises(TypeError);

Returns the `Channel` instance of given the id. Returns `null` if there is no such channel.

Throws `TypeError` if not connected.

##### LocalChannels::getChannelByName

	Channel? getChannelByName(String name) raises(TypeError);

Returns the `Channel` instance that is bound to the given. Returns `null` if there is no such
channel.

Throws `TypeError` if not connected.

##### LocalChannels::getChannels

	Channel[] getChannels(optional (String or FilterFunction or object) filter)
	              raises(TypeError);

Returns array of `Channel` objects. If `filter` is not given all channels (including self) are
returned. See [postMessage](#localchannelspostMessage) for a description of the `filter`
parameter.

Throws `TypeError` if not connected.

##### LocalChannels::getBindings

	object getBindings() raises(TypeError);

Returns an object that maps bound names to `Channel` objects.

Throws `TypeError` if not connected.

##### LocalChannels::postMessage

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
of the channels. So using the filter `{someKey: "SomeValue"}` the message will be dispatched
to all channels that have a `someKey` property with the value `"SomeValue"`. Note that values
are compared using `===`, so `0` and `"0"` are not equal.

Throws `TypeError` if not connected.

##### LocalChannels::connected

	boolean connected();

Returns `true` if conencted, `false` otherwise.

##### LocalChannels::connect

	Channel connect(optional ConnectParameters options) raises(TypeError);

Connect local channel. The optional `options` parameter can be used to pass a name to which
the `SelfChannel` will be [bound](#selfchannelbind) and a [properties](#selfchannelsetproperties)
map that contains the properties of the `SelfChannel`.

Throws `TypeError` if already connected.

###### LocalChannels::disconnect

	void disconnect() raises(TypeError);

Disconnect local channel.

Throws `TypeError` if not connected.

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
		boolean      hasProperty(String name);
		void         postMessage(any data);
	};

##### Channel::id

	unsigned int id();

Returns the id of the channel.

##### Channel::getNames

	String[] getNames();

Returns an array of names that are bound to this channel.

##### Channel::getProperties

	object getProperties();

Get the properties map of this channel. A channel can set arbitrary properties (key-value-pairs)
for application specific information/meta data. Property values can by any objects that
survive a `JSON.stringify`/`JSON.parse` roundtrip.

##### Channel::getProperty

	any? getProperty(String name);

Get a property by name. Returns `null` if there is no such property. Note that a
property value can also be explicitely set to `null`.

##### Channel::hasProperty

	boolean hasProperty(String name);

Returns `true` if the property with given name is set, `false` otherwise.

##### Channel::postMessage

Use this to dispatch a message to a certain channel. Message `data` can be anything that
survives a `JSON.stringify`/`JSON.parse` roundtrip. You can also send a message to
`localChannels.self()`. In that case the data parameter will not go through
`JSON.stringify`/`JSON.parse` and has to remain valid until the message is dispatched,
which still happens asynchrounously.

**TDOD:** Maybe make a copy of the data parameter/pass it through `JSON.stringify`/`JSON.parse`
anyway, so that the original value can be changed without unexpected side effects?

#### SelfChannel

`localChannels.self()` returns an object implenting this interface. This is the channel
that will be referred to as the source for all messages sent to other channels.

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

##### SelfChannel::setProperties

	void setProperties(object properties);

Sets the properties map of this channel to the passed `properties`.

A channel can set arbitrary properties (key-value-pairs) for application specific
information/meta data. Property values can by any objects that survive a
`JSON.stringify`/`JSON.parse` roundtrip.

##### SelfChannel::setProperty

	void setProperty(String name, any value);

Sets the property of given `name` to `value`.

##### SelfChannel::removeProperty

	void removeProperty(String name);

Removes the property of given `name`.

##### SelfChannel::bind

	void bind(String name, optional boolean rebind = false)
	         raises(TypeError);

Binds `name` to this channel. Unless `rebind` is true this method throws a `TypeError`
if the name is already bound, even if it is bound to this channel.

##### SelfChannel::unbind

	void unbind(String name) raises(TypeError);

Removes binding to `name` from this channel.

Throws `TypeError` if not bound to `name`.

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

The `Event` and `EventTarget` interfaces are not to be confused with the interfaces
of the same name in standard ECMAScript. These here are plain JavaScript objects only
used within this library.

`EventTarget`s support event listeners added via [addEventListener](#eventtargetaddeventlistener)
and via assigning of an appropriate `on${type}` property.

In this example two event listeners are bound to the `message` event:

```javascript
localChannels.onmessage = function (event) { ... };
localChannels.addEventListener("message", function (event) { ... });
```

Note that the `onmessage` property can only reference a single event listener for
obvious reasons.

##### EventTarget::addEventListener

	void addEventListener(String type, EventHandler listener);

Adds a `listener` for the event of given `type` to this event target. The listener
can be a function or any object that has a `call` method accepting two arguments (the
event target and the event object). A listener can be bound multiple times to the
same event.

##### EventTarget::removeEventListener

	void removeEventListener(String type, EventHandler listener);

Removes one occurence of `listener` in the handler list of event `type`.

##### EventTarget::dispatchEvent

	void dispatchEvent(Event event);

Dispatches `event` to all event listeners that are bound to `event.type` on this
event target.

##### Event::initEvent

	void initEvent(String type, Channel source);

Initialize this event. Used by the constructor of derived event objects.

##### Event::type

Event type. See the subsections of the event interfaces for possible values.

##### Event::source

Channel that caused this event.

##### Event::timeStamp

Arrival time of this event.

#### ConnectionEvent

	[Constructor(String type, Channel source)]
	interface ConnectionEvent : Event {};

##### connect

A `connect` event is dispatched to all `Channel` objects representing channels that got
connected and to the global `localChannels` objects in all windows except the one that
is the source of this event.

##### disconnect

A `disconnect` event is dispatched to all `Channel` objects representing channels that got
disconnected and to the global `localChannels` objects in all windows except the one that
is the source of this event.

#### PropertiesChangeEvent

	[Constructor(Channel source, object properties)]
	interface PropertiesChangeEvent : Event {
		attribute object properties;
	};

##### PropertiesChangeEvent::properties

The new properties map of the associated channel.

##### propertieschange

A `propertieschange` event is dispatched to all `Channel` objects representing the channel
that changed its properties and to the global `localChannels` objects in all windows except
the one that is the source of this event.

#### BindingEvent

	[Constructor(String type, Channel source, String name)]
	interface BindingEvent : Event {
		attribute String name;
	};

##### bind

A `bind` event is dispatched to the `Channel` object representing the channel that got bound
to a name and to the global `localChannels` objects in all windows except the one that is the
source of this event.

##### unbind

An `unbind` event is dispatched to the `Channel` object representing the channel that got unbound
from a name and to the global `localChannels` objects in all windows except the one that is the
source of this event.

#### MessageEvent

	[Constructor(Channel source, any data)]
	interface MessageEvent : Event {
		attribute any data;
	};

##### MessageEvent::data

The data sent via this message.

##### message

A `message` event is dispatched to the `Channel` object representing the channel that sent the
message and to the global `localChannels` objects in all windows except the one that is the
source of this event.

### Local Storage Keys

These local storage keys are used by this library:

 * `localChannels.channels`: Array of channel IDs
 * `localChannels.bindings`: Object mapping bound names to channel IDs
 * `localChannels.channel.{ID}.queue`: Array of message Objects
 * `localChannels.channel.{ID}.properties`: Object mapping property names to values

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
