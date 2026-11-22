import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { window, QuickPickItem } from 'vscode';
import { getPath, androidExtraBootArgs, isWSL } from './config';
import { ANDROID } from './constants';

const runEmulator = promisify(execFile);

interface EmulatorQuickPickItem extends QuickPickItem {
	emulator: string;
}

// Get Android devices and pick one
export const androidPick = async (cold: boolean = false) => {
	// Create and show QuickPick with loading state
	const quickPick = window.createQuickPick<EmulatorQuickPickItem>();
	quickPick.placeholder = 'Loading Android emulators...';
	quickPick.busy = true;
	quickPick.show();

	try {
		const emulators = await getAndroidEmulators();

		if (emulators) {
			quickPick.busy = false;
			quickPick.placeholder = 'Select Android emulator';
			quickPick.items = emulators.map((e) => ({
				label: e.replace(/_/g, ' '),
				emulator: e,
			}));

			quickPick.onDidAccept(async () => {
				const selected = quickPick.selectedItems[0];
				if (selected) {
					// Update quickpick to show launching status
					quickPick.items = [
						{
							label: `Starting ${selected.label}...`,
							emulator: selected.emulator,
						} as EmulatorQuickPickItem,
					];
					quickPick.busy = true;

					const response = await runAndroidEmulator(selected.emulator, cold);

					if (!response) {
						quickPick.dispose();
						return;
					}

					// Show success message in quickpick
					quickPick.items = [
						{
							label: `${response}${selected.label}!`,
							emulator: selected.emulator,
						} as EmulatorQuickPickItem,
					];
					quickPick.busy = false;

					// Close quickpick after brief delay
					setTimeout(() => quickPick.dispose(), 2000);
				}
			});

			quickPick.onDidHide(() => quickPick.dispose());
		} else {
			quickPick.dispose();
		}
	} catch (error: any) {
		quickPick.dispose();
		window.showErrorMessage(error.toString());
	}
};

const getAndroidPath = (): string => (getPath() ?? '').trim().replace(/^~(?=[/\\]|$)/, homedir());

const getEmulatorPath = (androidPath: string): string => {
	const executable = isWSL() || process.platform === 'win32' ? `${ANDROID.PATH}.exe` : ANDROID.PATH;
	return path.join(androidPath, executable);
};

function splitBootArgs(input: string): string[] {
	const argumentsList: string[] = [];
	const argument = /(?:[^\s"']+|"[^"]*"|'[^']*')+/y;
	let remaining = input.trim();
	while (remaining) {
		argument.lastIndex = 0;
		const match = argument.exec(remaining);
		if (!match) {
			throw new Error('Android emulator boot arguments have an unclosed quote.');
		}
		argumentsList.push(match[0].replace(/"([^"]*)"|'([^']*)'/g, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted));
		remaining = remaining.slice(match[0].length).trimStart();
	}
	return argumentsList;
}

const getAndroidEmulators = async (): Promise<string[] | false> => {
	const androidPath = getAndroidPath();
	if (!androidPath) {
		return false;
	}

	const executable = getEmulatorPath(androidPath);
	try {
		const { stdout: res } = await runEmulator(executable, ['-list-avds'], { cwd: androidPath });

		if (res) {
			return res.trim().split('\n');
		}
		window.showErrorMessage(
			'No Android emulators found. Please check if you have any emulators installed.',
		);
		return false;
	} catch (e) {
		window.showErrorMessage(
			`Error fetching your Android emulators! Make sure your path is correct. Emulator path: ${executable}`,
		);
		return false;
	}
};

const runAndroidEmulator = async (emulator: string, cold: boolean): Promise<string | false> => {
	const androidPath = getAndroidPath();
	if (!androidPath) {
		return false;
	}

	const executable = getEmulatorPath(androidPath);
	try {
		const bootArgs = splitBootArgs(androidExtraBootArgs() ?? '');
		if (cold) {
			bootArgs.push('-no-snapshot-load');
		}
		bootArgs.push('-avd', emulator);
		await runEmulator(executable, bootArgs, { cwd: androidPath });
		return '✓ Started ';
	} catch (e: any) {
		if (
			e &&
			e.stdout &&
			e.stdout.includes('Running multiple emulators with the same AVD')
		) {
			return 'Already running ';
		}

		if (e?.message?.includes("CPU Architecture 'arm'")) {
			window.showErrorMessage(
				'ARM-based Android emulators are not supported in WSL. Please use an x86/x64-based Android Virtual Device instead.',
			);
			return false;
		}

		window.showErrorMessage(
			`Error running your Android emulator! Emulator path: ${executable}`,
		);
		return false;
	}
};
