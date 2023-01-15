export const toPascalCase = (s: string) => {
  const words = s.match(/(\w)(\w*)/g) || [];
  return words.map((word) => word[0].toUpperCase() + word.slice(1)).join('');
};

export const toCamelCase = (s: string) => {
  const pascal = toPascalCase(s);
  return pascal[0].toLowerCase() + pascal.slice(1);
};
