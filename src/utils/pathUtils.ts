import * as path from "path"

function buildDots(length: number) {
    const result: string[] = [];
    for (let i = 0; i < length; i++) {
        result.push("..");
    }

    return result;
}

function convertToRelativePath (pathFrom: string, pathTo: string) {
    let pf1 = path.parse(pathFrom);
    if (!pf1.ext) pf1 = path.parse(path.join(pathFrom, "x.y"));
    const pf2 = pf1.dir.split(path.sep);

    let fakeFileName = false;
    let pt1 = path.parse(pathTo);
    if (!pt1.ext) {
        fakeFileName = true;
        pt1 = path.parse(path.join(pathTo, "x.y"));
    }
    
    const pt2 = pt1.dir.split(path.sep);

    // if there is no relative path, return absolute path
    if (pf1.root !== pt1.root) {
        return pathTo;
    }
    
    let i = 0;
    for (; i < Math.min(pf2.length , pt2.length); i++) {
        if (pf2[i] !== pt2[i]) break;
    }

    const result = [
        ...buildDots(pf2.length - i),
        ...pt2.slice(i)
    ];

    if (!fakeFileName) {
        result.push(pt1.name + pt1.ext);
    }

    return result.join(path.sep);
}

function convertRelativePathToUnix(relativePath: string) {
    const split = relativePath.split(path.sep);
    if (!split.length) {
        split.splice(0, 0, ".");
    } else if (split[0][0] !== ".") {
        split.splice(0, 0, ".");
    }

    return split.join("/");
}

export {
    convertRelativePathToUnix,
    convertToRelativePath
}