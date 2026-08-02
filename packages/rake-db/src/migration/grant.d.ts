import { Grant as PqbGrant } from 'pqb/internal';
import { Migration } from './migration';
export type RevokeMode = 'CASCADE' | 'RESTRICT';
export type GrantMigrationArg = PqbGrant.Privilege & {
    revokeMode?: RevokeMode;
};
export interface GrantPrivilege extends PqbGrant.InternalPrivilege {
    action: 'grant' | 'revoke';
    revokeMode?: RevokeMode;
}
export declare const changeGrant: (migration: Migration, up: boolean, params: GrantMigrationArg) => Promise<void>;
