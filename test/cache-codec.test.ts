import {expect,test} from "bun:test";
import {serializeCachedData,deserializeCachedData} from "../lib/cache/codec";

test("persisted cache preserves database dates and nested content",()=>{
 const value={date:new Date('2026-09-16T00:00:00Z'),nested:[{date:new Date('2020-01-01T00:00:00Z'),metadata:{'$cs35Date':'user content'},empty:undefined}],amount:'0.000123456789',nil:null};
 const copy=deserializeCachedData<typeof value>(serializeCachedData(value));
 expect(copy).toEqual(value);expect(copy.date).toBeInstanceOf(Date);
 expect(copy.nested[0]!.date.toISOString()).toBe('2020-01-01T00:00:00.000Z');
});
