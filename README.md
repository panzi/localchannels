Local Channels
==============

TODO:

 * write readme
 * maybe change name? localQueues? messageQueues?
 * maybe also dispatch propertieschange, bind and unbind events to self?

Supports Internet Exporer 8+ and every modern browser that *correctly* implements
HTML5 local storage (e.g. Firefox, Chrome and Safari).

```javascript
localChannels.connect();
...
```

### Events

 * connect
 * disconnect
 * message
 * propertieschange
 * bind
 * unbind

### Used Keys

 * localChannels.channels: Array of channel IDs
 * localChannels.bindings: Object mapping bound names to channel IDs
 * localChannels.channel.{ID}.queue: Array of message Objects
 * localChannels.channel.{ID}.properties: Object mapping property names to values
