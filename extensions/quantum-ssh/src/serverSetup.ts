/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IServerConfig, ServerValidation, ServerVersion } from './server-config/types';

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ILogger } from './common/logger';
import type { SSHClient } from './ssh/sshClient';
import { getServerConfig } from './server-config/get-server-config';
import { fetchRelease } from './fetchRelease';
import { sanitizeExtensionIds } from './utils/sanitize-extension-ids';
import { RemotePlatform } from './common/platform';
import { quotePowerShell, quotePosixShell } from './common/shellQuote';

/**
 * Reads a script template from <extensionPath>/out/scripts/<templateName> and
 * replaces every %%KEY%% occurrence with the matching value from `variables`.
 */
function compileTemplate(templateName: string, variables: Record<string, string>, extensionPath: string): string {
    const templatePath = path.join(extensionPath, 'out', 'scripts', templateName);
    const content = fs.readFileSync(templatePath, 'utf8');
    return content.replace(/%%([A-Z_]+)%%/g, (placeholder, key: string) => variables[key] ?? placeholder);
}

/**
 * Matches a hostname against a pattern that may contain wildcards.
 * Returns a specificity score: higher scores indicate more specific matches.
 * Returns -1 if no match.
 */
function matchHostnamePattern(hostname: string, pattern: string): number {
    // Exact match has highest priority
    if (hostname === pattern) {
        return 1000;
    }

    // Catch-all wildcard has lowest priority
    if (pattern === '*') {
        return 1;
    }

    // Convert wildcard pattern to regex
    // Escape special regex characters except *
    const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);

    if (regex.test(hostname)) {
        // Calculate specificity based on the number of non-wildcard characters
        // More specific patterns (more characters) get higher scores
        const nonWildcardChars = pattern.replace(/\*/g, '').length;
        return 10 + nonWildcardChars;
    }

    return -1;
}

/**
 * Finds the best matching path for a hostname from a map of patterns to paths.
 * Supports wildcards with priority: exact match > specific wildcard > general wildcard.
 */
export function findServerInstallPath(hostname: string, pathMap: Record<string, string>): string | undefined {
    let bestMatch: { pattern: string; path: string; score: number } | undefined;

    for (const [pattern, path] of Object.entries(pathMap)) {
        const score = matchHostnamePattern(hostname, pattern);

        if (score > 0) {
            if (!bestMatch || score > bestMatch.score) {
                bestMatch = { pattern, path, score };
            }
        }
    }

    return bestMatch?.path;
}

export type ServerInstallOptions = {
    id: string;
    quality: string;
    commit: string;
    version: string;
    release?: string;
    extensionIds: string[];
    envVariables: string[];
    sendEnvVars: Record<string, string>;
    useSocketPath: boolean;
    serverApplicationName: string;
    serverDataFolderName: string;
    serverDownloadUrlTemplate: string;
    customInstallPath?: string;
    serverValidation: ServerValidation;
    serverPlatform: Platform;
    serverArch: Architecture;
    scriptPreventExit: boolean;
    localServerDownload: 'auto' | 'always' | 'off';
};

export type ServerInstallResult = {
    exitCode: number;
    listeningOn: number | string;
    connectionToken: string;
    logFile: string;
    osReleaseId: string;
    arch: string;
    platform: string;
    tmpDir: string;
    [key: string]: unknown;
};

export class ServerInstallError extends Error {
    constructor(message: string) {
        super(message);
    }
}

const DEFAULT_DOWNLOAD_URL_TEMPLATE = 'https://github.com/Suryanshu-Nabheet/quantum/releases/download/${version}/quantum-reh-${os}-${arch}-${version}.tar.gz';

export type Platform = 'alpine' | 'darwin' | 'dragonfly' | 'freebsd' | 'linux' | 'windows';
export type Architecture = 'arm64' | 'armhf' | 'loong64' | 'ppc64le' | 'riscv64' | 's390x' | 'x64';
export type Shell = 'cmd' | 'powershell' | 'bash';

export type DetectedPlatform = {
    detectedPlatform: Platform;
    detectedArch: Architecture;
    detectedShell: Shell;
};

export function parseKernelName(stdout: string): Platform {
    if(/MINGW|MSYS|CYGWIN/i.test(stdout)) {
        return 'windows';
    }

    switch (stdout) {
        case 'Darwin':
            return 'darwin';
        case 'Linux':
            return 'linux';
        case 'FreeBSD':
            return 'freebsd';
        case 'DragonFly':
            return 'dragonfly';
        default:
            throw new ServerInstallError(`Platform not supported: ${stdout}`);
    }
}

export function parseMachineArch(stdout: string): Architecture {
    switch (stdout) {
        case 'x86_64':
        case 'amd64':
            return 'x64';
        case 'armv7l':
        case 'armv8l':
            return 'armhf';
        case 'arm64':
        case 'aarch64':
            return 'arm64';
        case 'ppc64le':
            return 'ppc64le';
        case 'riscv64':
            return 'riscv64';
        case 'loongarch64':
            return 'loong64';
        case 's390x':
            return 's390x';
        default:
            throw new ServerInstallError(`Architecture not supported: ${stdout}`);
    }
}

export async function detectPlatform(conn: Pick<SSHClient, 'exec'>, platform: RemotePlatform | undefined, logger: ILogger): Promise<DetectedPlatform> {
    let detectedPlatform: Platform;
    let detectedShell: Shell = 'bash';

    // detect platform and shell for windows
    if (!platform || platform === 'windows') {
        const { stdout } = await conn.exec('echo %COMSPEC%~$PSHOME');
        const [comspec, pshome = ''] = stdout.replace(/\r?\n/g, ' ').trim().split('~');

        if (comspec && comspec !== '%COMSPEC%') {
            detectedPlatform = 'windows';
            detectedShell = 'cmd';
        } else if (pshome) {
            detectedShell = 'powershell';
            detectedPlatform ||= /^[A-Za-z]:\\/.test(pshome) ? 'windows' : 'linux';
        } else if (!platform) {
            const result = await conn.exec('echo "==$(uname -s)=="');
            const uname = /==\s*(.+?)\s*==/.exec(result.stdout);

            if (uname) {
                detectedPlatform = parseKernelName(uname[1].trim());
            } else if (result.stderr) {
                throw new ServerInstallError(`Cannot execute "uname -s", yields: ${result.stderr}`);
            } else {
                throw new ServerInstallError(`Platform not found: ${result.stdout}`);
            }
        } else {
            detectedPlatform = 'windows';
        }
    } else if (platform === 'macos') {
        detectedPlatform = 'darwin';
    } else {
        detectedPlatform = 'linux';
    }

    logger.trace(`Detected platform: ${detectedPlatform}, ${detectedShell}`);

    let detectedArch: Architecture;

    if (detectedPlatform === 'windows') {
        detectedArch = 'x64';
    } else {
        const result = await conn.exec('echo "==$(uname -m)=="');
        const uname = /==\s*(.+?)\s*==/.exec(result.stdout);

        if (uname) {
            detectedArch = parseMachineArch(uname[1].trim());
        } else if (result.stderr) {
            throw new ServerInstallError(`Cannot execute "uname -m", yields: ${result.stderr}`);
        } else {
            throw new ServerInstallError(`Architecture not found: ${result.stdout}`);
        }
    }

    logger.trace(`Detected architecture: ${detectedArch}`);

    return { detectedPlatform, detectedArch, detectedShell };
}

export async function installQuantumServer(
    conn: SSHClient,
    serverDownloadUrlTemplate: string | undefined,
    serverVersion: ServerVersion,
    extensionIds: string[],
    envVariables: string[],
    sendEnvVars: Record<string, string>,
    platform: RemotePlatform | undefined,
    useSocketPath: boolean,
    customInstallPath: string | undefined,
    logger: ILogger,
    extensionPath: string
): Promise<ServerInstallResult> {
    const { detectedPlatform, detectedArch, detectedShell: shell } = await detectPlatform(conn, platform, logger);

    const scriptId = crypto.randomBytes(12).toString('hex');
    const { options: installOptions, quantumServerConfig } =
        await buildServerInstallOptions(
            scriptId,
            serverDownloadUrlTemplate,
            serverVersion,
            extensionIds,
            envVariables,
            sendEnvVars,
            useSocketPath,
            customInstallPath,
            detectedPlatform,
            detectedArch,
            false,
            'off',
            logger,
        );

    const commandOutput = await runInstallScript(
        conn, detectedPlatform, shell, installOptions, quantumServerConfig,
        installOptions.id, logger, extensionPath,
    );

    return parseInstallOutput(
        commandOutput, installOptions, installOptions.id, envVariables, logger,
    );
}

async function runInstallScript(
    conn: SSHClient,
    platform: string | undefined,
    shell: string,
    installOptions: ServerInstallOptions,
    quantumServerConfig: { serverDataFolderName: string; commit: string },
    scriptId: string,
    logger: ILogger,
    extensionPath: string
): Promise<{ stdout: string; stderr: string }> {
    if (platform === 'windows') {
        const installServerScript = generatePowerShellInstallScript(installOptions, extensionPath);

        logger.trace('Server install command:', installServerScript);

        const installDir = `$HOME\\${quantumServerConfig.serverDataFolderName}\\install`;
        const installScript = `${installDir}\\${quantumServerConfig.commit}.ps1`;
        const endRegex = new RegExp(`${scriptId}: end`);

        // investigate if it's possible to use `-EncodedCommand` flag
        // https://devblogs.microsoft.com/powershell/invoking-powershell-with-complex-expressions-using-scriptblocks/
        // eslint-disable-next-line no-useless-assignment
        let command = '';

        if (shell === 'powershell') {
            command = `md -Force ${installDir}; echo @'\n${installServerScript}\n'@ | Set-Content ${installScript}; powershell -ExecutionPolicy ByPass -File "${installScript}"`;
        } else if (shell === 'bash') {
            command = `mkdir -p ${installDir.replace(/\\/g, '/')} && echo '\n${installServerScript.replace(/'/g, '\'"\'"\'')}\n' > ${installScript.replace(/\\/g, '/')} && powershell -ExecutionPolicy ByPass -File "${installScript}"`;
        } else if (shell === 'cmd') {
            const script = installServerScript.trim()
                // escape double quotes (from powershell/cmd)
                .replace(/"/g, '"""')
                // escape single quotes (from cmd)
                .replace(/'/g, `''`)
                // escape redirect (from cmd)
                .replace(/>/g, `^>`)
                // escape new lines (from powershell/cmd)
                .replace(/\n/g, '\'`n\'');

            command = `powershell "md -Force ${installDir}" && powershell "echo '${script}'" > ${installScript.replace('$HOME', '%USERPROFILE%')} && powershell -ExecutionPolicy ByPass -File "${installScript.replace('$HOME', '%USERPROFILE%')}"`;

            logger.trace('Command length (8191 max):', command.length);

            if (command.length > 8191) {
                throw new ServerInstallError(`Command line too long`);
            }
        } else {
            throw new ServerInstallError(`Not supported shell: ${shell}`);
        }

        return await conn.execPartial(command, (stdout: string) => endRegex.test(stdout));
    } else {
        const installServerScript = generateBashInstallScript(installOptions, extensionPath);

        logger.trace('Server install command:', installServerScript);
        // Use base64 encoding to avoid shell quoting issues across different login shells (bash, csh, tcsh, fish).
        // csh cannot handle multi-line strings inside single quotes with -c, so piping via base64 is the most portable approach.
        const base64Script = Buffer.from(installServerScript).toString('base64');
        return await conn.exec(`echo ${base64Script} | base64 -d | bash -l`);
    }
}

function parseInstallOutput(
    commandOutput: { stdout: string; stderr: string },
    installOptions: ServerInstallOptions,
    scriptId: string,
    envVariables: string[],
    logger: ILogger
): ServerInstallResult {
    if (commandOutput.stderr) {
        logger.trace('Server install command stderr:', commandOutput.stderr);
    }
    logger.trace('Server install command stdout:', commandOutput.stdout);

    const resultMap = parseServerInstallOutput(commandOutput.stdout, scriptId);
    if (!resultMap) {
        throw new ServerInstallError(`Failed parsing install script output`);
    }

    const exitCode = parseInt(resultMap.exitCode, 10);
    if (exitCode !== 0) {
        throw new ServerInstallError(`Couldn't install the Quantum server on the remote host, install script returned non-zero exit status`);
    }

    const listeningOn = resultMap.listeningOn.match(/^\d+$/)
        ? parseInt(resultMap.listeningOn, 10)
        : resultMap.listeningOn;

    const { serverArch } = installOptions;
    const remoteEnvVars = Object.fromEntries(Object.entries(resultMap).filter(([key,]) => envVariables.includes(key)));

    return {
        exitCode,
        listeningOn,
        connectionToken: resultMap.connectionToken,
        logFile: resultMap.logFile,
        osReleaseId: resultMap.osReleaseId,
        arch: resultMap.arch || serverArch,
        platform: resultMap.platform,
        tmpDir: resultMap.tmpDir,
        ...remoteEnvVars
    };
}

export function parseServerInstallOutput(str: string, scriptId: string): { [k: string]: string } | undefined {
    const startResultStr = `${scriptId}: start`;
    const endResultStr = `${scriptId}: end`;

    const startResultIdx = str.indexOf(startResultStr);
    if (startResultIdx < 0) {
        return undefined;
    }

    const endResultIdx = str.indexOf(endResultStr, startResultIdx + startResultStr.length);
    if (endResultIdx < 0) {
        return undefined;
    }

    const installResult = str.substring(startResultIdx + startResultStr.length, endResultIdx);

    const resultMap: { [k: string]: string } = {};
    const resultArr = installResult.split(/\r?\n/);
    for (const line of resultArr) {
        const [key, value] = line.split('==');
        resultMap[key] = value;
    }

    return resultMap;
}

export function generateBashInstallScript({ id, quality, version, commit, release, extensionIds, envVariables, sendEnvVars, useSocketPath, serverApplicationName, serverDataFolderName, serverDownloadUrlTemplate, customInstallPath, serverValidation, serverPlatform, serverArch, scriptPreventExit, localServerDownload }: ServerInstallOptions, extensionPath: string): string {
    const extensions = extensionIds.flatMap(extId => ['--install-extension', quotePosixShell(extId)]).map(quotePosixShell).join(' ');
    const serverDataDir = customInstallPath
        ? (customInstallPath === '~' ? '"$HOME"' : customInstallPath.startsWith('~/') ? `"$HOME"/${quotePosixShell(customInstallPath.slice(2))}` : quotePosixShell(customInstallPath))
        : `"$HOME"/${quotePosixShell(serverDataFolderName)}`;
    const listenFlag = useSocketPath
        ? `--socket-path "$TMP_DIR/quantum-server-sock-${crypto.randomUUID()}"`
        // This is a literal argv value in the generated shell script.
        // eslint-disable-next-line local/code-no-unexternalized-strings
        : "'--port=0'";
    const envVarLines = envVariables.map(envVar => `  echo "${envVar}==$${envVar}=="`).join('\n');
    const sendEnvVarLines = Object.entries(sendEnvVars)
        .filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
        .map(([key, value]) => `export ${key}=${quotePosixShell(value)}`)
        .join('\n');

    return compileTemplate('server-setup.sh', {
        DISTRO_VERSION: quotePosixShell(version),
        DISTRO_COMMIT: quotePosixShell(commit),
        DISTRO_QUALITY: quotePosixShell(quality),
        DISTRO_QUANTUM_RELEASE: quotePosixShell(release ?? ''),
        SERVER_APP_NAME: quotePosixShell(serverApplicationName),
        SERVER_INITIAL_EXTENSIONS: extensions,
        SERVER_LISTEN_FLAG: listenFlag,
        SERVER_DATA_DIR: serverDataDir,
        SERVER_DATA_DIR_FLAG: customInstallPath ? 'true' : 'false',
        SERVER_VALIDATION_FLAG: serverValidation === 'skip' ? '--disable-client-validation' : '',
        SERVER_DOWNLOAD_URL_TEMPLATE: quotePosixShell(serverDownloadUrlTemplate),
        SCRIPT_ID: id,
        ENV_VAR_LINES: envVarLines,
        SEND_ENV_VAR_LINES: sendEnvVarLines,
        MODIFY_PRODUCT_JSON: serverValidation === 'force' ? 'true' : 'false',
        SERVER_CONNECTION_TOKEN: crypto.randomUUID(),
        SERVER_PLATFORM: serverPlatform,
        SERVER_ARCH: serverArch,
        SCRIPT_PREVENT_EXIT: String(scriptPreventExit),
        LOCAL_SERVER_DOWNLOAD: localServerDownload
    }, extensionPath);
}

export function generatePowerShellInstallScript({ id, quality, version, commit, release, extensionIds, envVariables, sendEnvVars, useSocketPath, serverApplicationName, serverDataFolderName, serverDownloadUrlTemplate, customInstallPath, serverValidation, localServerDownload }: ServerInstallOptions, extensionPath: string): string {
    const extensions = extensionIds.map(extId => '--install-extension ' + extId).join(' ');
    const downloadUrl = quotePowerShell(serverDownloadUrlTemplate
        .replace(/\$\{quality\}/g, quality)
        .replace(/\$\{version\}/g, version)
        .replace(/\$\{commit\}/g, commit)
        .replace(/\$\{os\}/g, 'win32')
        .replace(/\$\{arch\}/g, 'x64')
        .replace(/\$\{release\}/g, release ?? ''));
    const serverDataDir = customInstallPath
        ? (customInstallPath === '~' ? '(Resolve-Path ~)' : customInstallPath.startsWith('~/') || customInstallPath.startsWith('~\\')
            ? `(Join-Path (Resolve-Path ~) ${quotePowerShell(customInstallPath.slice(2).replace(/[\\/]/g, '\\'))})`
            : quotePowerShell(customInstallPath))
        : `(Join-Path (Resolve-Path ~) ${quotePowerShell(serverDataFolderName)})`;
    const listenFlag = useSocketPath
        ? `--socket-path="$TMP_DIR/quantum-server-sock-${crypto.randomUUID()}"`
        : '--port=0';
    const envVarLines = envVariables.map(envVar => `    "${envVar}==$${envVar}=="`).join('\n');
    const sendEnvVarLines = Object.entries(sendEnvVars)
        .filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
        .map(([key, value]) => `$env:${key}=${quotePowerShell(value)}`)
        .join('\n');

    let compiledScript = compileTemplate('server-setup.ps1', {
        DISTRO_VERSION: quotePowerShell(version),
        DISTRO_COMMIT: quotePowerShell(commit),
        DISTRO_QUALITY: quotePowerShell(quality),
        DISTRO_QUANTUM_RELEASE: quotePowerShell(release ?? ''),
        SERVER_APP_NAME: quotePowerShell(serverApplicationName),
        SERVER_INITIAL_EXTENSIONS: extensions,
        SERVER_LISTEN_FLAG: listenFlag,
        SERVER_DATA_DIR: serverDataDir,
        SERVER_DATA_DIR_FLAG: customInstallPath ? '--server-data-dir=""$SERVER_DATA_DIR""' : '',
        SERVER_VALIDATION_FLAG: serverValidation === 'skip' ? '--disable-client-validation' : '',
        SERVER_DOWNLOAD_URL: downloadUrl,
        SCRIPT_ID: id,
        ENV_VAR_LINES: envVarLines,
        SEND_ENV_VAR_LINES: sendEnvVarLines,
        MODIFY_PRODUCT_JSON: serverValidation === 'force' ? '$true' : '$false',
        SERVER_CONNECTION_TOKEN: crypto.randomUUID(),
        LOCAL_SERVER_DOWNLOAD: localServerDownload
    }, extensionPath);


    const RENAME_MAP: [RegExp, string][] = [
        // --- $SERVER_* (longer first) ---
        [/\$SERVER_DATA_DIR_FLAG(?!\w)/g,       '$df'],
        [/\$SERVER_DATA_DIR(?!\w)/g,            '$d'],
        [/\$SERVER_DOWNLOAD_URL(?!\w)/g,        '$u'],
        [/\$SERVER_VALIDATION_FLAG(?!\w)/g,     '$vf'],
        [/\$SERVER_CONNECTION_TOKEN(?!\w)/g,    '$ct'],
        [/\$SERVER_INITIAL_EXTENSIONS(?!\w)/g,  '$ei'],
        [/\$SERVER_LISTEN_FLAG(?!\w)/g,         '$lf'],
        [/\$SERVER_TOKENFILE(?!\w)/g,           '$tf'],
        [/\$SERVER_LOGFILE(?!\w)/g,             '$l'],
        [/\$SERVER_PIDFILE(?!\w)/g,             '$p'],
        [/\$SERVER_APP_NAME(?!\w)/g,            '$a'],
        [/\$SERVER_SCRIPT(?!\w)/g,              '$sc'],
        [/\$SERVER_ARCH(?!\w)/g,                '$ar'],
        [/\$SERVER_ID(?!\w)/g,                  '$id'],
        [/\$SERVER_DIR(?!\w)/g,                 '$s'],

        // --- function names ---
        [/\bGet-Content\b/gi,                   'gc'],
        [/\bSet-Content\b/gi,                   'sc'],   // Windows PowerShell 5.1 only
        [/\bRemove-Item\b/gi,                   'ri'],
        [/\bStart-Sleep\b/gi,                   'sleep'],
        [/\bSelect-String\b/gi,                 'sls'],
        [/\bGet-Process\b/gi,                   'gps'],
        [/\bInvoke-WebRequest\b/gi,             'iwr'],
        [/\bStart-Process\b/gi,                 'saps'],
        [/\bNew-Item\b/gi,                      'ni'],
        [/\bWrite-Output\b/gi,                  'echo'],

        [/\bPrint-LocalDownloadRequest\b/g,     'pld'],
        [/\bRequest-LocalDownload\b/g,          'rld'],
        [/\bAwait-LocalDownload\b/g,            'ald'],
        [/\bTest-InstalledCommit\b/g,           'tic'],
        [/\bGet-InstalledCommit\b/g,            'gic'],
        [/\bRemove-IfExists\b/g,                'rif'],
        [/\bprintInstallResults\b/g,            'pir'],
        [/\bFailAndExit\b/g,                    'fae'],
    ];

    for (const [re, rep] of RENAME_MAP) {
        compiledScript = compiledScript.replace(re, rep);
    }

    return compiledScript
            // remove comments
            .replace(/^\s*#.*$/gm, '')
            // remove empty lines
            .replace(/(\r?\n\s*){2,}/g, '\n')
            // remove leading spaces
            .replace(/^\s*/gm, '');
}

export async function buildServerInstallOptions(
    scriptId: string,
    serverDownloadUrlTemplate: string | undefined,
    serverVersion: ServerVersion,
    extensionIds: string[],
    envVariables: string[],
    sendEnvVars: Record<string, string>,
    useSocketPath: boolean,
    customInstallPath: string | undefined,
    detectedPlatform: Platform,
    detectedArch: Architecture,
    scriptPreventExit: boolean,
    localServerDownload: 'auto' | 'always' | 'off',
    logger: ILogger,
): Promise<{
    options: ServerInstallOptions;
    quantumServerConfig: IServerConfig;
}> {
    const quantumServerConfig = await getServerConfig();

    const serverDownloadUrlTemplateFinal =
        serverDownloadUrlTemplate
        || quantumServerConfig.serverDownloadUrlTemplate
        || DEFAULT_DOWNLOAD_URL_TEMPLATE;

    const bestRelease = await fetchRelease(
        serverDownloadUrlTemplateFinal,
        quantumServerConfig.version,
        quantumServerConfig.release,
        serverVersion,
        logger,
    );

    return {
        options: {
            id: scriptId,
            version: bestRelease.version,
            commit: quantumServerConfig.commit,
            quality: quantumServerConfig.quality,
            release: bestRelease.build,
            extensionIds: sanitizeExtensionIds(extensionIds),
            envVariables,
            sendEnvVars,
            useSocketPath,
            serverApplicationName: quantumServerConfig.serverApplicationName,
            serverDataFolderName: quantumServerConfig.serverDataFolderName,
            serverDownloadUrlTemplate: serverDownloadUrlTemplateFinal,
            customInstallPath,
            serverValidation: quantumServerConfig.serverValidation,
            serverPlatform: detectedPlatform,
            serverArch: detectedArch,
            scriptPreventExit,
            localServerDownload
        },
        quantumServerConfig,
    };
}

export interface LocalDownloadRequest {
    serverPlatform: string;
    serverArch: string;
    serverDir: string;
}

export function parseLocalDownloadMarker(str: string, scriptId: string): LocalDownloadRequest | undefined {
    const startResultStr = `${scriptId}: local-download-request`;
    const endResultStr = `${scriptId}: local-download-request-end`;

    const startResultIdx = str.indexOf(startResultStr);
    if (startResultIdx < 0) {
        return undefined;
    }

    const endResultIdx = str.indexOf(endResultStr, startResultIdx + startResultStr.length);
    if (endResultIdx < 0) {
        return undefined;
    }

    const installResult = str.substring(startResultIdx + startResultStr.length, endResultIdx);

    const resultMap: { [k: string]: string } = {};
    const resultArr = installResult.split(/\r?\n/);
    for (const line of resultArr) {
        const [key, value] = line.split('==');
        resultMap[key] = value;
    }

    const platform = resultMap['platform'];
    const serverArch = resultMap['serverArch'];
    const serverDir = resultMap['serverDir'];
    if (!platform || !serverArch || !serverDir) {
        return undefined;
    }
    return { serverPlatform: platform, serverArch, serverDir };
}

export async function resolveServerDownloadUrl(options: ServerInstallOptions, request: LocalDownloadRequest): Promise<string> {
    return options.serverDownloadUrlTemplate
        .replace(/\$\{quality\}/g, options.quality)
        .replace(/\$\{version\}/g, options.version)
        .replace(/\$\{commit\}/g, options.commit)
        .replace(/\$\{os\}/g, request.serverPlatform)
        .replace(/\$\{arch\}/g, request.serverArch)
        .replace(/\$\{release\}/g, options.release || '');
}
