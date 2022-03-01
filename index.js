const path = require("path");
var fs = require('fs');


const args = getArgs();

const lastRunResult = fetchLastRunResult(args.lastRunResultFile);
//console.log('lastRunResult', lastRunResult);

copyDiffFiles(lastRunResult, function (runResult, newFiles, copiedSize) {
    console.log('new files count', newFiles.length);
    console.log('new files size', copiedSize);
    //console.log('runResult', runResult);

    if (true === args.backupLastRunFile && fs.existsSync(args.lastRunResultFile)) {
        fs.copyFileSync(args.lastRunResultFile, `./lastRun.${getDateString(new Date(fs.statSync(args.lastRunResultFile).mtimeMs))}.json`)
    }
    if (args.backupsToKeep > 0) {
        removeOldBackups(path.dirname(args.lastRunResultFile), args.backupsToKeep)
    }
    saveLastRunResult(args.lastRunResultFile, runResult);
});


//------------------------------------------functii--------------------------------------

function removeOldBackups(dir, backupsToKeep) {
    fs.readdirSync(dir, {}).filter(f => /lastRun\.([a-z0-9_\-])+\.json/.test(f)).sort().reverse().slice(backupsToKeep).forEach(f => {
        fs.unlinkSync(path.join(dir, f));
    });
}

function getDateString(d) {
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2) + "_" +
        ("0" + d.getHours()).slice(-2) + "-" + ("0" + d.getMinutes()).slice(-2) + "-" + ("0" + d.getSeconds()).slice(-2);

}

function makeDiffFilePath(file) {
    return args.diffDir + file.slice(args.sourceDir.length);
}

function saveLastRunResult(path, runResult) {
    fs.writeFileSync(path, JSON.stringify(runResult, null, 2));
}

function ensureDirForFile(newFile) {
    const dir = path.dirname(newFile);
    if (!fs.existsSync(dir)) {
        if (!fs.mkdirSync(dir, {recursive: true})) {
            throw `mkdir failed: ${dir}`;
        }
    }
}

function copyDiffFiles(lastRunResult, done) {

    walk(args.sourceDir, function (err, results) {
        if (err) throw err;
        const newFiles = [];
        let copiedSize = 0;
        results.forEach(file => {
            if (lastRunResult[file] && !isFileNew(file, lastRunResult[file])) {

            } else {
                newFiles.push(file);
                let newFile = makeDiffFilePath(file);
                ensureDirForFile(newFile)
                fs.copyFileSync(file, newFile)
                let stat = fs.statSync(file);
                lastRunResult[file] = {
                    stat: {
                        size: stat.size,
                        mtimeMs: stat.mtimeMs,
                    }
                };
                copiedSize += stat.size;
            }
        });

        done(lastRunResult, newFiles, copiedSize)
    });
}

function isFileNew(file, last) {
    const stat = fs.statSync(file);
    if (stat.size !== last.stat.size || stat.mtimeMs !== last.stat.mtimeMs) {
        return true;
    }
    return false;
}

function fetchLastRunResult(lastRunResultFile) {
    if (!fs.existsSync(lastRunResultFile)) {
        return {};
    }
    let rawdata = fs.readFileSync(lastRunResultFile);
    return JSON.parse(rawdata);
}

function walk(dir, done) {
    var results = [];
    fs.readdir(dir, function (err, list) {
        if (err) return done(err);
        var i = 0;
        (function next() {
            var file = list[i++];
            if (!file) return done(null, results);
            file = path.resolve(dir, file);
            fs.stat(file, function (err, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function (err, res) {
                        results = results.concat(res);
                        next();
                    });
                } else {
                    results.push(file);
                    next();
                }
            });
        })();
    });
};

function usage() {
    let argsDesc = getArgsDesc();
    const str = Object.getOwnPropertyNames(argsDesc).map(name => {
        const desc = argsDesc[name];
        let str = `${desc.alias}: `;
        if (desc.description) {
            str += `${desc.description}`;
        }
        if (desc.required) {
            str += `, obligatoriu`;
        }
        if (desc.defaultValue) {
            str += `, valoare implicita ${desc.defaultValue}`;
        }
        return str;
    }).join('\n    ');

    const exemplu = Object.getOwnPropertyNames(argsDesc).map(name => {
        const desc = argsDesc[name];
        let str = `${desc.alias}=${desc.example}`;
        // if(!desc.required){
        //     str = `[${str}]`;
        // }
        return str;
    }).join(' ');

    console.log(`usage: node ${path.basename(__filename)} <parametri>`);
    console.log(`descriere parametri:\n    ${str}`);
    console.log(`exemplu: node ${path.basename(__filename)} ${exemplu}`);
}

function getArgs() {

    var args;
    try {
        args = parseArgs();
        console.log(args);
        return args;
    } catch (e) {
        console.error("EROARE:", e)
        usage();
        process.exit(1);
    }

}

function getArgsDesc() {
    return {
        sourceDir: {
            alias: '--source-dir',
            required: true,
            validate: isString,
            example: 'c:\\some\\dir',
            description: 'directorul de unde se copiaza fisierele',
        },
        diffDir: {
            alias: '--diff-dir',
            required: true,
            validate: isString,
            example: 'c:\\some\\dir',
            description: 'directorul  unde se copiaza fisierele noi',
        },
        lastRunResultFile: {
            alias: '--last-run-file',
            required: false,
            defaultValue: './lastRun.json',
            validate: isString,
            example: 'c:\\some\\lastRun.json',
            description: 'fisierul care stocheaza rezultatul ultimei rulari; daca nu exista atunci se creeaza',
        },
        backupsToKeep: {
            alias: '--backups-to-keep',
            required: false,
            defaultValue: '5',
            validate: isNumeric,
            sanitization: parseInt,
            example: '10',
            description: 'cate backup-uri sa tinem; se sterg celelalte backup-uri in mod automat',
        },
        backupLastRunFile: {
            alias: '--backup-last-run-file',
            required: false,
            defaultValue: '',
            validate: isBoolean,
            example: 'true',
            sanitization: s => s === 'true',
            description: 'daca este true, fisierul care stocheaza rezultatul rulari anterioare va fi salvat intr-un fisier aditional, de forma lastRun.YYY-mm-DD_HH-MM-SS.json',
        },
        help: {
            alias: '--help',
            required: false,
            description: 'afiseaza HELP',
        },
    };
}

function parseArgs() {
    const argsRaw = process.argv.slice(2);

    const args = {
        sourceDir: undefined,
        diffDir: undefined,
        backupLastRunFile: false,
    }

    const argsDesc = getArgsDesc();

    function findArgDescByAlias(alias) {
        let ownPropertyNames = Object.getOwnPropertyNames(argsDesc);
        for (var i = 0; i < ownPropertyNames.length; i++) {
            var argName = ownPropertyNames[i];
            if (argsDesc[argName].alias === alias) {
                return [argName, argsDesc[argName]];
            }
        }
        throw  `parametru invalid ${alias}`
    }

    argsRaw.forEach(arg => {
        let [name, value] = arg.split('=', 2);
        if (name === '--help') {
            usage();
            process.exit(0);
        }
        const [argName, argDesc] = findArgDescByAlias(name);
        if (!argDesc.validate(value)) {
            throw  `parametrul ${name} nu are valoare valida: ${value}`
        }
        if ('sanitization' in argDesc) {
            value = argDesc.sanitization(value)
        }
        args[argName] = value;
    });

    for (var argName in argsDesc) {
        let argValue = args[argName];
        if (argValue === undefined) {
            let argDesc = argsDesc[argName];
            if (argDesc.required) {
                throw  `parametrul ${argDesc.alias} este obligatoriu`
            }
            if (argDesc.defaultValue) {
                args[argName] = argDesc.defaultValue;
            }
        }
    }
    return args;
}

function isString(v) {
    return v !== undefined && typeof v === 'string'
}

function isNumeric(v) {
    return isString(v) && /^\d+$/.test(v);
}

function isBoolean(v) {
    return isString(v) && (v === 'true' || v === 'false');
}
