
import {readFileSync} from 'fs'
import {parse} from './src/parser'

const input = process.argv[2];
const output = process.argv[3];
const api = parse(fs.readFileSync(input));

fs.writeFileSync(output, api.getJSText({}), 'utf8');
