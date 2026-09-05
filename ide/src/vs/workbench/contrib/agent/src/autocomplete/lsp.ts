import type {
  DocumentSymbol,
  RangeInFile,
  SignatureHelp,
} from "core";
import * as vscode from "vscode";

type GotoProviderName =
  | "vscode.executeDefinitionProvider"
  | "vscode.executeTypeDefinitionProvider"
  | "vscode.executeDeclarationProvider"
  | "vscode.executeImplementationProvider"
  | "vscode.executeReferenceProvider";

type SignatureHelpProviderName = "vscode.executeSignatureHelpProvider";
type SymbolProviderName = "vscode.executeDocumentSymbolProvider";

interface GotoInput {
  uri: vscode.Uri;
  line: number;
  character: number;
  name: GotoProviderName;
}

interface SignatureHelpInput {
  uri: vscode.Uri;
  line: number;
  character: number;
  name: SignatureHelpProviderName;
}

interface SymbolInput {
  uri: vscode.Uri;
  name: SymbolProviderName;
}

const MAX_GOTO_CACHE_SIZE = 500;
const MAX_SYMBOL_CACHE_SIZE = 100;

const gotoCache = new Map<string, RangeInFile[]>();
const signatureHelpCache = new Map<string, vscode.SignatureHelp>();
const symbolCache = new Map<string, DocumentSymbol[]>();

function boundedSet<K, V>(cache: Map<K, V>, key: K, value: V, maxSize: number) {
  if (cache.size >= maxSize) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, value);
}

export async function executeGotoProvider(
  input: GotoInput,
): Promise<RangeInFile[]> {
  const cacheKey = `${input.name}:${input.uri.toString()}:${input.line}:${input.character}`;
  const cached = gotoCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const definitions = (await vscode.commands.executeCommand(
      input.name,
      input.uri,
      new vscode.Position(input.line, input.character),
    )) as any[] | undefined;

    const results = (definitions ?? [])
      .filter((item) => (item.targetUri || item.uri) && (item.targetRange || item.range))
      .map((item) => ({
        filepath: (item.targetUri || item.uri).toString(),
        range: item.targetRange || item.range,
      }));

    boundedSet(gotoCache, cacheKey, results, MAX_GOTO_CACHE_SIZE);
    return results;
  } catch (e) {
    console.warn(`Error executing ${input.name}:`, e);
    return [];
  }
}

export async function executeSignatureHelpProvider(
  input: SignatureHelpInput,
): Promise<SignatureHelp | null> {
  const cacheKey = `${input.name}:${input.uri.toString()}:${input.line}:${input.character}`;
  const cached = signatureHelpCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const signatureHelp = (await vscode.commands.executeCommand(
      input.name,
      input.uri,
      new vscode.Position(input.line, input.character),
    )) as vscode.SignatureHelp;

    boundedSet(
      signatureHelpCache,
      cacheKey,
      signatureHelp,
      MAX_GOTO_CACHE_SIZE,
    );
    return signatureHelp;
  } catch (e) {
    console.warn(`Error executing ${input.name}:`, e);
    return null;
  }
}

export async function executeSymbolProvider(
  input: SymbolInput,
): Promise<DocumentSymbol[]> {
  const cacheKey = `${input.name}:${input.uri.toString()}`;
  const cached = symbolCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const symbols = (await vscode.commands.executeCommand(
      input.name,
      input.uri,
    )) as vscode.DocumentSymbol[] | undefined;
    const results = collectSymbols(symbols ?? []);

    boundedSet(symbolCache, cacheKey, results, MAX_SYMBOL_CACHE_SIZE);
    return results;
  } catch (e) {
    console.warn(`Error executing ${input.name}:`, e);
    return [];
  }
}

function collectSymbols(symbols: vscode.DocumentSymbol[]): DocumentSymbol[] {
  const results: DocumentSymbol[] = [];
  for (const symbol of symbols) {
    results.push({
      name: symbol.name,
      range: symbol.range,
      selectionRange: symbol.selectionRange,
      kind: symbol.kind,
    });
    if (symbol.children.length > 0) {
      results.push(...collectSymbols(symbol.children));
    }
  }
  return results;
}
