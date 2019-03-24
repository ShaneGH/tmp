import * as ts from "typescript";

function _isAncestor(child: ts.Node | undefined, parent: ts.Node): boolean {
    if (!child) return false;

    return child === parent || _isAncestor(child.parent, parent);
}

function isAncestor(child: ts.Node, parent: ts.Node) {
    return child !== parent && _isAncestor(child, parent);
}

export {
    isAncestor
};