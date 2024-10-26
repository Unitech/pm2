const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const rl = readline.createInterface({ input: stdin, output: stdout });

const defaultConfig = require('./config.json');

async function main() {
	// Read overrides from stdin
	const overridesStr = await rl.question('overrides? ');
	let overrides;
	try {
		overrides = JSON.parse(overridesStr);
	} catch (e) {
		console.error(`Error parsing >${overridesStr}<:`, e);
		process.exit(1);
	}

	// Merge overrides into default config to form final config
	const config = Object.assign({}, defaultConfig, overrides);
	console.log(`App running with config: ${JSON.stringify(config, null, 2)}`);
	// Keep it alive
	setInterval(() => {}, 1000);
}

main().catch(console.error);
