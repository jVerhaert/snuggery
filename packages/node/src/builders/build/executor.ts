import type {BuilderContext, BuilderOutput} from '@angular-devkit/architect';
import {
	copyAssets,
	resolveProjectPath,
	resolveWorkspacePath,
	runPackager,
} from '@snuggery/architect';
import {switchMapSuccessfulResult} from '@snuggery/architect/operators';
import {isJsonObject, type JsonObject} from '@snuggery/core';
import {promises as fs} from 'fs';
import {join} from 'path';
import {forkJoin, from, Observable, ObservableInput, of} from 'rxjs';
import {switchMap, tap} from 'rxjs/operators';

import type {Schema} from './schema';
import {tsc} from './typescript';

const manifestFilename = 'package.json';

export function executeBuild(
	{
		assets = [],
		compile,
		keepScripts = false,
		packager,
		tsconfig,
		outputFolder,
	}: Schema,
	context: BuilderContext,
): Observable<BuilderOutput> {
	let hasTypescript: boolean;
	try {
		require.resolve('typescript/package.json');
		hasTypescript = true;
	} catch {
		hasTypescript = false;
	}

	return forkJoin({
		outputFolder: outputFolder
			? of(resolveWorkspacePath(context, outputFolder))
			: resolveProjectPath(context, 'dist'),

		manifest: resolveProjectPath(context, manifestFilename)
			.then(path => fs.readFile(path, 'utf8'))
			.then(manifest => JSON.parse(manifest) as JsonObject),
	}).pipe(
		tap(({manifest}) => context.logger.info(`Building ${manifest.name}`)),

		switchMap(async ({outputFolder, manifest}) => {
			await fs.mkdir(outputFolder, {recursive: true});
			return {outputFolder, manifest};
		}),

		switchMap(({outputFolder, manifest}) => {
			return (
				compile || hasTypescript
					? from(tsc(context, {compile, tsconfig}, outputFolder))
					: of<BuilderOutput>({success: true})
			).pipe(
				switchMapSuccessfulResult(async (): Promise<BuilderOutput> => {
					try {
						await writeManifest(manifest, {keepScripts}, outputFolder);
						return {success: true};
					} catch (e) {
						return {
							success: false,
							error: `Failed to copy ${manifestFilename}: ${
								e instanceof Error ? e.message : e
							}`,
						};
					}
				}),

				switchMapSuccessfulResult(() => {
					context.logger.debug('Copying assets...');
					return copyAssets(context, outputFolder, assets || []);
				}),

				switchMapSuccessfulResult((): ObservableInput<BuilderOutput> => {
					if (!packager) {
						return of({success: true});
					}

					context.logger.debug('Running packager');
					return runPackager(context, {packager, directory: outputFolder});
				}),

				tap(() =>
					context.logger.debug(`Build for ${manifest.name} is complete`),
				),
			);
		}),
	);
}

async function writeManifest(
	manifest: JsonObject,
	{keepScripts}: Pick<Schema, 'keepScripts'>,
	outputFolder: string,
) {
	if (!keepScripts) {
		delete manifest.scripts;
	}
	delete manifest.devDependencies;
	delete manifest.private;

	if (isJsonObject(manifest.publishConfig)) {
		if (manifest.publishConfig.main !== undefined) {
			manifest.main = manifest.publishConfig.main;
			delete manifest.publishConfig.main;
		}

		if (manifest.publishConfig.exports !== undefined) {
			manifest.exports = manifest.publishConfig.exports;
			delete manifest.publishConfig.exports;
		}
	}

	await fs.writeFile(
		join(outputFolder, manifestFilename),
		JSON.stringify(manifest, null, 2),
	);
}
