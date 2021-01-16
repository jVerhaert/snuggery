import {Option} from 'clipanion';

import {SchematicCommand} from '../command/schematic';

export class NewCommand extends SchematicCommand {
  static paths = [['new']];

  static usage = SchematicCommand.Usage({
    category: 'Schematic commands',
    description: 'Create a new workspace',
    examples: [['Create a new workspace ', '$0 new @schematics/angular']],
  });

  dryRun = Option.Boolean('--dry-run', false, {
    description: 'Run the schematics without writing the results to disk',
  });

  force = Option.Boolean('--force', false, {
    description: 'Write the results to disk even if there are conflicts',
  });

  showFileChanges = Option.Boolean('--show-file-changes', false, {
    description: 'Print an overview of all file changes made by the schematic',
  });

  collection = Option.String();

  args = Option.Proxy();

  protected get root(): string {
    return this.context.startCwd;
  }

  protected readonly resolveSelf = true;

  async execute(): Promise<number | void> {
    const schematic = this.getSchematic(this.collection, 'ng-new', true);

    const {
      options: definedOptions,
      allowExtraOptions,
      description,
    } = await this.getOptions(schematic);

    /* eslint-disable @typescript-eslint/no-var-requires */
    this.workflow.registry.addSmartDefaultProvider(
      'ng-cli-version',
      () => require('@angular-devkit/core/package.json').version,
    );
    this.workflow.registry.addSmartDefaultProvider(
      'atelier-version',
      () => require('@bgotink/atelier/package.json').version,
    );
    /* eslint-enable @typescript-eslint/no-var-requires */

    return this.withOptionValues(
      {
        options: definedOptions,
        allowExtraOptions,
        description,

        pathSuffix: [this.collection],
        values: this.args,
      },
      options =>
        this.runSchematic({
          schematic,
          options: {
            ...this.createPathPartialOptions(definedOptions),
            ...options,
          },
        }),
    );
  }
}
