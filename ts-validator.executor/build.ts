import { readdir, readFile, writeFile } from 'fs';
import { parse as parsePath, sep, join as joinPath } from 'path';
import { execute } from "ts-validator.code-gen"
import { promisify2_1, promisify3_1 } from "./src/utils/promisify"
import { convertToRelativePath, convertRelativePathToUnix } from './src/utils/pathUtils';

const readdirAsync = promisify2_1(readdir);
const readFileAsync = promisify2_1(readFile);
const writeFileAsync = promisify3_1(writeFile);

function findParentDir(directoryName: string): string | null {
    const dirs = directoryName.split(sep);

    if (dirs.length < 2) {
        return null;
    }

    if (!dirs[dirs.length - 1]) {
        return null;
    }

    dirs.splice(dirs.length - 1, 1);
    return dirs.join(sep);    
}

async function findClosestProjectDir(directoryName: string): Promise<string | null> {
    const contents = await readdirAsync(directoryName, null as any);
    for (var i = 0; i < contents.length; i++) {
        if (/^package\.json$/i.test(contents[i].toString())) {
            return directoryName;
        }
    }

    const parent = findParentDir(directoryName);
    if (!parent) {
        return null;
    }

    return await findClosestProjectDir(parent);
}

async function findClosestProjectDirectory(fileName: string) {
    const path = parsePath(fileName);
    if (!path) {
        throw new Error(`Cannot parse file path ${fileName}.`);
    }

    if (path.name === "package" && path.ext === "json") {
        return Promise.resolve(path.dir);
    }

    const parent = findParentDir(path.dir);
    if (!parent) {
        throw new Error(`Cannot find project.json for file ${fileName}.`);
    }

    const tryAgain = await findClosestProjectDir(parent);
    if (!tryAgain) {
        throw new Error(`Cannot find project.json for file ${fileName}.`);
    }

    return tryAgain;
}

function ensureCorrectSeparators(uri: string) {
    return uri.replace(/[\\\/]/g, sep);
}

const dependencies = {
    readFile: async (fileName: string) => (await readFileAsync(ensureCorrectSeparators(fileName), null as any)).toString(),
    writeFile: (fileName: string, fileContent: string) => writeFileAsync(ensureCorrectSeparators(fileName), fileContent, null as any),
    joinPath: (...parts: string[]) => joinPath.apply(null, parts) as string,
    findClosestProjectDirectory,
    convertToRelativePath,
    convertRelativePathToUnix
};

const fileName = process.argv[2];
if (!fileName) {
    throw new Error("You must specify a file name");
}

const result = execute(fileName)(dependencies);
result.catch(x => {
    console.error(x);
    process.exit(1);
});