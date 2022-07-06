import type {Target} from '@angular-devkit/architect';
import type {schema, workspaces} from '@angular-devkit/core';
import {
	type JsonObject,
	type ProjectDefinition,
	type ProjectDefinitionCollection,
	readWorkspace,
	type WorkspaceDefinition,
	workspaceFilenames,
} from '@snuggery/core';
import {type BaseContext, UsageError} from 'clipanion';
import {basename, dirname, normalize, relative, resolve, sep} from 'path';

import {findUp} from '../utils/find-up';
import type {Report} from '../utils/report';
import {createWorkspaceTransform} from '../utils/schema';

export interface Context extends BaseContext {
	/**
	 * The folder the command was executed in
	 */
	startCwd: string;

	/**
	 * The configured workspace, if any
	 */
	workspace: CliWorkspace | null;

	/**
	 * Report / logger
	 */
	report: Report;

	/**
	 * Information on the global CLI if snuggery is executed via global
	 */
	globalManifest?: string;
}

export class CliWorkspace implements WorkspaceDefinition {
	#syntheticProject?: ProjectDefinition;
	readonly #workspace: WorkspaceDefinition;
	readonly workspaceFilename: string;
	readonly workspaceFolder: string;

	constructor(workspace: WorkspaceDefinition, workspacePath: string) {
		this.#workspace = workspace;

		this.workspaceFilename = basename(workspacePath);
		this.workspaceFolder = dirname(workspacePath);
	}

	/** @deprecated Remove before 1.0.0, kept temporarily to not break @snuggery/global */
	get basePath() {
		return this.workspaceFolder;
	}

	get extensions(): JsonObject {
		return this.#workspace.extensions;
	}

	get projects(): ProjectDefinitionCollection {
		return this.#workspace.projects;
	}

	get defaultProject(): string | null {
		return typeof this.extensions.defaultProject === 'string'
			? this.extensions.defaultProject
			: null;
	}

	tryGetProjectNameByCwd(
		cwd: string,
		warn: (message: string) => void,
	): string | null {
		const relativeCwd = normalize(
			relative(this.workspaceFolder, resolve(this.workspaceFolder, cwd)),
		);

		if (relativeCwd.startsWith(`..${sep}`)) {
			throw new UsageError(`Invalid project path ${relativeCwd}`);
		}

		let longestMatch = '';
		let longestMatchingProject: string | null = null;

		let warnDuplicate = false;

		for (const [name, project] of this.projects) {
			const root = normalize(project.root);

			if (root === relativeCwd) {
				if (longestMatch === root) {
					warnDuplicate = true;
					longestMatchingProject = this.defaultProject;
				} else {
					warnDuplicate = false;
					longestMatch = root;
					longestMatchingProject = name;
				}
			} else if (
				relativeCwd.startsWith(`${root}${sep}`) &&
				root.length > longestMatch.length
			) {
				if (longestMatch === root) {
					warnDuplicate = true;
					longestMatchingProject = this.defaultProject;
				} else {
					warnDuplicate = false;
					longestMatch = root;
					longestMatchingProject = name;
				}
			}
		}

		if (warnDuplicate) {
			warn(
				`Multiple projects have the same root ${relativeCwd}, using the default project "${longestMatchingProject}"`,
			);
		}

		return longestMatchingProject;
	}

	tryGetProjectByName(name: string): workspaces.ProjectDefinition | null {
		return this.projects.get(name) ?? null;
	}

	getProjectByName(name: string): workspaces.ProjectDefinition {
		const project = this.projects.get(name);

		if (project == null) {
			throw new UsageError(
				`No project named ${JSON.stringify(name)} found in the workspace`,
			);
		}

		return project;
	}

	makeSyntheticTarget(projectName: string | null, builder: string): Target {
		let project;
		if (projectName == null) {
			projectName = '@synthetic/project';
			project =
				this.#syntheticProject ??
				(this.#syntheticProject = this.projects.add({
					name: projectName,
					root: '',
				}));
		} else {
			project = this.tryGetProjectByName(projectName);
			if (project == null) {
				throw new UsageError(`Unknown project "${projectName}"`);
			}
		}

		const targetName = `$$synthetic-${Date.now()}-${Math.random()
			.toFixed(5)
			.slice(2)}$$`;
		project.targets.add({
			name: targetName,
			builder,
		});

		return {
			project: projectName,
			target: targetName,
		};
	}

	/**
	 * Create a JsonVisitor for all data in this workspace validated by a schema.
	 */
	createWorkspaceDataVisitor(): schema.JsonVisitor {
		return createWorkspaceTransform(this.workspaceFilename);
	}
}

export async function findWorkspace(
	startingCwd: string,
): Promise<CliWorkspace | null> {
	const workspacePath = await findUp(workspaceFilenames, startingCwd);

	if (workspacePath == null) {
		return null;
	}

	return new CliWorkspace(await readWorkspace(workspacePath), workspacePath);
}
