import path from 'path';

export const getImportPath = (from: string, to: string) => {
  const rel = path.posix.relative(path.dirname(from), to);
  const importPath =
    rel.startsWith('./') || rel.startsWith('../') ? rel : `./${rel}`;
  return importPath.replace(/\.[tj]s$/, '');
};
