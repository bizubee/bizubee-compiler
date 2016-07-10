
import tangler from 'tangler'
import fs from 'fs'
import co from 'co'
import cc from 'cli-color'
import Pipeline from 'lazy-iterator'
import * as bz from '../src/parser'
import * as lex from '../src/lexer'
import * as sources from '../src/source'

const pad = function(str, len) {
	str = str + "";
	if (str.length > len) {
		throw new Error('Original string cannot be longer than target!');
	} else {
		while (str.length < len) {
			str += ' ';
		}

		return str;
	}
}

const cache = new Map();

const descriptionTable = [
	'Lexing error',
	'Bizubee AST build error',
	'JS AST generation error',
	'JS code generation error',
	'Runtime error'
];

const PADDING = 60;

const FUN_DIR = `function`;

let CURRENT_CODE;

let tests = [];
// get array of test files
const testFiles = new Set(fs.readdirSync(`${__dirname}/function/`));
const pipeline = new Pipeline();


let nullOut = {
	log: function() {

	}
};

const fail = cc.red('\u2718');
const win = cc.green('\u2714');


function TestKit(ctrl, promise) {
	this.eq = function(a, b, msg) {
		if (a !== b) {
			ctrl.fail();
			return false;
		} else return true;
	}

	this.arrayEq = function(a1, a2, msg) {
		if (a1.length === a2.length) {
			for (let i = 0; i < a1.length; i++) {
				let truth = this.eq(a1[i], a2[i], msg);
				if (!truth) return false;
			}

			return true;
		} else {
			ctrl.fail();
		}
	}

	this.neq = function(a, b, msg) {
		if (a === b) {
			ctrl.fail();
			return false;
		} else return true;
	}

	this.throws = function(fn, msg) {
		try {
			fn();
			ctrl.fail();
			return false;
		} catch (e) {
			return true;
		}
	}

	this.assert = function(expr, msg) {
		if (!expr)
			ctrl.fail();
	}

	this.done = function(msg) {
		ctrl.win();
	}
	
	this.fail = function(msg) {
		ctrl.fail();
	}
	
	this.isInstance = function(obj, ctor, msg) {
		return this.assert(obj instanceof ctor, msg);
	}

	this.throwError = () => {
	    var t = null;
	    return t.noprop.noprop;
	}

	this.dontThrowError = () => {
	    return 5;
	}

	this.observableFromArray = (arr) => {
		var observable = {};
		observable[blib.symbols.observer] = () => {
			var i = 0;
			return {
				next() {
					if (i < arr.length) {
						i++;
						return Promise.resolve({
							value: arr[i - 1],
							done: false
						});
					} else {
						return Promise.resolve({
							value: null,
							done: true
						});
					}
				},
				[blib.symbols.observer] () {
					return this;
				}
			}
		};

		return observable;
	}

	this.is = function(value, target) {
		return typeof value === target;
	}
}

const startRgx =
	/^test\( *('.*'), \([$a-zA-Z][$a-zA-Z0-9]*\) *-> *~? *{ *\n?$/;

function* getLines(file) {
	var csrc = new sources
		.StringSource(fs.readFileSync(file, 'utf8'));
	var line = "", i = 0;
	while (true) {
		const c = csrc.get(i);
		if (c === null) {
			yield line;
			return;
		}

		line += c;

		if (c === '\n') {
			yield line;
			line = "";
		}

		i++;
	}
}

function* getTests(file) {
	var test = null, name = null;
	for (var string of getLines(file)) {
		if (string[0] === 't') {
			const match = startRgx.exec(string);
			if (match !== null) {
				if (name !== null && test !== null ) {
					yield [name, `\n${test}`];
				}

				name = eval(match[1]);
				test = string;
				continue;
			}
		}

		if (test !== null) {
			test += string;
		}
	}

	if (name !== null && test !== null ) {
		yield [name, `\n${test}`];
	}
}


const discard = (el) => {
	// do nothing
}

const resolver = {
	resolveId(importee) {
		return importee;
	},
	load(id) {
		if (id === 'bizubee utils') {
			return {source:
				fs.readFileSync(`${__dirname}/bizubee-utilities.js`, 'utf8')};
		} else {
			const {source} = cache.get(id);
			const ast = bz.parseString(source)
				.getJSTree();
			return {ast, context: this.context};
		}
	}
}

const blib = tangler.require('bizubee utils', null, resolver);

const runTests = co.wrap(function*({name, source, path, id}) {
	var promise;
	var passed = 0;
	const globalContext = {
		test(title, fn) {
			promise = new Promise(function(win, fail) {
				let ctrl = {
					win: win,
					fail: fail,
					index: tests.length
				};
		
				fn(new TestKit(ctrl));
			});
		}
	};

	// compiler able to tokenize
	try {
		const csrc = new sources.StringSource(source);
		for (var token of lex.tokenizeCharSrc(csrc)) {
			// do nothing
		}
		passed += 1;
	} catch (e) {

		return passed;
	}


	const ctrl = bz.parseString(source, {
		file: path,
		output: console,
		throwSyntax: true
	});

	// compiler able to generate bizubee ast
	try {
		discard(ctrl.tree);
		passed += 1;
	} catch (e) {

		return passed;
	}

	// compiler able to generate JS AST
	try {
		ctrl.getJSTree();
		passed += 1;
	} catch (e) {

		return passed;
	}

	// compiler able to generate JS code
	try {
		ctrl.getJSText();
		passed += 1;
	} catch (e) {

		return passed;
	}

	// unexpected runtime error(s)
	try {
		resolver.context = globalContext;
		tangler.run(id, null, resolver);
		try {
			yield promise;
			passed += 1;
		} catch (e) {
			return passed;
		}
	} catch(e) {

		console.log(cc.red(e.stack));
		return passed;
	}

	return passed;
});

co(function*(){
	let i = 0, passed = 0, failed = 0;
	console.log(`failed (${cc.red('*')}), passed (${cc.green('*')}):\n`);

	console.log(`test   ${pad("", PADDING)}\tresult`);
	console.log();
	while (true) {
		const ctrl = yield pipeline.next();
		if (ctrl.done)
			break;
		
		const test = ctrl.value;
		const res = yield test.promise;
		const max = 5;

		let output;
		if (res === max) {
			output = (` ${pad(i + 1, 5)}: ${pad(test.title, PADDING)}\t${win}`);
			output += ('\t' + pad('', 30));
		} else {
			const msg = descriptionTable[res];
			const str = ` ${pad(i + 1, 5)}: ${pad(test.title, PADDING)}\t${fail}`;
			output = (`${str}\t${pad(msg, 30)}`);
		}

		if (i % 2 === 0) {
			console.log(cc.bgWhite(output));
		} else {
			console.log(output);
		}

		if (res === max)
			passed++;
		else
			failed++;

		i++;
	}
	
	console.log();
	if (passed === i) {
		console.log(`Passed all ${i} tests, congratulations!!!`)
	} else {
		console.log(`Failed ${failed} of ${i} tests, sorry! :(`)
	}
});

co(function*() {
	var i = 0;
	for (let testFile of testFiles) {
		let relativePath = `${__dirname}/function/${testFile}`;
		if (!testFile.endsWith('.bz')) {
			continue;
		}

		for (var [name, source] of getTests(relativePath)) {
			cache.set(i, {name, source});
			pipeline.send({
				title: name,
				promise: runTests({
					id: i,
					name,
					source,
					path: relativePath
				})
			});

			i++;
			yield Promise.resolve();
		}
	}
	
	pipeline.close();
});