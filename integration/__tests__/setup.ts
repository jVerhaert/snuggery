import type {JsonObject} from '@snuggery/core';
import * as snuggery from '@snuggery/snuggery/cli';
import path from 'path';
import {Readable, Writable} from 'stream';
import * as assert from 'uvu/assert';

const fixtureRoot = path.resolve(__dirname, '../__fixtures__');

export interface Fixture {
	directory: string;
	run(
		args: string[],
		options?: {cwd?: string},
	): Promise<{stdout: string; stderr: string; exitCode: number}>;
	runJson(args: string[], options?: {cwd?: string}): Promise<JsonObject>;
}

export function inFixture(
	name: string,
	callback: (fixture: Fixture) => PromiseLike<void> | void,
) {
	const fixtureDir = path.join(fixtureRoot, name);
	const run = createRunner(fixtureDir);

	return async () => {
		await callback({
			directory: fixtureDir,
			run,
			runJson: async (args, options) => {
				const {exitCode, stdout, stderr} = await run(args, options);

				assert.equal(
					exitCode,
					0,
					`Failed with exit code ${exitCode}\n== STDOUT: ${stdout}\n== STDERR: ${stderr}`,
				);

				try {
					return JSON.parse(stdout);
				} catch {
					assert.unreachable(`Invalid JSON: ${JSON.stringify(stdout)}`);
				}
			},
		});
	};
}

class EmptyReadable extends Readable {
	constructor() {
		super({
			read: () => {
				this.push(null);
			},
		});
	}
}

class CollectingWritable extends Writable {
	readonly #buffers: Buffer[] = [];

	constructor() {
		super({
			write: (buff, _encoding, callback) => {
				this.#buffers.push(buff);
				callback();
			},
		});
	}

	getContent() {
		return Buffer.concat(this.#buffers);
	}
}

function createRunner(dir: string): Fixture['run'] {
	return async function run(args: string[], options = {}) {
		const startCwd = options.cwd ? path.resolve(dir, options.cwd) : dir;

		const workspace = await snuggery.findWorkspace(startCwd);

		assert.equal(
			workspace?.basePath,
			dir,
			`found workspace at ${workspace?.basePath} instead of ${dir}`,
		);

		const stdout = new CollectingWritable();
		const stderr = new CollectingWritable();

		const exitCode = await snuggery.run(args, {
			stdin: new EmptyReadable(),
			stdout,
			stderr,
			startCwd,
			workspace,
			colorDepth: 1,
		});

		return {
			exitCode,
			stdout: stdout.getContent().toString('utf8'),
			stderr: stderr.getContent().toString('utf8'),
		};
	};
}
