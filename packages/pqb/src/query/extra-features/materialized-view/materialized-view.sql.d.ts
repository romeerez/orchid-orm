import { SingleSql } from '../../sql/sql';
import { ToSQLQuery } from '../../sql/to-sql';
import { type RefreshMaterializedViewOptions } from './materialized-view.query';
export declare const makeRefreshMaterializedViewSql: (query: ToSQLQuery, options?: RefreshMaterializedViewOptions) => SingleSql;
