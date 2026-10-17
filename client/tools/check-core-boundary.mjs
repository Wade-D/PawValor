import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function sourceScope(file) {
  for (let directory = dirname(file); dirname(directory) !== directory; directory = dirname(directory)) {
    const name = directory.slice(directory.lastIndexOf(sep) + 1);
    if ((name === 'core' || name === 'config') && dirname(directory).endsWith(`${sep}assets${sep}scripts`)) {
      return { name, root: directory, scripts: dirname(directory) };
    }
  }
  return undefined;
}

function isWithin(root, file) {
  const path = relative(root, file);
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function resolveDependency(file, specifier) {
  const base = resolve(dirname(file), specifier);
  const sourceBase = base.replace(/\.(?:js|mjs|cjs)$/, '');
  const candidates = [base, `${sourceBase}.ts`, `${sourceBase}.tsx`, `${sourceBase}.d.ts`, join(base, 'index.ts'), join(base, 'index.d.ts')];
  return candidates.find((candidate) => /\.(?:ts|tsx)$/.test(candidate) && existsSync(candidate) && statSync(candidate).isFile());
}

/** Check core/config source dependencies, including reachable internal modules. */
export function checkCoreBoundary(sourceFiles) {
  const diagnostics = [];
  const visited = new Set();

  function visitFile(input) {
    const file = resolve(input);
    if (visited.has(file)) return;
    visited.add(file);
    const scope = sourceScope(file);
    if (!scope) {
      diagnostics.push(`${file}: source must be inside assets/scripts/core or assets/scripts/config`);
      return;
    }

    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (error) {
      diagnostics.push(`${file}: cannot read source: ${error.message}`);
      return;
    }
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2020, true);
    function report(node, message) {
      const position = typeof node === 'number' ? node : node.getStart(source);
      const { line, character } = source.getLineAndCharacterOfPosition(position);
      diagnostics.push(`${file}:${line + 1}:${character + 1}: ${message}`);
    }
    for (const error of source.parseDiagnostics) {
      report(error.start ?? 0, `invalid TypeScript: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`);
    }
    for (const reference of [...source.referencedFiles, ...source.typeReferenceDirectives, ...source.libReferenceDirectives]) {
      report(reference.pos, `triple-slash dependency reference is forbidden: ${reference.fileName}`);
    }

    function dependency(node) {
      const specifier = node.text;
      if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
        report(node, `external import is forbidden: ${specifier}`);
        return;
      }
      const lexicalTarget = resolve(dirname(file), specifier);
      const allowedRoots = scope.name === 'core' ? [scope.root] : [join(scope.scripts, 'core'), scope.root];
      if (!allowedRoots.some((root) => isWithin(root, lexicalTarget))) {
        report(node, `dependency is outside allowed ${scope.name} directories: ${specifier}`);
        return;
      }
      const target = resolveDependency(file, specifier);
      if (!target) {
        report(node, `unresolved internal dependency: ${specifier}`);
        return;
      }
      if (!allowedRoots.some((root) => existsSync(root) && isWithin(realpathSync(root), realpathSync(target)))) {
        report(node, `dependency is outside allowed ${scope.name} directories: ${specifier}`);
        return;
      }
      visitFile(target);
    }

    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        dependency(node.moduleSpecifier);
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
        dependency(node.argument.literal);
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        report(node, 'require/import-equals dependency is forbidden');
      } else if (ts.isCallExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) report(node, 'dynamic import is forbidden');
        if (ts.isIdentifier(node.expression) && node.expression.text === 'require') report(node, 'require is forbidden');
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }

  for (const file of sourceFiles) visitFile(file);
  return diagnostics;
}

function collectSources(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? collectSources(file) : /\.(?:ts|tsx)$/.test(file) ? [file] : [];
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const supplied = process.argv.slice(2);
  const files = supplied.length ? supplied : [
    ...collectSources(resolve('assets/scripts/core')),
    ...collectSources(resolve('assets/scripts/config')),
  ];
  const diagnostics = checkCoreBoundary(files);
  if (diagnostics.length) {
    console.error(diagnostics.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`Core boundary check passed (${files.length} source files).`);
  }
}
