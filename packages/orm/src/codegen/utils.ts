import path from 'path';

export const getImportPath = (from: string, to: string) => {
  const rel = path
    .relative(path.dirname(from), to)
    .split(path.sep)
    .join(path.posix.sep);

  const importPath =
    rel.startsWith('./') || rel.startsWith('../') ? rel : `./${rel}`;

  return importPath.replace(/\.[tj]s$/, '');
};
