var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// main_scripts/recovery-core.js
var require_recovery_core = __commonJS({
  "main_scripts/recovery-core.js"(exports2, module2) {
    (function(root, factory) {
      const api = factory();
      if (typeof module2 !== "undefined" && module2.exports) {
        module2.exports = api;
      }
      if (root) {
        root.AutoContinueRecoveryCore = api;
      }
    })(typeof globalThis !== "undefined" ? globalThis : exports2, function() {
      const DEFAULT_PROCESSING_DELAY_SECONDS = 5;
      const FOREGROUND_SCAN_INTERVAL_MS = 250;
      const REMOTE_POLL_INTERVAL_MS = 1e3;
      const CDP_RESCAN_INTERVAL_MS = 1500;
      const CONTROL_PANEL_REFRESH_INTERVAL_MS = 2e3;
      const MIN_NATIVE_CONTINUE_REPEAT_MS = 3e4;
      const BUSY_PATTERNS = [
        "agent hasn't processed previous input",
        "agent hasnt processed previous input",
        "agent has not processed previous input",
        "executor has not processed the previous input yet",
        "executor hasnt processed the previous input yet",
        "has not processed the previous input yet",
        "previous input is still being processed",
        "previous input is still processing",
        "still processing previous input",
        "wait for the previous input to finish",
        "please wait for the current input to finish"
      ];
      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }
      function normalizeProcessingDelaySeconds2(value, fallback = DEFAULT_PROCESSING_DELAY_SECONDS) {
        const numericFallback = Number.isFinite(Number(fallback)) ? Math.trunc(Number(fallback)) : DEFAULT_PROCESSING_DELAY_SECONDS;
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
          return clamp(numericFallback, 1, 30);
        }
        return clamp(Math.trunc(parsed), 1, 30);
      }
      function buildRuntimeConfig2(value) {
        const processingDelaySeconds2 = normalizeProcessingDelaySeconds2(value, DEFAULT_PROCESSING_DELAY_SECONDS);
        return {
          processingDelaySeconds: processingDelaySeconds2,
          retryDelaySeconds: processingDelaySeconds2,
          retryCooldownMs: processingDelaySeconds2 * 1e3,
          pollIntervalMs: FOREGROUND_SCAN_INTERVAL_MS,
          remotePollIntervalMs: REMOTE_POLL_INTERVAL_MS,
          cdpRescanIntervalMs: CDP_RESCAN_INTERVAL_MS,
          controlPanelRefreshIntervalMs: CONTROL_PANEL_REFRESH_INTERVAL_MS
        };
      }
      function normalizeText(text) {
        return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
      }
      function detectBusyPattern(text) {
        const normalized = normalizeText(text);
        for (const pattern of BUSY_PATTERNS) {
          if (normalized.includes(pattern)) {
            return pattern;
          }
        }
        return "";
      }
      function shouldUseRemotePoll({ isBackgroundMode, documentHidden, visibilityState }) {
        if (isBackgroundMode)
          return true;
        if (documentHidden)
          return true;
        return visibilityState === "hidden";
      }
      function shouldAttemptNativeContinue2({
        nativeContinueRequested,
        hasRetryButton,
        hasBusySignal,
        isAgentRunning,
        now,
        lastNativeAttemptTs,
        retryCooldownMs: retryCooldownMs2
      }) {
        if (!nativeContinueRequested)
          return false;
        if (hasRetryButton)
          return false;
        if (hasBusySignal)
          return false;
        if (isAgentRunning)
          return false;
        const attemptNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
        const lastAttempt = Number.isFinite(Number(lastNativeAttemptTs)) ? Number(lastNativeAttemptTs) : 0;
        const cooldown = Math.max(1e3, Number(retryCooldownMs2) || 0);
        return attemptNow - lastAttempt >= cooldown;
      }
      function shouldQueueNativeContinueRequest({
        pattern,
        nativeContinueRequested,
        nativeContinuePattern,
        lastNativeContinuePattern,
        lastNativeContinueAttemptAt,
        now,
        minRepeatMs = MIN_NATIVE_CONTINUE_REPEAT_MS
      }) {
        const normalizedPattern = normalizeText(pattern);
        if (!normalizedPattern)
          return false;
        if (nativeContinueRequested && normalizeText(nativeContinuePattern) === normalizedPattern) {
          return false;
        }
        const lastPattern = normalizeText(lastNativeContinuePattern);
        const attemptNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
        const lastAttempt = Number.isFinite(Number(lastNativeContinueAttemptAt)) ? Number(lastNativeContinueAttemptAt) : 0;
        const repeatWindow = Math.max(1e3, Number(minRepeatMs) || MIN_NATIVE_CONTINUE_REPEAT_MS);
        if (lastPattern === normalizedPattern && attemptNow - lastAttempt < repeatWindow) {
          return false;
        }
        return true;
      }
      return {
        BUSY_PATTERNS,
        DEFAULT_PROCESSING_DELAY_SECONDS,
        MIN_NATIVE_CONTINUE_REPEAT_MS,
        buildRuntimeConfig: buildRuntimeConfig2,
        detectBusyPattern,
        normalizeProcessingDelaySeconds: normalizeProcessingDelaySeconds2,
        shouldAttemptNativeContinue: shouldAttemptNativeContinue2,
        shouldQueueNativeContinueRequest,
        shouldUseRemotePoll
      };
    });
  }
});

// node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/ws/lib/constants.js"(exports2, module2) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob)
      BINARY_TYPES.push("blob");
    module2.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: Symbol("kIsForOnEventAttribute"),
      kListener: Symbol("kListener"),
      kStatusCode: Symbol("status-code"),
      kWebSocket: Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/ws/lib/buffer-util.js"(exports2, module2) {
    "use strict";
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0)
        return EMPTY_BUFFER;
      if (list.length === 1)
        return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data))
        return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module2.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = require("bufferutil");
        module2.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48)
            _mask(source, mask, output, offset, length);
          else
            bufferUtil.mask(source, mask, output, offset, length);
        };
        module2.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32)
            _unmask(buffer, mask);
          else
            bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/ws/lib/limiter.js"(exports2, module2) {
    "use strict";
    var kDone = Symbol("kDone");
    var kRun = Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency)
          return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module2.exports = Limiter;
  }
});

// node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/ws/lib/permessage-deflate.js"(exports2, module2) {
    "use strict";
    var zlib = require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = Symbol("permessage-deflate");
    var kTotalLength = Symbol("total-length");
    var kCallback = Symbol("callback");
    var kBuffers = Symbol("buffers");
    var kError = Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._maxPayload = this._options.maxPayload | 0;
        this._isServer = !!this._options.isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && !params.client_max_window_bits) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin)
          this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module2.exports = PerMessageDeflate;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/ws/lib/validation.js"(exports2, module2) {
    "use strict";
    var { isUtf8 } = require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module2.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module2.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = require("utf-8-validate");
        module2.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/ws/lib/receiver.js"(exports2, module2) {
    "use strict";
    var { Writable } = require("stream");
    var PerMessageDeflate = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO)
          return cb();
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length)
          return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored)
          cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented)
          this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126)
          this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127)
          this._state = GET_PAYLOAD_LENGTH_64;
        else
          this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked)
          this._state = GET_MASK;
        else
          this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err)
            return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO)
            this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module2.exports = Receiver;
  }
});

// node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/ws/lib/sender.js"(exports2, module2) {
    "use strict";
    var { Duplex } = require("stream");
    var { randomFillSync } = require("crypto");
    var PerMessageDeflate = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1)
          target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask)
          return [target, data];
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (skipMasking)
          return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else {
            buf.set(data, 2);
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin)
          this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module2.exports = Sender;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function")
        cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function")
          callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/ws/lib/event-target.js"(exports2, module2) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = Symbol("kCode");
    var kData = Symbol("kData");
    var kError = Symbol("kError");
    var kMessage = Symbol("kMessage");
    var kReason = Symbol("kReason");
    var kTarget = Symbol("kTarget");
    var kType = Symbol("kType");
    var kWasClean = Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module2.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/ws/lib/extension.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0)
        dest[name] = [elem];
      else
        dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1)
              start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1)
              end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1)
              end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1)
              start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1)
              end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1)
              end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1)
              start = i;
            else if (!mustUnescape)
              mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1)
                start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1)
              start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1)
              end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1)
              end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1)
        end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension) => {
        let configurations = extensions[extension];
        if (!Array.isArray(configurations))
          configurations = [configurations];
        return configurations.map((params) => {
          return [extension].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values))
                values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module2.exports = { format, parse };
  }
});

// node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/ws/lib/websocket.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var https = require("https");
    var http2 = require("http");
    var net = require("net");
    var tls = require("tls");
    var { randomBytes, createHash } = require("crypto");
    var { Duplex, Readable } = require("stream");
    var { URL } = require("url");
    var PerMessageDeflate = require_permessage_deflate();
    var Receiver = require_receiver();
    var Sender = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            protocols = [];
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              protocols = [];
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._closeTimeout = options.closeTimeout;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type))
          return;
        this._binaryType = type;
        if (this._receiver)
          this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket)
          return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout)
          socket.setTimeout(0);
        if (socket.setNoDelay)
          socket.setNoDelay();
        if (head.length > 0)
          socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate.extensionName]) {
          this._extensions[PerMessageDeflate.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED)
          return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._readyState = _WebSocket.CLOSING;
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err)
            return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number")
          data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0)
          mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number")
          data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0)
          mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain)
          this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number")
          data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED)
          return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute])
              return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function")
            return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket.prototype.addEventListener = addEventListener;
    WebSocket.prototype.removeEventListener = removeEventListener;
    module2.exports = WebSocket;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      websocket._closeTimeout = opts.closeTimeout;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:") {
        parsedUrl.protocol = "ws:";
      } else if (parsedUrl.protocol === "https:") {
        parsedUrl.protocol = "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes(16).toString("base64");
      const request = isSecure ? https.request : http2.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate({
          ...opts.perMessageDeflate,
          isServer: false,
          maxPayload: opts.maxPayload
        });
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
      }
      if (isIpcUrl) {
        const parts = opts.path.split(":");
        opts.socketPath = parts[0];
        opts.path = parts[1];
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost)
              delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted])
          return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket.CONNECTING)
          return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt)
          websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket)
          websocket._sender._bufferedBytes += length;
        else
          websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeMessage = reason;
      websocket._closeCode = code;
      if (websocket._socket[kWebSocket] === void 0)
        return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005)
        websocket.close();
      else
        websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused)
        websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong)
        websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket.CLOSED)
        return;
      if (websocket.readyState === WebSocket.OPEN) {
        websocket._readyState = WebSocket.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket.CLOSING;
        this.destroy();
      }
    }
  }
});

// node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/ws/lib/stream.js"(exports2, module2) {
    "use strict";
    var WebSocket = require_websocket();
    var { Duplex } = require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data))
          ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed)
          return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed)
          return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called)
            callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy)
          ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null)
          return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted)
            duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused)
          ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module2.exports = createWebSocketStream;
  }
});

// node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/ws/lib/subprotocol.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1)
            start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1)
            end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1)
            end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module2.exports = { parse };
  }
});

// node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/ws/lib/websocket-server.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var http2 = require("http");
    var { Duplex } = require("stream");
    var { createHash } = require("crypto");
    var extension = require_extension();
    var PerMessageDeflate = require_permessage_deflate();
    var subprotocol = require_subprotocol();
    var WebSocket = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http2.createServer((req, res) => {
            const body = http2.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true)
          options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server)
          return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb)
          this.once("close", cb);
        if (this._state === CLOSING)
          return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path)
            return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate({
            ...this.options.perMessageDeflate,
            isServer: true,
            maxPayload: this.options.maxPayload
          });
          try {
            const offers = extension.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]);
              extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info))
            return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable)
          return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING)
          return abortHandshake(socket, 503);
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate.extensionName]) {
          const params = extensions[PerMessageDeflate.extensionName].params;
          const value = extension.format({
            [PerMessageDeflate.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module2.exports = WebSocketServer;
    function addListeners(server, map) {
      for (const event of Object.keys(map))
        server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http2.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http2.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// node_modules/ws/index.js
var require_ws = __commonJS({
  "node_modules/ws/index.js"(exports2, module2) {
    "use strict";
    var createWebSocketStream = require_stream();
    var extension = require_extension();
    var PerMessageDeflate = require_permessage_deflate();
    var Receiver = require_receiver();
    var Sender = require_sender();
    var subprotocol = require_subprotocol();
    var WebSocket = require_websocket();
    var WebSocketServer = require_websocket_server();
    WebSocket.createWebSocketStream = createWebSocketStream;
    WebSocket.extension = extension;
    WebSocket.PerMessageDeflate = PerMessageDeflate;
    WebSocket.Receiver = Receiver;
    WebSocket.Sender = Sender;
    WebSocket.Server = WebSocketServer;
    WebSocket.subprotocol = subprotocol;
    WebSocket.WebSocket = WebSocket;
    WebSocket.WebSocketServer = WebSocketServer;
    module2.exports = WebSocket;
  }
});

// main_scripts/cdp-handler.js
var require_cdp_handler = __commonJS({
  "main_scripts/cdp-handler.js"(exports2, module2) {
    var WebSocket = require_ws();
    var http2 = require("http");
    var fs = require("fs");
    var path = require("path");
    var DEFAULT_BASE_PORT = 9e3;
    var DEFAULT_PORT_RANGE = 3;
    var RECONNECT_DELAY_MS = 1500;
    function normalizePort(value, fallback = DEFAULT_BASE_PORT) {
      const num = Number(value);
      if (!Number.isFinite(num))
        return fallback;
      const port = Math.trunc(num);
      if (port < 1 || port > 65535)
        return fallback;
      return port;
    }
    function normalizePortRange(value, fallback = DEFAULT_PORT_RANGE) {
      const num = Number(value);
      if (!Number.isFinite(num))
        return fallback;
      const range = Math.trunc(num);
      if (range < 0 || range > 32)
        return fallback;
      return range;
    }
    var _autoContinueScript = null;
    var _autoContinueScriptCacheKey = "";
    function findExistingScript(candidates, label) {
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
      throw new Error(`${label} not found. __dirname=${__dirname}`);
    }
    function getAutoContinueScript() {
      const recoveryCorePath = findExistingScript([
        path.join(__dirname, "recovery-core.js"),
        path.join(__dirname, "main_scripts", "recovery-core.js"),
        path.join(__dirname, "..", "main_scripts", "recovery-core.js")
      ], "recovery-core.js");
      const autoContinuePath = findExistingScript([
        path.join(__dirname, "auto-continue.js"),
        path.join(__dirname, "main_scripts", "auto-continue.js"),
        path.join(__dirname, "..", "main_scripts", "auto-continue.js")
      ], "auto-continue.js");
      const recoveryCoreStat = fs.statSync(recoveryCorePath);
      const autoContinueStat = fs.statSync(autoContinuePath);
      const cacheKey = [
        recoveryCorePath,
        recoveryCoreStat.mtimeMs || 0,
        autoContinuePath,
        autoContinueStat.mtimeMs || 0
      ].join(":");
      if (_autoContinueScript && cacheKey === _autoContinueScriptCacheKey) {
        return _autoContinueScript;
      }
      const recoveryCoreScript = fs.readFileSync(recoveryCorePath, "utf8");
      const autoContinueScript = fs.readFileSync(autoContinuePath, "utf8");
      _autoContinueScript = `${recoveryCoreScript}
;
${autoContinueScript}`;
      _autoContinueScriptCacheKey = cacheKey;
      return _autoContinueScript;
    }
    var CDPHandler = class {
      constructor(logger = console.log) {
        this.logger = logger;
        this.connections = /* @__PURE__ */ new Map();
        this.isEnabled = false;
        this.msgId = 1;
        this._lastConfigHash = "";
        this.basePort = DEFAULT_BASE_PORT;
        this.portRange = DEFAULT_PORT_RANGE;
        this._reconnectTimers = /* @__PURE__ */ new Map();
        this._targetUrls = /* @__PURE__ */ new Map();
      }
      log(msg) {
        this.logger(`[CDP] ${msg}`);
      }
      getPortCandidates(basePort = this.basePort, portRange = this.portRange) {
        const base = normalizePort(basePort, DEFAULT_BASE_PORT);
        const range = normalizePortRange(portRange, DEFAULT_PORT_RANGE);
        const ports = [];
        for (let port = base - range; port <= base + range; port++) {
          if (port >= 1 && port <= 65535) {
            ports.push(port);
          }
        }
        return ports;
      }
      async getAvailablePorts(portCandidates = null) {
        const candidates = Array.isArray(portCandidates) && portCandidates.length > 0 ? [...new Set(portCandidates.map((p) => normalizePort(p, 0)).filter((p) => p > 0))] : this.getPortCandidates();
        const available = [];
        for (const port of candidates) {
          try {
            const pages = await this._getPages(port);
            if (pages.length > 0) {
              available.push(port);
            }
          } catch (e) {
          }
        }
        return available;
      }
      async isCDPAvailable(port = this.basePort, portRange = this.portRange) {
        const candidates = this.getPortCandidates(port, portRange);
        for (const p of candidates) {
          try {
            const pages = await this._getPages(p);
            if (pages.length > 0)
              return true;
          } catch (e) {
          }
        }
        return false;
      }
      async start(config) {
        this.isEnabled = true;
        this.basePort = normalizePort(config?.cdpPort, this.basePort);
        this.portRange = normalizePortRange(config?.cdpPortRange, this.portRange);
        const candidates = this.getPortCandidates(this.basePort, this.portRange);
        const candidateSet = new Set(candidates);
        for (const [id, conn] of Array.from(this.connections.entries())) {
          const port = Number(String(id).split(":")[0]);
          if (!candidateSet.has(port)) {
            try {
              conn.ws.close();
            } catch (e) {
            }
            this.connections.delete(id);
            this._targetUrls.delete(id);
          }
        }
        const quiet = !!config?.quiet;
        const configHash = JSON.stringify({
          p: this.basePort,
          r: this.portRange,
          pd: config?.processingDelaySeconds || 5,
          mr: config?.maxRetries || 50,
          cd: config?.retryCooldownMs || 5e3,
          ds: config?.retryDelaySeconds || 5
        });
        if (!quiet || this._lastConfigHash !== configHash) {
          this.log(`Scanning ports ${candidates[0]} to ${candidates[candidates.length - 1]}...`);
        }
        this._lastConfigHash = configHash;
        for (const port of candidates) {
          try {
            const pages = await this._getPages(port);
            if (pages.length > 0) {
              const newTargets = pages.filter((p) => !this.connections.has(`${port}:${p.id}`));
              if (!quiet || newTargets.length > 0) {
                this.log(`Port ${port}: ${pages.length} page(s) found`);
              }
              for (const page of pages) {
                const id = `${port}:${page.id}`;
                if (!this.connections.has(id)) {
                  this._targetUrls.set(id, page.webSocketDebuggerUrl);
                  this.log(`Target ${id}: type=${page.type} url=${(page.url || "").slice(0, 120)}`);
                  await this._connect(id, page.webSocketDebuggerUrl);
                }
                await this._inject(id, config);
              }
            }
          } catch (e) {
          }
        }
      }
      async stop() {
        this.isEnabled = false;
        for (const [id, timer] of this._reconnectTimers) {
          clearTimeout(timer);
        }
        this._reconnectTimers.clear();
        for (const [id, conn] of this.connections) {
          try {
            await this._evaluate(id, "if(window.__autoContinueStop) window.__autoContinueStop()");
            conn.ws.close();
          } catch (e) {
          }
        }
        this.connections.clear();
        this._targetUrls.clear();
      }
      async _getPages(port) {
        return new Promise((resolve, reject) => {
          const req = http2.get({
            hostname: "127.0.0.1",
            port,
            path: "/json/list",
            timeout: 800
          }, (res) => {
            let body = "";
            res.on("data", (chunk) => body += chunk);
            res.on("end", () => {
              try {
                const pages = JSON.parse(body);
                const filtered = pages.filter((p) => {
                  if (!p.webSocketDebuggerUrl)
                    return false;
                  if (p.type !== "page" && p.type !== "webview")
                    return false;
                  const url = (p.url || "").toLowerCase();
                  if (url.startsWith("devtools://") || url.startsWith("chrome-devtools://"))
                    return false;
                  return true;
                });
                resolve(filtered);
              } catch (e) {
                resolve([]);
              }
            });
          });
          req.on("error", () => resolve([]));
          req.on("timeout", () => {
            req.destroy();
            resolve([]);
          });
        });
      }
      async _connect(id, url) {
        return new Promise((resolve) => {
          let ws;
          try {
            ws = new WebSocket(url);
          } catch (e) {
            resolve(false);
            return;
          }
          const timeout = setTimeout(() => {
            try {
              ws.terminate();
            } catch (e) {
            }
            resolve(false);
          }, 3e3);
          ws.on("open", () => {
            clearTimeout(timeout);
            this.connections.set(id, { ws, injected: false });
            this.log(`Connected to page ${id}`);
            resolve(true);
          });
          ws.on("error", (err) => {
            clearTimeout(timeout);
            resolve(false);
          });
          ws.on("close", () => {
            clearTimeout(timeout);
            const wasConnected = this.connections.has(id);
            this.connections.delete(id);
            if (wasConnected) {
              this.log(`Disconnected from page ${id}`);
              this._scheduleReconnect(id);
            }
          });
        });
      }
      /**
       * Schedule a reconnection attempt after disconnect.
       */
      _scheduleReconnect(id) {
        if (!this.isEnabled)
          return;
        if (this._reconnectTimers.has(id)) {
          clearTimeout(this._reconnectTimers.get(id));
        }
        const wsUrl = this._targetUrls.get(id);
        if (!wsUrl)
          return;
        const timer = setTimeout(async () => {
          this._reconnectTimers.delete(id);
          if (!this.isEnabled)
            return;
          if (this.connections.has(id))
            return;
          this.log(`Attempting reconnect to ${id}...`);
          const success = await this._connect(id, wsUrl);
          if (success) {
            this.log(`Reconnected to ${id}`);
          } else {
            this._targetUrls.delete(id);
          }
        }, RECONNECT_DELAY_MS);
        this._reconnectTimers.set(id, timer);
      }
      async _inject(id, config) {
        const conn = this.connections.get(id);
        if (!conn)
          return;
        try {
          if (conn.injected) {
            try {
              const existsRes = await this._evaluate(id, 'typeof window.__autoContinueStart === "function"');
              const exists = !!existsRes?.result?.value;
              if (!exists) {
                conn.injected = false;
                this.log(`Script missing in ${id}; reinjecting...`);
              }
            } catch (e) {
              conn.injected = false;
            }
          }
          if (!conn.injected) {
            const script = getAutoContinueScript();
            this.log(`Injecting script into ${id} (${(script.length / 1024).toFixed(1)}KB)...`);
            const injectResult = await this._safeEvaluate(id, script, 2);
            conn.injected = true;
            this.log(`Script injected into ${id}`);
            try {
              const diagRes = await this._evaluate(id, 'JSON.stringify({title: document.title, bodyLen: (document.body?.textContent||"" ).length, url: location.href.slice(0,150)})');
              if (diagRes?.result?.value) {
                const diag = JSON.parse(diagRes.result.value);
                this.log(`  \u2192 Page: "${diag.title}" | body=${diag.bodyLen} chars | url=${diag.url}`);
              }
            } catch (e) {
            }
          }
          let isRunning = false;
          try {
            const runningRes = await this._safeEvaluate(id, "!!(window.__autoContinueState && window.__autoContinueState.isRunning)", 1);
            isRunning = !!runningRes?.result?.value;
          } catch (e) {
            isRunning = false;
          }
          const configJson = JSON.stringify({
            processingDelaySeconds: config.processingDelaySeconds || config.retryDelaySeconds || 5,
            maxRetries: config.maxRetries || 50,
            retryCooldownMs: config.retryCooldownMs || 5e3,
            retryDelaySeconds: config.retryDelaySeconds || 5,
            pollInterval: config.pollInterval || 500,
            isBackgroundMode: !!config.isBackgroundMode
          });
          if (!isRunning) {
            this.log(`Calling __autoContinueStart in ${id}`);
            await this._safeEvaluate(id, `if(window.__autoContinueStart) window.__autoContinueStart(${configJson})`, 1);
          } else {
            await this._safeEvaluate(id, `if(window.__autoContinueUpdateConfig) window.__autoContinueUpdateConfig(${configJson})`, 1);
          }
        } catch (e) {
          this.log(`Failed to inject into ${id}: ${e.message}`);
        }
      }
      async _safeEvaluate(id, expression, retries = 0) {
        let attempts = 0;
        while (true) {
          try {
            return await this._evaluate(id, expression);
          } catch (e) {
            if (attempts >= retries)
              throw e;
            attempts += 1;
            await new Promise((r) => setTimeout(r, 150));
          }
        }
      }
      async _evaluate(id, expression) {
        const conn = this.connections.get(id);
        if (!conn || conn.ws.readyState !== WebSocket.OPEN)
          return;
        return new Promise((resolve, reject) => {
          const currentId = this.msgId++;
          const timeout = setTimeout(() => {
            conn.ws.off("message", onMessage);
            reject(new Error("CDP Timeout"));
          }, 5e3);
          const onMessage = (data) => {
            try {
              const msg = JSON.parse(data.toString());
              if (msg.id === currentId) {
                conn.ws.off("message", onMessage);
                clearTimeout(timeout);
                resolve(msg.result);
              }
            } catch (e) {
            }
          };
          conn.ws.on("message", onMessage);
          try {
            conn.ws.send(JSON.stringify({
              id: currentId,
              method: "Runtime.evaluate",
              params: { expression, userGesture: true, awaitPromise: true }
            }));
          } catch (e) {
            conn.ws.off("message", onMessage);
            clearTimeout(timeout);
            reject(e);
          }
        });
      }
      getConnectionCount() {
        return this.connections.size;
      }
      async getStats() {
        const stats = {
          retries: 0,
          errorsDetected: 0,
          lastError: "",
          lastBusyPattern: "",
          lastRetryAt: "",
          consecutiveRetries: 0,
          countdownActive: false,
          countdownSecondsLeft: 0,
          waitingForPreviousInput: false,
          busyAcks: 0,
          nativeContinueRequested: false,
          retryHistory: []
        };
        for (const [id] of this.connections) {
          try {
            const res = await this._evaluate(id, "JSON.stringify(window.__autoContinueGetStats ? window.__autoContinueGetStats() : {})");
            if (res?.result?.value) {
              const s = JSON.parse(res.result.value);
              stats.retries += s.retries || 0;
              stats.errorsDetected += s.errorsDetected || 0;
              stats.consecutiveRetries = Math.max(stats.consecutiveRetries, s.consecutiveRetries || 0);
              if (s.countdownActive)
                stats.countdownActive = true;
              stats.countdownSecondsLeft = Math.max(stats.countdownSecondsLeft, s.countdownSecondsLeft || 0);
              if (s.lastError) {
                stats.lastError = s.lastError;
              }
              if (s.lastBusyPattern) {
                stats.lastBusyPattern = s.lastBusyPattern;
              }
              if (s.lastRetryAt) {
                stats.lastRetryAt = s.lastRetryAt;
              }
              if (s.waitingForPreviousInput) {
                stats.waitingForPreviousInput = true;
              }
              stats.busyAcks += s.busyAcks || 0;
              if (s.nativeContinueRequested) {
                stats.nativeContinueRequested = true;
              }
              if (Array.isArray(s.retryHistory) && s.retryHistory.length > 0) {
                stats.retryHistory = s.retryHistory;
              }
            }
          } catch (e) {
          }
        }
        return stats;
      }
      async acknowledgeNativeContinueRequest(targetId, pattern, attemptedAt = Date.now()) {
        if (!targetId)
          return;
        const payload = JSON.stringify({
          pattern: pattern || "",
          attemptedAt
        });
        try {
          await this._evaluate(
            targetId,
            `if(window.__autoContinueAcknowledgeNativeContinue) window.__autoContinueAcknowledgeNativeContinue(${payload})`
          );
        } catch (e) {
        }
      }
      /**
       * Active polling from the extension process (Node.js — never throttled).
       * Calls __autoContinuePollOnce() on every connected CDP target.
       * This is the key mechanism that makes background mode work:
       * even if the browser tab has its timers throttled, this CDP call
       * executes synchronously in the target's JS context.
       */
      async pollAndRetry() {
        if (!this.isEnabled)
          return [];
        const results = [];
        for (const [id, conn] of this.connections) {
          if (!conn || !conn.injected)
            continue;
          if (conn.ws.readyState !== 1)
            continue;
          try {
            const res = await this._evaluate(
              id,
              'JSON.stringify(window.__autoContinuePollOnce ? window.__autoContinuePollOnce() : {skipped:"no-function"})'
            );
            if (res?.result?.value) {
              const r = JSON.parse(res.result.value);
              r.targetId = id;
              results.push(r);
              if (r.clicked) {
                this.log(`[RemotePoll] Target ${id}: \u2713 CLICKED retry for "${r.pattern}"`);
              } else if (r.requestNativeContinue && r.skipped !== "native-pending") {
                this.log(`[RemotePoll] Target ${id}: requesting native continue for "${r.pattern}"`);
              } else if (r.busyPattern) {
              } else if (r.errorFound && !r.buttonFound && !["arming", "native-backoff"].includes(r.skipped)) {
                this.log(`[RemotePoll] Target ${id}: Error "${r.pattern}" but no retry button found`);
              } else if (r.errorFound && r.buttonFound && r.skipped === "dedup") {
              }
            }
          } catch (e) {
          }
        }
        return results;
      }
    };
    module2.exports = { CDPHandler };
  }
});

// extension.js
var vscode = require("vscode");
var http = require("http");
var os = require("os");
var {
  buildRuntimeConfig,
  normalizeProcessingDelaySeconds,
  shouldAttemptNativeContinue
} = require_recovery_core();
var isEnabled = false;
var backgroundModeEnabled = false;
var pollTimer;
var statusBarItem;
var statusControlPanelItem;
var outputChannel;
var currentIDE = "unknown";
var globalContext;
var cdpHandler;
var controlPanel = null;
var cdpPort = 9e3;
var processingDelaySeconds = 5;
var pollInterval = 250;
var remotePollIntervalMs = 1e3;
var cdpRescanIntervalMs = 1500;
var controlPanelRefreshIntervalMs = 2e3;
var maxRetries = 50;
var retryCooldownMs = 5e3;
var retryDelaySeconds = 5;
var enableNativeCommands = true;
var lastControlPanelStatePushTs = 0;
var cdpRefreshTimer;
var activePollingTimer;
var lastNativeCommandAttemptTs = 0;
var ENABLED_STATE_KEY = "autocontinue-enabled";
var BACKGROUND_STATE_KEY = "autocontinue-background";
var DEFAULT_CDP_PORT = 9e3;
var ANTIGRAVITY_CONTINUE_COMMANDS = [
  "antigravity.command.continueGenerating",
  "antigravity.continueGenerating",
  "antigravity.command.continue",
  "antigravity.agent.continue"
];
function log(message) {
  try {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().split("T")[1].split(".")[0];
    const logLine = `[${timestamp}] ${message}`;
    console.log(logLine);
    if (outputChannel) {
      outputChannel.appendLine(logLine);
    }
  } catch (e) {
    console.error("Logging failed:", e);
  }
}
function detectIDE() {
  const appName = vscode.env.appName || "";
  if (appName.toLowerCase().includes("antigravity"))
    return "Antigravity";
  if (appName.toLowerCase().includes("cursor"))
    return "Cursor";
  return "VS Code";
}
async function isCDPPortReady(port = cdpPort, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: "127.0.0.1",
      port,
      path: "/json/version",
      timeout: timeoutMs
    }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}
function normalizeCdpPort(value, fallback = DEFAULT_CDP_PORT) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    return fallback;
  const port = Math.trunc(parsed);
  if (port < 1 || port > 65535)
    return fallback;
  return port;
}
async function tryNativeContinueCommands(request = {}) {
  if (!enableNativeCommands)
    return false;
  if ((currentIDE || "").toLowerCase() !== "antigravity")
    return false;
  const now = Date.now();
  const canAttempt = shouldAttemptNativeContinue({
    nativeContinueRequested: true,
    hasRetryButton: !!request.hasRetryButton,
    hasBusySignal: !!request.hasBusySignal,
    isAgentRunning: !!request.isAgentRunning,
    now,
    lastNativeAttemptTs: lastNativeCommandAttemptTs,
    retryCooldownMs
  });
  if (!canAttempt)
    return false;
  lastNativeCommandAttemptTs = now;
  let attempted = false;
  for (const cmd of ANTIGRAVITY_CONTINUE_COMMANDS) {
    try {
      await vscode.commands.executeCommand(cmd);
      attempted = true;
    } catch (e) {
    }
  }
  if (attempted) {
    log(`Native continue fallback executed${request.pattern ? ` for "${request.pattern}"` : ""}`);
  }
  return attempted;
}
async function activate(context) {
  globalContext = context;
  console.log("AutoContinue Extension v2: Activating...");
  try {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 97);
    statusBarItem.command = "autocontinue.toggle";
    statusBarItem.text = "\u26A1 AC: OFF";
    statusBarItem.tooltip = "Click to toggle AutoContinue error retry";
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();
    statusControlPanelItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 96);
    statusControlPanelItem.command = "autocontinue.openControlPanel";
    statusControlPanelItem.text = "$(tools) AC Panel";
    statusControlPanelItem.tooltip = "Open AutoContinue Control Panel";
    context.subscriptions.push(statusControlPanelItem);
    statusControlPanelItem.show();
  } catch (e) {
    console.error("Failed to create status bar items:", e);
  }
  try {
    isEnabled = context.globalState.get(ENABLED_STATE_KEY, false);
    backgroundModeEnabled = context.globalState.get(BACKGROUND_STATE_KEY, false);
    currentIDE = detectIDE();
    loadConfiguration();
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("autoContinue")) {
        loadConfiguration();
        log("Configuration reloaded");
        if (isEnabled) {
          await startMonitoring();
        }
      }
    });
    outputChannel = vscode.window.createOutputChannel("AutoContinue Agent");
    context.subscriptions.push(outputChannel);
    log(`AutoContinue v2: Activating for ${currentIDE}...`);
    log(`Platform: ${process.platform} / ${os.arch()} / ${os.release()}`);
    try {
      const { CDPHandler } = require_cdp_handler();
      cdpHandler = new CDPHandler(log);
      log("CDP handler initialized");
    } catch (err) {
      log(`Failed to initialize CDP handler: ${err.message}`);
    }
    updateStatusBar();
    context.subscriptions.push(
      vscode.commands.registerCommand("autocontinue.toggle", () => handleToggle(context)),
      vscode.commands.registerCommand("autocontinue.toggleBackground", () => handleToggleBackground(context)),
      vscode.commands.registerCommand("autocontinue.openControlPanel", () => openControlPanel(context)),
      vscode.commands.registerCommand("autocontinue.copyDiagnostics", () => handleCopyDiagnostics()),
      vscode.commands.registerCommand("autocontinue.openOutputLog", () => {
        if (outputChannel)
          outputChannel.show(true);
      })
    );
    if (isEnabled) {
      log("AutoContinue was enabled, starting...");
      await startMonitoring();
    }
    log("AutoContinue v2: Activation complete");
  } catch (error) {
    console.error("ACTIVATION FAILED:", error);
    log(`ACTIVATION FAILED: ${error.message}`);
  }
}
function loadConfiguration() {
  const config = vscode.workspace.getConfiguration("autoContinue");
  const configuredProcessingDelay = config.get("processingDelaySeconds");
  const legacyDelaySeconds = Math.max(1, Math.min(30, Number(config.get("retryDelaySeconds", 5)) || 5));
  const legacyCooldownMs = Math.max(0, Math.min(3e4, Number(config.get("retryCooldownMs", legacyDelaySeconds * 1e3)) || 0));
  const fallbackProcessingDelay = Math.max(legacyDelaySeconds, Math.round(legacyCooldownMs / 1e3) || 0, 1);
  const runtimeConfig = buildRuntimeConfig(
    normalizeProcessingDelaySeconds(
      configuredProcessingDelay == null ? fallbackProcessingDelay : configuredProcessingDelay,
      fallbackProcessingDelay
    )
  );
  cdpPort = normalizeCdpPort(config.get("cdpPort", DEFAULT_CDP_PORT));
  processingDelaySeconds = runtimeConfig.processingDelaySeconds;
  pollInterval = runtimeConfig.pollIntervalMs;
  remotePollIntervalMs = runtimeConfig.remotePollIntervalMs;
  cdpRescanIntervalMs = runtimeConfig.cdpRescanIntervalMs;
  controlPanelRefreshIntervalMs = runtimeConfig.controlPanelRefreshIntervalMs;
  maxRetries = Math.max(1, Math.min(500, Number(config.get("maxRetries", 50)) || 50));
  retryCooldownMs = runtimeConfig.retryCooldownMs;
  retryDelaySeconds = runtimeConfig.retryDelaySeconds;
  enableNativeCommands = config.get("enableNativeCommands", true) !== false;
}
function updateStatusBar() {
  if (!statusBarItem)
    return;
  const connCount = cdpHandler ? cdpHandler.getConnectionCount() : 0;
  if (isEnabled && backgroundModeEnabled) {
    statusBarItem.text = `\u26A1 AC: BG [${connCount}]`;
    statusBarItem.tooltip = `AutoContinue Background Mode \u2014 ${connCount} target(s) connected
Processing wait: ${processingDelaySeconds}s
Click to disable`;
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
  } else if (isEnabled) {
    statusBarItem.text = `\u26A1 AC: ON [${connCount}]`;
    statusBarItem.tooltip = `AutoContinue Active \u2014 ${connCount} target(s) connected
Processing wait: ${processingDelaySeconds}s
Click to disable`;
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
  } else {
    statusBarItem.text = "\u26A1 AC: OFF";
    statusBarItem.tooltip = "Click to enable AutoContinue error retry";
    statusBarItem.backgroundColor = void 0;
  }
}
async function handleToggle(context) {
  isEnabled = !isEnabled;
  await context.globalState.update(ENABLED_STATE_KEY, isEnabled);
  updateStatusBar();
  if (isEnabled) {
    log("AutoContinue: ENABLED");
    await startMonitoring();
    vscode.window.showInformationMessage(`AutoContinue: Enabled \u2014 will auto-retry with a ${processingDelaySeconds}s processing wait`);
  } else {
    log("AutoContinue: DISABLED");
    await stopMonitoring();
    vscode.window.showInformationMessage("AutoContinue: Disabled");
  }
  pushControlPanelState();
}
async function handleToggleBackground(context) {
  backgroundModeEnabled = !backgroundModeEnabled;
  await context.globalState.update(BACKGROUND_STATE_KEY, backgroundModeEnabled);
  updateStatusBar();
  if (backgroundModeEnabled) {
    log("Background mode: ENABLED");
    vscode.window.showInformationMessage("AutoContinue: Background mode enabled \u2014 overlay active");
    if (isEnabled) {
      await syncCDP();
    }
  } else {
    log("Background mode: DISABLED");
    vscode.window.showInformationMessage("AutoContinue: Background mode disabled");
    if (isEnabled) {
      await syncCDP();
    }
  }
  pushControlPanelState();
}
async function startMonitoring() {
  if (pollTimer)
    clearInterval(pollTimer);
  if (cdpRefreshTimer)
    clearInterval(cdpRefreshTimer);
  if (activePollingTimer)
    clearInterval(activePollingTimer);
  if (!cdpHandler) {
    log("No CDP handler available");
    return;
  }
  const cdpAvailable = await cdpHandler.isCDPAvailable(cdpPort);
  if (!cdpAvailable) {
    log(`CDP not available on port ${cdpPort}. AutoContinue will retry when CDP becomes available.`);
  }
  await syncCDP();
  cdpRefreshTimer = setInterval(async () => {
    if (!isEnabled)
      return;
    await syncCDP();
  }, cdpRescanIntervalMs);
  pollTimer = setInterval(async () => {
    if (!isEnabled)
      return;
    updateStatusBar();
    pushControlPanelState();
  }, controlPanelRefreshIntervalMs);
  activePollingTimer = setInterval(async () => {
    if (!isEnabled || !cdpHandler)
      return;
    try {
      const results = await cdpHandler.pollAndRetry();
      const nativeRequest = Array.isArray(results) ? results.find((result) => result && result.requestNativeContinue) : null;
      if (nativeRequest) {
        const attempted = await tryNativeContinueCommands({
          hasRetryButton: !!nativeRequest.buttonFound,
          hasBusySignal: !!nativeRequest.busyPattern,
          isAgentRunning: !!nativeRequest.isAgentRunning,
          pattern: nativeRequest.pattern || nativeRequest.busyPattern || ""
        });
        if (attempted) {
          await cdpHandler.acknowledgeNativeContinueRequest(
            nativeRequest.targetId,
            nativeRequest.pattern || nativeRequest.busyPattern || "",
            Date.now()
          );
        } else {
          log(`Native continue request still pending for "${nativeRequest.pattern || nativeRequest.busyPattern || ""}"`);
        }
      }
    } catch (e) {
    }
  }, remotePollIntervalMs);
  log(`Active polling enabled (${remotePollIntervalMs}ms interval)`);
  log(`Monitoring started (CDP re-scan: ${cdpRescanIntervalMs}ms)`);
}
async function syncCDP() {
  if (!cdpHandler || !isEnabled)
    return;
  try {
    await cdpHandler.start({
      cdpPort,
      processingDelaySeconds,
      maxRetries,
      retryCooldownMs,
      retryDelaySeconds,
      pollInterval,
      isBackgroundMode: backgroundModeEnabled,
      quiet: true
    });
  } catch (err) {
    log(`CDP sync error: ${err.message}`);
  }
}
async function stopMonitoring() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (cdpRefreshTimer) {
    clearInterval(cdpRefreshTimer);
    cdpRefreshTimer = null;
  }
  if (activePollingTimer) {
    clearInterval(activePollingTimer);
    activePollingTimer = null;
  }
  if (cdpHandler) {
    await cdpHandler.stop();
  }
  log("Monitoring stopped");
}
function openControlPanel(context) {
  if (controlPanel) {
    controlPanel.reveal();
    return;
  }
  controlPanel = vscode.window.createWebviewPanel(
    "autocontinuePanel",
    "AutoContinue Control Panel",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  controlPanel.webview.html = getControlPanelHtml();
  controlPanel.webview.onDidReceiveMessage(async (msg) => {
    switch (msg.type) {
      case "ready":
      case "refresh":
        await pushControlPanelState();
        break;
      case "toggleAuto":
        await handleToggle(context);
        break;
      case "toggleBackground":
        await handleToggleBackground(context);
        break;
      case "savePort": {
        const port = normalizeCdpPort(msg.port, cdpPort);
        await vscode.workspace.getConfiguration("autoContinue").update("cdpPort", port, vscode.ConfigurationTarget.Global);
        cdpPort = port;
        log(`CDP port saved: ${port}`);
        await pushControlPanelState();
        break;
      }
      case "saveMaxRetries": {
        const val = Math.max(1, Math.min(500, Number(msg.value) || 50));
        await vscode.workspace.getConfiguration("autoContinue").update("maxRetries", val, vscode.ConfigurationTarget.Global);
        maxRetries = val;
        log(`Max retries saved: ${val}`);
        await pushControlPanelState();
        break;
      }
      case "saveProcessingDelay": {
        const val = normalizeProcessingDelaySeconds(msg.value, processingDelaySeconds);
        await vscode.workspace.getConfiguration("autoContinue").update("processingDelaySeconds", val, vscode.ConfigurationTarget.Global);
        loadConfiguration();
        if (isEnabled) {
          await syncCDP();
        }
        log(`Processing delay saved: ${val}s`);
        await pushControlPanelState();
        break;
      }
      case "copyDiagnostics":
        await handleCopyDiagnostics();
        break;
      case "openOutputLog":
        if (outputChannel)
          outputChannel.show(true);
        break;
    }
  });
  controlPanel.onDidDispose(() => {
    controlPanel = null;
  });
  context.subscriptions.push(controlPanel);
}
async function pushControlPanelState() {
  if (!controlPanel)
    return;
  const now = Date.now();
  if (now - lastControlPanelStatePushTs < 800)
    return;
  lastControlPanelStatePushTs = now;
  const cdpReady = cdpHandler ? await isCDPPortReady(cdpPort, 900) : false;
  const connectionCount = cdpHandler ? cdpHandler.getConnectionCount() : 0;
  const stats = cdpHandler ? await cdpHandler.getStats() : {};
  try {
    controlPanel.webview.postMessage({
      type: "state",
      state: {
        isEnabled,
        backgroundModeEnabled,
        ide: currentIDE,
        platform: `${process.platform} / ${os.arch()}`,
        cdpPort,
        cdpReady,
        connectionCount,
        pollInterval,
        processingDelaySeconds,
        maxRetries,
        retryCooldownMs,
        retryDelaySeconds,
        enableNativeCommands,
        stats: {
          retries: stats.retries || 0,
          errorsDetected: stats.errorsDetected || 0,
          consecutiveRetries: stats.consecutiveRetries || 0,
          lastError: stats.lastError || "",
          lastBusyPattern: stats.lastBusyPattern || "",
          lastRetryAt: stats.lastRetryAt || "",
          countdownActive: stats.countdownActive || false,
          countdownSecondsLeft: stats.countdownSecondsLeft || 0,
          waitingForPreviousInput: stats.waitingForPreviousInput || false,
          busyAcks: stats.busyAcks || 0,
          nativeContinueRequested: stats.nativeContinueRequested || false,
          retryHistory: stats.retryHistory || []
        },
        lastRefreshedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  } catch (e) {
    log(`Panel state push failed: ${e.message}`);
  }
}
function getControlPanelHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    :root {
      --bg: #0c0c0c;
      --surface: #141414;
      --surface-2: #1a1a1a;
      --border: #222;
      --border-hover: #333;
      --txt: #e0e0e0;
      --txt-secondary: #777;
      --accent: #00d4aa;
      --accent-dim: rgba(0, 212, 170, 0.08);
      --accent-glow: rgba(0, 212, 170, 0.12);
      --red: #e55;
      --red-dim: rgba(238, 85, 85, 0.08);
      --amber: #e0a030;
      --amber-dim: rgba(224, 160, 48, 0.08);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, system-ui, sans-serif;
      background: var(--bg);
      color: var(--txt);
      padding: 24px 20px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    .wrap {
      max-width: 640px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* \u2500\u2500 Cards \u2500\u2500 */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 18px;
      transition: border-color 0.15s ease;
    }
    .card:hover { border-color: var(--border-hover); }
    .card.active { border-color: rgba(0,212,170,0.25); }

    /* \u2500\u2500 Header \u2500\u2500 */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .header-left { display: flex; align-items: center; gap: 10px; }

    .logo {
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
      background: var(--accent-dim);
      border-radius: 8px;
      flex-shrink: 0;
    }

    h1 {
      font-size: 15px;
      font-weight: 600;
      color: var(--txt);
      letter-spacing: -0.2px;
    }
    h1 span {
      color: var(--txt-secondary);
      font-weight: 400;
      font-size: 12px;
      margin-left: 6px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .badge.on {
      background: var(--accent-dim);
      color: var(--accent);
    }
    .badge.off {
      background: rgba(119,119,119,0.1);
      color: var(--txt-secondary);
    }

    .dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot.on {
      background: var(--accent);
      box-shadow: 0 0 6px var(--accent);
      animation: pulse 2s ease-in-out infinite;
    }
    .dot.off { background: #555; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }

    /* \u2500\u2500 Controls row \u2500\u2500 */
    .controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    button {
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      color: var(--txt);
      background: var(--surface-2);
      border: 1px solid var(--border);
    }
    button:hover {
      border-color: var(--border-hover);
      background: #1e1e1e;
    }
    button:active { transform: scale(0.97); }
    button.primary {
      background: var(--accent);
      color: #000;
      border-color: transparent;
      font-weight: 600;
    }
    button.primary:hover {
      background: #00e5bf;
      border-color: transparent;
    }
    button.danger {
      background: rgba(238,85,85,0.12);
      border-color: rgba(238,85,85,0.2);
      color: var(--red);
    }
    button.danger:hover {
      background: rgba(238,85,85,0.18);
    }
    button:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

    /* \u2500\u2500 CDP pill \u2500\u2500 */
    .cdp-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 500;
      background: var(--surface-2);
      border: 1px solid var(--border);
      color: var(--txt-secondary);
    }
    .cdp-pill.ok {
      border-color: rgba(0,212,170,0.2);
      color: var(--accent);
    }
    .cdp-pill.bad {
      border-color: rgba(238,85,85,0.2);
      color: var(--red);
    }

    /* \u2500\u2500 Stats grid \u2500\u2500 */
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .stat-item {
      padding: 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      text-align: center;
    }
    .stat-label {
      font-size: 10px;
      font-weight: 500;
      color: var(--txt-secondary);
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .stat-value {
      font-size: 22px;
      font-weight: 700;
      margin-top: 4px;
      font-variant-numeric: tabular-nums;
    }
    .stat-value.accent { color: var(--accent); }
    .stat-value.sm { font-size: 13px; font-weight: 500; }

    /* \u2500\u2500 Section labels \u2500\u2500 */
    .section-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--txt-secondary);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 10px;
    }

    /* \u2500\u2500 Toggle row \u2500\u2500 */
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .toggle-info h3 {
      font-size: 13px;
      font-weight: 600;
      color: var(--txt);
    }
    .toggle-info p {
      font-size: 11px;
      color: var(--txt-secondary);
      margin-top: 2px;
    }

    .toggle-btn {
      min-width: 56px;
      padding: 6px 14px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 6px;
      text-align: center;
    }
    .toggle-btn.is-on {
      background: var(--accent-dim);
      border-color: rgba(0,212,170,0.2);
      color: var(--accent);
    }

    /* \u2500\u2500 Config \u2500\u2500 */
    .config-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .config-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .config-item label {
      font-size: 10px;
      font-weight: 500;
      color: var(--txt-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .config-item input[type="number"] {
      width: 100%;
      padding: 7px 10px;
      font-family: inherit;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
      color: var(--txt);
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      transition: border-color 0.15s ease;
    }
    .config-item input:focus {
      outline: none;
      border-color: var(--accent);
    }
    .config-item.wide {
      grid-column: 1 / -1;
    }
    .slider-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .slider-wrap input[type="range"] {
      width: 100%;
      accent-color: var(--accent);
    }
    .slider-value {
      min-width: 52px;
      text-align: right;
      font-size: 12px;
      font-weight: 600;
      color: var(--accent);
      font-variant-numeric: tabular-nums;
    }
    .config-hint {
      font-size: 11px;
      color: var(--txt-secondary);
      line-height: 1.4;
    }

    .save-row {
      display: flex;
      gap: 6px;
      margin-top: 10px;
      flex-wrap: wrap;
    }

    /* \u2500\u2500 Countdown card \u2500\u2500 */
    .countdown-card {
      text-align: center;
      border-color: rgba(224,160,48,0.3) !important;
    }
    .countdown-number {
      font-size: 48px;
      font-weight: 700;
      color: var(--amber);
      line-height: 1;
      font-variant-numeric: tabular-nums;
      animation: cdPulse 1s ease-in-out infinite;
    }
    @keyframes cdPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .countdown-bar-track {
      margin-top: 12px;
      height: 3px;
      background: var(--surface-2);
      border-radius: 2px;
      overflow: hidden;
    }
    .countdown-bar-fill {
      height: 100%;
      background: var(--amber);
      border-radius: 2px;
      transition: width 1s linear;
    }

    /* \u2500\u2500 History \u2500\u2500 */
    .history-list {
      max-height: 180px;
      overflow-y: auto;
    }
    .history-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 0;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
    }
    .history-item:last-child { border-bottom: none; }
    .history-time { color: var(--txt-secondary); font-size: 11px; font-variant-numeric: tabular-nums; }
    .history-pattern { color: var(--txt-secondary); font-size: 11px; margin-left: 6px; }
    .history-action {
      font-size: 10px;
      font-weight: 600;
      color: var(--accent);
      padding: 2px 8px;
      background: var(--accent-dim);
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      flex-shrink: 0;
    }

    /* \u2500\u2500 Error log \u2500\u2500 */
    .error-log {
      padding: 10px 12px;
      border-radius: 8px;
      background: var(--red-dim);
      border: 1px solid rgba(238,85,85,0.15);
      font-size: 12px;
      color: #f99;
      word-break: break-word;
      margin-top: 8px;
      max-height: 100px;
      overflow-y: auto;
    }
    .error-log:empty { display: none; }

    /* \u2500\u2500 Footer \u2500\u2500 */
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .footer-meta {
      font-size: 11px;
      color: var(--txt-secondary);
    }
    .footer-meta kbd {
      font-family: inherit;
      background: var(--surface-2);
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 10px;
      border: 1px solid var(--border);
    }

    /* \u2500\u2500 Scrollbar \u2500\u2500 */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
    ::-webkit-scrollbar-thumb:hover { background: #444; }
  </style>
</head>
<body>
  <div class="wrap">

    <!-- Header -->
    <div class="card" id="mainCard">
      <div class="header">
        <div class="header-left">
          <div class="logo">\u26A1</div>
          <h1>AutoContinue<span>v2.3</span></h1>
        </div>
        <div id="statusBadge" class="badge off">
          <span class="dot off" id="statusDot"></span>
          <span id="statusLabel">OFF</span>
        </div>
      </div>
    </div>

    <!-- Countdown (hidden by default) -->
    <div class="card countdown-card" id="countdownCard" style="display:none;">
      <div class="section-label" style="margin-bottom:6px;">\u26A1 Retrying in\u2026</div>
      <div class="countdown-number" id="countdownNumber">5</div>
      <div style="font-size:12px; color:var(--txt-secondary); margin-top:6px;">Auto-clicking retry button</div>
      <div class="countdown-bar-track">
        <div class="countdown-bar-fill" id="countdownBar" style="width:100%;"></div>
      </div>
    </div>

    <!-- Main controls -->
    <div class="card">
      <div class="controls">
        <button class="primary" id="toggleBtn" style="flex:1;">Enable AutoContinue</button>
        <button id="refreshBtn">\u21BB</button>
      </div>
      <div id="cdpStatus" class="cdp-pill" style="margin-top:10px;">Checking CDP\u2026</div>
    </div>

    <!-- Background mode -->
    <div class="card" id="bgCard">
      <div class="toggle-row">
        <div class="toggle-info">
          <h3>Background Mode</h3>
          <p>Overlay + silent retry when tab is not visible</p>
        </div>
        <button id="toggleBgBtn" class="toggle-btn">OFF</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="card">
      <div class="section-label">Statistics</div>
      <div class="stats">
        <div class="stat-item">
          <div class="stat-label">Retries</div>
          <div class="stat-value accent" id="totalRetries">0</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Errors</div>
          <div class="stat-value" id="errorsDetected">0</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Consecutive</div>
          <div class="stat-value" id="consecutiveRetries">0</div>
        </div>
      </div>
      <div class="stats" style="margin-top:8px;">
        <div class="stat-item">
          <div class="stat-label">CDP</div>
          <div class="stat-value sm" id="connections">0</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Last Retry</div>
          <div class="stat-value sm" id="lastRetry">\u2014</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Platform</div>
          <div class="stat-value sm" id="platform">\u2014</div>
        </div>
      </div>
    </div>

    <!-- Retry History (hidden by default) -->
    <div class="card" id="historyCard" style="display:none;">
      <div class="section-label">Recent Retries</div>
      <div class="history-list" id="historyList"></div>
    </div>

    <!-- Last Error (hidden by default) -->
    <div class="card" id="errorCard" style="display:none;">
      <div class="section-label" id="errorLabel">Last Error</div>
      <div class="error-log" id="lastError"></div>
    </div>

    <!-- Configuration -->
    <div class="card">
      <div class="section-label">Configuration</div>
      <div class="config-grid">
        <div class="config-item">
          <label>CDP Port</label>
          <input id="portInput" type="number" min="1" max="65535" step="1" />
        </div>
        <div class="config-item">
          <label>Max Retries</label>
          <input id="maxRetriesInput" type="number" min="1" max="500" step="1" />
        </div>
        <div class="config-item wide">
          <label>Processing Wait</label>
          <div class="slider-wrap">
            <input id="processingDelayInput" type="range" min="1" max="30" step="1" />
            <div class="slider-value" id="processingDelayValue">5s</div>
          </div>
          <div class="config-hint">Fast scanning stays on. This only controls how long AutoContinue waits before retrying or sending a continue fallback.</div>
        </div>
      </div>
      <div class="save-row">
        <button id="savePort">Save Port</button>
        <button id="saveMaxRetries">Save Retries</button>
      </div>
    </div>

    <!-- Footer -->
    <div class="card">
      <div class="footer">
        <div class="controls">
          <button id="copyDiagnostics">Copy Diagnostics</button>
          <button id="openOutputLog">Output Log</button>
        </div>
        <div class="footer-meta">
          <kbd>\u2318\u21E7K</kbd> toggle \xB7 IDE: <span id="ide">\u2014</span>
        </div>
      </div>
      <div class="footer-meta" style="margin-top:8px;">Last refresh: <span id="lastRefreshed">\u2014</span></div>
    </div>

  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const byId = (id) => document.getElementById(id);
    function post(type, payload = {}) { vscode.postMessage({ type, ...payload }); }

    function render(s) {
      const badge = byId('statusBadge');
      const dot = byId('statusDot');
      const label = byId('statusLabel');
      const mainCard = byId('mainCard');
      const toggleBtn = byId('toggleBtn');

      if (s.isEnabled && s.backgroundModeEnabled) {
        badge.className = 'badge on';
        dot.className = 'dot on';
        label.textContent = 'BG MODE';
        mainCard.classList.add('active');
        toggleBtn.textContent = 'Disable';
        toggleBtn.className = 'danger';
        toggleBtn.style.cssText = 'flex:1;';
      } else if (s.isEnabled) {
        badge.className = 'badge on';
        dot.className = 'dot on';
        label.textContent = 'ACTIVE';
        mainCard.classList.add('active');
        toggleBtn.textContent = 'Disable';
        toggleBtn.className = 'danger';
        toggleBtn.style.cssText = 'flex:1;';
      } else {
        badge.className = 'badge off';
        dot.className = 'dot off';
        label.textContent = 'OFF';
        mainCard.classList.remove('active');
        toggleBtn.textContent = 'Enable AutoContinue';
        toggleBtn.className = 'primary';
        toggleBtn.style.cssText = 'flex:1;';
      }

      const bgBtn = byId('toggleBgBtn');
      const bgCard = byId('bgCard');

      if (s.backgroundModeEnabled) {
        bgBtn.textContent = 'ON';
        bgBtn.className = 'toggle-btn is-on';
        bgCard.style.borderColor = 'rgba(0,212,170,0.2)';
      } else {
        bgBtn.textContent = 'OFF';
        bgBtn.className = 'toggle-btn';
        bgCard.style.borderColor = '';
      }

      // CDP status
      const cdpEl = byId('cdpStatus');
      if (s.cdpReady) {
        cdpEl.textContent = 'Port ' + s.cdpPort + ' \xB7 ' + s.connectionCount + ' target' + (s.connectionCount !== 1 ? 's' : '') + ' connected';
        cdpEl.className = 'cdp-pill ok';
      } else {
        cdpEl.textContent = 'CDP unavailable \xB7 port ' + s.cdpPort;
        cdpEl.className = 'cdp-pill bad';
      }

      // Countdown card
      const countdownCard = byId('countdownCard');
      const stats = s.stats || {};
      if (stats.countdownActive && stats.countdownSecondsLeft > 0) {
        countdownCard.style.display = '';
        byId('countdownNumber').textContent = String(stats.countdownSecondsLeft);
        const totalDelay = s.processingDelaySeconds || s.retryDelaySeconds || 5;
        const pct = Math.max(0, (stats.countdownSecondsLeft / totalDelay) * 100);
        byId('countdownBar').style.width = pct + '%';
      } else {
        countdownCard.style.display = 'none';
      }

      // Stats
      byId('totalRetries').textContent = String(stats.retries || 0);
      byId('errorsDetected').textContent = String(stats.errorsDetected || 0);
      byId('consecutiveRetries').textContent = String(stats.consecutiveRetries || 0);
      byId('connections').textContent = String(s.connectionCount || 0);
      byId('ide').textContent = s.ide || '\u2014';
      byId('platform').textContent = s.platform || '\u2014';

      if (stats.lastRetryAt) {
        try {
          byId('lastRetry').textContent = new Date(stats.lastRetryAt).toLocaleTimeString();
        } catch (e) {
          byId('lastRetry').textContent = stats.lastRetryAt;
        }
      } else {
        byId('lastRetry').textContent = '\u2014';
      }

      // Retry history
      const historyCard = byId('historyCard');
      const historyList = byId('historyList');
      const history = Array.isArray(stats.retryHistory) ? stats.retryHistory : [];
      if (history.length > 0) {
        historyCard.style.display = '';
        historyList.innerHTML = history.slice().reverse().map(h => {
          let timeStr = '\u2014';
          try { timeStr = new Date(h.at).toLocaleTimeString(); } catch(e) {}
          return '<div class="history-item">' +
            '<div><span class="history-time">' + timeStr + '</span>' +
            '<span class="history-pattern"> \xB7 ' + (h.pattern || '\u2014').slice(0, 40) + '</span></div>' +
            '<span class="history-action">' + (h.action || 'retry') + '</span>' +
          '</div>';
        }).join('');
      } else {
        historyCard.style.display = 'none';
      }

      // Error card
      const errorCard = byId('errorCard');
      const errorLabel = byId('errorLabel');
      const errorEl = byId('lastError');
      if (stats.waitingForPreviousInput && stats.lastBusyPattern) {
        errorCard.style.display = '';
        errorLabel.textContent = 'Input Queue';
        errorEl.textContent = stats.lastBusyPattern + ' \u2014 waiting instead of sending another continue.';
      } else if (stats.lastError) {
        errorCard.style.display = '';
        errorLabel.textContent = 'Last Error';
        errorEl.textContent = stats.lastError;
      } else {
        errorCard.style.display = 'none';
      }

      // Config inputs \u2014 only update when user is NOT focused
      const activeId = document.activeElement ? document.activeElement.id : '';
      if (activeId !== 'portInput') byId('portInput').value = String(s.cdpPort || 9000);
      if (activeId !== 'maxRetriesInput') byId('maxRetriesInput').value = String(s.maxRetries || 50);
      if (activeId !== 'processingDelayInput') byId('processingDelayInput').value = String(s.processingDelaySeconds || 5);
      byId('processingDelayValue').textContent = String(s.processingDelaySeconds || 5) + 's';

      // Timestamps
      if (s.lastRefreshedAt) {
        try {
          byId('lastRefreshed').textContent = new Date(s.lastRefreshedAt).toLocaleTimeString();
        } catch (e) {
          byId('lastRefreshed').textContent = s.lastRefreshedAt;
        }
      }
    }

    window.addEventListener('message', (event) => {
      const msg = event.data || {};
      if (msg.type === 'state') {
        render(msg.state || {});
      }
    });

    byId('toggleBtn').addEventListener('click', () => post('toggleAuto'));
    byId('toggleBgBtn').addEventListener('click', () => post('toggleBackground'));
    byId('refreshBtn').addEventListener('click', () => post('refresh'));
    byId('savePort').addEventListener('click', () => post('savePort', { port: Number(byId('portInput').value) }));
    byId('saveMaxRetries').addEventListener('click', () => post('saveMaxRetries', { value: Number(byId('maxRetriesInput').value) }));
    byId('processingDelayInput').addEventListener('input', () => {
      byId('processingDelayValue').textContent = String(byId('processingDelayInput').value) + 's';
    });
    byId('processingDelayInput').addEventListener('change', () => {
      post('saveProcessingDelay', { value: Number(byId('processingDelayInput').value) });
    });
    byId('copyDiagnostics').addEventListener('click', () => post('copyDiagnostics'));
    byId('openOutputLog').addEventListener('click', () => post('openOutputLog'));

    post('ready');
    setInterval(() => post('refresh'), 2000);
  </script>
</body>
</html>`;
}
async function handleCopyDiagnostics() {
  try {
    const cdpReady = await isCDPPortReady(cdpPort, 900);
    const stats = cdpHandler ? await cdpHandler.getStats() : {};
    const lines = [
      "AutoContinue Agent v2 Diagnostics",
      `generatedAt=${(/* @__PURE__ */ new Date()).toISOString()}`,
      `ide=${currentIDE}`,
      `platform=${process.platform}`,
      `arch=${os.arch()}`,
      `enabled=${isEnabled}`,
      `backgroundMode=${backgroundModeEnabled}`,
      `cdpPort=${cdpPort}`,
      `cdpReady=${cdpReady}`,
      `connectionCount=${cdpHandler ? cdpHandler.getConnectionCount() : 0}`,
      `pollInterval=${pollInterval}`,
      `processingDelaySeconds=${processingDelaySeconds}`,
      `maxRetries=${maxRetries}`,
      `retryCooldownMs=${retryCooldownMs}`,
      `retryDelaySeconds=${retryDelaySeconds}`,
      `enableNativeCommands=${enableNativeCommands}`,
      `stats.retries=${stats.retries || 0}`,
      `stats.errorsDetected=${stats.errorsDetected || 0}`,
      `stats.consecutiveRetries=${stats.consecutiveRetries || 0}`,
      `stats.countdownActive=${stats.countdownActive || false}`,
      `stats.waitingForPreviousInput=${stats.waitingForPreviousInput || false}`,
      `stats.lastBusyPattern=${stats.lastBusyPattern || "-"}`,
      `stats.busyAcks=${stats.busyAcks || 0}`,
      `stats.nativeContinueRequested=${stats.nativeContinueRequested || false}`,
      `stats.lastError=${stats.lastError || "-"}`,
      `stats.lastRetryAt=${stats.lastRetryAt || "-"}`
    ];
    await vscode.env.clipboard.writeText(lines.join("\n"));
    log("Diagnostics copied to clipboard");
    vscode.window.showInformationMessage("AutoContinue: Diagnostics copied to clipboard.");
  } catch (err) {
    log(`Failed to copy diagnostics: ${err.message}`);
  }
}
function deactivate() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (cdpRefreshTimer) {
    clearInterval(cdpRefreshTimer);
    cdpRefreshTimer = null;
  }
  if (activePollingTimer) {
    clearInterval(activePollingTimer);
    activePollingTimer = null;
  }
  if (cdpHandler) {
    cdpHandler.stop().catch(() => {
    });
  }
  log("AutoContinue v2: Deactivated");
}
module.exports = { activate, deactivate };
