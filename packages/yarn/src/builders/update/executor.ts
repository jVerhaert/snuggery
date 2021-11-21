import type {BuilderContext, BuilderOutput} from '@angular-devkit/architect';
import {defer, Observable, of} from 'rxjs';
import {catchError, mapTo, switchMap} from 'rxjs/operators';

import {loadYarn} from '../../utils/yarn';

import type {Schema} from './schema';

const snuggeryWorkspacePlugin = '@yarnpkg/plugin-snuggery-workspace';

export function executeUpdate(
	{packages}: Schema,
	context: BuilderContext,
): Observable<BuilderOutput> {
	return defer(() => loadYarn(context)).pipe(
		switchMap(yarn => {
			return yarn.listPlugins().pipe(
				switchMap(plugins => {
					const hasPlugin = plugins.some(
						plugin => plugin.name === snuggeryWorkspacePlugin,
					);

					if (!hasPlugin) {
						return of({
							success: false,
							error: `Couldn't find ${snuggeryWorkspacePlugin}`,
						});
					}

					return yarn.snuggeryWorkspaceUp(packages).pipe(
						mapTo<void, BuilderOutput>({success: true}),
						catchError(e =>
							of<BuilderOutput>({
								success: false,
								error: e.message,
							}),
						),
					);
				}),
			);
		}),
	);
}
