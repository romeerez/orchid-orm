// import { assertType, BaseTable, ProfileTable, UserTable } from 'test-utils';
// import { RelationToTableInput } from './relations/relations';
// import { ShallowSimplify } from 'pqb/index';

export * from './orm-table/base-table';
export * from './orm';
export * from './repo';
export * from 'pqb';

// class ProfileWithId extends BaseTable {
//   id = 'profileId' as const;
//   table = 'profile-by-id' as const;
// }
//
// type TC = {
//   profile: typeof ProfileTable;
//   profileWithId: typeof ProfileWithId;
// };
//
// type VC = {
//   user: typeof UserTable;
// };
//
// const notFound = {} as ShallowSimplify<
//   RelationToTableInput<
//     TC,
//     VC,
//     {
//       type: 'string';
//       id: 'not-found';
//       options: {};
//     }
//   >
// >;
// assertType<typeof notFound, false>();
//
// const profileById = {} as ShallowSimplify<
//   RelationToTableInput<
//     TC,
//     VC,
//     {
//       type: 'string';
//       id: 'profileId';
//       options: {};
//     }
//   >
// >;
// assertType<typeof profileById, ProfileWithId>();
//
// const profileByTable = {} as ShallowSimplify<
//   RelationToTableInput<
//     TC,
//     VC,
//     {
//       type: 'string';
//       id: 'profile';
//       options: {};
//     }
//   >
// >;
// assertType<typeof profileByTable, ProfileTable>();
//
// const userByTable = {} as ShallowSimplify<
//   RelationToTableInput<
//     TC,
//     VC,
//     {
//       type: 'string';
//       id: 'user';
//       options: {};
//     }
//   >
// >;
// assertType<typeof userByTable, UserTable>();
