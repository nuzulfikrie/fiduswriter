const path = require('path');
const fs = require('fs');
function isFile(file) {
    let stat
    try {
        stat = fs.statSync(file);
    } catch (e) {
        if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return false;
        throw e;
    }
    return stat.isFile() || stat.isFIFO();
}

exports.interfaceVersion = 2;

function resolveFilelocation(source, file, config, modifiedPath = false) {
    const returnValue = {found: false}
    const fullPath = path.resolve(path.dirname(file), source)

    if (fullPath.includes('/plugins/')) {
        returnValue.found = true
        returnValue.path = null
        return returnValue
    }

    const djangoApps = [
        'base',
        'bibliography',
        'browser_check',
        'document',
        'feedback',
        'menu',
        'style',
        'user',
        'usermedia'
    ]


    const triedPaths = []
    djangoApps.find(appName => {
        const resolvedPath = fullPath.replace(/\/\w*\/static\/js\//g, `/${appName}/static/js/`)
        if (isFile(`${resolvedPath}.js`)) {
            returnValue.path = `${resolvedPath}.js`
            returnValue.found = true
            return true
        }
        triedPaths.push(`${resolvedPath}.js`)
        if (isFile(`${resolvedPath}/index.js`)) {
            returnValue.path = `${resolvedPath}/index.js`
            returnValue.found = true
            return true
        }
        triedPaths.push(`${resolvedPath}/index.js`)
        return false
    })

    if (!returnValue.found) {
        const resolvedPath = fullPath.replace(/\/\w*\/static\/js\//g, `/static-libs/js/`)
        if (isFile(`${resolvedPath}.js`)) {
            returnValue.path = `${resolvedPath}.js`
            returnValue.found = true
        }
    }

    if (!returnValue.found && !modifiedPath && process.env.PROJECT_PATH !== process.env.SRC_PATH && file.includes(process.env.PROJECT_PATH)) {
        modifiedFile = file.replace(process.env.PROJECT_PATH, process.env.SRC_PATH)
        return resolveFilelocation(source, modifiedFile, config, true)
    }

    return returnValue
}

exports.resolve = resolveFilelocation
