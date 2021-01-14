import {Option} from 'clipanion';
import {join} from 'path';

import {AbstractCommand} from '../command/abstract-command';

export class ProjectCommand extends AbstractCommand {
  static paths = [['project']];

  static usage = AbstractCommand.Usage({
    category: 'Utility commands',
    description: 'Run a command within a project',
    details: `
    This command runs another command as if atelier was executed from within that project.
    
    For architects this behaves as if a project is passed in the command. In other words, \`ai build app\` is the same as \`ai project app build\`. For schematics, this is the only way to run from another project.

    Note: This command doesn't change the working directory of the process.
    `,
    examples: [
      ['Run the `build` target in project `app`', '$0 project app build'],
      [
        'Run the `@schematics/angularcomponent` schematic in project `app`',
        '$0 project app generate @schematics/angular:component',
      ],
    ],
  });

  projectName = Option.String();

  command = Option.String();

  args = Option.Proxy();

  execute(): Promise<number> {
    const project = this.workspace.getProjectByName(this.projectName);
    const cwd = join(this.workspace.basePath, project.root);

    return this.cli.run([this.command, ...this.args], {startCwd: cwd});
  }
}
