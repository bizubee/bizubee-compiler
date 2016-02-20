
import {range, keys} from "standard";

function reflect() {
	return this;
}

export function enumerate(iterator) {
	var i = 0;
	return {
		[Symbol.iterator]: reflect,
		next() {
			const ctrl = iterator.next();
			if (ctrl.done) {
				return ctrl;
			} else {
				return {
					done: false,
					value: tuple(i++, ctrl.value)
				};
			}
		}
	}
}

export function cat(...iterators) {
	const length = iterators.length;
	return {
		[Symbol.iterator]: reflect,
		next(val) {
			const array = new Array(length);
			for (var i = 0; i < length; i++) {
				const ctrl = iterators[i].next(val);
				if (ctrl.done) {
					return {done: true};
				} else {
					array[i] = ctrl.done;
				}
			}

			Object.freeze(array);
			return {
				done: false,
				value: array
			};
		}
	};
}

export function zip(...iterables) {
	const l = iterables.length;
	const iterators =
		iterables.map(iterable => iterable[Symbol.iterator]());
	return {
		[Symbol.iterator]: reflect,
		next() {
			const values = new Array(l);
			for (var i = 0; i < l; i++) {
				const ctrl = iterators[i].next();
				if (ctrl.done) {
					return {done: true};
				} else {
					values[i] = ctrl.value;
				}
			}

			Object.freeze(values);
			return {
				done: false,
				value: values
			}
		}
	}
}

export {range, keys};

export default class Iterable {
	[Symbol.iterator] () {
		return this.iterate();
	}
	iterate() {
		throw new Error("'iterator' method must be implemented!");
	}
}
