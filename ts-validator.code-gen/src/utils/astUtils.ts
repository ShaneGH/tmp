import * as ts from "typescript";

function _isAncestor(child: ts.Node | undefined, parent: ts.Node): boolean {
    if (!child) return false;

    return child === parent || _isAncestor(child.parent, parent);
}

export function isAncestor(child: ts.Node, parent: ts.Node) {
    return child !== parent && _isAncestor(child, parent);
}

type VisitResult<TResult> = TResult | null | undefined;
function _visitNodesInScope<TResult>(current: ts.Node, visitor: (x: ts.Node) => VisitResult<TResult>, recurseUp = true): VisitResult<TResult> {

    const childNodes = current.getChildren();
    for (let i = 0; i < childNodes.length; i++) {
        const child = childNodes[i];
        if (child.kind === ts.SyntaxKind.SyntaxList) {
            const r = _visitNodesInScope(child, visitor, false);
            if (r !== null && r !== undefined) {
                return r;
            }
        }

        const r = visitor(child);
        if (r !== null && r !== undefined) {
            return r;
        }
    }

    return recurseUp && current.parent
        ? _visitNodesInScope(current.parent, visitor)
        : null;
}

export function visitNodesInScope<TResult>(node: ts.Node, visitor: (x: ts.Node) => VisitResult<TResult>) {
    if (!node.parent) return null;
    return _visitNodesInScope(node.parent, visitor);
}