export const symbols = {
    observer: Symbol('Observer symbol'),
    default: Symbol('Default symbol')
};

const returnVal = function(val) {
    return val;
};

// wrapper that turns generators functions into async functions
export const async = function(fn) {
	return function () {
		var gen = fn.apply(this, arguments);
		try {
			return resolved();
		} catch (e) {
			return Promise.reject(e);
		}
		function resolved(res) { return next(gen.next(res)); }
		function rejected(err) { return next(gen.throw(err)); }
		function next(ret) {
			var val = ret.value;
			if (ret.done) {
				return Promise.resolve(val);
			} else try {
				return val.then(resolved, rejected);
			} catch (_) {
				throw new Error('Expected Promise/A+');
			}
		}
	}
}

// used for async generators
export const getObservableCtrl = function() {
	let first = true, promises = [];
	let onsend, onsendfail;
	let onnext, onnextfail;
	let done = function(value) {
		onsend({
			done: true,
			value: value
		});
	};
	let observable = {
		[symbols.observer] () {
			return observable;
		},
		next(value) {
			if (first) {
				if (value !== undefined)
					throw new Error('First sent value must not exist!');

				let p = new Promise(function(win, fail) {
					onsend = win;
					onsendfail = fail;
				});

				first = false;
				api.code().then(done);

				return p;
			} else {
				let p = new Promise(function(win, fail) {
					onsend = win;
					onsendfail = fail;
				});

				onnext(value);

				return p;
			}
		}
	};

	let api = {
		send(value) {
			onsend({
				value: value,
				done: false
			});

			let npromise = new Promise(function(win, fail) {
				onnext = win;
				onnextfail = fail;
			});

			return npromise;
		},
		observable: observable,
        code: null // code must be set by generated JS code
	};

	return api;
}

export const rest = function(iterable) {
	let array = [];
	for (let val of iterable) {
		array.push(val);
	}
	return array;
}

export const restargs = function(args, index) {
	let arr = [];
	for (let i = index; i < args.length; i++) {
		arr.push(args[i]);
	}

	return arr;
}

export const iter = function*(al) {
	for (var i = 0; i < al.length; i++) {
		yield al[i];
	}
}

export const concat = function(args) {
	let argv = [];
	for (let i = 0; i < args.length; i++) {
		for (let arg of args[i]) {
			argv.push(arg);
		}
	}
	
	return argv;
}

export const last = function() {
	if (arguments.length === 0)
		return;
	
	return arguments[arguments.length - 1];
}

export const classify = function(cls, protoProps, staticProps) {
	var proto = cls.prototype;
	for (var key in protoProps) {
		if (protoProps[key] instanceof Function) {
			proto[key] = protoProps[key];
		} else {
			Object.defineProperty(proto, key, {
				get: returnVal.bind(null, protoProps[key])
			});
		}
	}
	
	for (var key in staticProps) {
	    cls[key] = staticProps[key];
	}
	
	return cls;
}
