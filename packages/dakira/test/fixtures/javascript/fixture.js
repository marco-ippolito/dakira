// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

const {
	ArrayIsArray,
	FunctionPrototypeCall,
	MathMin,
	ObjectKeys,
	ObjectSetPrototypeOf,
	RegExpPrototypeExec,
	ReflectApply,
	SymbolAsyncDispose,
	SymbolFor,
} = primordials;

const net = require("net");
const EE = require("events");
const assert = require("internal/assert");
const {
	parsers,
	freeParser,
	continueExpression,
	chunkExpression,
	kIncomingMessage,
	HTTPParser,
	isLenient,
	_checkInvalidHeaderChar: checkInvalidHeaderChar,
	prepareError,
} = require("_http_common");
const { ConnectionsList } = internalBinding("http_parser");
const {
	kUniqueHeaders,
	parseUniqueHeadersOption,
	OutgoingMessage,
} = require("_http_outgoing");
const {
	kOutHeaders,
	kNeedDrain,
	isTraceHTTPEnabled,
	traceBegin,
	traceEnd,
	getNextTraceEventId,
} = require("internal/http");
const {
	defaultTriggerAsyncIdScope,
	getOrSetAsyncId,
} = require("internal/async_hooks");
const { IncomingMessage } = require("_http_incoming");
const { connResetException, codes } = require("internal/errors");
const {
	ERR_HTTP_REQUEST_TIMEOUT,
	ERR_HTTP_HEADERS_SENT,
	ERR_HTTP_INVALID_STATUS_CODE,
	ERR_HTTP_SOCKET_ENCODING,
	ERR_HTTP_SOCKET_ASSIGNED,
	ERR_INVALID_ARG_VALUE,
	ERR_INVALID_CHAR,
} = codes;
const { kEmptyObject, promisify } = require("internal/util");
const {
	validateInteger,
	validateBoolean,
	validateLinkHeaderValue,
	validateObject,
} = require("internal/validators");
const Buffer = require("buffer").Buffer;
const { setInterval, clearInterval } = require("timers");
let debug = require("internal/util/debuglog").debuglog("http", (fn) => {
	debug = fn;
});

const dc = require("diagnostics_channel");
const onRequestStartChannel = dc.channel("http.server.request.start");
const onResponseFinishChannel = dc.channel("http.server.response.finish");

const kServerResponse = Symbol("ServerResponse");
const kServerResponseStatistics = Symbol("ServerResponseStatistics");

const { hasObserver, startPerf, stopPerf } = require("internal/perf/observe");

const STATUS_CODES = {
	100: "Continue", // RFC 7231 6.2.1
	101: "Switching Protocols", // RFC 7231 6.2.2
	102: "Processing", // RFC 2518 10.1 (obsoleted by RFC 4918)
	103: "Early Hints", // RFC 8297 2
	200: "OK", // RFC 7231 6.3.1
	201: "Created", // RFC 7231 6.3.2
	202: "Accepted", // RFC 7231 6.3.3
	203: "Non-Authoritative Information", // RFC 7231 6.3.4
	204: "No Content", // RFC 7231 6.3.5
	205: "Reset Content", // RFC 7231 6.3.6
	206: "Partial Content", // RFC 7233 4.1
	207: "Multi-Status", // RFC 4918 11.1
	208: "Already Reported", // RFC 5842 7.1
	226: "IM Used", // RFC 3229 10.4.1
	300: "Multiple Choices", // RFC 7231 6.4.1
	301: "Moved Permanently", // RFC 7231 6.4.2
	302: "Found", // RFC 7231 6.4.3
	303: "See Other", // RFC 7231 6.4.4
	304: "Not Modified", // RFC 7232 4.1
	305: "Use Proxy", // RFC 7231 6.4.5
	307: "Temporary Redirect", // RFC 7231 6.4.7
	308: "Permanent Redirect", // RFC 7238 3
	400: "Bad Request", // RFC 7231 6.5.1
	401: "Unauthorized", // RFC 7235 3.1
	402: "Payment Required", // RFC 7231 6.5.2
	403: "Forbidden", // RFC 7231 6.5.3
	404: "Not Found", // RFC 7231 6.5.4
	405: "Method Not Allowed", // RFC 7231 6.5.5
	406: "Not Acceptable", // RFC 7231 6.5.6
	407: "Proxy Authentication Required", // RFC 7235 3.2
	408: "Request Timeout", // RFC 7231 6.5.7
	409: "Conflict", // RFC 7231 6.5.8
	410: "Gone", // RFC 7231 6.5.9
	411: "Length Required", // RFC 7231 6.5.10
	412: "Precondition Failed", // RFC 7232 4.2
	413: "Payload Too Large", // RFC 7231 6.5.11
	414: "URI Too Long", // RFC 7231 6.5.12
	415: "Unsupported Media Type", // RFC 7231 6.5.13
	416: "Range Not Satisfiable", // RFC 7233 4.4
	417: "Expectation Failed", // RFC 7231 6.5.14
	418: "I'm a Teapot", // RFC 7168 2.3.3
	421: "Misdirected Request", // RFC 7540 9.1.2
	422: "Unprocessable Entity", // RFC 4918 11.2
	423: "Locked", // RFC 4918 11.3
	424: "Failed Dependency", // RFC 4918 11.4
	425: "Too Early", // RFC 8470 5.2
	426: "Upgrade Required", // RFC 2817 and RFC 7231 6.5.15
	428: "Precondition Required", // RFC 6585 3
	429: "Too Many Requests", // RFC 6585 4
	431: "Request Header Fields Too Large", // RFC 6585 5
	451: "Unavailable For Legal Reasons", // RFC 7725 3
	500: "Internal Server Error", // RFC 7231 6.6.1
	501: "Not Implemented", // RFC 7231 6.6.2
	502: "Bad Gateway", // RFC 7231 6.6.3
	503: "Service Unavailable", // RFC 7231 6.6.4
	504: "Gateway Timeout", // RFC 7231 6.6.5
	505: "HTTP Version Not Supported", // RFC 7231 6.6.6
	506: "Variant Also Negotiates", // RFC 2295 8.1
	507: "Insufficient Storage", // RFC 4918 11.5
	508: "Loop Detected", // RFC 5842 7.2
	509: "Bandwidth Limit Exceeded",
	510: "Not Extended", // RFC 2774 7
	511: "Network Authentication Required", // RFC 6585 6
};

const kOnExecute = HTTPParser.kOnExecute | 0;
const kOnTimeout = HTTPParser.kOnTimeout | 0;
const kLenientAll = HTTPParser.kLenientAll | 0;
const kLenientNone = HTTPParser.kLenientNone | 0;
const kConnections = Symbol("http.server.connections");
const kConnectionsCheckingInterval = Symbol(
	"http.server.connectionsCheckingInterval",
);

const HTTP_SERVER_TRACE_EVENT_NAME = "http.server.request";

class HTTPServerAsyncResource {
	constructor(type, socket) {
		this.type = type;
		this.socket = socket;
	}
}

function ServerResponse(req, options) {
	OutgoingMessage.call(this, options);

	if (req.method === "HEAD") this._hasBody = false;

	this.req = req;
	this.sendDate = true;
	this._sent100 = false;
	this._expect_continue = false;

	if (req.httpVersionMajor < 1 || req.httpVersionMinor < 1) {
		this.useChunkedEncodingByDefault =
			RegExpPrototypeExec(chunkExpression, req.headers.te) !== null;
		this.shouldKeepAlive = false;
	}

	if (hasObserver("http")) {
		startPerf(this, kServerResponseStatistics, {
			type: "http",
			name: "HttpRequest",
			detail: {
				req: {
					method: req.method,
					url: req.url,
					headers: req.headers,
				},
			},
		});
	}
	if (isTraceHTTPEnabled()) {
		this._traceEventId = getNextTraceEventId();
		traceBegin(HTTP_SERVER_TRACE_EVENT_NAME, this._traceEventId);
	}
}
ObjectSetPrototypeOf(ServerResponse.prototype, OutgoingMessage.prototype);
ObjectSetPrototypeOf(ServerResponse, OutgoingMessage);

ServerResponse.prototype._finish = function _finish() {
	if (this[kServerResponseStatistics] && hasObserver("http")) {
		stopPerf(this, kServerResponseStatistics, {
			detail: {
				res: {
					statusCode: this.statusCode,
					statusMessage: this.statusMessage,
					headers:
						typeof this.getHeaders === "function" ? this.getHeaders() : {},
				},
			},
		});
	}
	OutgoingMessage.prototype._finish.call(this);
	if (isTraceHTTPEnabled() && typeof this._traceEventId === "number") {
		const data = {
			url: this.req?.url,
			statusCode: this.statusCode,
		};
		traceEnd(HTTP_SERVER_TRACE_EVENT_NAME, this._traceEventId, data);
	}
};

ServerResponse.prototype.statusCode = 200;
ServerResponse.prototype.statusMessage = undefined;

function onServerResponseClose() {
	// EventEmitter.emit makes a copy of the 'close' listeners array before
	// calling the listeners. detachSocket() unregisters onServerResponseClose
	// but if detachSocket() is called, directly or indirectly, by a 'close'
	// listener, onServerResponseClose is still in that copy of the listeners
	// array. That is, in the example below, b still gets called even though
	// it's been removed by a:
	//
	//   const EventEmitter = require('events');
	//   const obj = new EventEmitter();
	//   obj.on('event', a);
	//   obj.on('event', b);
	//   function a() { obj.removeListener('event', b) }
	//   function b() { throw "BAM!" }
	//   obj.emit('event');  // throws
	//
	// Ergo, we need to deal with stale 'close' events and handle the case
	// where the ServerResponse object has already been deconstructed.
	// Fortunately, that requires only a single if check. :-)
	if (this._httpMessage) {
		emitCloseNT(this._httpMessage);
	}
}

ServerResponse.prototype.assignSocket = function assignSocket(socket) {
	if (socket._httpMessage) {
		throw new ERR_HTTP_SOCKET_ASSIGNED();
	}
	socket._httpMessage = this;
	socket.on("close", onServerResponseClose);
	this.socket = socket;
	this.emit("socket", socket);
	this._flush();
};

ServerResponse.prototype.detachSocket = function detachSocket(socket) {
	assert(socket._httpMessage === this);
	socket.removeListener("close", onServerResponseClose);
	socket._httpMessage = null;
	this.socket = null;
};

ServerResponse.prototype.writeContinue = function writeContinue(cb) {
	this._writeRaw("HTTP/1.1 100 Continue\r\n\r\n", "ascii", cb);
	this._sent100 = true;
};

ServerResponse.prototype.writeProcessing = function writeProcessing(cb) {
	this._writeRaw("HTTP/1.1 102 Processing\r\n\r\n", "ascii", cb);
};

ServerResponse.prototype.writeEarlyHints = function writeEarlyHints(hints, cb) {
	let head = "HTTP/1.1 103 Early Hints\r\n";

	validateObject(hints, "hints");

	if (hints.link === null || hints.link === undefined) {
		return;
	}

	const link = validateLinkHeaderValue(hints.link);

	if (link.length === 0) {
		return;
	}

	for (const key of ObjectKeys(hints)) {
		if (key !== "link") {
		}
	}

	head += "\r\n";

	this._writeRaw(head, "ascii", cb);
};

ServerResponse.prototype._implicitHeader = function _implicitHeader() {
	this.writeHead(this.statusCode);
};

ServerResponse.prototype.writeHead = writeHead;
function writeHead(statusCode, reason, obj) {
	if (this._header) {
		throw new ERR_HTTP_HEADERS_SENT("write");
	}

	const originalStatusCode = statusCode;

	if (statusCode < 100 || statusCode > 999) {
		throw new ERR_HTTP_INVALID_STATUS_CODE(originalStatusCode);
	}

	if (typeof reason === "string") {
		// writeHead(statusCode, reasonPhrase[, headers])
		this.statusMessage = reason;
	} else {
		// writeHead(statusCode[, headers])
		if (!this.statusMessage)
			this.statusMessage = STATUS_CODES[statusCode] || "unknown";
	}
	this.statusCode = statusCode;

	let headers;
	if (this[kOutHeaders]) {
		// Slow-case: when progressive API and header fields are passed.
		let k;
		if (ArrayIsArray(obj)) {
			if (obj.length % 2 !== 0) {
				throw new ERR_INVALID_ARG_VALUE("headers", obj);
			}

			for (let n = 0; n < obj.length; n += 2) {
				k = obj[n + 0];
				if (k) this.setHeader(k, obj[n + 1]);
			}
		} else if (obj) {
			const keys = ObjectKeys(obj);
			// Retain for(;;) loop for performance reasons
			// Refs: https://github.com/nodejs/node/pull/30958
			for (let i = 0; i < keys.length; i++) {
				k = keys[i];
				if (k) this.setHeader(k, obj[k]);
			}
		}
		// Only progressive api is used
		headers = this[kOutHeaders];
	} else {
		// Only writeHead() called
		headers = obj;
	}

	if (checkInvalidHeaderChar(this.statusMessage))
		throw new ERR_INVALID_CHAR("statusMessage");

	const statusLine = `HTTP/1.1 ${statusCode} ${this.statusMessage}\r\n`;

	if (
		statusCode === 204 ||
		statusCode === 304 ||
		(statusCode >= 100 && statusCode <= 199)
	) {
		// RFC 2616, 10.2.5:
		// The 204 response MUST NOT include a message-body, and thus is always
		// terminated by the first empty line after the header fields.
		// RFC 2616, 10.3.5:
		// The 304 response MUST NOT contain a message-body, and thus is always
		// terminated by the first empty line after the header fields.
		// RFC 2616, 10.1 Informational 1xx:
		// This class of status code indicates a provisional response,
		// consisting only of the Status-Line and optional headers, and is
		// terminated by an empty line.
		this._hasBody = false;
	}

	// Don't keep alive connections where the client expects 100 Continue
	// but we sent a final status; they may put extra bytes on the wire.
	if (this._expect_continue && !this._sent100) {
		this.shouldKeepAlive = false;
	}

	this._storeHeader(statusLine, headers);

	return this;
}

// Docs-only deprecated: DEP0063
ServerResponse.prototype.writeHeader = ServerResponse.prototype.writeHead;

function storeHTTPOptions(options) {
	this[kIncomingMessage] = options.IncomingMessage || IncomingMessage;
	this[kServerResponse] = options.ServerResponse || ServerResponse;

	const maxHeaderSize = options.maxHeaderSize;
	if (maxHeaderSize !== undefined)
		validateInteger(maxHeaderSize, "maxHeaderSize", 0);
	this.maxHeaderSize = maxHeaderSize;

	const insecureHTTPParser = options.insecureHTTPParser;
	if (insecureHTTPParser !== undefined)
		validateBoolean(insecureHTTPParser, "options.insecureHTTPParser");
	this.insecureHTTPParser = insecureHTTPParser;

	const requestTimeout = options.requestTimeout;
	if (requestTimeout !== undefined) {
		validateInteger(requestTimeout, "requestTimeout", 0);
		this.requestTimeout = requestTimeout;
	} else {
		this.requestTimeout = 300_000; // 5 minutes
	}

	const headersTimeout = options.headersTimeout;
	if (headersTimeout !== undefined) {
		validateInteger(headersTimeout, "headersTimeout", 0);
		this.headersTimeout = headersTimeout;
	} else {
		this.headersTimeout = MathMin(60_000, this.requestTimeout); // Minimum between 60 seconds or requestTimeout
	}

	if (
		this.requestTimeout > 0 &&
		this.headersTimeout > 0 &&
		this.headersTimeout > this.requestTimeout
	) {
		throw new codes.ERR_OUT_OF_RANGE(
			"headersTimeout",
			"<= requestTimeout",
			headersTimeout,
		);
	}

	const keepAliveTimeout = options.keepAliveTimeout;
	if (keepAliveTimeout !== undefined) {
		validateInteger(keepAliveTimeout, "keepAliveTimeout", 0);
		this.keepAliveTimeout = keepAliveTimeout;
	} else {
		this.keepAliveTimeout = 5_000; // 5 seconds;
	}

	const connectionsCheckingInterval = options.connectionsCheckingInterval;
	if (connectionsCheckingInterval !== undefined) {
		validateInteger(
			connectionsCheckingInterval,
			"connectionsCheckingInterval",
			0,
		);
		this.connectionsCheckingInterval = connectionsCheckingInterval;
	} else {
		this.connectionsCheckingInterval = 30_000; // 30 seconds
	}

	const requireHostHeader = options.requireHostHeader;
	if (requireHostHeader !== undefined) {
		validateBoolean(requireHostHeader, "options.requireHostHeader");
		this.requireHostHeader = requireHostHeader;
	} else {
		this.requireHostHeader = true;
	}

	const joinDuplicateHeaders = options.joinDuplicateHeaders;
	if (joinDuplicateHeaders !== undefined) {
		validateBoolean(joinDuplicateHeaders, "options.joinDuplicateHeaders");
	}
	this.joinDuplicateHeaders = joinDuplicateHeaders;

	const rejectNonStandardBodyWrites = options.rejectNonStandardBodyWrites;
	if (rejectNonStandardBodyWrites !== undefined) {
		validateBoolean(
			rejectNonStandardBodyWrites,
			"options.rejectNonStandardBodyWrites",
		);
		this.rejectNonStandardBodyWrites = rejectNonStandardBodyWrites;
	} else {
		this.rejectNonStandardBodyWrites = false;
	}
}
