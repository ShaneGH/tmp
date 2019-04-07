import { Type } from "../validation-rewriter/types";
import { serialize } from "../validation-rewriter/typeSerializer";
import { EOL } from  'os'
import { CompilerArgs } from "../validator/validate";
import { moduleName } from "../const";

interface ICodeFile {

    toString(): string
    log(): void
}

class CodeWriter implements ICodeFile {
    private _tab = 0;
    private _code: string[] = [];

    tabbed(f: () => void) {
        this._tab++;
        f();
        this._tab--;
    }

    writeLine(value?: string) {
        if (!value) {
            this._code.push("");
            return;
        }

        let tab = "";
        for (var i = 0; i < this._tab; i++) {
            tab += "\t";
        }

        this._code.push(tab + value);
    }

    writeTabbedLine(value?: string) {
        this.tabbed(() => this.writeLine(value));
    }

    toString() {
        return this._code.join(EOL);
    }

    log() {
        this._code.forEach(x => console.log(x));
    }
}

export function generateValidateFile (types: {[key: string]: Type}, compilerArgs: CompilerArgs): ICodeFile {

    const typesList: Type[] = [];
    const keyMap: {[key: string]: string} = {};
    const done: {[key: string]: boolean} = {};

    for(var k in types) {
        keyMap[k] = types[k].id;
        if (done[types[k].id]) continue;
        
         done[types[k].id] = true;
         typesList.push(types[k]);
    }

    const typesS = serialize(typesList);

    const writer = new CodeWriter();

    writer.writeLine(`import { init } from "${moduleName}";`);

    writer.writeLine();
    writer.writeLine('var keyMap = {');
    writer.tabbed(() => {
        Object
            .keys(keyMap)
            .forEach(k => {
                const kSafe = k.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
                const vSafe = keyMap[k].replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
                writer.writeLine(`"${kSafe}": "${vSafe}",`);
            });
    });
    writer.writeLine('};');

    writer.writeLine();
    writer.writeLine('var types = {');
    writer.tabbed(() => {
        Object
            .keys(typesS)
            .forEach(k => {
                const kSafe = k.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
                const vSafe = JSON.stringify(typesS[k]);
                writer.writeLine(`"${kSafe}": ${vSafe},`);
            });
    });
    writer.writeLine(`};`);

    writer.writeLine();
    writer.writeLine(`var compilerArgs = ${JSON.stringify(compilerArgs)};`);

    writer.writeLine();
    writer.writeLine('function initInternal () {');
    writer.writeTabbedLine('init(keyMap, types, compilerArgs);');
    writer.writeLine('}');

    writer.writeLine();
    writer.writeLine('export {');
    writer.writeTabbedLine('initInternal as init');
    writer.writeLine('}');

    return writer;
}