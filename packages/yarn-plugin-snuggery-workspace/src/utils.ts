import {Manifest, tgzUtils, Workspace} from '@yarnpkg/core';
import {CwdFS, xfs} from '@yarnpkg/fslib';

export function createPublishWorkspace(
  workspace: Workspace,
  cwd: Workspace['cwd'],
  rawManifest: Manifest['raw'],
): Workspace {
  return Object.create(workspace, {
    cwd: {
      value: cwd,
      writable: false,
      configurable: true,
    },

    manifest: {
      value: Object.create(workspace.manifest, {
        raw: {
          value: JSON.parse(JSON.stringify(rawManifest)),
          writable: false,
          configurable: true,
        },
      }),
      writable: false,
      configurable: true,
    },
  });
}

export function getManifestFromTarball(buffer: Buffer): Promise<Manifest> {
  return xfs.mktempPromise(async folder => {
    const fs = new CwdFS(folder);
    await tgzUtils.extractArchiveTo(buffer, fs, {stripComponents: 1});

    return Manifest.fromText(
      await fs.readFilePromise(Manifest.fileName, 'utf8'),
    );
  });
}
