import { State } from '@aldinh777/reactive/state/State';
import RDBError from '../error/RDBError';
import RDBTable from './RDBTable';

export interface DBListeners {
    tableRename: ((oldname: string, newname: string) => void)[];
    tableCreate: ((name: string, table: RDBTable) => void)[];
    tableDrop: ((name: string, table: RDBTable) => void)[];
}

export default class RDB {
    private _listeners: DBListeners = { tableRename: [], tableCreate: [], tableDrop: [] };
    private _tables: Map<string, RDBTable> = new Map();
    private _tablenames: WeakMap<RDBTable, string> = new WeakMap();
    private _refwaiters: Map<string, State<RDBTable | string>[]> = new Map();

    createTable(name: string, structure: object): RDBTable {
        if (this._tables.has(name)) {
            throw new RDBError('TABLE_EXISTS', name);
        }
        const table = new RDBTable(this, structure);
        this._tables.set(name, table);
        this._tablenames.set(table, name);
        if (this._refwaiters.has(name)) {
            const waitlist = this._refwaiters.get(name);
            waitlist?.forEach((tableState) => {
                tableState.setValue(table);
            });
            this._refwaiters.delete(name);
        }
        for (const create of this._listeners.tableCreate) {
            create(name, table);
        }
        return table;
    }
    hasTable(name: string): boolean {
        return this._tables.has(name);
    }
    selectTable(name: string): RDBTable {
        const table = this._tables.get(name);
        if (!table) {
            throw new RDBError('TABLE_NOT_EXISTS', name);
        }
        return table;
    }
    dropTable(name: string): void {
        if (!this._tables.has(name)) {
            throw new RDBError('TABLE_DROP_NOT_EXISTS', name);
        }
        const tb = this._tables.get(name) as RDBTable;
        RDBTable.drop(tb);
        this._tablenames.delete(tb);
        this._tables.delete(name);
        for (const drop of this._listeners.tableDrop) {
            drop(name, tb);
        }
    }
    renameTable(oldname: string, newname: string): void {
        if (!this._tables.has(oldname)) {
            throw new RDBError('TABLE_RENAME_NOT_EXISTS', oldname, newname);
        }
        if (this._tables.has(newname)) {
            throw new RDBError('TABLE_CLONE_JUTSU', oldname, newname);
        }
        const tb = this._tables.get(oldname) as RDBTable;
        this._tables.delete(oldname);
        this._tables.set(newname, tb);
        this._tablenames.set(tb, newname);
    }
    getTableName(table: RDBTable): string | undefined {
        return this._tablenames.get(table);
    }
    getTableRefference(name: string): State<RDBTable | string> {
        const table = this._tables.get(name);
        const tableState = new State(name as RDBTable | string);
        if (table) {
            tableState.setValue(table);
        } else {
            if (!this._refwaiters.has(name)) {
                this._refwaiters.set(name, []);
            }
            const waitlist = this._refwaiters.get(name);
            waitlist?.push(tableState);
        }
        return tableState;
    }

    onTableRename(listener: (oldname: string, newname: string) => void): void {
        this._listeners.tableRename.push(listener);
    }
    onTableCreate(listener: (name: string, table: RDBTable) => void): void {
        this._listeners.tableCreate.push(listener);
    }
    onTableDrop(listener: (name: string, table: RDBTable) => void): void {
        this._listeners.tableDrop.push(listener);
    }

    eachTable(callback: (name: string, table: RDBTable) => void): void {
        this._tables.forEach((table, tablename) => callback(tablename, table));
    }
}
