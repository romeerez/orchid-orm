import tag from 'tagged-tag';

interface Brand<Token extends PropertyKey> {
  readonly [tag]: { [K in Token]: never };
}

export type Branded<Type, Token extends PropertyKey> = Type & Brand<Token>;

type BrandColumnKey = '__inputType' | '__outputType' | '__queryType';

type BrandToken<
  Token extends PropertyKey,
  ColumnToken extends true | string,
> = string extends ColumnToken
  ? Token
  : ColumnToken extends string
    ? ColumnToken
    : Token;

export type BrandColumn<Column, Token extends PropertyKey> = Column extends {
  data: { branded: infer ColumnToken extends true | string };
}
  ? {
      [K in keyof Column]: K extends BrandColumnKey
        ? Branded<Column[K], BrandToken<Token, ColumnToken>>
        : Column[K];
    }
  : Column;

export type BrandColumnsShape<Shape, Table extends string | undefined> = {
  [K in keyof Shape]: BrandColumn<Shape[K], `${Table}.${K & string}`>;
};
