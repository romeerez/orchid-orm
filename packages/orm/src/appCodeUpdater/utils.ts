import path from 'path';

export const getRelativePath = (from: string, to: string) => {
  const rel = path.relative(path.dirname(from), to);
  return rel.startsWith('./') || rel.startsWith('../') ? rel : `./${rel}`;
};

export const getImportPath = (from: string, to: string) => {
  return getRelativePath(from, to).replace(/\.[tj]s$/, '');
};
