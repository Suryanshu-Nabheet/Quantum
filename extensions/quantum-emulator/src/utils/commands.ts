import { exec, type ExecOptions } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function runCmd(command: string, options: ExecOptions = {}): Promise<string> {
	const { stdout } = await execAsync(command, options);
	return stdout.toString();
}
