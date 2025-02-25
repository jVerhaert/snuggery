import {Document, Node} from '@bgotink/kdl';

import type {SnuggeryWorkspaceFileHandle} from './v0';

export const arrayItemKey = '-';

export const implicitPropertyKey = '$implicit';

export const tagOverwrite = 'overwrite';

export function isChildOf(parent: Node | Document, child: Node) {
	return (
		(parent instanceof Document ? parent : parent.children)?.nodes.includes(
			child,
		) || false
	);
}

export function setTag(tag: string | null, node: Node) {
	node.setTag(tag);
	return node;
}

export async function expandDocument(
	document: Document,
	handle: SnuggeryWorkspaceFileHandle,
	allDocuments?: Document[],
): Promise<Document> {
	allDocuments?.push(document);

	const imports = document.nodes.filter(node => node.getTag() === 'import');
	if (imports.length === 0) {
		return document;
	}

	const replacements = new Map(
		await Promise.all(
			imports.map(async importNode => {
				const path = importNode.getName();
				// Node package names can't start with . and relative paths have to start
				// with . (./, ../, .\ and ..\)
				const importedHandle = path.startsWith('.')
					? await handle.openRelative(path)
					: await handle.openDependency(path);

				const importedDocument = await importedHandle.readDocument();

				return [
					importNode,
					await expandDocument(importedDocument, importedHandle, allDocuments),
				] as const;
			}),
		),
	);

	return new Document(
		document.nodes.flatMap(node => replacements.get(node)?.nodes ?? node),
	);
}
