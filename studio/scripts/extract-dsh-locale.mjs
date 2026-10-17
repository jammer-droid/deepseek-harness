/**
 * Extract DSH Client locale dictionaries (namespace → key → en/zh) from one git ref, without
 * running DSH code. Every `locale.register(ns, dicts)` / `*.locale.register(ns, dicts)` / `register(ns, locale, dict)` call under
 * the scanned roots is resolved statically: string constants, object literals, spreads, `satisfies`
 * and `as` wrappers, and relative ESM imports. Anything else is reported as unresolved.
 *
 * Usage: node studio/scripts/extract-dsh-locale.mjs <git-ref> [--out <file>]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOTS = ['packages/client', 'packages/extensions', 'packages/session-query', 'packages/experimental'];
const SKIP = /(^|\/)(test|tests|__tests__)\/|\.(test|spec)\.tsx?$|\.d\.ts$/;

export function extract(ref, git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 })) {
  const sources = new Map();
  const read = file => {
    if (!sources.has(file)) {
      let text;
      try { text = git(['show', `${ref}:${file}`]); } catch { text = undefined; }
      sources.set(file, text === undefined ? undefined : ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS));
    }
    return sources.get(file);
  };
  const files = git(['ls-tree', '-r', '--name-only', ref, '--', ...ROOTS]).split('\n')
    .filter(file => /\/src\/.*\.tsx?$/.test(file) && !SKIP.test(file));
  const candidates = git(['grep', '-l', '-E', '(^|[^A-Za-z0-9_])locale\\.register\\(', ref, '--', ...ROOTS]).split('\n').filter(Boolean)
    .map(line => line.slice(ref.length + 1)).filter(file => files.includes(file));

  const unwrap = node => {
    while (node && (ts.isSatisfiesExpression?.(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isTypeAssertionExpression?.(node))) node = node.expression;
    return node;
  };
  /** Find a top-level binding in `file` and return the expression it denotes. */
  const lookup = (file, name, depth = 0) => {
    if (depth > 8) throw new Error(`import depth exceeded for ${name}`);
    const sf = read(file);
    if (!sf) throw new Error(`missing file ${file}`);
    for (const statement of sf.statements) {
      if (ts.isVariableStatement(statement)) {
        for (const decl of statement.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.name.text === name && decl.initializer) return { file, node: decl.initializer };
        }
      }
      if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings) && !statement.importClause.isTypeOnly) {
        for (const element of statement.importClause.namedBindings.elements) {
          if (element.name.text !== name) continue;
          const target = resolveModule(file, statement.moduleSpecifier.text);
          return lookup(target, element.propertyName?.text ?? name, depth + 1);
        }
      }
      if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause) && statement.moduleSpecifier) {
        for (const element of statement.exportClause.elements) {
          if (element.name.text !== name) continue;
          return lookup(resolveModule(file, statement.moduleSpecifier.text), element.propertyName?.text ?? name, depth + 1);
        }
      }
    }
    throw new Error(`cannot resolve ${name} in ${file}`);
  };
  const resolveModule = (from, spec) => {
    if (!spec.startsWith('.')) throw new Error(`non-relative import ${spec} from ${from}`);
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
    for (const candidate of [base, base.replace(/\.js$/, '.ts'), `${base}.ts`, `${base}/index.ts`]) if (read(candidate)) return candidate;
    throw new Error(`cannot find module ${spec} from ${from}`);
  };
  const evaluate = (file, node, scope = new Map()) => {
    node = unwrap(node);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isIdentifier(node)) {
      if (scope.has(node.text)) return scope.get(node.text);
      const found = lookup(file, node.text);
      return evaluate(found.file, found.node);
    }
    if (ts.isObjectLiteralExpression(node)) {
      const out = {};
      for (const prop of node.properties) {
        if (ts.isSpreadAssignment(prop)) { Object.assign(out, evaluate(file, prop.expression, scope)); continue; }
        if (ts.isShorthandPropertyAssignment(prop)) { out[prop.name.text] = evaluate(file, prop.name, scope); continue; }
        if (!ts.isPropertyAssignment(prop)) throw new Error(`unsupported property in ${file}`);
        const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name) ? prop.name.text : undefined;
        if (key === undefined) throw new Error(`computed key in ${file}`);
        out[key] = evaluate(file, prop.initializer, scope);
      }
      return out;
    }
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(element => evaluate(file, element, scope));
    // `[...].join(separator)`: multi-paragraph copy assembled from string parts.
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'join' && node.arguments.length <= 1) {
      const parts = evaluate(file, node.expression.expression, scope);
      if (!Array.isArray(parts) || parts.some(part => typeof part !== 'string')) throw new Error(`join over non-string array in ${file}`);
      return parts.join(node.arguments.length ? evaluate(file, node.arguments[0], scope) : ',');
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) return evaluate(file, node.left, scope) + evaluate(file, node.right, scope);
    throw new Error(`unsupported expression ${ts.SyntaxKind[node.kind]} in ${file}:${node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
  };
  /** Inside a function body, resolve a local `const` before falling back to module scope. */
  const localScope = (file, call) => {
    const scope = new Map();
    for (let parent = call.parent; parent && !ts.isSourceFile(parent); parent = parent.parent) {
      if (!ts.isBlock(parent)) continue;
      for (const statement of parent.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const decl of statement.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name) || !decl.initializer || scope.has(decl.name.text)) continue;
          try { scope.set(decl.name.text, evaluate(file, decl.initializer, scope)); } catch { /* not a static value */ }
        }
      }
    }
    return scope;
  };

  const namespaces = {};
  const unresolved = [];
  const add = (ns, locale, dict, site) => {
    const entry = namespaces[ns] ??= { sites: [], keys: {} };
    if (!entry.sites.includes(site)) entry.sites.push(site);
    for (const [key, value] of Object.entries(dict)) {
      if (typeof value !== 'string') throw new Error(`non-string value ${ns}.${key}`);
      (entry.keys[key] ??= {})[locale] = value;
    }
  };
  for (const file of candidates) {
    const sf = read(file);
    const visit = node => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'register'
        && ((ts.isPropertyAccessExpression(node.expression.expression) && node.expression.expression.name.text === 'locale')
          || (ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'locale'))) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const site = `${file}:${line}`;
        try {
          const scope = localScope(file, node);
          const ns = evaluate(file, node.arguments[0], scope);
          if (typeof ns !== 'string') throw new Error('namespace is not a string');
          if (node.arguments.length === 3) {
            const locale = ts.isIdentifier(unwrap(node.arguments[1])) ? undefined : evaluate(file, node.arguments[1], scope);
            if (locale === undefined) {
              // `for (const [locale, dict] of dictionaries) register(ns, locale, dict)`: evaluate the iterated pairs.
              let loop = node.parent;
              while (loop && !ts.isForOfStatement(loop)) loop = loop.parent;
              if (!loop) throw new Error('dynamic locale argument');
              for (const [id, dict] of evaluate(file, loop.expression, scope)) add(ns, id, dict, site);
            } else add(ns, locale, evaluate(file, node.arguments[2], scope), site);
          } else {
            const dicts = evaluate(file, node.arguments[1], scope);
            for (const [locale, dict] of Object.entries(dicts)) add(ns, locale, dict, site);
          }
        } catch (error) { unresolved.push({ site, error: error.message }); }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  const sorted = Object.fromEntries(Object.keys(namespaces).sort().map(ns => [ns, {
    sites: namespaces[ns].sites.sort(),
    keys: Object.fromEntries(Object.keys(namespaces[ns].keys).sort().map(key => [key, namespaces[ns].keys[key]])),
  }]));
  return { ref, commit: git(['rev-parse', '--short', `${ref}^{commit}`]).trim(), namespaces: sorted, unresolved };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [ref, flag, out] = process.argv.slice(2);
  if (!ref || (flag && flag !== '--out')) { console.error('Usage: extract-dsh-locale.mjs <git-ref> [--out <file>]'); process.exit(2); }
  const result = extract(ref);
  const keys = Object.values(result.namespaces).reduce((sum, ns) => sum + Object.keys(ns.keys).length, 0);
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (out) { mkdirSync(path.dirname(out), { recursive: true }); writeFileSync(out, json); } else process.stdout.write(json);
  console.error(`${ref} (${result.commit}): ${Object.keys(result.namespaces).length} namespaces, ${keys} keys, ${result.unresolved.length} unresolved`);
  for (const item of result.unresolved) console.error(`  unresolved ${item.site}: ${item.error}`);
}
