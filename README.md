local channels
==============

TODO: write readme

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
