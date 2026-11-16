# Query Log Guidance

Call the callbacks of a log object as its methods: the default callbacks take
`colors` and the logger from the log object they are called on. A log object
passed as a `log` option keeps its settings and callbacks, and its default
callbacks write to the given logger.
