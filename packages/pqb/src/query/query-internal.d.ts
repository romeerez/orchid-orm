import { QueryInternalColumnNameToKey } from './query-columns/query-columns';
import { AsyncLocalStorage } from 'node:async_hooks';
import { RecordUnknown } from '../utils';
import { TableData } from '../tableData';
import { DbDomainArgRecord, DbExtension, GeneratorIgnore, Query } from './query';
import { Rls } from './extra-features/rls/rls.db';
import { AsyncState } from './basic-features/storage/storage';
import { DbRole } from './extra-features/roles/roles';
import { Grant } from './extra-features/grants/grants.db';
import { RawSqlBase } from './expressions/raw-sql';
export interface QueryInternal<SinglePrimaryKey = any, UniqueColumns = any, UniqueColumnNames = any, UniqueColumnTuples = any, UniqueConstraints = any> extends QueryInternalColumnNameToKey {
    runtimeDefaultColumns?: string[];
    asyncStorage: AsyncLocalStorage<AsyncState>;
    scopes?: RecordUnknown;
    snakeCase?: boolean;
    noPrimaryKey: boolean;
    comment?: string;
    readOnly?: boolean;
    materialized?: boolean;
    generatorIgnored?: true;
    primaryKeys?: string[];
    singlePrimaryKey: SinglePrimaryKey;
    uniqueColumns: UniqueColumns;
    uniqueColumnNames: UniqueColumnNames;
    uniqueColumnTuples: UniqueColumnTuples;
    uniqueConstraints: UniqueConstraints;
    extensions?: DbExtension[];
    domains?: DbDomainArgRecord;
    generatorIgnore?: GeneratorIgnore;
    roles?: DbRole[];
    rls?: Rls.Options;
    tableRls?: Rls.TableConfig;
    tableGrants?: Grant.TableClassGrant[];
    viewData?: {
        query?: Query;
        sql?: string | RawSqlBase;
        recursive?: boolean;
        checkOption?: 'LOCAL' | 'CASCADED';
        securityBarrier?: boolean;
        securityInvoker?: boolean;
        withData?: boolean;
    };
    managedRolesSql?: string;
    defaultGrantedBy?: string;
    grants?: Grant.InternalPrivilege[];
    tableData: TableData;
    nowSQL?: string;
    callbackArg?: Query;
    selectAllCount: number;
    /**
     * @see DbSharedOptions
     */
    nestedCreateBatchMax: number;
}
